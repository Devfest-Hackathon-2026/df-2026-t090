import { NextResponse } from "next/server";
import { Type } from "@google/genai";
import { authenticate } from "@/lib/auth";
import { getAdminDb, FieldValue } from "@/lib/firebase-admin";
import { getGeminiClient, GEMINI_MODEL } from "@/lib/gemini";
import { checkAndIncrementGeminiUsage, GeminiRateLimitError } from "@/lib/gemini-limiter";

export interface ProjectProgressAiResult {
  progressPercentage: number;  // 0〜100
  stageLabel: string;          // 例: "企画構想期", "チーム結成・要件定義", "試作・実証実験", "成果発表準備"
  summary: string;             // 進捗の客観的要約
  goodPoints: string[];        // 順調に進んでいる点（箇条書き）
  bottlenecks: string[];       // 遅延リスクや不足している点（箇条書き）
  nextActions: string[];       // 次に優先して行うべき具体的な一手（箇条書き）
  scoreWhy: string;            // なぜこの進捗度（%）なのかの論理的根拠（Own the Why）
}

const progressResponseSchema = {
  type: Type.OBJECT,
  properties: {
    progressPercentage: { type: Type.INTEGER },
    stageLabel: { type: Type.STRING },
    summary: { type: Type.STRING },
    goodPoints: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    bottlenecks: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    nextActions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    scoreWhy: { type: Type.STRING },
  },
  required: [
    "progressPercentage",
    "stageLabel",
    "summary",
    "goodPoints",
    "bottlenecks",
    "nextActions",
    "scoreWhy",
  ],
};

/**
 * POST /api/student/projects/[id]/progress-ai
 * プロジェクトのチャット会話・ゴール・メンバー構成からAIが進行度を客観測定
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
    // 1日あたりのAI利用回数制限チェック（40回上限）
    const currentUsage = await checkAndIncrementGeminiUsage(authUser.uid);
    const db = getAdminDb();

    // 1. プロジェクト情報の取得
    const projectDoc = await db.collection("ideas").doc(projectId).get();
    if (!projectDoc.exists) {
      return NextResponse.json({ error: "プロジェクトが見つかりません。" }, { status: 404 });
    }
    const projectData = projectDoc.data();
    const title = projectData?.result?.title || projectData?.title || "プロジェクト";
    const goal = projectData?.result?.goal || projectData?.goal || "";
    const firstSteps = projectData?.result?.firstSteps || [];

    // 2. チャット履歴の取得（最新30件）
    const messagesSnap = await db
      .collection("ideas")
      .doc(projectId)
      .collection("messages")
      .orderBy("createdAt", "desc")
      .limit(30)
      .get();

    const recentMessages = messagesSnap.docs.reverse().map((d) => {
      const data = d.data();
      return `[${data.senderName} (${data.senderRole})]: ${data.text} ${data.isAnnouncement ? "(全体連絡)" : ""}`;
    });

    // 3. 参加メンバー一覧の取得
    const membersSnap = await db
      .collection("ideas")
      .doc(projectId)
      .collection("members")
      .get();
    const membersList = membersSnap.docs.map((d) => {
      const data = d.data();
      return `${data.displayName} (${data.schoolName} / 担当: ${data.roleName})`;
    });

    // 4. Geminiプロンプトの構成
    const ai = getGeminiClient();
    const prompt = `あなたは学生向け学際プロジェクトのファシリテーター兼進行アナリストです。
以下の学生プロジェクトについて、ゴール、参加メンバー、最近のチャット発言内容から客観的に【現在のプロジェクト進行度（0〜100%）】を測定し、課題と次の一手を診断してください。

【ハッカソン設計方針】
単にパーセンテージを出すだけでなく、ハッカソンテーマ「Own the Why, Build with Intent」に則り、
「なぜその進捗度と判断したのか（scoreWhy）」を、チャットでの会話の具体例や未達成タスクを根拠にして明確に説明してください。

【プロジェクト概要】
- タイトル: ${title}
- 目標（ゴール）: ${goal}
- 最初の一歩のタスク: ${JSON.stringify(firstSteps)}

【参加メンバー (${membersList.length}名)】
${membersList.join("\n") || "未登録"}

【直近のチャット発言履歴 (${recentMessages.length}件)】
${recentMessages.join("\n") || "チャット履歴なし（チーム結成直後）"}

指示されたJSONスキーマに従い、日本語で分析結果を出力してください。`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: progressResponseSchema,
      },
    });

    const parsed: ProjectProgressAiResult = JSON.parse(response.text || "{}");

    // Firestoreに診断履歴を保存
    await db.collection("ideas").doc(projectId).collection("progress_reports").add({
      ...parsed,
      diagnosedByUid: authUser.uid,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      result: parsed,
      remainingCount: Math.max(0, 40 - currentUsage),
    });
  } catch (error) {
    if (error instanceof GeminiRateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    console.error("AI進行度測定エラー:", error);
    return NextResponse.json(
      { error: "AIによる進行度測定中にエラーが発生しました。" },
      { status: 502 }
    );
  }
}
