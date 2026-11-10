"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { User } from "firebase/auth";
import { UserProfile } from "@/lib/types/hive";

interface StudentSidebarProps {
  user: User | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  activeNav: string;
  onSelectNav: (navId: string) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  refreshTrigger?: number; // 応募承認などで参加プロジェクトが更新された場合のトリガー
}

interface ProjectSummaryItem {
  id: string;
  name: string;
  isCompleted: boolean;
  isOwner?: boolean;
}

const DEFAULT_PROJECTS: ProjectSummaryItem[] = [
  {
    id: "demo-idea-craft-beer",
    name: "地域伝統クラフトビール開発",
    isCompleted: false,
  },
  {
    id: "demo-idea-campus-map",
    name: "学内空き教室リアルタイム共有",
    isCompleted: false,
  },
  {
    id: "demo-completed-pj",
    name: "放置竹林サステナブル照明 (第1期)",
    isCompleted: true,
  },
];

export default function StudentSidebar({
  user,
  profile,
  isAdmin,
  activeNav,
  onSelectNav,
  isOpenMobile = false,
  onCloseMobile,
  refreshTrigger = 0,
}: StudentSidebarProps) {
  const [projects, setProjects] = useState<ProjectSummaryItem[]>(DEFAULT_PROJECTS);

  // 参加中プロジェクトの動的取得
  useEffect(() => {
    if (!user) return;

    let active = true;
    const fetchMyProjects = async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/student/my-projects", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (active && Array.isArray(data.projects)) {
            const mergedMap = new Map<string, ProjectSummaryItem>();
            DEFAULT_PROJECTS.forEach((p) => mergedMap.set(p.id, p));
            data.projects.forEach((p: ProjectSummaryItem) => mergedMap.set(p.id, p));
            setProjects(Array.from(mergedMap.values()));
          }
        }
      } catch (err) {
        console.error("参加プロジェクト取得エラー:", err);
      }
    };

    fetchMyProjects();
    return () => {
      active = false;
    };
  }, [user, refreshTrigger]);

  const mainMenuItems = [
    { id: "home", label: "ホーム（合うプロジェクト）", icon: "🏠", badge: null },
    { id: "profile", label: "スキルツリー・プロフィール", icon: "🌿", badge: null },
    { id: "scout", label: "スカウト", icon: "💌", badge: 2 }, // 未読2件のバッジ付き
    { id: "submit", label: "申請・公開", icon: "📝", badge: null },
    { id: "records", label: "活動記録", icon: "🏆", badge: null },
  ];

  return (
    <>
      {/* モバイル用背景オーバーレイ */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-[#3D2406]/40 backdrop-blur-xs md:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* サイドバー本体 */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-40 h-screen w-72 bg-[#FBF5E5] border-r border-[#B87503]/30 flex flex-col justify-between p-4 transition-transform duration-200 md:translate-x-0 ${
          isOpenMobile ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col gap-5 overflow-y-auto no-scrollbar">
          {/* サービスロゴ */}
          <div className="flex items-center justify-between pb-3 border-b border-[#B87503]/20">
            <Link href="/" className="flex items-center gap-2.5">
              <span
                className="flex items-center justify-center w-9 h-10 bg-[#F5B301] text-[#3D2406] font-black text-xl rounded-sm shadow-xs"
                style={{ clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)" }}
              >
                H
              </span>
              <div>
                <span className="font-black text-xl tracking-wider text-[#3D2406] block leading-none">HIVE</span>
                <span className="text-[10px] text-[#7A5726] font-medium block mt-0.5">学校を越えるプロジェクト共創</span>
              </div>
            </Link>

            {onCloseMobile && (
              <button
                type="button"
                onClick={onCloseMobile}
                className="p-1 rounded-lg text-[#5C3D15] hover:bg-[#F5B301]/20 md:hidden text-lg"
              >
                ✕
              </button>
            )}
          </div>

          {/* ログインユーザーの簡易情報 */}
          {user && (
            <div className="p-3 rounded-2xl bg-[#FFFBEB] border border-[#B87503]/20 shadow-xs flex items-center justify-between">
              <div className="overflow-hidden">
                <span className="text-xs font-black text-[#3D2406] block truncate">
                  {profile?.displayName || user.displayName || "学生ユーザー"}
                </span>
                <span className="text-[11px] text-[#7A5726] block truncate">
                  {profile?.schoolName || "学校未設定"} {profile?.grade || ""}
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-[#FFF8E1] border border-[#F5B301] text-[#B87503] text-[10px] font-bold shrink-0">
                {profile?.rank?.title || "初段"}
              </span>
            </div>
          )}

          {/* メインメニュー（仕様: ホーム、スキルツリー、スカウト、申請公開、活動記録） */}
          <nav className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-[#7A5726] px-2 mb-1">メインメニュー</span>
            {mainMenuItems.map((item) => {
              const isActive = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectNav(item.id);
                    if (onCloseMobile) onCloseMobile();
                  }}
                  className={`min-h-[44px] w-full flex items-center justify-between px-3 py-2 rounded-2xl text-xs font-bold transition-all text-left ${
                    isActive
                      ? "bg-[#F5B301] text-[#3D2406] shadow-xs border border-[#E0A200]"
                      : "text-[#5C3D15] hover:bg-[#FFFBEB] hover:text-[#3D2406]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="px-1.5 py-0.2 rounded-full bg-[#EA4335] text-white text-[10px] font-black shrink-0">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* 参加中のプロジェクト（仕様: チャット、ファイル、予定、メンバーと役割、終了PJは薄く） */}
          <div className="flex flex-col gap-2 pt-2 border-t border-[#B87503]/20">
            <span className="text-[11px] font-bold text-[#7A5726] px-2">参加中のプロジェクト</span>
            <div className="flex flex-col gap-3">
              {projects.map((pj) => (
                <div
                  key={pj.id}
                  className={`p-2.5 rounded-2xl border transition-colors ${
                    pj.isCompleted
                      ? "bg-[#FFFDF7]/60 border-[#B87503]/15 opacity-60"
                      : "bg-[#FFFBEB] border-[#B87503]/25 shadow-xs"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1 px-1">
                    <span className="text-xs font-bold text-[#3D2406] truncate block">
                      {pj.name} {pj.isCompleted && <span className="text-[10px] text-[#7A5726]">（終了）</span>}
                    </span>
                  </div>

                  {/* サブメニュー: チャット、ファイル、予定、メンバー */}
                  <div className="grid grid-cols-2 gap-1 text-[11px]">
                    <button
                      type="button"
                      onClick={() => onSelectNav(`workspace-${pj.id}-chat`)}
                      className="py-1 px-2 rounded-lg text-left text-[#5C3D15] hover:bg-[#F5B301]/20 font-medium flex items-center gap-1"
                    >
                      <span>💬</span>
                      <span>チャット</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectNav(`workspace-${pj.id}-files`)}
                      className="py-1 px-2 rounded-lg text-left text-[#5C3D15] hover:bg-[#F5B301]/20 font-medium flex items-center gap-1"
                    >
                      <span>📁</span>
                      <span>ファイル</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectNav(`workspace-${pj.id}-schedule`)}
                      className="py-1 px-2 rounded-lg text-left text-[#5C3D15] hover:bg-[#F5B301]/20 font-medium flex items-center gap-1"
                    >
                      <span>📅</span>
                      <span>予定・空き</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectNav(`workspace-${pj.id}-members`)}
                      className="py-1 px-2 rounded-lg text-left text-[#5C3D15] hover:bg-[#F5B301]/20 font-medium flex items-center gap-1"
                    >
                      <span>👥</span>
                      <span>メンバー</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* フッターエリア: 運営管理画面リンク ＆ バージョン */}
        <div className="pt-3 border-t border-[#B87503]/20 flex flex-col gap-2">
          {/* 運営管理画面への切り替えリンク（審査用設定: ログインしている全員に表示） */}
          {user && (
            <Link
              href="/admin"
              className="min-h-[44px] w-full py-2.5 px-3 rounded-2xl bg-[#FFF8E1] border-2 border-[#F5B301] text-[#B87503] hover:bg-[#F5B301] hover:text-[#3D2406] text-xs font-black shadow-xs transition-all flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <span>🛡️</span>
                <span>運営の管理画面へ</span>
              </div>
              <span className="text-[10px] bg-[#B87503] text-white px-1.5 py-0.2 rounded-md">
                Admin
              </span>
            </Link>
          )}

          <div className="text-[10px] text-[#7A5726] text-center">
            HIVE v0.1 • 学生プロジェクト共創
          </div>
        </div>
      </aside>
    </>
  );
}
