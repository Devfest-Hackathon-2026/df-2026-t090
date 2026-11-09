import { getAdminDb, FieldValue } from "@/lib/firebase-admin";

/**
 * 日本時間（JST）基準の「YYYY-MM-DD」形式の日付文字列を返します。
 */
export function getJSTDateString(date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date).replace(/\//g, "-");
}

export class GeminiRateLimitError extends Error {
  constructor(
    message = "本日のAI機能の利用上限（1日40回）に達しました。明日（日本時間0時以降）再度お試しください。"
  ) {
    super(message);
    this.name = "GeminiRateLimitError";
  }
}

/**
 * ユーザーのGemini利用回数を日本時間基準でチェックし、40回未満であれば+1してトランザクションで保存します。
 * 40回に達している場合はGeminiRateLimitErrorをスローします。
 * users/{uid}のgeminiUsageフィールドに保存され、他フィールドを上書きしないようmergeします。
 */
export async function checkAndIncrementGeminiUsage(uid: string): Promise<number> {
  const db = getAdminDb();
  const userRef = db.collection("users").doc(uid);
  const today = getJSTDateString();

  return await db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    const data = userDoc.data();
    const usage = data?.geminiUsage;

    let count = 0;
    if (usage && usage.date === today && typeof usage.count === "number") {
      count = usage.count;
    }

    if (count >= 40) {
      throw new GeminiRateLimitError();
    }

    const nextCount = count + 1;
    transaction.set(
      userRef,
      {
        geminiUsage: {
          date: today,
          count: nextCount,
          updatedAt: FieldValue.serverTimestamp(),
        },
      },
      { merge: true }
    );

    return nextCount;
  });
}
