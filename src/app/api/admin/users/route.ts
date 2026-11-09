import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getAdminDb, FieldValue } from "@/lib/firebase-admin";
import { recordAuditLog } from "@/lib/audit-logger";

/**
 * GET /api/admin/users
 * 利用者一覧の取得、集計、検索・絞り込み
 */
export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if ("response" in guard) {
    return guard.response;
  }

  const { searchParams } = new URL(request.url);
  const keyword = (searchParams.get("keyword") || "").trim().toLowerCase();
  const roleFilter = searchParams.get("role") || "all"; // all, student, admin
  const statusFilter = searchParams.get("status") || "all"; // all, active, suspended

  try {
    const db = getAdminDb();
    const usersSnapshot = await db.collection("users").get();

    let totalUsers = 0;
    let adminCount = 0;
    const uniqueSchools = new Set<string>();

    const usersList = [];

    for (const doc of usersSnapshot.docs) {
      const data = doc.data();
      const roles: string[] = Array.isArray(data?.roles) ? data.roles : ["student"];
      const isAdmin = roles.includes("admin");
      const status = data?.status === "suspended" ? "suspended" : "active";
      const schoolName = data?.schoolName || "未登録";

      totalUsers += 1;
      if (isAdmin) adminCount += 1;
      if (data?.schoolId) uniqueSchools.add(data.schoolId);

      // 絞り込み判定
      if (roleFilter === "admin" && !isAdmin) continue;
      if (roleFilter === "student" && isAdmin) continue;
      if (statusFilter !== "all" && status !== statusFilter) continue;

      // キーワード検索（名前、メール、学校）
      if (keyword) {
        const dName = (data?.displayName || "").toLowerCase();
        const email = (data?.email || "").toLowerCase();
        const sName = schoolName.toLowerCase();
        if (!dName.includes(keyword) && !email.includes(keyword) && !sName.includes(keyword)) {
          continue;
        }
      }

      usersList.push({
        uid: doc.id,
        displayName: data?.displayName || "ユーザー",
        email: data?.email || "",
        schoolName,
        faculty: data?.faculty || "",
        department: data?.department || "",
        grade: data?.grade || "",
        roles,
        isAdmin,
        status,
        branchesCount: 0, // スキル枝数
        projectsCount: 0, // 参加プロジェクト数
        lastLoginAt: data?.lastLoginAt?.toDate ? data.lastLoginAt.toDate().toISOString() : null,
        createdAt: data?.createdAt?.toDate ? data.createdAt.toDate().toISOString() : null,
      });
    }

    return NextResponse.json({
      metrics: {
        totalUsers,
        totalSchools: uniqueSchools.size,
        adminCount,
      },
      users: usersList,
    });
  } catch (error) {
    console.error("利用者一覧取得エラー:", error);
    return NextResponse.json({ error: "利用者一覧の取得に失敗しました。" }, { status: 500 });
  }
}

/**
 * POST /api/admin/users
 * 運営の印の付け外し / 利用停止
 * 仕様書厳守: 「運営の印は運営どうしで付け外しできるが、自分の印は外せない」
 */
export async function POST(request: Request) {
  const guard = await requireAdmin(request);
  if ("response" in guard) {
    return guard.response;
  }

  const currentAdmin = guard.user;

  try {
    const body = await request.json();
    const { targetUid, action, reason } = body;

    if (!targetUid || !action) {
      return NextResponse.json({ error: "パラメータが不足しています。" }, { status: 400 });
    }

    const db = getAdminDb();
    const targetRef = db.collection("users").doc(targetUid);
    const targetDoc = await targetRef.get();

    if (!targetDoc.exists) {
      return NextResponse.json({ error: "対象の利用者が見つかりません。" }, { status: 404 });
    }

    const targetData = targetDoc.data();
    const currentRoles: string[] = Array.isArray(targetData?.roles) ? targetData.roles : ["student"];

    if (action === "toggle_admin") {
      const willBeAdmin = !currentRoles.includes("admin");

      // ★仕様書の絶対ルール: 「自分の印は外せない」
      if (!willBeAdmin && targetUid === currentAdmin.uid) {
        return NextResponse.json(
          { error: "安全保護のため、自分自身の運営権限（印）を外すことはできません。" },
          { status: 400 }
        );
      }

      const nextRoles = willBeAdmin
        ? Array.from(new Set([...currentRoles, "admin"]))
        : currentRoles.filter((r) => r !== "admin");

      await targetRef.set(
        {
          roles: nextRoles,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // A09 操作の記録に追記
      await recordAuditLog({
        adminUid: currentAdmin.uid,
        adminName: currentAdmin.displayName,
        adminEmail: currentAdmin.email,
        actionType: "user_role_change",
        actionDetail: willBeAdmin
          ? `${targetData?.displayName || targetUid} に運営の印を付与しました`
          : `${targetData?.displayName || targetUid} の運営の印を外しました`,
        targetType: "user",
        targetId: targetUid,
        targetName: targetData?.displayName || targetUid,
        reasonAndNotes: reason || "管理者による権限変更",
      });

      return NextResponse.json({
        message: willBeAdmin ? "運営権限を付与しました。" : "運営権限を解除しました。",
        roles: nextRoles,
      });
    }

    return NextResponse.json({ error: "無効なアクションです。" }, { status: 400 });
  } catch (error) {
    console.error("利用者権限更新エラー:", error);
    return NextResponse.json({ error: "処理中にエラーが発生しました。" }, { status: 500 });
  }
}
