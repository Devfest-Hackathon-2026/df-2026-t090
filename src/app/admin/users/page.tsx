"use client";

import { useEffect, useState, useCallback } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { formatJSTDateTime, maskEmail } from "@/lib/theme";

interface AdminUserItem {
  uid: string;
  displayName: string;
  email: string;
  schoolName: string;
  faculty: string;
  department: string;
  grade: string;
  roles: string[];
  isAdmin: boolean;
  status: "active" | "suspended";
  branchesCount: number;
  projectsCount: number;
  lastLoginAt: string | null;
  createdAt: string | null;
}

export default function AdminUsersPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [metrics, setMetrics] = useState({ totalUsers: 0, totalSchools: 0, adminCount: 0 });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // フィルター
  const [keyword, setKeyword] = useState<string>("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // モーダル（運営の印の付け外し確認）
  const [selectedUser, setSelectedUser] = useState<AdminUserItem | null>(null);
  const [actionReason, setActionReason] = useState<string>("");
  const [updating, setUpdating] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    setError(null);
    try {
      const token = await auth.currentUser.getIdToken();
      const params = new URLSearchParams();
      if (keyword) params.set("keyword", keyword);
      if (roleFilter !== "all") params.set("role", roleFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`/api/admin/users?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "利用者一覧の取得に失敗しました。");
        return;
      }

      const data = await res.json();
      setUsers(data.users || []);
      setMetrics(data.metrics || { totalUsers: 0, totalSchools: 0, adminCount: 0 });
    } catch {
      setError("通信エラーが発生しました。");
    } finally {
      setLoading(false);
    }
  }, [keyword, roleFilter, statusFilter]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) fetchUsers();
    });
    return () => unsubscribe();
  }, [fetchUsers]);

  const handleToggleAdmin = async () => {
    if (!selectedUser || !currentUser) return;
    setUpdating(true);
    setMessage(null);
    setError(null);

    try {
      const token = await currentUser.getIdToken();
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetUid: selectedUser.uid,
          action: "toggle_admin",
          reason: actionReason || "運営者による手動変更",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "権限の変更に失敗しました。");
        return;
      }

      setMessage(data.message || "権限を変更しました。");
      setSelectedUser(null);
      setActionReason("");
      fetchUsers();
    } catch {
      setError("通信エラーが発生しました。");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ページタイトル */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#B87503]/30 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[#3D2406] flex items-center gap-2">
            <span>👥</span>
            <span>利用者の管理</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#5C3D15] mt-1">
            学生および運営アカウントの一覧、所属学校、運営の印の付け外しを管理します。
          </p>
        </div>
        <button
          type="button"
          onClick={fetchUsers}
          className="px-4 py-2 rounded-full border border-[#B87503] bg-[#FFF8E1] text-[#3D2406] text-xs font-bold hover:bg-[#F5B301] transition-colors shadow-xs flex items-center gap-1.5 self-start sm:self-auto"
        >
          <span>🔄</span>
          <span>再読込</span>
        </button>
      </div>

      {/* 集計カード（仕様: 登録人数、学校数、運営の人数） */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-[#FFFBEB] border border-[#B87503]/30 shadow-xs flex flex-col gap-1">
          <span className="text-xs font-bold text-[#7A5726]">登録人数</span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-black text-[#3D2406]">{metrics.totalUsers}</span>
            <span className="text-xs font-bold text-[#5C3D15]">名</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#FFFBEB] border border-[#B87503]/30 shadow-xs flex flex-col gap-1">
          <span className="text-xs font-bold text-[#7A5726]">参加学校数</span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-black text-[#3D2406]">{metrics.totalSchools}</span>
            <span className="text-xs font-bold text-[#5C3D15]">校</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#FFF8E1] border-2 border-[#F5B301] shadow-xs flex flex-col gap-1">
          <span className="text-xs font-bold text-[#B87503]">運営の人数</span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-black text-[#B87503]">{metrics.adminCount}</span>
            <span className="text-xs font-bold text-[#3D2406]">名</span>
          </div>
        </div>
      </div>

      {/* 検索・絞り込みバー */}
      <div className="p-4 rounded-2xl bg-[#FFFBEB] border border-[#B87503]/20 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchUsers();
          }}
          className="flex-1 flex items-center gap-2"
        >
          <input
            type="text"
            placeholder="名前・メール・学校名で検索..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="w-full bg-[#FFFDF7] border border-[#B87503]/30 rounded-xl px-3 py-2 text-xs sm:text-sm text-[#3D2406] focus:outline-none focus:border-[#F5B301]"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-[#F5B301] text-[#3D2406] text-xs font-bold hover:bg-[#E0A200] transition-colors shrink-0"
          >
            検索
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          {/* 役割絞り込み */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-[#FFFDF7] border border-[#B87503]/30 rounded-xl px-3 py-2 text-xs font-bold text-[#3D2406] focus:outline-none"
          >
            <option value="all">役割: すべて</option>
            <option value="student">学生のみ</option>
            <option value="admin">運営のみ</option>
          </select>

          {/* 状態絞り込み */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#FFFDF7] border border-[#B87503]/30 rounded-xl px-3 py-2 text-xs font-bold text-[#3D2406] focus:outline-none"
          >
            <option value="all">状態: すべて</option>
            <option value="active">利用中</option>
            <option value="suspended">一時停止中</option>
          </select>
        </div>
      </div>

      {/* メッセージ通知 */}
      {message && (
        <div className="p-3.5 rounded-xl bg-[#EDF7ED] border border-[#81C784] text-[#1E4620] text-xs sm:text-sm font-bold shadow-xs">
          ✓ {message}
        </div>
      )}
      {error && (
        <div className="p-3.5 rounded-xl bg-[#FDEAEA] border border-[#E57373] text-[#5F1313] text-xs sm:text-sm font-bold shadow-xs">
          ⚠ {error}
        </div>
      )}

      {/* 利用者一覧テーブル */}
      <div className="overflow-x-auto rounded-2xl border border-[#B87503]/30 bg-[#FFFBEB] shadow-xs">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead>
            <tr className="bg-[#FFF2BE]/70 border-b border-[#B87503]/30 text-[#3D2406] font-bold">
              <th className="py-3 px-4">名前 / メール</th>
              <th className="py-3 px-4">所属学校・学年</th>
              <th className="py-3 px-4">役割</th>
              <th className="py-3 px-4">状態</th>
              <th className="py-3 px-4">最後の利用</th>
              <th className="py-3 px-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#B87503]/15">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-[#7A5726]">
                  <div className="flex items-center justify-center gap-2 font-bold">
                    <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[#F5B301] border-t-transparent" />
                    <span>読み込み中...</span>
                  </div>
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-[#7A5726] font-bold">
                  条件に一致する利用者は見つかりませんでした。
                </td>
              </tr>
            ) : (
              users.map((u) => {
                const isCurrentSelf = currentUser?.uid === u.uid;
                return (
                  <tr key={u.uid} className="hover:bg-[#FFFDF7]/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-[#3D2406] flex items-center gap-1.5">
                        <span>{u.displayName}</span>
                        {isCurrentSelf && (
                          <span className="px-1.5 py-0.2 rounded-md bg-[#F5B301]/30 text-[#3D2406] text-[10px] font-black border border-[#B87503]/40">
                            あなた
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#7A5726] mt-0.5">{maskEmail(u.email)}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-[#3D2406]">{u.schoolName}</div>
                      <div className="text-[11px] text-[#7A5726] mt-0.5">
                        {u.faculty} {u.department} {u.grade}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                          u.isAdmin
                            ? "bg-[#FFF8E1] text-[#B87503] border-[#F5B301]"
                            : "bg-[#FFFDF7] text-[#5C3D15] border-[#B87503]/30"
                        }`}
                      >
                        {u.isAdmin ? "運営" : "学生"}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          u.status === "active"
                            ? "bg-[#EDF7ED] text-[#1E4620]"
                            : "bg-[#FDEAEA] text-[#5F1313]"
                        }`}
                      >
                        {u.status === "active" ? "利用中" : "一時停止"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-[#5C3D15]">
                      {formatJSTDateTime(u.lastLoginAt)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedUser(u)}
                        className="px-3 py-1.5 rounded-full border border-[#B87503] bg-[#FFF8E1] text-[#3D2406] text-xs font-bold hover:bg-[#F5B301] transition-colors shadow-xs"
                      >
                        印の変更
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 運営の印の変更モーダル（仕様: 「運営の印は運営どうしで付け外しできるが、自分の印は外せない」） */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-[#3D2406]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FFFBEB] max-w-md w-full rounded-3xl p-6 border-2 border-[#B87503] shadow-2xl flex flex-col gap-4 text-left">
            <h3 className="text-base sm:text-lg font-black text-[#3D2406] border-b border-[#B87503]/30 pb-2">
              運営の印（Admin権限）の変更
            </h3>

            <div className="p-3.5 rounded-xl bg-[#FFFDF7] border border-[#B87503]/30 text-xs flex flex-col gap-1">
              <div>
                <span className="text-[#7A5726]">対象者: </span>
                <span className="font-bold text-[#3D2406]">{selectedUser.displayName}</span>
              </div>
              <div>
                <span className="text-[#7A5726]">学校: </span>
                <span className="text-[#3D2406]">{selectedUser.schoolName}</span>
              </div>
              <div>
                <span className="text-[#7A5726]">現在の印: </span>
                <span className="font-bold text-[#B87503]">
                  {selectedUser.isAdmin ? "運営（付与済み）" : "学生（未付与）"}
                </span>
              </div>
            </div>

            {/* 自分の印を外そうとした場合の警告ブロック */}
            {selectedUser.isAdmin && currentUser?.uid === selectedUser.uid ? (
              <div className="p-3.5 rounded-xl bg-[#FDEAEA] border border-[#E57373] text-[#5F1313] text-xs font-bold leading-relaxed">
                ⚠ 仕様書の安全ルールにより、自分自身の運営の印（管理者権限）を外すことはできません。別の運営者に依頼してください。
              </div>
            ) : (
              <>
                <p className="text-xs text-[#5C3D15] leading-relaxed">
                  {selectedUser.isAdmin
                    ? "このユーザーの運営の印を外して「一般学生」に戻します。操作内容は 操作の記録（監査ログ） に自動保存されます。"
                    : "このユーザーに運営の印を付与して「本部運営」にします。管理画面の全機能が開放されます。"}
                </p>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-[#3D2406]">
                    変更の理由・メモ <span className="text-[#B87503]">*</span>
                  </label>
                  <textarea
                    rows={2}
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    placeholder="例: 新任運営スタッフとしての着任承認"
                    className="w-full bg-[#FFFDF7] border border-[#B87503]/30 rounded-xl p-2.5 text-xs text-[#3D2406] focus:outline-none focus:border-[#F5B301]"
                  />
                </div>
              </>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#B87503]/20">
              <button
                type="button"
                onClick={() => {
                  setSelectedUser(null);
                  setActionReason("");
                }}
                className="px-4 py-2 rounded-full border border-[#B87503]/40 bg-[#FFFDF7] text-[#5C3D15] text-xs font-bold hover:bg-[#FFF8E1]"
              >
                キャンセル
              </button>

              {!(selectedUser.isAdmin && currentUser?.uid === selectedUser.uid) && (
                <button
                  type="button"
                  onClick={handleToggleAdmin}
                  disabled={updating}
                  className="px-5 py-2 rounded-full bg-[#F5B301] text-[#3D2406] text-xs font-bold shadow-sm hover:bg-[#E0A200] disabled:opacity-50"
                >
                  {updating ? "更新中..." : selectedUser.isAdmin ? "運営の印を外す" : "運営の印を付ける"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
