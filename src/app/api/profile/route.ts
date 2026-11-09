import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb, FieldValue } from "@/lib/firebase-admin";

/**
 * AuthorizationヘッダーのBearerトークンを検証し、検証済みuidを返します。
 * トークンが存在しない、または無効な場合は null を返します。
 */
async function authenticate(request: Request): Promise<{ uid: string } | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const idToken = authHeader.split("Bearer ")[1]?.trim();
  if (!idToken) {
    return null;
  }

  try {
    const adminAuth = getAdminAuth();
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    return { uid: decodedToken.uid };
  } catch (error) {
    console.error("IDトークン検証失敗:", error);
    return null;
  }
}

/**
 * GET: 認証済み本人のプロフィール情報のみを取得します。
 */
export async function GET(request: Request) {
  const authUser = await authenticate(request);
  if (!authUser) {
    return NextResponse.json({ error: "認証が必要です。" }, { status: 401 });
  }

  try {
    const db = getAdminDb();
    // ドキュメントIDは検証済みトークンのuidのみを使用
    const docSnap = await db.collection("users").doc(authUser.uid).get();

    if (!docSnap.exists) {
      return NextResponse.json({ error: "プロフィールが見つかりません。" }, { status: 404 });
    }

    const data = docSnap.data();
    return NextResponse.json({
      displayName: data?.displayName ?? "",
      university: data?.university ?? "",
      faculty: data?.faculty ?? "",
      department: data?.department ?? "",
      major: data?.major ?? "",
      skills: data?.skills ?? "",
      motivation: data?.motivation ?? "",
    });
  } catch (error) {
    console.error("プロフィール取得エラー:", error);
    return NextResponse.json({ error: "プロフィールの取得中にエラーが発生しました。" }, { status: 500 });
  }
}

/**
 * PUT: 認証済み本人のプロフィール情報を検証してFirestoreに保存します。
 */
export async function PUT(request: Request) {
  const authUser = await authenticate(request);
  if (!authUser) {
    return NextResponse.json({ error: "認証が必要です。" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "不正なリクエスト形式です。" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "不正なリクエストです。" }, { status: 400 });
  }

  const { displayName, university, faculty, department, major, skills, motivation } = body as Record<string, unknown>;

  // バリデーション
  if (typeof displayName !== "string" || displayName.trim().length === 0 || displayName.trim().length > 50) {
    return NextResponse.json({ error: "表示名は必須で、50文字以内で入力してください。" }, { status: 400 });
  }

  if (typeof university !== "string" || university.trim().length === 0 || university.trim().length > 100) {
    return NextResponse.json({ error: "大学名は必須で、100文字以内で入力してください。" }, { status: 400 });
  }

  if (typeof faculty !== "string" || faculty.trim().length === 0 || faculty.trim().length > 100) {
    return NextResponse.json({ error: "学部は必須で、100文字以内で入力してください。" }, { status: 400 });
  }

  if (typeof department !== "string" || department.trim().length === 0 || department.trim().length > 100) {
    return NextResponse.json({ error: "学科は必須で、100文字以内で入力してください。" }, { status: 400 });
  }

  if (typeof major !== "string" || major.trim().length === 0 || major.trim().length > 100) {
    return NextResponse.json({ error: "専攻・分野は必須で、100文字以内で入力してください。" }, { status: 400 });
  }

  if (typeof skills !== "string" || skills.trim().length === 0 || skills.trim().length > 2000) {
    return NextResponse.json({ error: "できることは必須で、2000文字以内で入力してください。" }, { status: 400 });
  }

  if (motivation !== undefined && motivation !== null && typeof motivation !== "string") {
    return NextResponse.json({ error: "協力したいテーマや動機は文字列で入力してください。" }, { status: 400 });
  }

  const motivationStr = typeof motivation === "string" ? motivation.trim() : "";
  if (motivationStr.length > 1000) {
    return NextResponse.json({ error: "協力したいテーマや動機は1000文字以内で入力してください。" }, { status: 400 });
  }

  try {
    const db = getAdminDb();
    // 保存項目は指定された項目のみ（メールアドレスやクライアント指定のuid等は保存しない）
    const profileData = {
      displayName: displayName.trim(),
      university: university.trim(),
      faculty: faculty.trim(),
      department: department.trim(),
      major: major.trim(),
      skills: skills.trim(),
      motivation: motivationStr,
      updatedAt: FieldValue.serverTimestamp(),
    };

    // ドキュメントIDには検証済みトークンのuidのみを使用（geminiUsage等の他フィールドを保護するためmergeを有効化）
    await db.collection("users").doc(authUser.uid).set(profileData, { merge: true });

    return NextResponse.json({ message: "プロフィールを保存しました。" });
  } catch (error) {
    console.error("プロフィール保存エラー:", error);
    return NextResponse.json({ error: "プロフィールの保存中にエラーが発生しました。" }, { status: 500 });
  }
}
