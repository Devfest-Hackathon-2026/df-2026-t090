import { NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { getAdminDb, FieldValue } from "@/lib/firebase-admin";
import { UserSkillBranch } from "@/lib/types/hive";

/**
 * GET /api/student/skills?userId=...
 * スキルツリー上の枝一覧を取得（自分または他ユーザー）
 */
export async function GET(request: Request) {
  const authUser = await authenticate(request);
  const { searchParams } = new URL(request.url);
  const targetUserId = searchParams.get("userId") || authUser?.uid;

  if (!targetUserId) {
    return NextResponse.json({ error: "ユーザーIDが指定されていません。" }, { status: 400 });
  }

  try {
    const db = getAdminDb();
    const snapshot = await db
      .collection("user_skills")
      .where("userId", "==", targetUserId)
      .get();

    const branches: UserSkillBranch[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId,
        skillId: data.skillId,
        skillName: data.skillName,
        categoryId: data.categoryId || "cat-other",
        categoryName: data.categoryName || "その他",
        status: data.status || "verified",
        level: data.level || undefined,
        score: data.score || undefined,
        period: data.period || undefined,
        evidence: data.evidence || {
          evidenceType: "experience",
          description: "",
          fileUrls: [],
          links: [],
        },
        reviewerComment: data.reviewerComment || undefined,
        submittedAt: data.submittedAt?.toDate ? data.submittedAt.toDate().toISOString() : new Date().toISOString(),
        reviewedAt: data.reviewedAt?.toDate ? data.reviewedAt.toDate().toISOString() : undefined,
      };
    });

    return NextResponse.json({ branches });
  } catch (error) {
    console.error("スキル枝取得エラー:", error);
    return NextResponse.json({ error: "スキル枝の取得に失敗しました。" }, { status: 500 });
  }
}

/**
 * POST /api/student/skills
 * スキル枝の審査申請（W05）
 */
export async function POST(request: Request) {
  const authUser = await authenticate(request);
  if (!authUser) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { skillId, skillName, categoryId, categoryName, level, score, period, description, evidenceType = "experience", linkUrl } = body;

    if (!skillName || !categoryId) {
      return NextResponse.json({ error: "スキル名と分野は必須です。" }, { status: 400 });
    }

    const db = getAdminDb();
    const docId = `${authUser.uid}_${skillId || Date.now()}`;
    const branchRef = db.collection("user_skills").doc(docId);

    await branchRef.set({
      userId: authUser.uid,
      skillId: skillId || `custom-${Date.now()}`,
      skillName: skillName.trim(),
      categoryId,
      categoryName: categoryName || "専門スキル",
      status: "pending", // 運営の審査待ち
      level: level ? Number(level) : null,
      score: score || null,
      period: period || null,
      evidence: {
        evidenceType,
        description: (description || "").trim(),
        fileUrls: [],
        links: linkUrl ? [linkUrl.trim()] : [],
      },
      submittedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      message: "スキルの審査申請を提出しました。運営が3日以内に審査します。",
      branchId: docId,
    });
  } catch (error) {
    console.error("スキル申請エラー:", error);
    return NextResponse.json({ error: "スキル申請の送信に失敗しました。" }, { status: 500 });
  }
}
