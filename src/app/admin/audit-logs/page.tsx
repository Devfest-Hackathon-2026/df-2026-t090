"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { AuditLog } from "@/lib/types/hive";
import { formatJSTDateTime } from "@/lib/theme";

export default function AdminAuditLogsPage() {
  const [, setCurrentUser] = useState<User | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 絞り込み
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [searchTarget, setSearchTarget] = useState<string>("");

  const fetchLogs = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    setError(null);
    try {
      const token = await auth.currentUser.getIdToken();
      const params = new URLSearchParams();
      if (actionFilter !== "all") params.set("actionType", actionFilter);

      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("操作記録の取得に失敗しました。");
      const data = await res.json();
      setLogs(data.logs || []);
    } catch {
      setError("操作記録の読み込み中にエラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        setLoading(true);
        setError(null);
        try {
          const token = await user.getIdToken();
          const params = new URLSearchParams();
          if (actionFilter !== "all") params.set("actionType", actionFilter);

          const res = await fetch(`/api/admin/audit-logs?${params.toString()}`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (!res.ok) throw new Error("操作記録の取得に失敗しました。");
          const data = await res.json();
          if (active) setLogs(data.logs || []);
        } catch {
          if (active) setError("操作記録の読み込み中にエラーが発生しました。");
        } finally {
          if (active) setLoading(false);
        }
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [actionFilter]);

  // CSVダウンロードハンドラ
  const handleExportCSV = async () => {
    if (!auth.currentUser) return;
    try {
      const token = await auth.currentUser.getIdToken();
      const params = new URLSearchParams();
      if (actionFilter !== "all") params.set("actionType", actionFilter);
      params.set("format", "csv");

      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("CSVの取得に失敗しました。");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hive-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert("CSVのダウンロードに失敗しました。");
    }
  };

  const filteredLogs = searchTarget
    ? logs.filter(
        (l) =>
          l.actionDetail.toLowerCase().includes(searchTarget.toLowerCase()) ||
          l.targetName?.toLowerCase().includes(searchTarget.toLowerCase()) ||
          l.targetId.toLowerCase().includes(searchTarget.toLowerCase()) ||
          l.adminName.toLowerCase().includes(searchTarget.toLowerCase())
      )
    : logs;

  return (
    <div className="flex flex-col gap-6">
      {/* ページタイトル ＆ CSV出力ボタン */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#B87503]/30 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[#3D2406] flex items-center gap-2">
            <span>📜</span>
            <span>操作の記録（監査ログ）</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#5C3D15] mt-1">
            運営が行ったすべての操作ログです。追記のみで記録され、誰も書き換えや削除はできません。
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={fetchLogs}
            className="px-3.5 py-2 rounded-full border border-[#B87503] bg-[#FFF8E1] text-[#3D2406] text-xs font-bold hover:bg-[#F5B301] shadow-xs flex items-center gap-1"
          >
            <span>🔄</span>
            <span>再読込</span>
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-4 py-2 rounded-full bg-[#F5B301] text-[#3D2406] text-xs font-bold hover:bg-[#E0A200] shadow-xs flex items-center gap-1.5"
          >
            <span>📥</span>
            <span>CSVで書き出す</span>
          </button>
        </div>
      </div>

      {/* 絞り込み ＆ 対象検索バー */}
      <div className="p-4 rounded-2xl bg-[#FFFBEB] border border-[#B87503]/20 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex-1 flex items-center gap-2">
          <input
            type="text"
            placeholder="対象、したこと、運営者名で絞り込み..."
            value={searchTarget}
            onChange={(e) => setSearchTarget(e.target.value)}
            className="w-full bg-[#FFFDF7] border border-[#B87503]/30 rounded-xl px-3 py-2 text-xs sm:text-sm text-[#3D2406] focus:outline-none focus:border-[#F5B301]"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-[#FFFDF7] border border-[#B87503]/30 rounded-xl px-3 py-2 text-xs font-bold text-[#3D2406] focus:outline-none"
          >
            <option value="all">操作の種類: すべて</option>
            <option value="skill_review">スキル審査</option>
            <option value="project_review">プロジェクト公開審査</option>
            <option value="record_cert">活動記録の認定</option>
            <option value="report_action">通報への対応</option>
            <option value="user_role_change">運営の印の付け外し</option>
            <option value="master_skill_edit">スキル一覧の編集</option>
            <option value="master_school_edit">学校一覧の編集</option>
            <option value="announcement_post">お知らせの配信</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-[#FDEAEA] border border-[#E57373] text-[#5F1313] text-xs sm:text-sm font-bold shadow-xs">
          ⚠ {error}
        </div>
      )}

      {/* 監査ログ一覧テーブル */}
      <div className="overflow-x-auto rounded-2xl border border-[#B87503]/30 bg-[#FFFBEB] shadow-xs">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead>
            <tr className="bg-[#FFF2BE]/70 border-b border-[#B87503]/30 text-[#3D2406] font-bold">
              <th className="py-2.5 px-4 whitespace-nowrap">日時(JST)</th>
              <th className="py-2.5 px-4 whitespace-nowrap">担当運営</th>
              <th className="py-2.5 px-4 whitespace-nowrap">操作の種類</th>
              <th className="py-2.5 px-4">したこと</th>
              <th className="py-2.5 px-4">対象</th>
              <th className="py-2.5 px-4">理由・メモ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#B87503]/15">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-[#7A5726]">
                  <div className="flex items-center justify-center gap-2 font-bold">
                    <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[#F5B301] border-t-transparent" />
                    <span>操作ログを読み込み中...</span>
                  </div>
                </td>
              </tr>
            ) : filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-[#7A5726] font-bold">
                  記録された操作ログはありません。
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-[#FFFDF7]/60 transition-colors">
                  <td className="py-2.5 px-4 text-[11px] text-[#5C3D15] whitespace-nowrap">
                    {formatJSTDateTime(log.timestamp)}
                  </td>
                  <td className="py-2.5 px-4">
                    <span className="font-bold text-[#3D2406] block">{log.adminName}</span>
                    <span className="text-[10px] text-[#7A5726] block">{log.adminEmail}</span>
                  </td>
                  <td className="py-2.5 px-4 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFF8E1] border border-[#B87503]/30 text-[#B87503]">
                      {log.actionType}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 font-bold text-[#3D2406]">
                    {log.actionDetail}
                  </td>
                  <td className="py-2.5 px-4 text-xs text-[#5C3D15]">
                    {log.targetName ? `${log.targetName}` : log.targetId}
                  </td>
                  <td className="py-2.5 px-4 text-xs text-[#7A5726]">
                    {log.reasonAndNotes || "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
