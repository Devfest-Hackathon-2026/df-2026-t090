"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { UserProfile } from "@/lib/types/hive";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchKeyword, setSearchKeyword] = useState<string>("");

  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!active) return;
      setUser(currentUser);

      if (!currentUser) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        const token = await currentUser.getIdToken();
        const res = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!active) return;

        if (res.ok) {
          const data = await res.json();
          setProfile(data.profile);
          setIsAdmin(Boolean(data.isAdmin));
        } else {
          setIsAdmin(false);
        }
      } catch {
        if (active) setIsAdmin(false);
      } finally {
        if (active) setLoading(false);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const adminNav = [
    { label: "A01 審査の受付箱", href: "/admin" },
    { label: "A02 スキル申請審査", href: "/admin/skills-review" },
    { label: "A03 プロジェクト公開審査", href: "/admin/projects-review" },
    { label: "A04 活動記録の認定", href: "/admin/records-cert" },
    { label: "A05 通報への対応", href: "/admin/reports" },
    { label: "A06 利用者の管理", href: "/admin/users" },
    { label: "A07 学校とスキル", href: "/admin/master" },
    { label: "A08 お知らせの配信", href: "/admin/announcements" },
    { label: "A09 操作の記録", href: "/admin/audit-logs" },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFFDF7] flex flex-col items-center justify-center p-4 text-[#3D2406]">
        <div className="flex items-center gap-3 bg-[#FFFBEB] p-6 rounded-2xl border border-[#B87503]/30 shadow-md">
          <span className="inline-block h-6 w-6 animate-spin rounded-full border-3 border-[#F5B301] border-t-transparent" />
          <span className="text-sm font-bold">運営権限を確認中...</span>
        </div>
      </div>
    );
  }

  // 未ログイン時の入場画面
  if (!user) {
    return (
      <div className="min-h-screen bg-[#FFFDF7] flex flex-col items-center justify-center p-4 text-[#3D2406]">
        <div className="max-w-md w-full bg-[#FFFBEB] p-8 rounded-3xl border-2 border-[#B87503] shadow-lg text-center flex flex-col items-center gap-4">
          <span className="text-4xl">🛡️</span>
          <h1 className="text-xl font-black text-[#3D2406]">HIVE 運営管理画面</h1>
          <p className="text-sm text-[#5C3D15] leading-relaxed">
            審査の受付箱（A01）、利用者の管理（A06）、学校・スキル一覧（A07）、操作ログ（A09）を利用するには、運営アカウントでログインしてください。
          </p>
          <button
            type="button"
            onClick={async () => {
              try {
                const { signInWithPopup } = await import("firebase/auth");
                const { googleProvider } = await import("@/lib/firebase");
                await signInWithPopup(auth, googleProvider);
              } catch (err) {
                alert("ログインに失敗しました: " + (err as Error).message);
              }
            }}
            className="w-full py-3 px-6 rounded-full bg-[#F5B301] text-[#3D2406] text-sm font-bold shadow-md hover:bg-[#E0A200] transition-all flex items-center justify-center gap-2"
          >
            <span>Googleでログインして運営画面を開く</span>
          </button>
          <Link
            href="/"
            className="text-xs text-[#7A5726] hover:underline mt-2 font-medium"
          >
            ← 学生向け画面に戻る
          </Link>
        </div>
      </div>
    );
  }

  // ログイン済みだが運営の印（admin）がない場合（開発・デモ用ワンクリック有効化）
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#FFFDF7] flex flex-col items-center justify-center p-4 text-[#3D2406]">
        <div className="max-w-md w-full bg-[#FFFBEB] p-8 rounded-3xl border-2 border-[#F5B301] shadow-lg text-center flex flex-col items-center gap-4">
          <span className="text-4xl">⚠️</span>
          <h1 className="text-xl font-black text-[#3D2406]">運営権限の有効化</h1>
          <p className="text-sm text-[#5C3D15] leading-relaxed">
            現在のアカウント（{user.displayName || user.email}）には運営の印（admin）がまだ紐付いていません。
          </p>
          <button
            type="button"
            onClick={async () => {
              try {
                const token = await user.getIdToken();
                const res = await fetch("/api/auth/me", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({
                    email: user.email,
                    displayName: user.displayName,
                    grantAdmin: true,
                  }),
                });
                if (res.ok) {
                  window.location.reload();
                } else {
                  alert("権限の有効化に失敗しました。");
                }
              } catch {
                alert("通信エラーが発生しました。");
              }
            }}
            className="w-full py-3 px-6 rounded-full bg-[#F5B301] text-[#3D2406] text-sm font-bold shadow-md hover:bg-[#E0A200] transition-all"
          >
            このアカウントに運営権限（Admin）を付与して入場 🚀
          </button>
          <Link
            href="/"
            className="text-xs text-[#7A5726] hover:underline mt-2 font-medium"
          >
            ← 学生向け画面へ戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFDF7] text-[#3D2406] flex flex-col">
      {/* 運営専用ヘッダー */}
      <header className="sticky top-0 z-30 bg-[#FFFBEB]/95 backdrop-blur-md border-b border-[#B87503]/30 shadow-xs px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          {/* 左側: ロゴ ＆ バッジ */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
            <Link href="/admin" className="flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-9 bg-[#F5B301] text-[#3D2406] font-black text-lg rounded-sm" style={{ clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)" }}>
                H
              </span>
              <span className="font-black text-lg tracking-wider text-[#3D2406]">HIVE 運営管理</span>
            </Link>
            <span className="px-2.5 py-0.5 rounded-full bg-[#F5B301]/20 text-[#B87503] border border-[#B87503]/40 text-xs font-bold">
              本部Admin
            </span>
          </div>

          {/* 中央: 利用者・プロジェクト検索バー */}
          <div className="w-full md:max-w-md flex items-center gap-2 bg-[#FFF8E1] border border-[#B87503]/30 rounded-full px-3 py-1.5 shadow-inner">
            <span className="text-sm">🔍</span>
            <input
              type="text"
              placeholder="利用者・学校・プロジェクトを検索..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="w-full bg-transparent text-xs sm:text-sm text-[#3D2406] placeholder-[#7A5726]/60 focus:outline-none"
            />
          </div>

          {/* 右側: 運営者名 ＆ 学生画面への切り替えボタン */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <div className="text-right hidden sm:block">
              <span className="text-[11px] text-[#7A5726] block font-medium">ログイン中（運営）</span>
              <span className="text-xs font-bold text-[#3D2406]">
                {profile?.displayName || user.displayName || user.email}
              </span>
            </div>
            <Link
              href="/"
              className="px-3.5 py-1.5 rounded-full border border-[#B87503] bg-[#FFF8E1] text-[#3D2406] text-xs font-bold hover:bg-[#F5B301] transition-colors shadow-xs flex items-center gap-1 shrink-0"
            >
              <span>🐝</span>
              <span>学生の画面へ</span>
            </Link>
          </div>
        </div>

        {/* サブナビゲーションバー（A01〜A09） */}
        <div className="max-w-7xl mx-auto mt-3 overflow-x-auto no-scrollbar flex items-center gap-1.5 pt-2 border-t border-[#B87503]/20">
          {adminNav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-[#F5B301] text-[#3D2406] shadow-sm border border-[#E0A200]"
                    : "text-[#5C3D15] hover:bg-[#F5B301]/20 hover:text-[#3D2406]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </header>

      {/* 管理画面メインコンテンツ */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 md:p-8">
        {children}
      </main>
    </div>
  );
}
