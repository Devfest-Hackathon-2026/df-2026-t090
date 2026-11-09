import { getAdminDb, FieldValue } from "@/lib/firebase-admin";
import { AuditActionType, AuditLog } from "@/lib/types/hive";
import { formatJSTDateTime } from "@/lib/theme";

export interface LogAuditParams {
  adminUid: string;
  adminName: string;
  adminEmail: string;
  actionType: AuditActionType;
  actionDetail: string;
  targetType: string;
  targetId: string;
  targetName?: string;
  reasonAndNotes: string;
}

/**
 * 運営操作の記録（A09: 追記のみ、変更・削除不可）
 */
export async function recordAuditLog(params: LogAuditParams): Promise<string> {
  try {
    const db = getAdminDb();
    const logRef = db.collection("audit_logs").doc();

    await logRef.set({
      adminUid: params.adminUid,
      adminName: params.adminName,
      adminEmail: params.adminEmail,
      actionType: params.actionType,
      actionDetail: params.actionDetail,
      targetType: params.targetType,
      targetId: params.targetId,
      targetName: params.targetName || "",
      reasonAndNotes: params.reasonAndNotes,
      createdAt: FieldValue.serverTimestamp(),
    });

    return logRef.id;
  } catch (error) {
    console.error("監査ログ記録エラー:", error);
    throw new Error("操作記録の保存に失敗しました。");
  }
}

/**
 * 監査ログの一覧を取得（新しい順）
 */
export async function getAuditLogs(options?: {
  actionType?: string;
  adminUid?: string;
  limit?: number;
}): Promise<AuditLog[]> {
  try {
    const db = getAdminDb();
    let query = db.collection("audit_logs").orderBy("createdAt", "desc");

    if (options?.actionType && options.actionType !== "all") {
      query = query.where("actionType", "==", options.actionType);
    }
    if (options?.adminUid) {
      query = query.where("adminUid", "==", options.adminUid);
    }

    const limitCount = options?.limit || 100;
    const snapshot = await query.limit(limitCount).get();

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        timestamp: data?.createdAt?.toDate
          ? data.createdAt.toDate().toISOString()
          : new Date().toISOString(),
        adminUid: data?.adminUid || "",
        adminName: data?.adminName || "運営者",
        adminEmail: data?.adminEmail || "",
        actionType: data?.actionType || "master_skill_edit",
        actionDetail: data?.actionDetail || "",
        targetType: data?.targetType || "",
        targetId: data?.targetId || "",
        targetName: data?.targetName || "",
        reasonAndNotes: data?.reasonAndNotes || "",
      };
    });
  } catch (error) {
    console.error("監査ログ一覧取得エラー:", error);
    return [];
  }
}

/**
 * 監査ログ一覧をCSV文字列に変換（A09 CSVエクスポート）
 */
export function formatAuditLogsAsCSV(logs: AuditLog[]): string {
  const headers = ["日時(JST)", "運営者", "メールアドレス", "操作種類", "操作内容", "対象種類", "対象ID/名称", "理由・メモ"];

  const escapeCSV = (str: string) => {
    const s = String(str || "").replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = logs.map((log) => [
    escapeCSV(formatJSTDateTime(log.timestamp)),
    escapeCSV(log.adminName),
    escapeCSV(log.adminEmail),
    escapeCSV(log.actionType),
    escapeCSV(log.actionDetail),
    escapeCSV(log.targetType),
    escapeCSV(log.targetName ? `${log.targetName} (${log.targetId})` : log.targetId),
    escapeCSV(log.reasonAndNotes),
  ]);

  // UTF-8 BOM付きでExcel等の文字化けを防止
  return "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
}
