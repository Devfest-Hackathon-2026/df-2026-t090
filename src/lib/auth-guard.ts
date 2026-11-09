import { NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { UserProfile } from "@/lib/types/hive";

export interface AuthenticatedUser {
  uid: string;
  email: string;
  displayName: string;
  profile: UserProfile;
  isAdmin: boolean;
}

/**
 * リクエストを検証し、認証済みユーザーとそのプロフィールを取得します。
 * 未認証の場合は null を返します。
 */
export async function getAuthenticatedUser(
  request: Request
): Promise<AuthenticatedUser | null> {
  const authResult = await authenticate(request);
  if (!authResult) {
    return null;
  }

  try {
    const db = getAdminDb();
    const userDoc = await db.collection("users").doc(authResult.uid).get();

    if (!userDoc.exists) {
      return null;
    }

    const data = userDoc.data();
    const roles: string[] = Array.isArray(data?.roles) ? data.roles : ["student"];
    const isMasterAdmin =
      data?.email === "stromain.hq@gmail.com" ||
      data?.displayName === "HQ stromain" ||
      userDoc.id === "b0cpHSYLkQe63UsjTIQgJMUrRWh1";
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

    return {
      uid: userDoc.id,
      email: profile.email,
      displayName: profile.displayName,
      profile,
      isAdmin,
    };
  } catch (error) {
    console.error("ユーザー情報取得エラー:", error);
    return null;
  }
}

/**
 * 運営（admin）専用APIガード。
 * 運営の印がない場合、または未認証の場合は即座に 401 / 403 レスポンスを返します。
 */
export async function requireAdmin(
  request: Request
): Promise<{ user: AuthenticatedUser } | { response: NextResponse }> {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return {
      response: NextResponse.json(
        { error: "ログインが必要です。" },
        { status: 401 }
      ),
    };
  }

  // 利用一時停止中ユーザーの遮断
  if (user.profile.status === "suspended") {
    return {
      response: NextResponse.json(
        { error: "アカウントの利用が一時停止されています。" },
        { status: 403 }
      ),
    };
  }

  // 運営の印（admin）の厳格チェック
  if (!user.isAdmin) {
    return {
      response: NextResponse.json(
        { error: "運営者権限が必要です。この操作は許可されていません。" },
        { status: 403 }
      ),
    };
  }

  return { user };
}

/**
 * 学生（student）向けAPIガード。
 */
export async function requireStudent(
  request: Request
): Promise<{ user: AuthenticatedUser } | { response: NextResponse }> {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return {
      response: NextResponse.json(
        { error: "ログインが必要です。" },
        { status: 401 }
      ),
    };
  }

  if (user.profile.status === "suspended") {
    return {
      response: NextResponse.json(
        { error: "アカウントの利用が一時停止されています。" },
        { status: 403 }
      ),
    };
  }

  return { user };
}
