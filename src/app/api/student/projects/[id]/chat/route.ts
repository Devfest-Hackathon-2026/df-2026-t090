import { NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { getAdminDb, FieldValue } from "@/lib/firebase-admin";
import { ProjectMessage } from "@/lib/types/hive";

/**
 * GET /api/student/projects/[id]/chat?roomId=general
 * チャットメッセージ一覧の取得（最新50件）
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
  const roomId = searchParams.get("roomId") || "general";

  try {
    const db = getAdminDb();

    // メッセージ一覧取得
    const snapshot = await db
      .collection("ideas")
      .doc(projectId)
      .collection("messages")
      .where("roomId", "==", roomId)
      .orderBy("createdAt", "asc")
      .limit(100)
      .get();

    // メンバー総数の取得（全体連絡の「3/6人確認済み」算出用）
    const membersSnap = await db
      .collection("ideas")
      .doc(projectId)
      .collection("members")
      .get();
    const totalMembersCount = Math.max(membersSnap.size, 1);

    const messages: ProjectMessage[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        projectId,
        roomId: data.roomId || "general",
        senderUid: data.senderUid,
        senderName: data.senderName,
        senderSchool: data.senderSchool || "",
        senderRole: data.senderRole || "メンバー",
        text: data.text || "",
        isAnnouncement: Boolean(data.isAnnouncement),
        deadline: data.deadline || undefined,
        confirmedUserUids: Array.isArray(data.confirmedUserUids) ? data.confirmedUserUids : [],
        totalMembersCount,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
      };
    });

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("チャットメッセージ取得エラー:", error);
    return NextResponse.json({ error: "メッセージの取得に失敗しました。" }, { status: 500 });
  }
}

/**
 * POST /api/student/projects/[id]/chat
 * メッセージまたは「全体連絡」の送信
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
    const body = await request.json();
    const { text, roomId = "general", isAnnouncement = false, deadline } = body;

    if (!text || !text.trim()) {
      return NextResponse.json({ error: "メッセージを入力してください。" }, { status: 400 });
    }

    const db = getAdminDb();

    // 送信者のプロフィールとプロジェクト内役割を取得
    const userDoc = await db.collection("users").doc(authUser.uid).get();
    const userData = userDoc.data();

    const memberDoc = await db
      .collection("ideas")
      .doc(projectId)
      .collection("members")
      .doc(authUser.uid)
      .get();

    const memberData = memberDoc.exists ? memberDoc.data() : null;
    const senderRole = memberData?.roleName || "参加メンバー";
    const senderName = userData?.displayName || authUser.uid.slice(0, 5);
    const senderSchool = userData?.schoolName || "";

    const msgRef = db
      .collection("ideas")
      .doc(projectId)
      .collection("messages")
      .doc();

    await msgRef.set({
      roomId,
      senderUid: authUser.uid,
      senderName,
      senderSchool,
      senderRole,
      text: text.trim(),
      isAnnouncement: Boolean(isAnnouncement),
      deadline: isAnnouncement && deadline ? deadline : null,
      confirmedUserUids: [],
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      message: "メッセージを送信しました。",
      messageId: msgRef.id,
    });
  } catch (error) {
    console.error("メッセージ送信エラー:", error);
    return NextResponse.json({ error: "メッセージの送信に失敗しました。" }, { status: 500 });
  }
}

/**
 * PUT /api/student/projects/[id]/chat
 * 全体連絡の「確認しました」ボタンを押下
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await authenticate(request);
  if (!authUser) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  const { id: projectId } = await params;

  try {
    const body = await request.json();
    const { messageId } = body;

    if (!messageId) {
      return NextResponse.json({ error: "メッセージIDが不足しています。" }, { status: 400 });
    }

    const db = getAdminDb();
    const msgRef = db
      .collection("ideas")
      .doc(projectId)
      .collection("messages")
      .doc(messageId);

    await msgRef.update({
      confirmedUserUids: FieldValue.arrayUnion(authUser.uid),
    });

    return NextResponse.json({ message: "全体連絡を確認しました。" });
  } catch (error) {
    console.error("全体連絡確認エラー:", error);
    return NextResponse.json({ error: "確認ステータスの更新に失敗しました。" }, { status: 500 });
  }
}
