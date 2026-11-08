import { getApps, initializeApp, applicationDefault, App } from "firebase-admin/app";
import { getAuth, Auth } from "firebase-admin/auth";
import { getFirestore, Firestore, FieldValue } from "firebase-admin/firestore";

const PROJECT_ID = "project-7f11774d-0f3a-4228-93f";

/**
 * Firebase Admin SDKを遅延初期化します。
 * ビルド時に実行されないよう関数内で初期化を行い、二重初期化を防ぎます。
 */
export function getAdminApp(): App {
  if (getApps().length === 0) {
    return initializeApp({
      credential: applicationDefault(),
      projectId: PROJECT_ID,
    });
  }
  return getApps()[0];
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}

export { FieldValue };
