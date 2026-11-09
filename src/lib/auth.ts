import { getAdminAuth } from "@/lib/firebase-admin";

/**
 * AuthorizationヘッダーのBearerトークンを検証し、検証済みuidを返します。
 * トークンが存在しない、または無効な場合は null を返します。
 */
export async function authenticate(request: Request): Promise<{ uid: string } | null> {
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
