import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

export interface ProjectMemberResponseItem {
  userId: string;
  displayName: string;
  schoolName: string;
  roleName: string;
  isFacilitator: boolean;
}

/**
 * GET /api/student/projects/[id]/members
 * 指定プロジェクトの参加メンバー一覧を取得（メールアドレスは除外）
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  try {
    const db = getAdminDb();
    const membersSnap = await db
      .collection("ideas")
      .doc(projectId)
      .collection("members")
      .get();

    const members: ProjectMemberResponseItem[] = membersSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        userId: doc.id,
        displayName: data.displayName || "メンバー",
        schoolName: data.schoolName || "",
        roleName: data.roleName || "メンバー",
        isFacilitator: Boolean(data.isFacilitator),
      };
    });

    return NextResponse.json({ members });
  } catch (error) {
    console.error("プロジェクトメンバー取得エラー:", error);
    return NextResponse.json({ error: "メンバー一覧の取得に失敗しました。" }, { status: 500 });
  }
}
