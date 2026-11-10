import { NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { getAdminDb } from "@/lib/firebase-admin";

/**
 * GET /api/student/my-projects
 * 自分が提唱している、またはメンバーとして参加しているプロジェクト一覧を取得
 */
export async function GET(request: Request) {
  const authUser = await authenticate(request);
  if (!authUser) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  try {
    const db = getAdminDb();
    const projectsMap = new Map<string, { id: string; name: string; isCompleted: boolean; isOwner: boolean }>();

    // 1. 自分が提唱者のプロジェクト
    const ownedSnap = await db
      .collection("ideas")
      .where("ownerUid", "==", authUser.uid)
      .get();

    for (const doc of ownedSnap.docs) {
      const data = doc.data();
      projectsMap.set(doc.id, {
        id: doc.id,
        name: data?.result?.title || data?.title || "提唱プロジェクト",
        isCompleted: data?.status === "completed",
        isOwner: true,
      });
    }

    // 2. 自分がメンバー登録されているプロジェクト（joinedProjectIdsから検索）
    const userDoc = await db.collection("users").doc(authUser.uid).get();
    const joinedIds: string[] = userDoc.data()?.joinedProjectIds || [];

    for (const pId of joinedIds) {
      if (!projectsMap.has(pId)) {
        const pDoc = await db.collection("ideas").doc(pId).get();
        if (pDoc.exists) {
          const pData = pDoc.data();
          projectsMap.set(pId, {
            id: pId,
            name: pData?.result?.title || pData?.title || "参加プロジェクト",
            isCompleted: pData?.status === "completed",
            isOwner: false,
          });
        }
      }
    }

    const projects = Array.from(projectsMap.values());
    return NextResponse.json({ projects });
  } catch (error) {
    console.error("参加中プロジェクト取得エラー:", error);
    return NextResponse.json({ error: "参加中プロジェクトの取得に失敗しました。" }, { status: 500 });
  }
}
