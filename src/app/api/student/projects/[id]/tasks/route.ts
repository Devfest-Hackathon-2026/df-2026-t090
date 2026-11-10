import { NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { getAdminDb, FieldValue } from "@/lib/firebase-admin";

export type TaskStatus = "not_started" | "in_progress" | "completed";

export interface ProjectTaskItem {
  id: string;
  projectId: string;
  title: string;
  assigneeUid: string;
  assigneeName: string;
  deadline: string;
  status: TaskStatus;
  originalMessageId?: string;
  createdByUid: string;
  createdAt: string;
}

/**
 * GET /api/student/projects/[id]/tasks
 * タスク一覧の取得
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

  try {
    const db = getAdminDb();
    const tasksSnap = await db
      .collection("ideas")
      .doc(projectId)
      .collection("tasks")
      .orderBy("createdAt", "desc")
      .get();

    const tasks: ProjectTaskItem[] = tasksSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        projectId,
        title: data.title || "タスク",
        assigneeUid: data.assigneeUid || "",
        assigneeName: data.assigneeName || "未定",
        deadline: data.deadline || "",
        status: (data.status as TaskStatus) || "not_started",
        originalMessageId: data.originalMessageId || undefined,
        createdByUid: data.createdByUid || "",
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
      };
    });

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error("タスク取得エラー:", error);
    return NextResponse.json({ error: "タスクの取得に失敗しました。" }, { status: 500 });
  }
}

/**
 * POST /api/student/projects/[id]/tasks
 * 発言からタスクを作成
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
    const { title, assigneeUid, assigneeName, deadline, originalMessageId } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: "タスク名を入力してください。" }, { status: 400 });
    }

    const db = getAdminDb();
    const taskRef = db
      .collection("ideas")
      .doc(projectId)
      .collection("tasks")
      .doc();

    await taskRef.set({
      projectId,
      title: title.trim(),
      assigneeUid: assigneeUid || authUser.uid,
      assigneeName: assigneeName || "メンバー",
      deadline: deadline || "",
      status: "not_started",
      originalMessageId: originalMessageId || null,
      createdByUid: authUser.uid,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      message: "タスクを作成しました。",
      taskId: taskRef.id,
    });
  } catch (error) {
    console.error("タスク作成エラー:", error);
    return NextResponse.json({ error: "タスクの作成に失敗しました。" }, { status: 500 });
  }
}

/**
 * PATCH /api/student/projects/[id]/tasks
 * タスクの状態（未着手・進行中・完了）を変更
 */
export async function PATCH(
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
    const { taskId, status } = body;

    if (!taskId || !["not_started", "in_progress", "completed"].includes(status)) {
      return NextResponse.json({ error: "無効なタスク更新パラメータです。" }, { status: 400 });
    }

    const db = getAdminDb();
    const taskRef = db
      .collection("ideas")
      .doc(projectId)
      .collection("tasks")
      .doc(taskId);

    await taskRef.update({
      status,
      updatedAt: FieldValue.serverTimestamp(),
      updatedByUid: authUser.uid,
    });

    return NextResponse.json({ message: "タスクの状態を更新しました。" });
  } catch (error) {
    console.error("タスク更新エラー:", error);
    return NextResponse.json({ error: "タスクの更新に失敗しました。" }, { status: 500 });
  }
}
