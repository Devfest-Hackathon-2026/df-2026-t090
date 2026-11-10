"use client";

import Link from "next/link";

export default function RecordsCertPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between border-b border-[#B87503]/30 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[#3D2406] flex items-center gap-2">
            <span>🏆</span>
            <span>活動記録の認定</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#5C3D15] mt-1">
            終了したプロジェクトの成果物と活動記録を確かめ、参加メンバーのプロフィールに公式認定を付与します。
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
        <span className="text-4xl">📜</span>
        <h2 className="text-lg font-bold text-[#3D2406]">今後実装予定</h2>
        <p className="text-xs text-[#5C3D15] max-w-md leading-relaxed">
          今後のアップデートにおいて、終了プロジェクト一覧、成果物確認、メンバーごとの認定／保留切り替えアクションを構築します。
        </p>
      </div>
    </div>
  );
}
