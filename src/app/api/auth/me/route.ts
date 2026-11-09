import { NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { getAdminDb, FieldValue } from "@/lib/firebase-admin";
import { UserProfile } from "@/lib/types/hive";

/**
 * GET /api/auth/me
 * ログイン中ユーザーのプロファイル・権限情報・所属を取得
 */
export async function GET(request: Request) {
  const authResult = await authenticate(request);
  if (!authResult) {
    return NextResponse.json({ error: "未認証です。" }, { status: 401 });
  }

  try {
    const db = getAdminDb();
    const userDoc = await db.collection("users").doc(authResult.uid).get();

    if (!userDoc.exists) {
      return NextResponse.json({ isNewUser: true, uid: authResult.uid });
    }

    const data = userDoc.data();
    const roles: string[] = Array.isArray(data?.roles) ? data.roles : ["student"];
    const isMasterAdmin =
      data?.email === "stromain.hq@gmail.com" ||
      data?.displayName === "HQ stromain" ||
      userDoc.id === "b0cpHSYLkQe63UsjTIQgJMUrRWh1" ||
      userDoc.id === "WrTz65qe6AekWcZ6AcUVUI9eK3t2";
    const isAdmin = roles.includes("admin") || isMasterAdmin;
    const finalRoles = isAdmin && !roles.includes("admin") ? [...roles, "admin"] : roles;

    const profile: UserProfile = {
      uid: userDoc.id,
      email: data?.email || "",
      displayName: data?.displayName || "ユーザー",
      roles: finalRoles as ("student" | "admin")[],
      status: data?.status === "suspended" ? "suspended" : "active",
      schoolId: data?.schoolId || "",
      schoolName: data?.schoolName || "",
      faculty: data?.faculty || "",
      department: data?.department || "",
      grade: data?.grade || "",
      major: data?.major || "",
      mainRole: data?.mainRole || "",
      subRoles: Array.isArray(data?.subRoles) ? data.subRoles : [],
      rank: data?.rank || {
        title: "初段",
        breakdown: { contribution: 4, trust: 4, cooperation: 4, sharing: 4 },
        evaluationsCount: 0,
      },
      timetable: Array.isArray(data?.timetable) ? data.timetable : [],
      googleCalendarSynced: Boolean(data?.googleCalendarSynced),
      connections: data?.connections || {
        collaboratorsCount: 0,
        schoolsCount: 0,
        primaryPartners: [],
      },
      createdAt: data?.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
      updatedAt: data?.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : new Date().toISOString(),
      lastLoginAt: data?.lastLoginAt?.toDate ? data.lastLoginAt.toDate().toISOString() : new Date().toISOString(),
    };

    return NextResponse.json({
      profile,
      isAdmin: roles.includes("admin"),
    });
  } catch (error) {
    console.error("ユーザー取得エラー:", error);
    return NextResponse.json({ error: "ユーザー情報の取得に失敗しました。" }, { status: 500 });
  }
}

/**
 * POST /api/auth/me
 * 初回登録・プロフィール・時間割の保存
 */
export async function POST(request: Request) {
  const authResult = await authenticate(request);
  if (!authResult) {
    return NextResponse.json({ error: "未認証です。" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const db = getAdminDb();
    const userRef = db.collection("users").doc(authResult.uid);
    const existingDoc = await userRef.get();

    const existingData = existingDoc.exists ? existingDoc.data() : null;
    const existingRoles = Array.isArray(existingData?.roles) ? existingData.roles : ["student"];

    // 開発者・本部管理者または明示的な有効化の場合、adminロールを付与
    const isAdminEmail = body.email === "stromain.hq@gmail.com" || existingData?.email === "stromain.hq@gmail.com";
    const shouldGrantAdmin = isAdminEmail || body.grantAdmin === true || existingRoles.includes("admin");
    const finalRoles = shouldGrantAdmin && !existingRoles.includes("admin")
      ? [...existingRoles, "admin"]
      : existingRoles;

    const payload = {
      email: body.email || existingData?.email || "",
      displayName: (body.displayName || existingData?.displayName || "ユーザー").trim(),
      schoolId: body.schoolId || existingData?.schoolId || "",
      schoolName: body.schoolName || existingData?.schoolName || "",
      faculty: body.faculty || existingData?.faculty || "",
      department: body.department || existingData?.department || "",
      grade: body.grade || existingData?.grade || "学部1年",
      major: body.major || existingData?.major || "",
      mainRole: body.mainRole || existingData?.mainRole || "メンバー",
      subRoles: Array.isArray(body.subRoles) ? body.subRoles : existingData?.subRoles || [],
      roles: finalRoles,
      status: existingData?.status || "active",
      timetable: Array.isArray(body.timetable) ? body.timetable : existingData?.timetable || [],
      updatedAt: FieldValue.serverTimestamp(),
      lastLoginAt: FieldValue.serverTimestamp(),
    };

    await userRef.set(payload, { merge: true });

    return NextResponse.json({
      message: "プロフィールを保存しました。",
      isAdmin: finalRoles.includes("admin"),
    });
  } catch (error) {
    console.error("プロフィール保存エラー:", error);
    return NextResponse.json({ error: "プロフィールの保存に失敗しました。" }, { status: 500 });
  }
}
