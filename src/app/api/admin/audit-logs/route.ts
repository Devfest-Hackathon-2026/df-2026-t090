import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getAuditLogs, formatAuditLogsAsCSV } from "@/lib/audit-logger";

/**
 * GET /api/admin/audit-logs
 * 監査ログ一覧取得およびCSVエクスポート（A09: 追記のみ、変更・削除不可）
 */
export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if ("response" in guard) {
    return guard.response;
  }

  const { searchParams } = new URL(request.url);
  const actionType = searchParams.get("actionType") || "all";
  const adminUid = searchParams.get("adminUid") || undefined;
  const format = searchParams.get("format"); // "csv" の場合はCSV出力

  try {
    const logs = await getAuditLogs({
      actionType,
      adminUid,
      limit: 200,
    });

    if (format === "csv") {
      const csvData = formatAuditLogsAsCSV(logs);
      const filename = `hive-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;

      return new NextResponse(csvData, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    return NextResponse.json({ logs });
  } catch (error) {
    console.error("監査ログ取得エラー:", error);
    return NextResponse.json({ error: "操作記録の取得に失敗しました。" }, { status: 500 });
  }
}
