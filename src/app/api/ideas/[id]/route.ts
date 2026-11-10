import { NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { getAdminDb } from "@/lib/firebase-admin";

/**
 * GET /api/ideas/[id]
 * 公開済みのアイデアは誰でも閲覧可能。下書き・レビュー中は投稿者本人のみ閲覧可能。
 * 他の利用者のメールアドレスや本名は含めず、安全なプロフィール情報のみを返します。
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
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
    const isPublicAccessible =
      data?.status === "published" ||
      data?.status === "in_progress" ||
      data?.status === "completed" ||
      Boolean(data?.isSample);

    // 非公開かつサンプルでもないアイデアは投稿者本人のみ読み取り可能
    if (!isPublicAccessible) {
      const authUser = await authenticate(request);
      if (!authUser) {
        return NextResponse.json({ error: "認証が必要です。" }, { status: 401 });
      }
      if (data?.ownerUid !== authUser.uid) {
        return NextResponse.json({ error: "このアイデアに対するアクセス権限がありません。" }, { status: 403 });
      }
    }

    // 投稿者プロフィールの安全な取得（メールアドレス・本名は絶対に返却しない）
    let author = {
      displayName: "HIVEメンバー",
      university: "",
      faculty: "",
      department: "",
      major: "",
    };

    if (data?.ownerUid) {
      const userDoc = await db.collection("users").doc(data.ownerUid).get();
      if (userDoc.exists) {
        const uData = userDoc.data();
        author = {
          displayName: typeof uData?.displayName === "string" ? uData.displayName : "HIVEメンバー",
          university: typeof uData?.university === "string" ? uData.university : "",
          faculty: typeof uData?.faculty === "string" ? uData.faculty : "",
          department: typeof uData?.department === "string" ? uData.department : "",
          major: typeof uData?.major === "string" ? uData.major : "",
        };
      }
    }

    return NextResponse.json({
      id: docSnap.id,
      title: data?.title || data?.result?.title || "プロジェクト",
      goal: data?.goal || data?.result?.goal || "",
      status: data?.status ?? "draft",
      isCompleted: Boolean(data?.isCompleted),
      isSample: Boolean(data?.isSample),
      stages: Array.isArray(data?.stages) ? data.stages : [],
      progressSummaryText: data?.progressSummaryText || null,
      ownerUid: data?.ownerUid,
      rawText: data?.rawText ?? "",
      questions: data?.questions ?? [],
      answers: data?.answers ?? null,
      result: data?.result ?? null,
      createdAt: data?.createdAt?.toDate ? data.createdAt.toDate().toISOString() : null,
      updatedAt: data?.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : null,
      publishedAt: data?.publishedAt?.toDate ? data.publishedAt.toDate().toISOString() : null,
      author,
      aiSuggestions: Array.isArray(data?.aiSuggestions) ? data.aiSuggestions : [],
    });
  } catch (error) {
    console.error("アイデア取得エラー:", error);
    return NextResponse.json({ error: "アイデアの取得中にエラーが発生しました。" }, { status: 500 });
  }
}
