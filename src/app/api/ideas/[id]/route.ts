import { NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { getAdminDb } from "@/lib/firebase-admin";

/**
 * GET /api/ideas/[id]
 * 投稿者本人だけがアイデアの詳細を読み取ることができます。
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const authUser = await authenticate(request);
  if (!authUser) {
    return NextResponse.json({ error: "認証が必要です。" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "アイデアIDが指定されていません。" }, { status: 400 });
  }

  try {
    const db = getAdminDb();
    const docSnap = await db.collection("ideas").doc(id).get();

    if (!docSnap.exists) {
      return NextResponse.json({ error: "アイデアが見つかりません。" }, { status: 404 });
    }

    const data = docSnap.data();

    // 投稿者本人のみ読み取り可能
    if (data?.ownerUid !== authUser.uid) {
      return NextResponse.json({ error: "このアイデアに対するアクセス権限がありません。" }, { status: 403 });
    }

    return NextResponse.json({
      id: docSnap.id,
      ownerUid: data.ownerUid,
      rawText: data.rawText ?? "",
      questions: data.questions ?? [],
      answers: data.answers ?? null,
      result: data.result ?? null,
      status: data.status ?? "draft",
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : null,
      updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : null,
      publishedAt: data.publishedAt?.toDate ? data.publishedAt.toDate().toISOString() : null,
    });
  } catch (error) {
    console.error("アイデア取得エラー:", error);
    return NextResponse.json({ error: "アイデアの取得中にエラーが発生しました。" }, { status: 500 });
  }
}
