import { NextResponse } from "next/server";
import { getAdminDb, FieldValue } from "@/lib/firebase-admin";

// 代表大学の初期時間割テンプレート（先行登録例）
const DEFAULT_UNIVERSITY_TEMPLATES: Record<
  string,
  Array<{ period: number; startTime: string; endTime: string }>
> = {
  // 東京農工大学
  "school-tuat": [
    { period: 1, startTime: "08:50", endTime: "10:20" },
    { period: 2, startTime: "10:30", endTime: "12:00" },
    { period: 3, startTime: "13:00", endTime: "14:30" },
    { period: 4, startTime: "14:40", endTime: "16:10" },
    { period: 5, startTime: "16:20", endTime: "17:50" },
  ],
  // 東京大学
  "school-utokyo": [
    { period: 1, startTime: "08:30", endTime: "10:15" },
    { period: 2, startTime: "10:25", endTime: "12:10" },
    { period: 3, startTime: "13:00", endTime: "14:45" },
    { period: 4, startTime: "14:55", endTime: "16:40" },
    { period: 5, startTime: "16:50", endTime: "18:35" },
  ],
  // 東京工業大学
  "school-titech": [
    { period: 1, startTime: "08:50", endTime: "10:30" },
    { period: 2, startTime: "10:45", endTime: "12:25" },
    { period: 3, startTime: "13:30", endTime: "15:10" },
    { period: 4, startTime: "15:25", endTime: "17:05" },
    { period: 5, startTime: "17:20", endTime: "19:00" },
  ],
  // 早稲田大学
  "school-waseda": [
    { period: 1, startTime: "09:00", endTime: "10:40" },
    { period: 2, startTime: "10:55", endTime: "12:35" },
    { period: 3, startTime: "13:20", endTime: "15:00" },
    { period: 4, startTime: "15:15", endTime: "16:55" },
    { period: 5, startTime: "17:10", endTime: "18:50" },
  ],
  // 高専（東京高専など）
  "school-tokyo-ct": [
    { period: 1, startTime: "08:50", endTime: "10:20" },
    { period: 2, startTime: "10:30", endTime: "12:00" },
    { period: 3, startTime: "12:50", endTime: "14:20" },
    { period: 4, startTime: "14:30", endTime: "16:00" },
    { period: 5, startTime: "16:10", endTime: "17:40" },
  ],
};

/**
 * GET /api/schools/timetable?schoolId=...
 * 大学の時間割テンプレートを取得（提案用）
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const schoolId = searchParams.get("schoolId");

  if (!schoolId) {
    return NextResponse.json({ template: null, isFirstUser: true });
  }

  try {
    const db = getAdminDb();
    const doc = await db.collection("university_timetables").doc(schoolId).get();

    if (doc.exists) {
      const data = doc.data();
      return NextResponse.json({
        template: data?.periods || null,
        schoolName: data?.schoolName || "",
        isFirstUser: false,
      });
    }

    // デフォルトの登録例がある場合
    if (DEFAULT_UNIVERSITY_TEMPLATES[schoolId]) {
      return NextResponse.json({
        template: DEFAULT_UNIVERSITY_TEMPLATES[schoolId],
        isFirstUser: false,
      });
    }

    // 最初のユーザー（登録例なし）
    return NextResponse.json({
      template: null,
      isFirstUser: true,
    });
  } catch (error) {
    console.error("時間割テンプレート取得エラー:", error);
    return NextResponse.json({ template: null, isFirstUser: true });
  }
}

/**
 * POST /api/schools/timetable
 * ユーザーが設定した時間割を大学の共有テンプレートとして保存
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { schoolId, schoolName, periods, userUid } = body;

    if (!schoolId || !Array.isArray(periods) || periods.length === 0) {
      return NextResponse.json({ error: "パラメータが不足しています。" }, { status: 400 });
    }

    const db = getAdminDb();
    const docRef = db.collection("university_timetables").doc(schoolId);

    await docRef.set(
      {
        schoolId,
        schoolName: schoolName || "",
        periods,
        updatedByUid: userUid || "anonymous",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ message: "大学の時間割テンプレートを更新しました。" });
  } catch (error) {
    console.error("時間割テンプレート保存エラー:", error);
    return NextResponse.json({ error: "保存に失敗しました。" }, { status: 500 });
  }
}
