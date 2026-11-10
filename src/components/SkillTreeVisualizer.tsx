"use client";

import { useState, useMemo, useEffect } from "react";
import { UserSkillBranch } from "@/lib/types/hive";

export interface SkillTreeVisualizerProps {
  userBranches: UserSkillBranch[];
  requiredSkillsFromProjects?: Array<{
    skillName: string;
    projectTitle: string;
    roleName: string;
  }>;
  onApplyNewSkill?: () => void;
}

interface CategoryDefinition {
  id: string;
  name: string;
  shortName: string;
  subName?: string;
  x: number; // パーセント (0〜100)
  y: number; // パーセント (0〜100)
  branchSlots: {
    [count: number]: Array<{ x: number; y: number }>;
  };
  overflowSlot: { x: number; y: number };
  matcher: (b: UserSkillBranch) => boolean;
}

const CATEGORIES: CategoryDefinition[] = [
  {
    id: "cat-life-science",
    name: "生命科学・農学",
    shortName: "生命科学",
    subName: "農学",
    x: 26,
    y: 27,
    branchSlots: {
      1: [{ x: 12, y: 18 }],
      2: [
        { x: 15, y: 11 },
        { x: 10, y: 28 },
      ],
      3: [
        { x: 20, y: 9 },
        { x: 9, y: 18 },
        { x: 9, y: 34 },
      ],
    },
    overflowSlot: { x: 11, y: 44 },
    matcher: (b) =>
      b.categoryId === "cat-life-science" ||
      b.categoryName?.includes("生命") ||
      b.categoryName?.includes("農") ||
      /生物|培養|遺伝子|バイオ|土壌|農学|生理/i.test(b.skillName),
  },
  {
    id: "cat-it-programming",
    name: "情報・プログラミング",
    shortName: "情報",
    subName: "プログラミング",
    x: 74,
    y: 27,
    branchSlots: {
      1: [{ x: 88, y: 18 }],
      2: [
        { x: 85, y: 11 },
        { x: 90, y: 28 },
      ],
      3: [
        { x: 80, y: 9 },
        { x: 91, y: 18 },
        { x: 91, y: 34 },
      ],
    },
    overflowSlot: { x: 89, y: 44 },
    matcher: (b) =>
      b.categoryId === "cat-it-programming" ||
      b.categoryName?.includes("情報") ||
      b.categoryName?.includes("IT") ||
      b.categoryName?.includes("プログラミング") ||
      /Python|情報|機械学習|IoT|回路|プログラミング|Web|開発|データ/i.test(b.skillName),
  },
  {
    id: "cat-language-exams",
    name: "語学・資格試験",
    shortName: "語学・試験",
    subName: "資格",
    x: 26,
    y: 73,
    branchSlots: {
      1: [{ x: 12, y: 82 }],
      2: [
        { x: 10, y: 68 },
        { x: 16, y: 89 },
      ],
      3: [
        { x: 9, y: 62 },
        { x: 9, y: 78 },
        { x: 20, y: 91 },
      ],
    },
    overflowSlot: { x: 11, y: 52 },
    matcher: (b) =>
      b.categoryId === "cat-language-exams" ||
      b.categoryName?.includes("語学") ||
      b.categoryName?.includes("試験") ||
      b.categoryName?.includes("資格") ||
      /TOEIC|英語|試験|資格|基本情報|FE/i.test(b.skillName),
  },
  {
    id: "cat-experience",
    name: "経験・デザイン",
    shortName: "経験",
    subName: "デザイン",
    x: 74,
    y: 73,
    branchSlots: {
      1: [{ x: 88, y: 82 }],
      2: [
        { x: 90, y: 68 },
        { x: 84, y: 89 },
      ],
      3: [
        { x: 91, y: 62 },
        { x: 91, y: 78 },
        { x: 80, y: 91 },
      ],
    },
    overflowSlot: { x: 89, y: 52 },
    matcher: (b) =>
      b.categoryId === "cat-experience" ||
      b.categoryName?.includes("経験") ||
      b.categoryName?.includes("デザイン") ||
      /デザイン|運営|講師|企画|広報|リーダー|経験/i.test(b.skillName),
  },
];

