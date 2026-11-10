import { NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { getAdminDb, FieldValue } from "@/lib/firebase-admin";
import { ProjectApplication } from "@/lib/types/hive";

/**
 * GET /api/student/applications?type=received | sent
 * 提唱者として届いた応募、または自分が応募した履歴を取得
 */
export async function GET(request: Request) {
  const authUser = await authenticate(request);
  if (!authUser) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "received"; // received: 提唱者宛, sent: 自分が応募したもの

  try {
    const db = getAdminDb();
    let query = db.collection("project_applications").orderBy("createdAt", "desc");

    if (type === "received") {
      // 自分が提唱しているプロジェクト宛ての応募
      query = query.where("projectOwnerUid", "==", authUser.uid);
    } else {
      // 自分が応募した一覧
      query = query.where("applicantUid", "==", authUser.uid);
    }

    const snapshot = await query.get();
    const applications: ProjectApplication[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        projectId: data.projectId,
        projectTitle: data.projectTitle,
        projectOwnerUid: data.projectOwnerUid,
        roleId: data.roleId || "",
        roleName: data.roleName,
        applicantUid: data.applicantUid,
        applicantName: data.applicantName,
        applicantSchool: data.applicantSchool,
        applicantFaculty: data.applicantFaculty || "",
        applicantGrade: data.applicantGrade || "",
        motivationMessage: data.motivationMessage || "",
        status: data.status || "pending",
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
        reviewedAt: data.reviewedAt?.toDate ? data.reviewedAt.toDate().toISOString() : undefined,
      };
    });

    return NextResponse.json({ applications });
  } catch (error) {
    console.error("応募一覧取得エラー:", error);
    return NextResponse.json({ error: "応募一覧の取得に失敗しました。" }, { status: 500 });
  }
}

/**
 * POST /api/student/applications
 * プロジェクトのロールに応募する（W02）
 */
export async function POST(request: Request) {
  const authUser = await authenticate(request);
  if (!authUser) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { projectId, roleName, roleId, motivationMessage } = body;

    if (!projectId || !roleName) {
      return NextResponse.json({ error: "応募先プロジェクトと役割を指定してください。" }, { status: 400 });
    }

    const db = getAdminDb();

    // 応募先プロジェクトの存在確認
    const projectDoc = await db.collection("ideas").doc(projectId).get();
    if (!projectDoc.exists) {
      return NextResponse.json({ error: "プロジェクトが見つかりません。" }, { status: 404 });
    }

    const projectData = projectDoc.data();
    const projectTitle = projectData?.result?.title || projectData?.title || "プロジェクト";
    const projectOwnerUid = projectData?.ownerUid || "";

    // 自分のプロジェクトへの応募は不可
    if (projectOwnerUid === authUser.uid) {
      return NextResponse.json({ error: "自身が提唱したプロジェクトには応募できません。" }, { status: 400 });
    }

    // 応募者のプロフィールを取得
    const userDoc = await db.collection("users").doc(authUser.uid).get();
    const userData = userDoc.exists ? userDoc.data() : null;

    const applicantName = userData?.displayName || "学生ユーザー";
    const applicantSchool = userData?.schoolName || "未登録大学";
    const applicantFaculty = userData?.faculty || "";
    const applicantGrade = userData?.grade || "";

    // 重複応募チェック（同じロールにpendingの応募が既にある場合）
    const existingSnap = await db
      .collection("project_applications")
      .where("projectId", "==", projectId)
      .where("roleName", "==", roleName)
      .where("applicantUid", "==", authUser.uid)
      .where("status", "==", "pending")
      .get();

    if (!existingSnap.empty) {
      return NextResponse.json({ error: "この役割には既に応募中です。提唱者からの返答をお待ちください。" }, { status: 400 });
    }

    const newAppRef = db.collection("project_applications").doc();
    await newAppRef.set({
      projectId,
      projectTitle,
      projectOwnerUid,
      roleId: roleId || "",
      roleName,
      applicantUid: authUser.uid,
      applicantName,
      applicantSchool,
      applicantFaculty,
      applicantGrade,
      motivationMessage: (motivationMessage || "").trim(),
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      message: `「${roleName}」への応募を送信しました。提唱者へ通知されます。`,
      applicationId: newAppRef.id,
    });
  } catch (error) {
    console.error("応募送信エラー:", error);
    return NextResponse.json({ error: "応募の送信中にエラーが発生しました。" }, { status: 500 });
  }
}

/**
 * PUT /api/student/applications
 * 提唱者が届いた応募を「承認」または「見送り」にする（W04）
 */
export async function PUT(request: Request) {
  const authUser = await authenticate(request);
  if (!authUser) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { applicationId, action } = body; // action: "approve" | "reject"

    if (!applicationId || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "パラメータが無効です。" }, { status: 400 });
    }

    const db = getAdminDb();
    const appRef = db.collection("project_applications").doc(applicationId);
    const appDoc = await appRef.get();

    if (!appDoc.exists) {
      return NextResponse.json({ error: "該当の応募が見つかりません。" }, { status: 404 });
    }

    const appData = appDoc.data();

    // 提唱者本人かどうか検証
    if (appData?.projectOwnerUid !== authUser.uid) {
      return NextResponse.json({ error: "この応募を承認・見送りする権限がありません。" }, { status: 403 });
    }

    if (action === "approve") {
      // 1. 応募ステータスを approved に更新
      await appRef.update({
        status: "approved",
        reviewedAt: FieldValue.serverTimestamp(),
      });

      // 2. プロジェクトのメンバーコレクションに参加者を追加
      const memberRef = db
        .collection("ideas")
        .doc(appData.projectId)
        .collection("members")
        .doc(appData.applicantUid);

      await memberRef.set(
        {
          userId: appData.applicantUid,
          displayName: appData.applicantName,
          schoolName: appData.applicantSchool,
          roleName: appData.roleName,
          isOwner: false,
          isFacilitator: false,
          participationType: "membership",
          status: "active",
          joinedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // 3. ユーザー側の「参加中プロジェクト一覧」にも追加
      const userRef = db.collection("users").doc(appData.applicantUid);
      await userRef.update({
        joinedProjectIds: FieldValue.arrayUnion(appData.projectId),
      }).catch(async () => {
        // フィールドがない場合はセット
        await userRef.set(
          { joinedProjectIds: [appData.projectId] },
          { merge: true }
        );
      });

      return NextResponse.json({
        message: `${appData.applicantName} さんの参加を承認しました！プロジェクトメンバーに追加されました。`,
        status: "approved",
      });
    }

    if (action === "reject") {
      await appRef.update({
        status: "rejected",
        reviewedAt: FieldValue.serverTimestamp(),
      });

      return NextResponse.json({
        message: "応募を見送りました。",
        status: "rejected",
      });
    }
  } catch (error) {
    console.error("応募承認処理エラー:", error);
    return NextResponse.json({ error: "処理中にエラーが発生しました。" }, { status: 500 });
  }
}
