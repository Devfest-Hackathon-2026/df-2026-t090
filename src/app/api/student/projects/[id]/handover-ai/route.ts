import { NextResponse } from "next/server";
import { Type } from "@google/genai";
import { authenticate } from "@/lib/auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { getGeminiClient, GEMINI_MODEL } from "@/lib/gemini";
import { checkAndIncrementGeminiUsage, GeminiRateLimitError } from "@/lib/gemini-limiter";

export interface DecisionItem {
  content: string;   // 決定事項
  reference: string; // 元の発言やファイルへの参照
}

export interface RemainingTaskItem {
  task: string;      // 残りの作業
  deadline: string;  // 目安の締切
  note?: string;     // 引継ぎ先への留意事項
}

export interface HandoverAiSummaryResult {
  targetUserName: string;
  targetUserRole: string;
  currentStatus: string;           // 1. 現在地
  decisions: DecisionItem[];       // 2. 決まったこと（元の発言やファイルへのリンク付き）
  remainingTasks: RemainingTaskItem[]; // 3. 残りの作業と締切
  rawMaterialCount: number;        // 分析に用いた発言・記録件数
}

const handoverResponseSchema = {
  type: Type.OBJECT,
  properties: {
    currentStatus: {
      type: Type.STRING,
      description: "現在地: 当該メンバーが担当していた作業の進捗状況と現在の到達点",
    },
    decisions: {
      type: Type.ARRAY,
      description: "決まったこと: チャットや議論の中で当該メンバーが合意・決定した事項と根拠",
      items: {
        type: Type.OBJECT,
        properties: {
          content: { type: Type.STRING, description: "決定事項の要約" },
          reference: { type: Type.STRING, description: "元の発言日時や参照ファイル名" },
        },
        required: ["content", "reference"],
      },
    },
    remainingTasks: {
      type: Type.ARRAY,
      description: "残りの作業と締切: 次の担当者へ引き継ぐべき未完了タスクと推奨締切",
      items: {
        type: Type.OBJECT,
        properties: {
          task: { type: Type.STRING, description: "残された具体的作業" },
          deadline: { type: Type.STRING, description: "推奨される完了目安期日" },
          note: { type: Type.STRING, description: "引継ぎの際の注意点やアドバイス" },
        },
        required: ["task", "deadline"],
      },
    },
  },
  required: ["currentStatus", "decisions", "remainingTasks"],
};

/**
 * POST /api/student/projects/[id]/handover-ai
 * 離脱予定メンバーの活動記録からGeminiが引継ぎ要約を生成
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await authenticate(request);
  if (!authUser) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  const { id: projectId } = await params;

  try {
    const body = await request.json();
    const { targetUserId } = body;

    if (!targetUserId) {
      return NextResponse.json({ error: "引継ぎ対象のメンバーを指定してください。" }, { status: 400 });
    }

    const db = getAdminDb();

    // 1. プロジェクトおよび対象メンバー情報の取得
    const projectDoc = await db.collection("ideas").doc(projectId).get();
    if (!projectDoc.exists) {
      return NextResponse.json({ error: "プロジェクトが見つかりません。" }, { status: 404 });
    }
    const projectData = projectDoc.data();
    const projectTitle = projectData?.result?.title || projectData?.title || "プロジェクト";
    const projectGoal = projectData?.result?.goal || projectData?.goal || "";

    const memberDoc = await db
      .collection("ideas")
      .doc(projectId)
      .collection("members")
      .doc(targetUserId)
      .get();

    const memberData = memberDoc.exists ? memberDoc.data() : null;
    const targetUserName = memberData?.displayName || "メンバー";
    const targetUserRole = memberData?.roleName || "担当者";

    // 2. 対象メンバーが送信したチャットメッセージの取得
    const messagesSnap = await db
      .collection("ideas")
      .doc(projectId)
      .collection("messages")
      .where("senderUid", "==", targetUserId)
      .orderBy("createdAt", "asc")
      .limit(50)
      .get();

    const memberMessages = messagesSnap.docs.map((doc) => {
      const d = doc.data();
      const timeStr = d.createdAt?.toDate ? d.createdAt.toDate().toLocaleDateString("ja-JP") : "";
      return `[発言日: ${timeStr}] ${d.text} ${d.isAnnouncement ? "(全体連絡)" : ""}`;
    });

    // 3. 【重要仕様】材料のデータがないときはAIを呼ばずに「要約に使える記録がまだありません」と表示
    if (memberMessages.length === 0) {
      return NextResponse.json(
        {
          error: "要約に使える記録がまだありません",
          noData: true,
          targetUserName,
        },
        { status: 400 }
      );
    }

    // 4. 1日あたりのAI利用上限チェック（40回/日）
    const currentUsage = await checkAndIncrementGeminiUsage(authUser.uid);

    // 5. Vertex AI Gemini プロンプトの構成
    const ai = getGeminiClient();
    const prompt = `あなたは学生学際共創プロジェクトの進行役支援AIです。
プロジェクトから一時離脱・交代するメンバー「${targetUserName} (${targetUserRole})」の活動履歴を分析し、
後任のメンバーがスムーズに業務を引き継げるよう、以下の3つの観点で引継ぎ要約を作成してください。

【プロジェクト情報】
- プロジェクト名: ${projectTitle}
- ゴール: ${projectGoal}
- 対象メンバー: ${targetUserName}（担当役割: ${targetUserRole}）

【対象メンバーの活動記録・チャット発言 (${memberMessages.length}件)】
${memberMessages.join("\n")}

【出力要件】
1. 現在地: これまでに到達した進捗と現在のステータスを端的に記述してください。
2. 決まったこと: 議論を通じて決定した事項を箇条書きにし、元の発言日時（例: 発言日: 2026/11/09）を参照として添えてください。
3. 残りの作業と締切: 次のメンバーが引き継ぐべき未完了タスクと推奨目安期日を提示してください。

指示されたJSONスキーマに従い、日本語で出力してください。`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: handoverResponseSchema,
      },
    });

    const parsed = JSON.parse(response.text || "{}");

    const result: HandoverAiSummaryResult = {
      targetUserName,
      targetUserRole,
      currentStatus: parsed.currentStatus || "進行中",
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
      remainingTasks: Array.isArray(parsed.remainingTasks) ? parsed.remainingTasks : [],
      rawMaterialCount: memberMessages.length,
    };

    return NextResponse.json({
      result,
      remainingCount: Math.max(0, 40 - currentUsage),
    });
  } catch (error) {
    if (error instanceof GeminiRateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    console.error("AI引継ぎ要約生成エラー:", error);
    return NextResponse.json(
      { error: "AI引継ぎ要約の生成中にエラーが発生しました。" },
      { status: 502 }
    );
  }
}