export default function SkillTreeVisualizer({
  userBranches,
  requiredSkillsFromProjects = [],
  onApplyNewSkill,
}: SkillTreeVisualizerProps) {
  // 参加中のプロジェクトの役割で求められているのに、自分がまだ持っていないスキルを「次に伸ばせる枝」として補完
  const allBranches = useMemo(() => {
    const list: UserSkillBranch[] = [...userBranches];
    const existingSkillNames = new Set(
      list.map((b) => b.skillName.trim().toLowerCase())
    );

    // プロジェクトから求められているスキルの補完
    for (const req of requiredSkillsFromProjects) {
      const cleanName = req.skillName.trim();
      if (!cleanName || existingSkillNames.has(cleanName.toLowerCase())) continue;
      existingSkillNames.add(cleanName.toLowerCase());

      // カテゴリ推定
      let catId = "cat-experience";
      let catName = "経験・デザイン";
      if (/生命|農|生物|バイオ|遺伝子|土壌|培養/i.test(cleanName)) {
        catId = "cat-life-science";
        catName = "生命科学・農学";
      } else if (
        /情報|プログラミング|Python|機械学習|IoT|回路|Web|IT|データ/i.test(
          cleanName
        )
      ) {
        catId = "cat-it-programming";
        catName = "情報・プログラミング";
      } else if (/語学|英語|TOEIC|試験|資格|基本情報/i.test(cleanName)) {
        catId = "cat-language-exams";
        catName = "語学・資格試験";
      }

      list.push({
        id: `next-${cleanName}`,
        userId: "current-user",
        skillId: `next-${cleanName}`,
        skillName: cleanName,
        categoryId: catId,
        categoryName: catName,
        status: "next",
        evidence: {
          evidenceType: "portfolio",
          description: `参加中プロジェクト「${req.projectTitle}」の募集ロール（${req.roleName}）で求められているスキルです。`,
          fileUrls: [],
          links: [],
        },
        submittedAt: new Date().toISOString(),
      });
    }

    return list;
  }, [userBranches, requiredSkillsFromProjects]);

  // 選択された枝の詳細表示用State
  const [selectedBranch, setSelectedBranch] = useState<UserSkillBranch | null>(
    null
  );

  // 初期選択（審査済みの最初の枝、なければ最初の枝）
  useEffect(() => {
    if (allBranches.length > 0 && !selectedBranch) {
      const initial =
        allBranches.find((b) => b.status === "verified") || allBranches[0];
      setSelectedBranch(initial);
    }
  }, [allBranches, selectedBranch]);

  // 集計
  const verifiedCount = useMemo(
    () => allBranches.filter((b) => b.status === "verified").length,
    [allBranches]
  );
  const pendingCount = useMemo(
    () => allBranches.filter((b) => b.status === "pending").length,
    [allBranches]
  );
  const nextCount = useMemo(
    () => allBranches.filter((b) => b.status === "next").length,
    [allBranches]
  );

  // 各分野ごとの枝を取得（最大3本まで描画、4本以上は残りをカウント）
  const categoryBranchesMap = useMemo(() => {
    const map = new Map<string, UserSkillBranch[]>();
    CATEGORIES.forEach((cat) => {
      const branches = allBranches.filter((b) => cat.matcher(b));
      map.set(cat.id, branches);
    });
    return map;
  }, [allBranches]);

  // 残りスキル表示モーダル用State
  const [overflowListCategory, setOverflowListCategory] =
    useState<CategoryDefinition | null>(null);

  return (
    <div className="flex flex-col gap-4 text-left">
      {/* ──────────────── 1. 上部ヘッダー（件数＆申請ボタン） ──────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#B87503]/20 pb-3">
        <div className="flex items-baseline gap-2 sm:gap-3 flex-wrap">
          <h3 className="text-lg sm:text-xl font-black text-[#3D2406]">
            スキルツリー
          </h3>
          <span className="text-xs text-[#7A5726] font-medium">
            審査済み {verifiedCount} ・ 審査中 {pendingCount} ・ 次に伸ばせる枝 {nextCount}
          </span>
        </div>

        {onApplyNewSkill && (
          <button
            type="button"
            onClick={onApplyNewSkill}
            className="px-4 py-2 rounded-xl bg-[#3D2406] text-[#FFFDF7] text-xs font-bold shadow-xs hover:bg-[#5C3D15] transition-colors self-start sm:self-auto"
          >
            枝を増やす（申請）
          </button>
        )}
      </div>

      {/* ──────────────── 2. 放射状ツリー図枠（縦横 440px 枠） ──────────────── */}
      <div className="relative w-full max-w-[500px] h-[430px] sm:h-[450px] mx-auto my-2 select-none">
        {/* SVG による線の描画 */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {/* 中央「あなた」から4分野への実線 */}
          {CATEGORIES.map((cat) => (
            <line
              key={`center-line-${cat.id}`}
              x1="50"
              y1="50"
              x2={cat.x}
              y2={cat.y}
              stroke="#7A5726"
              strokeWidth="1.8"
            />
          ))}

          {/* 各分野から枝への細い線 */}
          {CATEGORIES.map((cat) => {
            const branches = categoryBranchesMap.get(cat.id) || [];
            if (branches.length === 0) return null;

            const count = Math.min(branches.length, 3);
            const slots = cat.branchSlots[count] || cat.branchSlots[1];

            return branches.slice(0, 3).map((branch, idx) => {
              const slot = slots[idx];
              if (!slot) return null;

              const isVerified = branch.status === "verified";
              const isPending = branch.status === "pending";

              return (
                <line
                  key={`branch-line-${cat.id}-${branch.id || idx}`}
                  x1={cat.x}
                  y1={cat.y}
                  x2={slot.x}
                  y2={slot.y}
                  stroke={isVerified ? "#7A5726" : isPending ? "#B87503" : "#B87503"}
                  strokeWidth="1.4"
                  strokeDasharray={
                    isVerified ? undefined : isPending ? "4 4" : "2 2"
                  }
                />
              );
            });
          })}
        </svg>

        {/* 中央の「あなた」ひし形（正方形を45度回転、一辺72px程度） */}
        <div
          className="absolute z-20 flex items-center justify-center -translate-x-1/2 -translate-y-1/2"
          style={{ left: "50%", top: "50%" }}
        >
          <div className="w-[66px] h-[66px] sm:w-[72px] sm:h-[72px] rotate-45 bg-[#3D2406] border-2 border-[#F5B301] shadow-md flex items-center justify-center">
            <span className="-rotate-45 text-[#FFFDF7] font-black text-xs sm:text-sm tracking-wider">
              あなた
            </span>
          </div>
        </div>

        {/* 4分野のひし形（正方形を45度回転、一辺60px程度） */}
        {CATEGORIES.map((cat) => (
          <div
            key={`cat-diamond-${cat.id}`}
            className="absolute z-20 flex items-center justify-center -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${cat.x}%`, top: `${cat.y}%` }}
          >
            <div className="w-[54px] h-[54px] sm:w-[60px] sm:h-[60px] rotate-45 bg-[#FFFDF7] border-2 border-[#7A5726] shadow-xs flex items-center justify-center p-1">
              <div className="-rotate-45 text-[#3D2406] font-black text-[10px] sm:text-[11px] text-center leading-tight">
                <div>{cat.shortName}</div>
                {cat.subName && (
                  <div className="text-[8px] sm:text-[9px] text-[#7A5726] font-semibold">
                    {cat.subName}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* 各分野から伸びるスキルボタン（枝） */}
        {CATEGORIES.map((cat) => {
          const branches = categoryBranchesMap.get(cat.id) || [];
          if (branches.length === 0) return null;

          const count = Math.min(branches.length, 3);
          const slots = cat.branchSlots[count] || cat.branchSlots[1];
          const remainingCount = branches.length - 3;

          return (
            <div key={`branches-group-${cat.id}`}>
              {branches.slice(0, 3).map((branch, idx) => {
                const slot = slots[idx];
                if (!slot) return null;

                const isVerified = branch.status === "verified";
                const isPending = branch.status === "pending";
                const isNext = branch.status === "next";
                const isSelected =
                  selectedBranch?.id === branch.id ||
                  selectedBranch?.skillName === branch.skillName;

                return (
                  <button
                    key={`branch-btn-${branch.id || idx}`}
                    type="button"
                    onClick={() => setSelectedBranch(branch)}
                    className={`absolute z-30 -translate-x-1/2 -translate-y-1/2 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl text-[10px] sm:text-xs font-bold transition-all shadow-xs flex items-center gap-1 whitespace-nowrap max-w-[105px] sm:max-w-[130px] hover:scale-105 active:scale-95 ${
                      isSelected ? "ring-2 ring-[#3D2406] ring-offset-2" : ""
                    } ${
                      isVerified
                        ? "bg-[#F5B301] text-[#3D2406] border border-[#B87503]"
                        : isPending
                        ? "bg-[#FFF8E1] text-[#7A5726] border-2 border-dashed border-[#B87503]"
                        : "bg-transparent text-[#7A5726] border-2 border-dotted border-[#B87503]"
                    }`}
                    style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                    title={branch.skillName}
                  >
                    <span className="truncate">{branch.skillName}</span>
                    {isVerified && branch.level && (
                      <span className="shrink-0 font-black text-[10px]">
                        Lv{branch.level}
                      </span>
                    )}
                    {isPending && (
                      <span className="shrink-0 text-[9px] text-[#B87503] font-bold">
                        審査中
                      </span>
                    )}
                    {isNext && (
                      <span className="shrink-0 text-[9px] text-[#7A5726] font-bold">
                        次に伸ばせる
                      </span>
                    )}
                  </button>
                );
              })}

              {/* 4本以上ある場合の「＋残りの数」ボタン */}
              {remainingCount > 0 && (
                <button
                  type="button"
                  onClick={() => setOverflowListCategory(cat)}
                  className="absolute z-30 -translate-x-1/2 -translate-y-1/2 px-2 py-0.5 rounded-lg text-[9px] sm:text-[10px] font-bold bg-[#FFFDF7] text-[#7A5726] border border-[#B87503]/50 shadow-xs hover:bg-[#FFF4CA] transition-colors"
                  style={{
                    left: `${cat.overflowSlot.x}%`,
                    top: `${cat.overflowSlot.y}%`,
                  }}
                  title={`残り ${remainingCount} 個のスキルを表示`}
                >
                  ＋{remainingCount}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* ──────────────── 3. 図の下の欄（選択したスキルの詳細） ──────────────── */}
      {selectedBranch ? (
        <div className="p-4 sm:p-5 rounded-2xl bg-[#FFFDF7] border border-[#B87503]/30 shadow-xs flex flex-col gap-2">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-base sm:text-lg font-black text-[#3D2406]">
              {selectedBranch.skillName}
              {selectedBranch.level
                ? ` Lv${selectedBranch.level}`
                : selectedBranch.score
                ? ` (${selectedBranch.score})`
                : ""}
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                selectedBranch.status === "verified"
                  ? "bg-[#3D2406] text-[#FFFDF7] border border-[#3D2406]"
                  : selectedBranch.status === "pending"
                  ? "bg-[#FFF8E1] text-[#B87503] border-2 border-dashed border-[#B87503]"
                  : "bg-transparent text-[#7A5726] border-2 border-dotted border-[#7A5726]"
              }`}
            >
              {selectedBranch.status === "verified"
                ? "審査済み"
                : selectedBranch.status === "pending"
                ? "審査中"
                : "次に伸ばせる枝"}
            </span>
          </div>

          <p className="text-xs sm:text-sm text-[#5C3D15] leading-relaxed">
            {selectedBranch.evidence?.description ||
              "大学の講義、研究活動、または個人プロジェクトにて実践的な実習・開発を担当。"}
            {selectedBranch.reviewerComment && (
              <span className="ml-1 text-[#3D2406] font-medium">
                {selectedBranch.reviewerComment}
              </span>
            )}
            {selectedBranch.status === "verified" && (
              <span className="text-[#7A5726] block sm:inline mt-1 sm:mt-0 sm:ml-2">
                審査日{" "}
                {selectedBranch.reviewedAt
                  ? new Date(selectedBranch.reviewedAt).toLocaleDateString(
                      "ja-JP",
                      {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      }
                    )
                  : "2026年9月2日"}
                {" ・ 根拠"}
                {(selectedBranch.evidence?.links?.length || 0) +
                  (selectedBranch.evidence?.fileUrls?.length || 0) || 2}
                件
              </span>
            )}
            {selectedBranch.status === "pending" && (
              <span className="text-[#B87503] block sm:inline mt-1 sm:mt-0 sm:ml-2">
                申請日{" "}
                {selectedBranch.submittedAt
                  ? new Date(selectedBranch.submittedAt).toLocaleDateString(
                      "ja-JP",
                      {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      }
                    )
                  : "2026年11月8日"}
                {" ・ 運営審査中（通常3日以内に審査完了）"}
              </span>
            )}
            {selectedBranch.status === "next" && (
              <span className="text-[#7A5726] block sm:inline mt-1 sm:mt-0 sm:ml-2">
                目標スキル（参加中のプロジェクト活動を通じて認定獲得を目指せます）
              </span>
            )}
          </p>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-[#FFFDF7] border border-[#B87503]/20 text-xs text-[#7A5726] text-center">
          枝のボタンを押すと、スキルの実績や審査の詳細が表示されます。
        </div>
      )}

      {/* ──────────────── 4. 「＋残りの数」用一覧モーダル ──────────────── */}
      {overflowListCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="p-6 rounded-3xl bg-[#FFFBEB] border-2 border-[#B87503] shadow-xl max-w-md w-full flex flex-col gap-4 text-left">
            <div className="flex items-center justify-between border-b border-[#B87503]/20 pb-2">
              <h4 className="font-black text-sm text-[#3D2406]">
                {overflowListCategory.name} のスキル一覧
              </h4>
              <button
                type="button"
                onClick={() => setOverflowListCategory(null)}
                className="text-xs font-bold text-[#7A5726] hover:text-[#3D2406]"
              >
                ✕ 閉じる
              </button>
            </div>

            <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
              {(categoryBranchesMap.get(overflowListCategory.id) || []).map(
                (branch) => (
                  <button
                    key={`modal-branch-${branch.id}`}
                    type="button"
                    onClick={() => {
                      setSelectedBranch(branch);
                      setOverflowListCategory(null);
                    }}
                    className="p-2.5 rounded-xl border border-[#B87503]/30 bg-[#FFFDF7] hover:bg-[#FFF4CA] flex items-center justify-between text-xs font-bold text-[#3D2406] transition-colors"
                  >
                    <span>{branch.skillName}</span>
                    <span className="text-[10px] text-[#7A5726]">
                      {branch.status === "verified"
                        ? `審査済み Lv${branch.level || 1}`
                        : branch.status === "pending"
                        ? "審査中"
                        : "次に伸ばせる"}
                    </span>
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
