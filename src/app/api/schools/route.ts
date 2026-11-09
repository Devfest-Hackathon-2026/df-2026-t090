import { NextResponse } from "next/server";
import { getAdminDb, FieldValue } from "@/lib/firebase-admin";

/**
 * GET /api/schools
 * 全学校マスターの一覧取得およびキーワード検索（一般学生・未ログインでも利用可能）
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") || "").trim().toLowerCase();

  try {
    const db = getAdminDb();
    const snapshot = await db.collection("schools_master").get();

    let schools = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || "",
        type: data.type || "university",
        prefecture: data.prefecture || "",
        registeredUsersCount: data.registeredUsersCount || 0,
      };
    });

    if (query) {
      const isKosenSearch = query.includes("高専");
      schools = schools.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.prefecture.toLowerCase().includes(query) ||
          (isKosenSearch && s.type === "kosen") ||
          (isKosenSearch && s.name.includes("高等専門学校"))
      );
    }

    return NextResponse.json({ schools });
  } catch (error) {
    console.error("学校一覧取得エラー:", error);
    return NextResponse.json({ error: "学校一覧の取得に失敗しました。" }, { status: 500 });
  }
}

/**
 * POST /api/schools/request
 * 一覧にない学校の追加依頼（学生からのリクエスト受付）
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const requestedName = (body.schoolName || "").trim();
    const userUid = body.userUid || "anonymous";

    if (!requestedName) {
      return NextResponse.json({ error: "学校名を入力してください。" }, { status: 400 });
    }

    const db = getAdminDb();
    // 既存のリクエストがあるか検索（同じ学校名へのリクエストを集計）
    const existingSnap = await db
      .collection("school_requests")
      .where("requestedName", "==", requestedName)
      .where("status", "==", "pending")
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      const doc = existingSnap.docs[0];
      await doc.ref.update({
        requestCount: FieldValue.increment(1),
        requesterUids: FieldValue.arrayUnion(userUid),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({
        message: "学校の追加依頼を受け付けました（希望者数に追加されました）。",
        requestId: doc.id,
      });
    }

    const newRef = db.collection("school_requests").doc();
    await newRef.set({
      requestedName,
      requestCount: 1,
      requesterUids: [userUid],
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      message: "学校の追加依頼を受け付けました。運営が確認後マスターに登録されます。",
      requestId: newRef.id,
    });
  } catch (error) {
    console.error("学校追加依頼エラー:", error);
    return NextResponse.json({ error: "依頼の送信に失敗しました。" }, { status: 500 });
  }
}
