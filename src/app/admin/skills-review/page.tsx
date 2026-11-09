"use client";

import Link from "next/link";

export default function SkillsReviewPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between border-b border-[#B87503]/30 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[#3D2406] flex items-center gap-2">
            <span>🔍</span>
            <span>A02 スキル申請の審査</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#5C3D15] mt-1">
            学生から提出されたスキルの枝と根拠（講義・資格・制作物など）を審査し、ツリーに反映または差し戻します。
          </p>
        </div>
        <Link
          href="/admin"
          className="px-4 py-2 rounded-full border border-[#B87503] bg-[#FFF8E1] text-[#3D2406] text-xs font-bold hover:bg-[#F5B301]"
        >
          ← 受付箱に戻る
        </Link>
      </div>

      <div className="p-8 rounded-3xl bg-[#FFFBEB] border border-[#B87503]/30 text-center flex flex-col items-center gap-3">
        <span className="text-4xl">🌿</span>
        <h2 className="text-lg font-bold text-[#3D2406]">第2段階で詳細審査機能を実装します</h2>
        <p className="text-xs text-[#5C3D15] max-w-md leading-relaxed">
          第2段階（スキル）の実装フェーズにおいて、左側に申請一覧、右側に根拠ファイルプレビューと「ツリーに反映」「根拠追加のお願い」「見送り」の判定アクションを構築します。
        </p>
      </div>
    </div>
  );
}
