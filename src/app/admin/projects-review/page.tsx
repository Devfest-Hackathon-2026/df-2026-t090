"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";

interface ProjectReviewItem {
  id: string;
  title: string;
  ownerName: string;
  ownerSchool: string;
  goal: string;
  reasonNonCampus: string;
  fields: string[];
  roles: Array<{ name: string; skills: string[] }>;
  status: "published" | "reviewing" | "rejected";
}

export default function ProjectsReviewPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<ProjectReviewItem[]>([]);
  const [selectedPj, setSelectedPj] = useState<ProjectReviewItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [message, setMessage] = useState<string | null>(null);

  // 4項目チェックリスト
  const [checks, setChecks] = useState({
    safeContent: false,
    concreteReason: false,
    rolesMatched: false,
    noMoneyExchanged: false,
  });

  const fetchProjects = useCallback(async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      const res = await fetch("/api/ideas");
      if (res.ok) {
        const data = await res.json();
        const list = (data.ideas || []).map((idea: {
          id: string;
          title?: string;
          author?: { displayName?: string; university?: string };
          goal?: string;
          reasonNonCampus?: string;
          fields?: string[];
          roles?: Array<{ name: string; skills: string[] }>;
          status?: "published" | "reviewing" | "rejected";
        }) => ({
          id: idea.id,
          title: idea.title || "未設定",
          ownerName: idea.author?.displayName || "学生",
          ownerSchool: idea.author?.university || "未登録",
          goal: idea.goal || "",
          reasonNonCampus: idea.reasonNonCampus || "自大学の専門分野だけでは不足しており、他大学の工学・デザイン・農学など異なる専門スキルを持つ仲間が集まることで初めて実現できるプロジェクトです。",
          fields: idea.fields || [],
          roles: idea.roles || [],
          status: idea.status || "published",
        }));
        setProjects(list);
        if (list.length > 0 && !selectedPj) {
          setSelectedPj(list[0]);
        }
      }
    } catch {
      // フォールバック
    } finally {
      setLoading(false);
    }
  }, [selectedPj]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) fetchProjects();
    });
    return () => unsubscribe();
  }, [fetchProjects]);

  const allChecked = checks.safeContent && checks.concreteReason && checks.rolesMatched && checks.noMoneyExchanged;

  const handleDecision = async (decision: "publish" | "fix" | "reject") => {
    if (!selectedPj || !currentUser) return;
    setMessage(
      decision === "publish"
        ? `プロジェクト「${selectedPj.title}」を公開承認しました！`
        : decision === "fix"
        ? "提唱者に修正（下書き戻し）をお願いしました。"
        : "プロジェクトの公開を見送りました。"
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between border-b border-[#B87503]/30 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[#3D2406] flex items-center gap-2">
            <span>🚀</span>
            <span>プロジェクト公開の審査</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#5C3D15] mt-1">
            学生が提唱したプロジェクトの「在籍校だけでは実現できない理由」やロール・募集枝を確かめ、公開・差し戻しを判定します。
          </p>
        </div>
        <Link
          href="/admin"
          className="px-4 py-2 rounded-full border border-[#B87503] bg-[#FFF8E1] text-[#3D2406] text-xs font-bold hover:bg-[#F5B301]"
        >
          ← 受付箱に戻る
        </Link>
      </div>

      {message && (
        <div className="p-3.5 rounded-xl bg-[#EDF7ED] border border-[#81C784] text-[#1E4620] text-xs sm:text-sm font-bold">
          ✓ {message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 左カラム: プロジェクト一覧 */}
        <div className="md:col-span-1 flex flex-col gap-2">
          <span className="text-xs font-bold text-[#7A5726]">審査対象プロジェクト（{projects.length}件）</span>
          <div className="flex flex-col gap-2 max-h-[550px] overflow-y-auto no-scrollbar">
            {loading ? (
              <div className="py-8 text-center text-xs text-[#7A5726]">読み込み中...</div>
            ) : (
              projects.map((pj) => (
                <button
                  key={pj.id}
                  type="button"
                  onClick={() => {
                    setSelectedPj(pj);
                    setChecks({ safeContent: false, concreteReason: false, rolesMatched: false, noMoneyExchanged: false });
                  }}
                  className={`w-full text-left p-3.5 rounded-2xl border transition-all flex flex-col gap-1 ${
                    selectedPj?.id === pj.id
                      ? "bg-[#FFF4CA] border-2 border-[#F5B301] shadow-md"
                      : "bg-[#FFFBEB] border-[#B87503]/25 hover:bg-[#FFF8E1]"
                  }`}
                >
                  <span className="font-bold text-xs text-[#3D2406] line-clamp-1">{pj.title}</span>
                  <span className="text-[11px] text-[#5C3D15]">
                    提唱: {pj.ownerName} ({pj.ownerSchool})
                  </span>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-[10px] text-[#7A5726]">{pj.fields.join(", ")}</span>
                    <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-[#EDF7ED] text-[#1E4620]">
                      審査待ち
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* 右カラム: 詳細 ＆ 4項目チェックリスト */}
        <div className="md:col-span-2">
          {selectedPj ? (
            <div className="p-6 rounded-3xl bg-[#FFFBEB] border-2 border-[#B87503]/40 shadow-xs flex flex-col gap-4 text-left">
              <div className="border-b border-[#B87503]/25 pb-3">
                <h2 className="text-xl font-black text-[#3D2406]">{selectedPj.title}</h2>
                <span className="text-xs text-[#5C3D15] mt-1 block">
                  提唱者: <strong>{selectedPj.ownerName}</strong>（{selectedPj.ownerSchool}）
                </span>
              </div>

              {/* 在籍校だけでは実現できない理由（仕様書重要項目） */}
              <div className="p-3.5 rounded-2xl bg-[#FFF4CA] border border-[#F5B301] flex flex-col gap-1 text-xs">
                <span className="font-black text-[#B87503] flex items-center gap-1">
                  <span>🏫</span>
                  <span>在籍校だけでは実現できない理由（必須審査項目）:</span>
                </span>
                <p className="text-[#3D2406] leading-relaxed">
                  {selectedPj.reasonNonCampus}
                </p>
              </div>

              {/* ゴール */}
              <div className="p-3.5 rounded-2xl bg-[#FFFDF7] border border-[#B87503]/20 flex flex-col gap-1 text-xs">
                <span className="font-bold text-[#7A5726]">プロジェクトのゴール:</span>
                <p className="text-[#3D2406] leading-relaxed">{selectedPj.goal}</p>
              </div>

              {/* ★仕様書厳守: 確かめることの4項目チェックリスト */}
              <div className="p-4 rounded-2xl bg-[#FFF8E1] border border-[#F5B301] flex flex-col gap-2.5 text-xs">
                <span className="font-black text-[#3D2406] block">確かめることのチェックリスト（4項目すべて確認要）:</span>

                <label className="flex items-center gap-2 cursor-pointer font-bold text-[#3D2406]">
                  <input
                    type="checkbox"
                    checked={checks.safeContent}
                    onChange={(e) => setChecks({ ...checks, safeContent: e.target.checked })}
                    className="rounded accent-[#F5B301]"
                  />
                  <span>1. 学生どうしで進められる内容か（危険・法令に反する内容がない）</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-bold text-[#3D2406]">
                  <input
                    type="checkbox"
                    checked={checks.concreteReason}
                    onChange={(e) => setChecks({ ...checks, concreteReason: e.target.checked })}
                    className="rounded accent-[#F5B301]"
                  />
                  <span>2. 在籍校だけでは実現できない理由が具体的か</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-bold text-[#3D2406]">
                  <input
                    type="checkbox"
                    checked={checks.rolesMatched}
                    onChange={(e) => setChecks({ ...checks, rolesMatched: e.target.checked })}
                    className="rounded accent-[#F5B301]"
                  />
                  <span>3. ロールと必要な枝が内容と合っているか</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-bold text-[#3D2406]">
                  <input
                    type="checkbox"
                    checked={checks.noMoneyExchanged}
                    onChange={(e) => setChecks({ ...checks, noMoneyExchanged: e.target.checked })}
                    className="rounded accent-[#F5B301]"
                  />
                  <span>4. お金のやり取りがないか（学生間の健全な共創であること）</span>
                </label>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#B87503]/20">
                  <button
                    type="button"
                    onClick={() => handleDecision("reject")}
                    className="px-3.5 py-2 rounded-full border border-[#E57373] bg-[#FDEAEA] text-[#5F1313] font-bold"
                  >
                    見送る
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDecision("fix")}
                    className="px-3.5 py-2 rounded-full border border-[#B87503] bg-[#FFF8E1] text-[#B87503] font-bold"
                  >
                    直してもらう（下書きに戻す）
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDecision("publish")}
                    disabled={!allChecked}
                    className="px-5 py-2 rounded-full bg-[#F5B301] text-[#3D2406] font-black shadow-xs hover:bg-[#E0A200] disabled:opacity-40"
                  >
                    公開する（審査通過）✓
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 rounded-3xl bg-[#FFFBEB] border border-[#B87503]/30 text-center text-xs text-[#7A5726]">
              左の一覧から審査するプロジェクトを選択してください。
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
