"use client";

import Link from "next/link";

export default function AnnouncementsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between border-b border-[#B87503]/30 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[#3D2406] flex items-center gap-2">
            <span>📢</span>
            <span>A08 お知らせの配信</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#5C3D15] mt-1">
            メンテナンス・新機能・大切なお願い・イベントを配信します。全員宛てのお知らせは運営2人確認を経て配信されます。
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
        <span className="text-4xl">✉️</span>
        <h2 className="text-lg font-bold text-[#3D2406]">第5段階でお知らせ配信機能を実装します</h2>
        <p className="text-xs text-[#5C3D15] max-w-md leading-relaxed">
          入力フォーム（件名・本文・配信先・届け方）、プレビュー表示、予約、および全員宛て配信時の運営2人確認ワークフローを構築します。
        </p>
      </div>
    </div>
  );
}
