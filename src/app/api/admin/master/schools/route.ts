import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getAdminDb, FieldValue } from "@/lib/firebase-admin";
import { recordAuditLog } from "@/lib/audit-logger";

/**
 * GET /api/admin/master/schools
 * 学校マスター一覧および学校追加依頼一覧の取得
 */
export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if ("response" in guard) {
    return guard.response;
  }

  try {
    const db = getAdminDb();

    // 1. 学校マスター一覧
    const schoolsSnapshot = await db.collection("schools_master").get();
    const schools = schoolsSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || "",
        type: data.type || "university", // university, kosen, other
        prefecture: data.prefecture || "",
        registeredUsersCount: data.registeredUsersCount || 0,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : null,
      };
    });

    // 2. 学校追加依頼一覧
    const requestsSnapshot = await db.collection("school_requests").get();
    const requests = requestsSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        requestedName: data.requestedName || "",
        requestCount: data.requestCount || 1,
        status: data.status || "pending", // pending, merged, added, rejected
        resolvedSchoolId: data.resolvedSchoolId || null,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : null,
      };
    });

    return NextResponse.json({
      schools,
      requests,
    });
  } catch (error) {
    console.error("学校マスター取得エラー:", error);
    return NextResponse.json({ error: "学校マスターの取得に失敗しました。" }, { status: 500 });
  }
}

/**
 * POST /api/admin/master/schools
 * 学校の新規追加・編集・追加依頼の解決（まとめる／足す／見送る）
 */
export async function POST(request: Request) {
  const guard = await requireAdmin(request);
  if ("response" in guard) {
    return guard.response;
  }

  const currentAdmin = guard.user;

  try {
    const body = await request.json();
    const { action } = body;
    const db = getAdminDb();

    // 1. 学校の新規登録
    if (action === "create_school") {
      const { name, type, prefecture } = body;
      if (!name) {
        return NextResponse.json({ error: "学校名を入力してください。" }, { status: 400 });
      }

      const schoolRef = db.collection("schools_master").doc();
      await schoolRef.set({
        name: name.trim(),
        type: type || "university",
        prefecture: (prefecture || "").trim(),
        registeredUsersCount: 0,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      await recordAuditLog({
        adminUid: currentAdmin.uid,
        adminName: currentAdmin.displayName,
        adminEmail: currentAdmin.email,
        actionType: "master_school_edit",
        actionDetail: `学校「${name}」を新規登録しました`,
        targetType: "school",
        targetId: schoolRef.id,
        targetName: name,
        reasonAndNotes: body.reason || "学校マスターへの追加",
      });

      return NextResponse.json({ message: "学校を登録しました。", id: schoolRef.id });
    }

    // 2. 学校追加依頼の解決（A07: 「（既存の学校）にまとめる」「新しく足す」「見送る」）
    if (action === "resolve_request") {
      const { requestId, resolution, targetSchoolId, newSchoolData, reason } = body;

      if (!requestId || !resolution) {
        return NextResponse.json({ error: "パラメータが不足しています。" }, { status: 400 });
      }

      const reqRef = db.collection("school_requests").doc(requestId);
      const reqDoc = await reqRef.get();

      if (!reqDoc.exists) {
        return NextResponse.json({ error: "該当の依頼が見つかりません。" }, { status: 404 });
      }

      const reqData = reqDoc.data();
      const requestedName = reqData?.requestedName || "";

      if (resolution === "merge") {
        // 既存の学校にまとめる
        await reqRef.update({
          status: "merged",
          resolvedSchoolId: targetSchoolId,
          resolvedAt: FieldValue.serverTimestamp(),
        });

        await recordAuditLog({
          adminUid: currentAdmin.uid,
          adminName: currentAdmin.displayName,
          adminEmail: currentAdmin.email,
          actionType: "master_school_edit",
          actionDetail: `学校追加依頼「${requestedName}」を既存学校(${targetSchoolId})にまとめました`,
          targetType: "school_request",
          targetId: requestId,
          targetName: requestedName,
          reasonAndNotes: reason || "表記ゆれ・同一校の統合",
        });

        return NextResponse.json({ message: "既存の学校に統合しました。" });
      }

      if (resolution === "add_new") {
        // 新しく足す
        const newRef = db.collection("schools_master").doc();
        await newRef.set({
          name: newSchoolData?.name || requestedName,
          type: newSchoolData?.type || "university",
          prefecture: newSchoolData?.prefecture || "",
          registeredUsersCount: reqData?.requestCount || 1,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        await reqRef.update({
          status: "added",
          resolvedSchoolId: newRef.id,
          resolvedAt: FieldValue.serverTimestamp(),
        });

        await recordAuditLog({
          adminUid: currentAdmin.uid,
          adminName: currentAdmin.displayName,
          adminEmail: currentAdmin.email,
          actionType: "master_school_edit",
          actionDetail: `学校追加依頼「${requestedName}」を新規学校として承認・登録しました`,
          targetType: "school_request",
          targetId: requestId,
          targetName: requestedName,
          reasonAndNotes: reason || "学生からの依頼承認",
        });

        return NextResponse.json({ message: "新しい学校として追加・登録しました。" });
      }

      if (resolution === "reject") {
        // 見送る
        await reqRef.update({
          status: "rejected",
          resolvedAt: FieldValue.serverTimestamp(),
        });

        await recordAuditLog({
          adminUid: currentAdmin.uid,
          adminName: currentAdmin.displayName,
          adminEmail: currentAdmin.email,
          actionType: "master_school_edit",
          actionDetail: `学校追加依頼「${requestedName}」を見送りました`,
          targetType: "school_request",
          targetId: requestId,
          targetName: requestedName,
          reasonAndNotes: reason || "対象外または重複",
        });

        return NextResponse.json({ message: "依頼を見送りました。" });
      }
    }

    return NextResponse.json({ error: "無効なアクションです。" }, { status: 400 });
  } catch (error) {
    console.error("学校マスター更新エラー:", error);
    return NextResponse.json({ error: "処理中にエラーが発生しました。" }, { status: 500 });
  }
}
