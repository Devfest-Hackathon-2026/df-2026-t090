"use client";

import Link from "next/link";

export default function ReportsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between border-b border-[#B87503]/30 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[#3D2406] flex items-center gap-2">
            <span>🚨</span>
            <span>通報への対応</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#5C3D15] mt-1">
            チャットやプロジェクトに対する通報を24時間以内を目安に対応し、注意送信・非公開化・一時停止（2人確認）を管理します。
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
        <span className="text-4xl">🛡️</span>
        <h2 className="text-lg font-bold text-[#3D2406]">第5段階で通報対応機能を実装します</h2>
        <p className="text-xs text-[#5C3D15] max-w-md leading-relaxed">
          未対応・対応中・済みのタブ、通報原文の閲覧、注意・非公開化および運営2人確認が必要なアカウント一時停止ワークフローを構築します。
        </p>
      </div>
    </div>
  );
}
