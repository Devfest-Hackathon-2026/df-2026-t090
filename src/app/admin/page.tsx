"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";

interface InboxItem {
  id: string;
  type: "skill" | "project" | "evidence_pending" | "record_cert";
  typeLabel: string;
  title: string;
  submittedByInfo: string; // 所属と学年のみ（例: "東京農工大 農学部 3年"）
  daysWaiting: number;    // 経過日数（3日以上は目立たせる）
  assignedAdminName?: string;
  actionUrl: string;
}

export default function AdminInboxPage() {
  const [, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<string>("all");

  // デモ用および初期表示用の受付箱データ
  const [items] = useState<InboxItem[]>([
    {
      id: "demo-inbox-1",
      type: "skill",
      typeLabel: "スキル申請",
      title: "微生物培養・発酵技術 (Lv2希望)",
      submittedByInfo: "東京農工大学 農学部 3年",
      daysWaiting: 4, // 3日以上待ち（強調表示）
      assignedAdminName: "未担当",
      actionUrl: "/admin/skills-review",
    },
    {
      id: "demo-inbox-2",
      type: "project",
      typeLabel: "プロジェクト公開",
      title: "小型センサー内蔵スマート竹刀で打突フォーム可視化",
      submittedByInfo: "東京工業大学 工学院 4年",
      daysWaiting: 1,
      assignedAdminName: "未担当",
      actionUrl: "/admin/projects-review",
    },
    {
      id: "demo-inbox-3",
      type: "skill",
      typeLabel: "スキル申請",
      title: "Next.js / React Webアプリケーション開発 (Lv3希望)",
      submittedByInfo: "早稲田大学 基幹理工学部 2年",
      daysWaiting: 2,
      assignedAdminName: "未担当",
      actionUrl: "/admin/skills-review",
    },
    {
      id: "demo-inbox-4",
      type: "evidence_pending",
      typeLabel: "根拠追加のお願い中",
      title: "基本情報技術者試験 (FE) - 合格番号の確認",
      submittedByInfo: "東京学芸大学 教育学部 1年",
      daysWaiting: 5,
      assignedAdminName: "本部Admin",
      actionUrl: "/admin/skills-review",
    },
    {
      id: "demo-inbox-5",
      type: "record_cert",
      typeLabel: "活動記録認定待ち",
      title: "キャンパス空き教室リアルタイム共有マップ (第1期完了)",
      submittedByInfo: "武蔵野美術大学 造形構想学部 3年",
      daysWaiting: 1,
      assignedAdminName: "未担当",
      actionUrl: "/admin/records-cert",
    },
  ]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredItems =
    filterType === "all" ? items : items.filter((i) => i.type === filterType);

  // 集計
  const skillWaiting = items.filter((i) => i.type === "skill").length;
  const overdueWaiting = items.filter((i) => i.daysWaiting >= 3).length;
  const projectWaiting = items.filter((i) => i.type === "project").length;
  const evidenceWaiting = items.filter((i) => i.type === "evidence_pending").length;
  const certWaiting = items.filter((i) => i.type === "record_cert").length;

  return (
    <div className="flex flex-col gap-6">
      {/* ページタイトル */}
      <div className="border-b border-[#B87503]/30 pb-4">
        <h1 className="text-xl sm:text-2xl font-black text-[#3D2406] flex items-center gap-2">
          <span>📥</span>
          <span>審査の受付箱</span>
        </h1>
        <p className="text-xs sm:text-sm text-[#5C3D15] mt-1">
          学生から届いたスキル申請、プロジェクト公開申請、活動記録認定の審査待ち一覧です（目安: 3日以内）。
        </p>
      </div>

      {/* 集計カード（仕様: スキル申請待ち/3日以上待ち、プロジェクト公開待ち、根拠追加お願い中、活動記録認定待ち） */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-[#FFFBEB] border border-[#B87503]/30 shadow-xs flex flex-col gap-1">
          <span className="text-xs font-bold text-[#7A5726]">スキル申請待ち</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-[#3D2406]">{skillWaiting}</span>
            <span className="text-xs font-bold text-[#5C3D15]">件</span>
            {overdueWaiting > 0 && (
              <span className="ml-auto px-2 py-0.5 rounded-full bg-[#FDEAEA] text-[#5F1313] border border-[#E57373] text-[10px] font-black">
                うち3日以上: {overdueWaiting}件
              </span>
            )}
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-[#FFFBEB] border border-[#B87503]/30 shadow-xs flex flex-col gap-1">
          <span className="text-xs font-bold text-[#7A5726]">プロジェクト公開待ち</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-[#3D2406]">{projectWaiting}</span>
            <span className="text-xs font-bold text-[#5C3D15]">件</span>
            <span className="text-[10px] text-[#7A5726] ml-auto">最長経過: 1日</span>
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-[#FFFBEB] border border-[#B87503]/30 shadow-xs flex flex-col gap-1">
          <span className="text-xs font-bold text-[#7A5726]">根拠の追加お願い中</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-[#B87503]">{evidenceWaiting}</span>
            <span className="text-xs font-bold text-[#5C3D15]">件</span>
            <span className="text-[10px] text-[#7A5726] ml-auto">学生返事待ち</span>
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-[#FFF8E1] border-2 border-[#F5B301] shadow-xs flex flex-col gap-1">
          <span className="text-xs font-bold text-[#B87503]">活動記録の認定待ち</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-[#B87503]">{certWaiting}</span>
            <span className="text-xs font-bold text-[#3D2406]">件</span>
          </div>
        </div>
      </div>

      {/* 絞り込みバー */}
      <div className="p-3.5 rounded-2xl bg-[#FFFBEB] border border-[#B87503]/20 shadow-xs flex items-center justify-between gap-3">
        <span className="text-xs font-bold text-[#3D2406]">種類で絞り込み:</span>
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { id: "all", label: "すべて" },
            { id: "skill", label: "スキル申請" },
            { id: "project", label: "プロジェクト公開" },
            { id: "evidence_pending", label: "根拠追加お願い中" },
            { id: "record_cert", label: "活動記録認定" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterType(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                filterType === tab.id
                  ? "bg-[#F5B301] text-[#3D2406] shadow-xs"
                  : "bg-[#FFFDF7] text-[#5C3D15] hover:bg-[#FFF8E1] border border-[#B87503]/20"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 古い順の審査待ち一覧（仕様: 所属と学年のみ表示、3日以上は目立たせる） */}
      <div className="overflow-x-auto rounded-2xl border border-[#B87503]/30 bg-[#FFFBEB] shadow-xs">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead>
            <tr className="bg-[#FFF2BE]/70 border-b border-[#B87503]/30 text-[#3D2406] font-bold">
              <th className="py-2.5 px-4 whitespace-nowrap">種類</th>
              <th className="py-2.5 px-4">申請内容</th>
              <th className="py-2.5 px-4">出した人（所属と学年のみ）</th>
              <th className="py-2.5 px-4 whitespace-nowrap">待ち日数</th>
              <th className="py-2.5 px-4 whitespace-nowrap">担当運営</th>
              <th className="py-2.5 px-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#B87503]/15">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-[#7A5726] font-bold">
                  読み込み中...
                </td>
              </tr>
            ) : filteredItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-[#7A5726] font-bold">
                  現在、審査待ちの案件はありません。
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => {
                const isOverdue = item.daysWaiting >= 3;
                return (
                  <tr
                    key={item.id}
                    className={`hover:bg-[#FFFDF7]/60 transition-colors ${
                      isOverdue ? "bg-[#FFF2BE]/25" : ""
                    }`}
                  >
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FFF8E1] border border-[#B87503]/30 text-[#B87503]">
                        {item.typeLabel}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-[#3D2406]">
                      {item.title}
                    </td>
                    <td className="py-3 px-4 text-xs text-[#5C3D15]">
                      {item.submittedByInfo}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold ${
                          isOverdue
                            ? "bg-[#FDEAEA] text-[#5F1313] border border-[#E57373] animate-pulse"
                            : "bg-[#EDF7ED] text-[#1E4620]"
                        }`}
                      >
                        {item.daysWaiting}日待ち {isOverdue && "(要対応)"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-[#7A5726]">
                      {item.assignedAdminName || "未担当"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        href={item.actionUrl}
                        className="inline-block px-3 py-1.5 rounded-full bg-[#F5B301] text-[#3D2406] text-xs font-bold hover:bg-[#E0A200] shadow-xs"
                      >
                        審査する
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
