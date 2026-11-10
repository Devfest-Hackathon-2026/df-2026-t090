import { NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { getGeminiClient, GEMINI_MODEL } from "@/lib/gemini";
import { checkAndIncrementGeminiUsage, GeminiRateLimitError } from "@/lib/gemini-limiter";

/**
 * POST /api/student/gakuchika-ai
 * 参加プロジェクトの実績からGeminiがガクチカ下書き文章を生成
 */
export async function POST(request: Request) {
  const authUser = await authenticate(request);
  if (!authUser) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json({ error: "プロジェクトを指定してください。" }, { status: 400 });
    }

    const db = getAdminDb();

    // 1. プロジェクト情報の取得
    const projectDoc = await db.collection("ideas").doc(projectId).get();
    if (!projectDoc.exists) {
      return NextResponse.json({ error: "プロジェクトが見つかりません。" }, { status: 404 });
    }

    const projectData = projectDoc.data();
    const projectTitle = projectData?.result?.title || projectData?.title || "プロジェクト";
    const projectGoal = projectData?.result?.goal || projectData?.goal || "";
    const progressText = projectData?.progressSummaryText || "進行中";

    // 2. ユーザーのメンバー情報（役割）の取得
    const memberDoc = await db
      .collection("ideas")
      .doc(projectId)
      .collection("members")
      .doc(authUser.uid)
      .get();

    const memberData = memberDoc.exists ? memberDoc.data() : null;
    const userRole = memberData?.roleName || "プロジェクトメンバー";
    const userName = memberData?.displayName || "学生";

    // 3. ユーザー自身のチャット発言の取得
    const messagesSnap = await db
      .collection("ideas")
      .doc(projectId)
      .collection("messages")
      .where("senderUid", "==", authUser.uid)
      .orderBy("createdAt", "asc")
      .limit(30)
      .get();

    // 4. 【重要仕様】材料の発言がないときはAIを呼ばずに案内を返却
    if (messagesSnap.empty) {
      return NextResponse.json(
        {
          error: "ガクチカ生成に使えるあなたの発言や活動記録がまだありません。プロジェクトのチャットで発言してから再度お試しください。",
          noData: true,
        },
        { status: 400 }
      );
    }

    const userMessages = messagesSnap.docs.map((doc) => {
      const d = doc.data();
      const timeStr = d.createdAt?.toDate ? d.createdAt.toDate().toLocaleDateString("ja-JP") : "";
      return `[${timeStr}] ${d.text}`;
    });

    // 5. ユーザー自身のタスクの取得
    const tasksSnap = await db
      .collection("ideas")
      .doc(projectId)
      .collection("tasks")
      .where("assigneeUid", "==", authUser.uid)
      .limit(20)
      .get();

    const userTasks = tasksSnap.docs.map((doc) => {
      const d = doc.data();
      return `・${d.title} (状態: ${d.status === "completed" ? "完了" : "進行中"})`;
    });

    // 6. 1日あたりのAI利用上限チェック（40回/日）
    const currentUsage = await checkAndIncrementGeminiUsage(authUser.uid);

    // 7. Vertex AI Gemini プロンプトの構成
    const ai = getGeminiClient();
    const prompt = `あなたは就職活動のES（エントリーシート）添削とキャリア支援の専門家です。
以下の学生が大学・高専を越えて取り組んだ学際共創プロジェクトの記録をもとに、
就職活動の面接やESでそのまま使える説得力のある「学生時代に力を入れたこと（ガクチカ）」の下書き文章を作成してください。

【学生情報】
- 氏名: ${userName}
- 担当役割: ${userRole}

【プロジェクト情報】
- タイトル: ${projectTitle}
- ゴール: ${projectGoal}
- 現在の進み具合: ${progressText}

【本人の実際のチャット発言記録 (${userMessages.length}件)】
${userMessages.join("\n")}

【本人の担当タスク (${userTasks.length}件)】
${userTasks.length > 0 ? userTasks.join("\n") : "特記事項なし"}

【文章の構成要件】
1. 結論（何に取り組み、どんな役割を担ったか）
2. 課題・動機（他大学の異なる専門性を持つ仲間と共創する中での壁や課題）
3. 具体的行動（発言記録やタスクに裏打ちされた、本人が実際に行った具体的な工夫・行動）
4. 学び・結果（得られた成果と、社会に出てどう活かせるか）
※ 文字数は400字〜500字程度で、自然で熱意の伝わる敬体（です・ます調）で記述してください。タイトルや見出しは付けず、本文のみを出力してください。`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
    });

    const gakuchikaText = (response.text || "").trim();

    return NextResponse.json({
      gakuchikaText,
      remainingCount: Math.max(0, 40 - currentUsage),
    });
  } catch (error) {
    if (error instanceof GeminiRateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    console.error("AIガクチカ生成エラー:", error);
    return NextResponse.json(
      { error: "AIによるガクチカ生成中にエラーが発生しました。" },
      { status: 502 }
    );
  }
}
