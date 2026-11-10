import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getAdminDb, FieldValue } from "@/lib/firebase-admin";
import { recordAuditLog } from "@/lib/audit-logger";

/**
 * GET /api/admin/skills-review
 * 審査待ちのスキル枝一覧を取得
 */
export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if ("response" in guard) {
    return guard.response;
  }

  try {
    const db = getAdminDb();
    const snapshot = await db.collection("user_skills").orderBy("submittedAt", "desc").get();

    const pendingBranches = [];
    for (const doc of snapshot.docs) {
      const data = doc.data();
      // 申請者のプロフィールを取得
      const userDoc = await db.collection("users").doc(data.userId).get();
      const userData = userDoc.exists ? userDoc.data() : null;

      pendingBranches.push({
        id: doc.id,
        userId: data.userId,
        applicantName: userData?.displayName || "学生ユーザー",
        applicantSchool: userData?.schoolName || "未登録大学",
        applicantFaculty: userData?.faculty || "",
        applicantGrade: userData?.grade || "",
        skillId: data.skillId,
        skillName: data.skillName,
        categoryName: data.categoryName,
        status: data.status || "pending",
        level: data.level,
        score: data.score,
        period: data.period,
        evidence: data.evidence || {},
        reviewerComment: data.reviewerComment,
        submittedAt: data.submittedAt?.toDate ? data.submittedAt.toDate().toISOString() : new Date().toISOString(),
      });
    }

    return NextResponse.json({ branches: pendingBranches });
  } catch (error) {
    console.error("スキル審査一覧取得エラー:", error);
    return NextResponse.json({ error: "審査一覧の取得に失敗しました。" }, { status: 500 });
  }
}

/**
 * POST /api/admin/skills-review
 * スキル審査結果の確定（反映／根拠追加お願い／見送り）
 */
export async function POST(request: Request) {
  const guard = await requireAdmin(request);
  if ("response" in guard) {
    return guard.response;
  }

  const currentAdmin = guard.user;

  try {
    const body = await request.json();
    const { branchId, decision, level, score, comment, reason } = body;
    // decision: "approve" (ツリーに反映) | "request_evidence" (根拠追加お願い) | "reject" (見送り)

    if (!branchId || !decision) {
      return NextResponse.json({ error: "パラメータが不足しています。" }, { status: 400 });
    }

    const db = getAdminDb();
    const branchRef = db.collection("user_skills").doc(branchId);
    const branchDoc = await branchRef.get();

    if (!branchDoc.exists) {
      return NextResponse.json({ error: "対象のスキル申請が見つかりません。" }, { status: 404 });
    }

    const branchData = branchDoc.data();
    const skillName = branchData?.skillName || "スキル";

    if (decision === "approve") {
      await branchRef.update({
        status: "verified",
        level: level ? Number(level) : branchData?.level || null,
        score: score || branchData?.score || null,
        reviewerComment: comment || "提出された根拠を確認し、スキル枝として認定しました。",
        reviewedAt: FieldValue.serverTimestamp(),
        reviewerUid: currentAdmin.uid,
      });

      await recordAuditLog({
        adminUid: currentAdmin.uid,
        adminName: currentAdmin.displayName,
        adminEmail: currentAdmin.email,
        actionType: "skill_review",
        actionDetail: `スキル申請「${skillName}」を認定（ツリーに反映）しました`,
        targetType: "user_skill",
        targetId: branchId,
        targetName: skillName,
        reasonAndNotes: reason || comment || "根拠確認済み",
      });

      return NextResponse.json({ message: "スキルを認定し、ツリーに反映しました。" });
    }

    if (decision === "request_evidence") {
      await branchRef.update({
        status: "pending",
        rejectionReason: reason || "根拠の追加をお願いします。",
        reviewerComment: comment || "追加の根拠（レポートや成果物）の提出をお願いします。",
        reviewedAt: FieldValue.serverTimestamp(),
        reviewerUid: currentAdmin.uid,
      });

      await recordAuditLog({
        adminUid: currentAdmin.uid,
        adminName: currentAdmin.displayName,
        adminEmail: currentAdmin.email,
        actionType: "skill_review",
        actionDetail: `スキル申請「${skillName}」に根拠の追加を依頼しました`,
        targetType: "user_skill",
        targetId: branchId,
        targetName: skillName,
        reasonAndNotes: reason || "追加根拠の要請",
      });

      return NextResponse.json({ message: "学生に根拠の追加をお願いしました。" });
    }

    if (decision === "reject") {
      await branchRef.update({
        status: "rejected",
        reviewedAt: FieldValue.serverTimestamp(),
        reviewerUid: currentAdmin.uid,
      });

      await recordAuditLog({
        adminUid: currentAdmin.uid,
        adminName: currentAdmin.displayName,
        adminEmail: currentAdmin.email,
        actionType: "skill_review",
        actionDetail: `スキル申請「${skillName}」を見送りました`,
        targetType: "user_skill",
        targetId: branchId,
        targetName: skillName,
        reasonAndNotes: reason || "審査基準未達",
      });

      return NextResponse.json({ message: "申請を見送りました。" });
    }

    return NextResponse.json({ error: "無効な判定です。" }, { status: 400 });
  } catch (error) {
    console.error("スキル審査確定エラー:", error);
    return NextResponse.json({ error: "処理中にエラーが発生しました。" }, { status: 500 });
  }
}
