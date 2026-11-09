import { NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { getAdminDb, FieldValue } from "@/lib/firebase-admin";

/**
 * POST /api/ideas/[id]/publish
 * 投稿者本人だけが実行可能。アイデアのstatusを「published」にしてpublishedAtを保存します。
 */
export async function POST(
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

  const db = getAdminDb();
  const docRef = db.collection("ideas").doc(id);

  try {
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return NextResponse.json({ error: "アイデアが見つかりません。" }, { status: 404 });
    }

    const data = docSnap.data();

    // 投稿者本人のみ公開可能
    if (data?.ownerUid !== authUser.uid) {
      return NextResponse.json({ error: "このアイデアに対する公開権限がありません。" }, { status: 403 });
    }

    // statusをpublishedにし、publishedAtを保存
    // 保存項目は ownerUid, rawText, questions, answers, result, status, createdAt, updatedAt, publishedAt のみ
    await docRef.update({
      status: "published",
      publishedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      message: "アイデアを公開しました。",
      status: "published",
    });
  } catch (error) {
    console.error("アイデア公開エラー:", error);
    return NextResponse.json({ error: "アイデアの公開中にエラーが発生しました。" }, { status: 500 });
  }
}
