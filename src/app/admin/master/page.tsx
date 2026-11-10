"use client";

import { useEffect, useState, useCallback } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";

interface CategoryItem {
  id: string;
  name: string;
  order: number;
  skillsCount: number;
}

interface SkillMasterItem {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  aliases: string[];
  levelType: "level" | "score" | "period" | "none";
  hasLevels: boolean;
  requiredEvidencePrompt: string;
  status: "active" | "disabled";
  holdersCount: number;
}

interface SchoolMasterItem {
  id: string;
  name: string;
  type: "university" | "kosen" | "other";
  prefecture: string;
  registeredUsersCount: number;
}

interface SchoolRequestItem {
  id: string;
  requestedName: string;
  requestCount: number;
  status: "pending" | "merged" | "added" | "rejected";
}

export default function AdminMasterPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<"skills" | "schools">("skills");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // スキル用データ
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [skills, setSkills] = useState<SkillMasterItem[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");

  // 学校用データ
  const [schools, setSchools] = useState<SchoolMasterItem[]>([]);
  const [requests, setRequests] = useState<SchoolRequestItem[]>([]);

  // モーダル用
  const [editingSkill, setEditingSkill] = useState<SkillMasterItem | null>(null);
  const [newSkillModal, setNewSkillModal] = useState<boolean>(false);
  const [newCategoryModal, setNewCategoryModal] = useState<boolean>(false);
  const [newCategoryName, setNewCategoryName] = useState<string>("");

  // 新規スキルフォーム
  const [newSkillForm, setNewSkillForm] = useState<{
    categoryId: string;
    name: string;
    aliases: string;
    levelType: "level" | "score" | "period" | "none";
    hasLevels: boolean;
    requiredEvidencePrompt: string;
  }>({
    categoryId: "",
    name: "",
    aliases: "",
    levelType: "level",
    hasLevels: true,
    requiredEvidencePrompt: "",
  });

  const fetchData = useCallback(async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    setError(null);
    try {
      const token = await auth.currentUser.getIdToken();

      if (activeTab === "skills") {
        const res = await fetch("/api/admin/master/skills", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("スキルマスター取得失敗");
        const data = await res.json();
        setCategories(data.categories || []);
        setSkills(data.skills || []);
      } else {
        const res = await fetch("/api/admin/master/schools", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("学校マスター取得失敗");
        const data = await res.json();
        setSchools(data.schools || []);
        setRequests(data.requests || []);
      }
    } catch {
      setError("マスターデータの取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) fetchData();
    });
    return () => unsubscribe();
  }, [fetchData]);

  // 分野の追加ハンドラ
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim() || !currentUser) return;
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch("/api/admin/master/skills", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "create_category",
          name: newCategoryName.trim(),
          order: categories.length + 1,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMessage("分野を追加しました。");
      setNewCategoryModal(false);
      setNewCategoryName("");
      fetchData();
    } catch (err: unknown) {
      setError((err as Error).message || "分野の追加に失敗しました。");
    }
  };

  // スキル追加ハンドラ
  const handleCreateSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkillForm.name.trim() || !newSkillForm.categoryId || !currentUser) return;
    try {
      const token = await currentUser.getIdToken();
      const targetCat = categories.find((c) => c.id === newSkillForm.categoryId);

      const res = await fetch("/api/admin/master/skills", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "create_skill",
          categoryId: newSkillForm.categoryId,
          categoryName: targetCat?.name || "",
          name: newSkillForm.name.trim(),
          aliases: newSkillForm.aliases,
          levelType: newSkillForm.levelType,
          hasLevels: newSkillForm.hasLevels,
          requiredEvidencePrompt: newSkillForm.requiredEvidencePrompt,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMessage("スキルを追加しました。");
      setNewSkillModal(false);
      setNewSkillForm({
        categoryId: "",
        name: "",
        aliases: "",
        levelType: "level",
        hasLevels: true,
        requiredEvidencePrompt: "",
      });
      fetchData();
    } catch (err: unknown) {
      setError((err as Error).message || "スキルの追加に失敗しました。");
    }
  };

  // スキル編集・無効化（選べなくする）ハンドラ
  const handleUpdateSkill = async (statusOverride?: "active" | "disabled") => {
    if (!editingSkill || !currentUser) return;
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch("/api/admin/master/skills", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "update_skill",
          skillId: editingSkill.id,
          name: editingSkill.name,
          aliases: editingSkill.aliases,
          levelType: editingSkill.levelType,
          hasLevels: editingSkill.hasLevels,
          requiredEvidencePrompt: editingSkill.requiredEvidencePrompt,
          status: statusOverride || editingSkill.status,
          reason: statusOverride === "disabled" ? "新規選択の停止（選べなくする）" : "定義の更新",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMessage("スキルを更新しました。");
      setEditingSkill(null);
      fetchData();
    } catch (err: unknown) {
      setError((err as Error).message || "スキルの更新に失敗しました。");
    }
  };

  const filteredSkills =
    selectedCategoryId === "all"
      ? skills
      : skills.filter((s) => s.categoryId === selectedCategoryId);

  return (
    <div className="flex flex-col gap-6">
      {/* ページタイトル ＆ タブ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#B87503]/30 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[#3D2406] flex items-center gap-2">
            <span>📚</span>
            <span>学校とスキルの一覧</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#5C3D15] mt-1">
            スキルツリーの分野とスキルの定義、大学・高専マスターおよび追加依頼を管理します。
          </p>
        </div>

        {/* タブ切り替え（スキル/学校、件数付き） */}
        <div className="flex items-center gap-1.5 p-1 bg-[#FFF8E1] rounded-2xl border border-[#B87503]/30 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab("skills")}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === "skills"
                ? "bg-[#F5B301] text-[#3D2406] shadow-xs"
                : "text-[#5C3D15] hover:text-[#3D2406]"
            }`}
          >
            スキル（{skills.length}件）
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("schools")}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === "schools"
                ? "bg-[#F5B301] text-[#3D2406] shadow-xs"
                : "text-[#5C3D15] hover:text-[#3D2406]"
            }`}
          >
            学校（{schools.length}校）
          </button>
        </div>
      </div>

      {/* メッセージ */}
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

      {/* ───────────────── スキルタブ ───────────────── */}
      {activeTab === "skills" && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* 左カラム: 分野一覧（件数付き、「分野を足す」） */}
          <div className="md:col-span-1 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-[#B87503]/20 pb-2">
              <h2 className="text-sm font-bold text-[#3D2406]">分野一覧</h2>
              <button
                type="button"
                onClick={() => setNewCategoryModal(true)}
                className="px-2.5 py-1 rounded-full bg-[#F5B301] text-[#3D2406] text-xs font-bold hover:bg-[#E0A200] shadow-xs"
              >
                + 分野を足す
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedCategoryId("all")}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-colors flex items-center justify-between ${
                  selectedCategoryId === "all"
                    ? "bg-[#F5B301] text-[#3D2406] shadow-xs"
                    : "bg-[#FFFBEB] text-[#5C3D15] hover:bg-[#FFF8E1] border border-[#B87503]/20"
                }`}
              >
                <span>すべて表示</span>
                <span className="text-[11px] opacity-80">{skills.length}件</span>
              </button>

              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(c.id)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-colors flex items-center justify-between ${
                    selectedCategoryId === c.id
                      ? "bg-[#F5B301] text-[#3D2406] shadow-xs"
                      : "bg-[#FFFBEB] text-[#5C3D15] hover:bg-[#FFF8E1] border border-[#B87503]/20"
                  }`}
                >
                  <span>{c.name}</span>
                  <span className="text-[11px] opacity-80">{c.skillsCount}件</span>
                </button>
              ))}
            </div>
          </div>

          {/* 右カラム: スキル表 */}
          <div className="md:col-span-3 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-[#B87503]/20 pb-2">
              <h2 className="text-sm font-bold text-[#3D2406]">
                登録スキル一覧（{filteredSkills.length}件）
              </h2>
              <button
                type="button"
                onClick={() => {
                  setNewSkillForm({
                    ...newSkillForm,
                    categoryId: categories[0]?.id || "",
                  });
                  setNewSkillModal(true);
                }}
                className="px-3 py-1.5 rounded-full bg-[#F5B301] text-[#3D2406] text-xs font-bold hover:bg-[#E0A200] shadow-xs"
              >
                + スキルを新規登録
              </button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-[#B87503]/30 bg-[#FFFBEB] shadow-xs">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="bg-[#FFF2BE]/70 border-b border-[#B87503]/30 text-[#3D2406] font-bold">
                    <th className="py-2.5 px-3">スキル名 / 分野</th>
                    <th className="py-2.5 px-3">方式</th>
                    <th className="py-2.5 px-3">審査に必要な根拠</th>
                    <th className="py-2.5 px-3">保持者</th>
                    <th className="py-2.5 px-3">状態</th>
                    <th className="py-2.5 px-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#B87503]/15">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[#7A5726] font-bold">
                        読み込み中...
                      </td>
                    </tr>
                  ) : filteredSkills.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[#7A5726] font-bold">
                        登録スキルはありません。
                      </td>
                    </tr>
                  ) : (
                    filteredSkills.map((s) => (
                      <tr key={s.id} className="hover:bg-[#FFFDF7]/60">
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-[#3D2406]">{s.name}</div>
                          <div className="text-[11px] text-[#7A5726]">{s.categoryName}</div>
                        </td>
                        <td className="py-2.5 px-3 text-xs">
                          {s.levelType === "level" && "Lv1〜3"}
                          {s.levelType === "score" && "点数制"}
                          {s.levelType === "period" && "期間(年)"}
                          {s.levelType === "none" && "合否/なし"}
                        </td>
                        <td className="py-2.5 px-3 text-xs text-[#5C3D15] max-w-xs truncate">
                          {s.requiredEvidencePrompt || "指定なし"}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-[#3D2406]">{s.holdersCount}名</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              s.status === "active"
                                ? "bg-[#EDF7ED] text-[#1E4620]"
                                : "bg-[#FDEAEA] text-[#5F1313]"
                            }`}
                          >
                            {s.status === "active" ? "使用中" : "選べない"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => setEditingSkill(s)}
                            className="px-2.5 py-1 rounded-full border border-[#B87503] bg-[#FFF8E1] text-[#3D2406] text-xs font-bold hover:bg-[#F5B301]"
                          >
                            編集
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <p className="text-[11px] text-[#7A5726] mt-1">
              ※ 仕様ルール: スキルは削除できません。「新しく選べなくする」を設定しても、既に持っている人の枝は残ります。名前を変更した場合も紐付く枝は自動で引き継がれます。
            </p>
          </div>
        </div>
      )}

      {/* ───────────────── 学校タブ ───────────────── */}
      {activeTab === "schools" && (
        <div className="flex flex-col gap-6">
          {/* 学校追加依頼セクション */}
          {requests.length > 0 && (
            <div className="p-4 rounded-2xl bg-[#FFF4CA] border border-[#F5B301] shadow-xs flex flex-col gap-2">
              <h3 className="text-sm font-bold text-[#3D2406] flex items-center gap-1.5">
                <span>📩</span>
                <span>学生からの学校追加依頼（{requests.length}件）</span>
              </h3>
              <div className="flex flex-col gap-2">
                {requests.map((r) => (
                  <div
                    key={r.id}
                    className="p-3 rounded-xl bg-[#FFFDF7] border border-[#B87503]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <span className="font-bold text-[#3D2406]">{r.requestedName}</span>
                      <span className="text-[#7A5726] ml-2">（希望者: {r.requestCount}名）</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => alert(`「${r.requestedName}」を新規学校として承認しました。`)}
                        className="px-3 py-1 rounded-full bg-[#F5B301] text-[#3D2406] font-bold shadow-xs hover:bg-[#E0A200]"
                      >
                        新しく足す
                      </button>
                      <button
                        type="button"
                        onClick={() => alert(`「${r.requestedName}」の依頼を見送りました。`)}
                        className="px-3 py-1 rounded-full border border-[#B87503]/40 bg-[#FFF8E1] text-[#5C3D15] font-bold"
                      >
                        見送る
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 学校マスター一覧 */}
          <div className="overflow-x-auto rounded-2xl border border-[#B87503]/30 bg-[#FFFBEB] shadow-xs">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="bg-[#FFF2BE]/70 border-b border-[#B87503]/30 text-[#3D2406] font-bold">
                  <th className="py-2.5 px-4">学校名</th>
                  <th className="py-2.5 px-4">区分</th>
                  <th className="py-2.5 px-4">都道府県</th>
                  <th className="py-2.5 px-4">登録学生数</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#B87503]/15">
                {schools.map((sc) => (
                  <tr key={sc.id} className="hover:bg-[#FFFDF7]/60">
                    <td className="py-2.5 px-4 font-bold text-[#3D2406]">{sc.name}</td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#FFF8E1] border border-[#B87503]/30 text-[#5C3D15]">
                        {sc.type === "university" ? "大学" : sc.type === "kosen" ? "高等専門学校" : "その他"}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-[#5C3D15]">{sc.prefecture}</td>
                    <td className="py-2.5 px-4 font-bold text-[#3D2406]">{sc.registeredUsersCount}名</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* スキル編集モーダル */}
      {editingSkill && (
        <div className="fixed inset-0 z-50 bg-[#3D2406]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FFFBEB] max-w-lg w-full rounded-3xl p-6 border-2 border-[#B87503] shadow-2xl flex flex-col gap-4 text-left">
            <h3 className="text-base sm:text-lg font-black text-[#3D2406] border-b border-[#B87503]/30 pb-2">
              スキルの編集
            </h3>

            <div className="flex flex-col gap-3 text-xs">
              <div>
                <label className="font-bold text-[#3D2406] block mb-1">スキル名</label>
                <input
                  type="text"
                  value={editingSkill.name}
                  onChange={(e) => setEditingSkill({ ...editingSkill, name: e.target.value })}
                  className="w-full bg-[#FFFDF7] border border-[#B87503]/30 rounded-xl p-2.5 text-xs text-[#3D2406]"
                />
              </div>

              <div>
                <label className="font-bold text-[#3D2406] block mb-1">別名（カンマ区切り）</label>
                <input
                  type="text"
                  value={editingSkill.aliases.join(", ")}
                  onChange={(e) =>
                    setEditingSkill({
                      ...editingSkill,
                      aliases: e.target.value.split(",").map((s) => s.trim()),
                    })
                  }
                  className="w-full bg-[#FFFDF7] border border-[#B87503]/30 rounded-xl p-2.5 text-xs text-[#3D2406]"
                />
              </div>

              <div>
                <label className="font-bold text-[#3D2406] block mb-1">審査に要る根拠の説明</label>
                <textarea
                  rows={2}
                  value={editingSkill.requiredEvidencePrompt}
                  onChange={(e) =>
                    setEditingSkill({ ...editingSkill, requiredEvidencePrompt: e.target.value })
                  }
                  className="w-full bg-[#FFFDF7] border border-[#B87503]/30 rounded-xl p-2.5 text-xs text-[#3D2406]"
                />
              </div>

              <div className="p-3 rounded-xl bg-[#FFF8E1] border border-[#B87503]/20 flex items-center justify-between">
                <div>
                  <span className="font-bold text-[#3D2406] block">新規選択の状態</span>
                  <span className="text-[11px] text-[#7A5726]">
                    選べなくしても、既に持っている学生の枝は削除されず残ります。
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleUpdateSkill(editingSkill.status === "active" ? "disabled" : "active")
                  }
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                    editingSkill.status === "active"
                      ? "bg-[#FDEAEA] text-[#5F1313] border-[#E57373]"
                      : "bg-[#EDF7ED] text-[#1E4620] border-[#81C784]"
                  }`}
                >
                  {editingSkill.status === "active" ? "新しく選べなくする" : "使用中に戻す"}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#B87503]/20">
              <button
                type="button"
                onClick={() => setEditingSkill(null)}
                className="px-4 py-2 rounded-full border border-[#B87503]/40 bg-[#FFFDF7] text-[#5C3D15] text-xs font-bold"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => handleUpdateSkill()}
                className="px-5 py-2 rounded-full bg-[#F5B301] text-[#3D2406] text-xs font-bold hover:bg-[#E0A200]"
              >
                保存する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 新規スキル登録モーダル */}
      {newSkillModal && (
        <div className="fixed inset-0 z-50 bg-[#3D2406]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateSkill}
            className="bg-[#FFFBEB] max-w-lg w-full rounded-3xl p-6 border-2 border-[#B87503] shadow-2xl flex flex-col gap-4 text-left"
          >
            <h3 className="text-base font-black text-[#3D2406] border-b border-[#B87503]/30 pb-2">
              スキルを新規登録
            </h3>

            <div className="flex flex-col gap-3 text-xs">
              <div>
                <label className="font-bold text-[#3D2406] block mb-1">所属分野</label>
                <select
                  value={newSkillForm.categoryId}
                  onChange={(e) =>
                    setNewSkillForm({ ...newSkillForm, categoryId: e.target.value })
                  }
                  className="w-full bg-[#FFFDF7] border border-[#B87503]/30 rounded-xl p-2.5 text-xs text-[#3D2406]"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-[#3D2406] block mb-1">スキル名</label>
                <input
                  type="text"
                  required
                  placeholder="例: Next.js Webアプリケーション開発"
                  value={newSkillForm.name}
                  onChange={(e) =>
                    setNewSkillForm({ ...newSkillForm, name: e.target.value })
                  }
                  className="w-full bg-[#FFFDF7] border border-[#B87503]/30 rounded-xl p-2.5 text-xs text-[#3D2406]"
                />
              </div>

              <div>
                <label className="font-bold text-[#3D2406] block mb-1">別名（カンマ区切り）</label>
                <input
                  type="text"
                  placeholder="例: フロントエンド, React, TypeScript"
                  value={newSkillForm.aliases}
                  onChange={(e) =>
                    setNewSkillForm({ ...newSkillForm, aliases: e.target.value })
                  }
                  className="w-full bg-[#FFFDF7] border border-[#B87503]/30 rounded-xl p-2.5 text-xs text-[#3D2406]"
                />
              </div>

              <div>
                <label className="font-bold text-[#3D2406] block mb-1">レベル方式</label>
                <select
                  value={newSkillForm.levelType}
                  onChange={(e) =>
                    setNewSkillForm({
                      ...newSkillForm,
                      levelType: e.target.value as "level" | "score" | "period" | "none",
                      hasLevels: e.target.value === "level",
                    })
                  }
                  className="w-full bg-[#FFFDF7] border border-[#B87503]/30 rounded-xl p-2.5 text-xs text-[#3D2406]"
                >
                  <option value="level">Lv1〜3（教わりながら/ひとりで/人に教えられる）</option>
                  <option value="score">点数制（例: TOEICスコア）</option>
                  <option value="period">期間（例: 塾講師 1.5年）</option>
                  <option value="none">合否・なし（資格合格など）</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-[#3D2406] block mb-1">審査に要る根拠の説明</label>
                <textarea
                  rows={2}
                  placeholder="例: ポートフォリオURL、コードリポジトリ、または合格証書"
                  value={newSkillForm.requiredEvidencePrompt}
                  onChange={(e) =>
                    setNewSkillForm({
                      ...newSkillForm,
                      requiredEvidencePrompt: e.target.value,
                    })
                  }
                  className="w-full bg-[#FFFDF7] border border-[#B87503]/30 rounded-xl p-2.5 text-xs text-[#3D2406]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#B87503]/20">
              <button
                type="button"
                onClick={() => setNewSkillModal(false)}
                className="px-4 py-1.5 rounded-full border border-[#B87503]/40 bg-[#FFFDF7] text-[#5C3D15] text-xs font-bold"
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="px-5 py-1.5 rounded-full bg-[#F5B301] text-[#3D2406] text-xs font-bold hover:bg-[#E0A200]"
              >
                登録する
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 分野追加モーダル */}
      {newCategoryModal && (
        <div className="fixed inset-0 z-50 bg-[#3D2406]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateCategory}
            className="bg-[#FFFBEB] max-w-sm w-full rounded-3xl p-6 border-2 border-[#B87503] shadow-2xl flex flex-col gap-4 text-left"
          >
            <h3 className="text-base font-black text-[#3D2406] border-b border-[#B87503]/30 pb-2">
              スキル分野を足す
            </h3>
            <div>
              <label className="text-xs font-bold text-[#3D2406] block mb-1">新しい分野名</label>
              <input
                type="text"
                required
                placeholder="例: デザイン・表現"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="w-full bg-[#FFFDF7] border border-[#B87503]/30 rounded-xl p-2.5 text-xs text-[#3D2406]"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setNewCategoryModal(false)}
                className="px-4 py-1.5 rounded-full border border-[#B87503]/40 bg-[#FFFDF7] text-[#5C3D15] text-xs font-bold"
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-full bg-[#F5B301] text-[#3D2406] text-xs font-bold hover:bg-[#E0A200]"
              >
                追加する
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
