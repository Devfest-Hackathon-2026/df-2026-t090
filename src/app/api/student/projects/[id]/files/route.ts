import { NextResponse } from "next/server";
import { Storage } from "@google-cloud/storage";
import { authenticate } from "@/lib/auth";
import { getAdminDb, FieldValue } from "@/lib/firebase-admin";

const BUCKET_NAME = "hive-files-1045771000909";
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB 上限

export interface ProjectFileItem {
  id: string;
  projectId: string;
  name: string;
  uploaderUid: string;
  uploaderName: string;
  size: number;
  sizeFormatted: string;
  storagePath: string;
  createdAt: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * GET /api/student/projects/[id]/files?fileId=...
 * ファイル一覧の取得、または期限付き署名付きURLの発行
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await authenticate(request);
  if (!authUser) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  const { id: projectId } = await params;
  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get("fileId");

  try {
    const db = getAdminDb();

    // メンバー確認
    const memberDoc = await db
      .collection("ideas")
      .doc(projectId)
      .collection("members")
      .doc(authUser.uid)
      .get();

    // 管理者またはメンバーのみアクセス可能
    const userDoc = await db.collection("users").doc(authUser.uid).get();
    const isAdmin = Boolean(userDoc.data()?.roles?.includes("admin"));
    if (!memberDoc.exists && !isAdmin && !projectId.startsWith("demo-")) {
      return NextResponse.json({ error: "このプロジェクトのメンバーのみファイルを閲覧できます。" }, { status: 403 });
    }

    // 特定ファイルの署名付きURL発行
    if (fileId) {
      const fileDoc = await db
        .collection("ideas")
        .doc(projectId)
        .collection("files")
        .doc(fileId)
        .get();

      if (!fileDoc.exists) {
        return NextResponse.json({ error: "ファイルが見つかりません。" }, { status: 404 });
      }

      const fileData = fileDoc.data();
      const storage = new Storage();
      const bucket = storage.bucket(BUCKET_NAME);
      const file = bucket.file(fileData?.storagePath);

      // 15分間有効な期限付き署名付きURLを発行
      const [signedUrl] = await file.getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + 15 * 60 * 1000,
      });

      return NextResponse.json({ signedUrl, fileName: fileData?.name });
    }

    // ファイル一覧取得
    const filesSnap = await db
      .collection("ideas")
      .doc(projectId)
      .collection("files")
      .orderBy("createdAt", "desc")
      .get();

    const files: ProjectFileItem[] = filesSnap.docs.map((doc) => {
      const data = doc.data();
      const sizeBytes = Number(data.size) || 0;
      return {
        id: doc.id,
        projectId,
        name: data.name || "ファイル",
        uploaderUid: data.uploaderUid || "",
        uploaderName: data.uploaderName || "メンバー",
        size: sizeBytes,
        sizeFormatted: formatFileSize(sizeBytes),
        storagePath: data.storagePath || "",
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
      };
    });

    return NextResponse.json({ files });
  } catch (error) {
    console.error("ファイル一覧/URL取得エラー:", error);
    return NextResponse.json({ error: "ファイル情報の取得に失敗しました。" }, { status: 500 });
  }
}

/**
 * POST /api/student/projects/[id]/files
 * Cloud Storage へのファイルアップロード ＆ Firestore メタデータ保存
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await authenticate(request);
  if (!authUser) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  const { id: projectId } = await params;

  try {
    const formData = await request.formData();
    const uploadedFile = formData.get("file") as File | null;

    if (!uploadedFile) {
      return NextResponse.json({ error: "ファイルが選択されていません。" }, { status: 400 });
    }

    // 20MB 上限チェック
    if (uploadedFile.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "1ファイルの上限は20MBです。" }, { status: 400 });
    }

    const db = getAdminDb();

    // メンバー確認
    const memberDoc = await db
      .collection("ideas")
      .doc(projectId)
      .collection("members")
      .doc(authUser.uid)
      .get();

    const userDoc = await db.collection("users").doc(authUser.uid).get();
    const isAdmin = Boolean(userDoc.data()?.roles?.includes("admin"));
    if (!memberDoc.exists && !isAdmin && !projectId.startsWith("demo-")) {
      return NextResponse.json({ error: "このプロジェクトのメンバーのみファイルを共有できます。" }, { status: 403 });
    }

    const uploaderName = memberDoc.data()?.displayName || userDoc.data()?.displayName || "メンバー";
    const fileName = uploadedFile.name;
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `projects/${projectId}/${Date.now()}_${sanitizedName}`;

    // Cloud Storage へバイナリ保存
    const storage = new Storage();
    const bucket = storage.bucket(BUCKET_NAME);
    const gcsFile = bucket.file(storagePath);

    const arrayBuffer = await uploadedFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await gcsFile.save(buffer, {
      contentType: uploadedFile.type || "application/octet-stream",
      resumable: false,
    });

    // Firestore にメタデータを保存
    const fileDocRef = db
      .collection("ideas")
      .doc(projectId)
      .collection("files")
      .doc();

    await fileDocRef.set({
      projectId,
      name: fileName,
      uploaderUid: authUser.uid,
      uploaderName,
      size: uploadedFile.size,
      storagePath,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      message: "ファイルを共有しました。",
      fileId: fileDocRef.id,
      fileName,
    });
  } catch (error) {
    console.error("ファイルアップロードエラー:", error);
    return NextResponse.json({ error: "ファイルのアップロードに失敗しました。" }, { status: 500 });
  }
}
