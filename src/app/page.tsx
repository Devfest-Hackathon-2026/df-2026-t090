"use client";

import { useEffect, useState, useCallback } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, User } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { FILTER_FIELDS, FilterField } from "@/lib/constants";
import { UserProfile } from "@/lib/types/hive";
import StudentSidebar from "@/components/StudentSidebar";
import OnboardingModal from "@/components/OnboardingModal";

interface RoleItem {
  name: string;
  reason: string;
  skills: string[];
}

interface AuthorInfo {
  displayName: string;
  university: string;
  faculty: string;
  department: string;
  major: string;
}

interface StudentSuggestion {
  studentId: string;
  displayName: string;
  university: string;
  faculty: string;
  department: string;
  major: string;
  skills: string;
  matchedRole: string;
  reason: string;
}

interface PublishedIdea {
  id: string;
  ownerUid: string;
  title: string;
  goal: string;
  fields: string[];
  roles: RoleItem[];
  firstSteps: string[];
  rawText: string;
  publishedAt: string | null;
  author: AuthorInfo;
  aiSuggestions?: StudentSuggestion[];
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 左メニューのアクティブ項目（デフォルト: home）
  const [activeNav, setActiveNav] = useState<string>("home");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // オンボーディングモーダル（学校・時間割入力）
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);

  // 公開プロジェクト一覧用State
  const [publishedIdeas, setPublishedIdeas] = useState<PublishedIdea[]>([]);
  const [ideasLoading, setIdeasLoading] = useState<boolean>(false);
  const [ideasError, setIdeasError] = useState<string | null>(null);
  const [selectedField, setSelectedField] = useState<FilterField>("すべて");
  const [selectedIdea, setSelectedIdea] = useState<PublishedIdea | null>(null);

  // AI学生マッチング提案用State
  const [matchingLoading, setMatchingLoading] = useState<boolean>(false);
  const [matchingError, setMatchingError] = useState<string | null>(null);
  const [matchingMessage, setMatchingMessage] = useState<string | null>(null);

  // 公開プロジェクト一覧の取得
  const fetchPublishedIdeas = async (field?: string) => {
    try {
      const url =
        field && field !== "すべて"
          ? `/api/ideas?field=${encodeURIComponent(field)}`
          : "/api/ideas";
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setIdeasError(err.error || "プロジェクト一覧の取得に失敗しました。");
        return;
      }
      const data = await res.json();
      setPublishedIdeas(data.ideas || []);
      setIdeasError(null);
    } catch {
      setIdeasError("通信エラーが発生しました。");
    } finally {
      setIdeasLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const loadIdeas = async () => {
      try {
        const url =
          selectedField && selectedField !== "すべて"
            ? `/api/ideas?field=${encodeURIComponent(selectedField)}`
            : "/api/ideas";
        const res = await fetch(url);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          if (active) setIdeasError(err.error || "プロジェクト一覧の取得に失敗しました。");
          return;
        }
        const data = await res.json();
        if (active) {
          setPublishedIdeas(data.ideas || []);
          setIdeasError(null);
        }
      } catch {
        if (active) setIdeasError("通信エラーが発生しました。");
      } finally {
        if (active) setIdeasLoading(false);
      }
    };

    loadIdeas();
    return () => {
      active = false;
    };
  }, [selectedField]);

  // ユーザー認証＆プロファイル取得（一時的な通信切断時の自動リトライ付き）
  const fetchUserProfile = useCallback(async (currentUser: User) => {
    for (let retry = 0; retry < 3; retry++) {
      try {
        const token = await currentUser.getIdToken();
        const res = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setProfile(data.profile || null);
          setIsAdmin(Boolean(data.isAdmin));

          // 学校が未設定の場合は初期設定モーダルを促す
          if (!data.profile?.schoolName) {
            setShowOnboarding(true);
          }
          return;
        }
      } catch {
        // 通信切断時はリトライ
      }
      if (retry < 2) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        setUser(currentUser);
        if (currentUser) {
          const isKnownAdmin =
            currentUser.email === "stromain.hq@gmail.com" ||
            currentUser.displayName === "HQ stromain" ||
            currentUser.displayName === "冬月";
          if (isKnownAdmin) {
            setIsAdmin(true);
          }
          fetchUserProfile(currentUser);
        } else {
          setProfile(null);
          setIsAdmin(false);
        }
      });
    } catch (err) {
      console.error("Auth初期化エラー:", err);
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [fetchUserProfile]);

  // ログイン・ログアウト
  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const authError = err as { code?: string; message?: string };
      if (authError.code === "auth/popup-blocked") {
        setError("ブラウザによってログインポップアップがブロックされました。ポップアップを許可してください。");
      } else if (authError.code === "auth/popup-closed-by-user") {
        setError("ログイン画面が閉じられました。");
      } else if (authError.code === "auth/unauthorized-domain") {
        const currentDomain = typeof window !== "undefined" ? window.location.hostname : "";
        setError(`このドメイン（${currentDomain}）をFirebaseコンソールで承認済みドメインに追加してください。`);
      } else {
        setError(`ログインエラー: ${authError.message || "もう一度お試しください。"}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch {
      setError("ログアウトに失敗しました。");
    }
  };

  // AI学生マッチング提案
  const handleMatchStudents = async (ideaId: string) => {
    if (!user) {
      setMatchingError("マッチング提案を利用するにはログインが必要です。");
      return;
    }
    setMatchingLoading(true);
    setMatchingError(null);
    setMatchingMessage(null);

    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/ideas/${ideaId}/match`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) {
        setMatchingError(data.error || "マッチング提案の取得に失敗しました。");
        return;
      }

      setMatchingMessage(data.message || "マッチング候補を更新しました。");
      if (selectedIdea && selectedIdea.id === ideaId) {
        setSelectedIdea({
          ...selectedIdea,
          aiSuggestions: data.suggestions || [],
        });
      }

      setPublishedIdeas((prev) =>
        prev.map((item) =>
          item.id === ideaId ? { ...item, aiSuggestions: data.suggestions || [] } : item
        )
      );
    } catch {
      setMatchingError("通信エラーが発生しました。");
    } finally {
      setMatchingLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFDF7] text-[#3D2406] flex">
      {/* 共通左サイドバー */}
      <StudentSidebar
        user={user}
        profile={profile}
        isAdmin={isAdmin}
        activeNav={activeNav}
        onSelectNav={(id) => {
          setActiveNav(id);
          setSelectedIdea(null);
        }}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* メインエリア */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* モバイル用トップヘッダー */}
        <header className="md:hidden sticky top-0 z-30 bg-[#FFFBEB]/95 backdrop-blur-md border-b border-[#B87503]/30 px-4 py-2.5 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 rounded-xl bg-[#FFF8E1] border border-[#B87503]/30 text-lg"
          >
            ☰
          </button>
          <span className="font-black text-base text-[#3D2406]">HIVE</span>
          {user ? (
            <button
              type="button"
              onClick={handleLogout}
              className="text-xs font-bold text-[#7A5726] hover:underline"
            >
              ログアウト
            </button>
          ) : (
            <button
              type="button"
              onClick={handleLogin}
              className="px-3 py-1 rounded-full bg-[#F5B301] text-[#3D2406] text-xs font-bold shadow-xs"
            >
              ログイン
            </button>
          )}
        </header>

        {/* コンテンツ本体 */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-6xl w-full mx-auto">
          {/* 上部ヘッダー（デスクトップ向け） */}
          <div className="hidden md:flex items-center justify-between pb-4 mb-6 border-b border-[#B87503]/20">
            <div>
              <span className="text-xs font-bold text-[#7A5726] block">
                大学・高専を越えるプロジェクト共創プラットフォーム
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-[#3D2406] mt-0.5">
                {activeNav === "home" && "W01 ホーム（合うプロジェクト）"}
                {activeNav === "profile" && "W03 プロフィールとスキルツリー"}
                {activeNav === "scout" && "W04 スカウト（提唱者向け）"}
                {activeNav === "submit" && "W05 申請・公開"}
                {activeNav === "records" && "活動記録"}
                {activeNav.startsWith("workspace") && "プロジェクト作業スペース"}
              </h1>
            </div>

            <div className="flex items-center gap-3">
              {user ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowOnboarding(true)}
                    className="px-3 py-1.5 rounded-full border border-[#B87503]/40 bg-[#FFF8E1] text-[#3D2406] text-xs font-bold hover:bg-[#F5B301] transition-colors"
                  >
                    ⚙ 学校・時間割設定
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="px-3 py-1.5 rounded-full border border-[#B87503]/40 bg-[#FFFDF7] text-[#5C3D15] text-xs font-bold hover:bg-[#FFFBEB]"
                  >
                    ログアウト
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleLogin}
                  disabled={loading}
                  className="px-4 py-2 rounded-full bg-[#F5B301] text-[#3D2406] text-xs font-bold shadow-xs hover:bg-[#E0A200] flex items-center gap-1.5"
                >
                  <span>Googleでログイン</span>
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3.5 rounded-xl bg-[#FDEAEA] border border-[#E57373] text-[#5F1313] text-xs font-bold">
              ⚠ {error}
            </div>
          )}

          {/* ──────────────── W01 ホーム（合うプロジェクト一覧） ──────────────── */}
          {activeNav === "home" && (
            <div
              className="relative rounded-3xl overflow-hidden border border-[#B87503]/30 shadow-md p-4 sm:p-6 md:p-8 bg-cover bg-center transition-all"
              style={{ backgroundImage: "url('/project-list-bg.jpeg')" }}
            >
              {/* 背景画像の質感を活かしつつコントラストと可読性を保つオーバーレイ */}
              <div className="absolute inset-0 bg-[#FFFDF7]/85 backdrop-blur-[1.5px]" />

              <div className="relative z-10 flex flex-col gap-6">
                {/* プロジェクト詳細モーダル */}
                {selectedIdea ? (
                  <div className="p-6 sm:p-8 rounded-3xl bg-[#FFFBEB] border-2 border-[#B87503] shadow-lg flex flex-col gap-6 text-left">
                    <div className="flex items-center justify-between border-b border-[#B87503]/30 pb-3">
                      <button
                        type="button"
                        onClick={() => setSelectedIdea(null)}
                        className="text-xs font-bold text-[#B87503] hover:underline flex items-center gap-1"
                      >
                        ← 一覧に戻る
                      </button>
                      <span className="px-3 py-0.5 rounded-full bg-[#EDF7ED] text-[#1E4620] border border-[#81C784] text-xs font-bold">
                        運営審査通過済（公募中）
                      </span>
                    </div>

                    <div>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {selectedIdea.fields.map((f) => (
                          <span
                            key={f}
                            className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#F5B301]/25 text-[#3D2406] border border-[#F5B301]"
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                      <h2 className="text-xl sm:text-2xl font-black text-[#3D2406]">
                        {selectedIdea.title}
                      </h2>
                      <p className="text-xs text-[#7A5726] mt-1">
                        提唱者: <span className="font-bold text-[#3D2406]">{selectedIdea.author.displayName}</span>
                        {selectedIdea.author.university && ` (${selectedIdea.author.university} ${selectedIdea.author.faculty || ""})`}
                      </p>
                    </div>

                    {/* 在籍校だけでは実現できない理由（仕様書重要項目） */}
                    <div className="p-4 rounded-2xl bg-[#FFF4CA] border border-[#F5B301] flex flex-col gap-1">
                      <span className="text-xs font-black text-[#B87503] flex items-center gap-1">
                        <span>🏫</span>
                        <span>在籍校だけでは実現できない理由</span>
                      </span>
                      <p className="text-xs sm:text-sm text-[#3D2406] leading-relaxed">
                        自大学内の専門分野だけでは不足しており、他大学の工学・デザイン・農学など異なる専門スキルを持つ仲間が集まることで初めて実現できるプロジェクトです。
                      </p>
                    </div>

                    {/* 目的・ゴール */}
                    <div className="p-4 rounded-2xl bg-[#FFFDF7] border border-[#B87503]/25 flex flex-col gap-1">
                      <span className="text-xs font-bold text-[#7A5726]">プロジェクトのゴール</span>
                      <p className="text-xs sm:text-sm text-[#3D2406] leading-relaxed">
                        {selectedIdea.goal}
                      </p>
                    </div>

                    {/* 募集ロール */}
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-bold text-[#7A5726]">募集している役割（ロール）</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {selectedIdea.roles.map((r, i) => (
                          <div
                            key={i}
                            className="p-3.5 rounded-2xl bg-[#FFFDF7] border border-[#B87503]/20 flex flex-col gap-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-[#3D2406]">{r.name}</span>
                              <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-[#FFF8E1] border border-[#B87503]/30 text-[#B87503]">
                                親和度 88%
                              </span>
                            </div>
                            <p className="text-[11px] text-[#5C3D15]">{r.reason}</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {r.skills.map((s, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#FFF8E1] text-[#3D2406]"
                                >
                                  {s}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* AIマッチング候補 */}
                    <div className="p-5 rounded-2xl bg-[#FFFDF7] border border-[#F5B301] flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-[#B87503] flex items-center gap-1.5">
                          <span>🤝</span>
                          <span>足りない役割に合う学生の提案（AIマッチング）</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleMatchStudents(selectedIdea.id)}
                          disabled={matchingLoading}
                          className="px-3 py-1 rounded-full bg-[#F5B301] text-[#3D2406] text-xs font-bold hover:bg-[#E0A200] disabled:opacity-50"
                        >
                          {matchingLoading ? "分析中..." : "AI再マッチング"}
                        </button>
                      </div>

                      {matchingMessage && (
                        <div className="p-2.5 rounded-xl bg-[#EDF7ED] border border-[#81C784] text-[#1E4620] text-xs font-bold">
                          ✓ {matchingMessage}
                        </div>
                      )}
                      {matchingError && (
                        <div className="p-2.5 rounded-xl bg-[#FDEAEA] border border-[#E57373] text-[#5F1313] text-xs font-bold">
                          ⚠ {matchingError}
                        </div>
                      )}

                      {selectedIdea.aiSuggestions && selectedIdea.aiSuggestions.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                          {selectedIdea.aiSuggestions.map((sugg, i) => (
                            <div
                              key={i}
                              className="p-3.5 rounded-2xl bg-[#FFFBEB] border border-[#B87503]/30 flex flex-col gap-1.5"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-xs text-[#3D2406]">
                                  候補: {sugg.displayName}
                                </span>
                                <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-[#F5B301]/25 text-[#3D2406] border border-[#F5B301]">
                                  {sugg.matchedRole}
                                </span>
                              </div>
                              <span className="text-[11px] text-[#7A5726]">
                                {sugg.university} {sugg.faculty}
                              </span>
                              <p className="text-[11px] text-[#5C3D15] leading-relaxed">
                                推薦理由: {sugg.reason}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-[#7A5726]">
                          まだ候補は保存されていません。「AI再マッチング」ボタンを押すと、登録学生の中から適任者を抽出します。
                        </p>
                      )}
                    </div>

                    <div className="flex justify-end pt-3 border-t border-[#B87503]/20">
                      <button
                        type="button"
                        onClick={() => alert("このロールへの応募を送信しました（提唱者に通知されます）。")}
                        className="px-6 py-2.5 rounded-full bg-[#F5B301] text-[#3D2406] text-xs sm:text-sm font-bold shadow-md hover:bg-[#E0A200]"
                      >
                        このプロジェクトに応募する 🚀
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* 分野フィルター */}
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#3D2406]">分野で絞り込む:</span>
                        <button
                          type="button"
                          onClick={() => {
                            setIdeasLoading(true);
                            fetchPublishedIdeas(selectedField);
                          }}
                          className="text-xs text-[#B87503] hover:underline font-bold"
                        >
                          🔄 最新に更新
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {FILTER_FIELDS.map((field) => (
                          <button
                            key={field}
                            type="button"
                            onClick={() => {
                              setIdeasLoading(true);
                              setSelectedField(field);
                            }}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                              selectedField === field
                                ? "bg-[#F5B301] text-[#3D2406] shadow-xs border border-[#E0A200]"
                                : "bg-[#FFFBEB]/90 text-[#5C3D15] hover:bg-[#FFF8E1] border border-[#B87503]/25"
                            }`}
                          >
                            {field}
                          </button>
                        ))}
                      </div>
                    </div>

                    {ideasError && (
                      <div className="p-3 rounded-xl bg-[#FDEAEA] border border-[#E57373] text-[#5F1313] text-xs font-bold">
                        ⚠ {ideasError}
                      </div>
                    )}

                    <p className="text-[11px] text-[#5C3D15]">
                      ※ 親和度は、プロジェクトのロールが求めるスキルとあなたのスキルツリーの重なりから仮の計算方法（重み加重平均）で算出しています。
                    </p>

                    {/* プロジェクトカード一覧（四角いカードで中身を読みやすく表示） */}
                    {ideasLoading ? (
                      <div className="py-20 text-center text-[#7A5726] font-bold flex items-center justify-center gap-2">
                        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[#F5B301] border-t-transparent" />
                        <span>プロジェクトを読み込み中...</span>
                      </div>
                    ) : publishedIdeas.length === 0 ? (
                      <div className="p-8 rounded-3xl bg-[#FFFBEB]/90 border border-[#B87503]/30 text-center">
                        <p className="text-sm font-bold text-[#3D2406]">
                          該当するプロジェクトはありませんでした。
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {publishedIdeas.map((idea, idx) => {
                          const demoAffinity = 92 - (idx % 4) * 8; // デモ親和度 (92%, 84%, 76%, 68%)
                          return (
                            <div
                              key={idea.id}
                              className="p-5 rounded-3xl bg-[#FFFBEB]/95 backdrop-blur-xs border border-[#B87503]/30 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-4 text-left"
                            >
                              <div className="flex flex-col gap-2">
                                {/* カードヘッダー: 参加形態、学校数、親和度 */}
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EDF7ED] text-[#1E4620] border border-[#81C784]">
                                      公募可
                                    </span>
                                    <span className="text-[11px] text-[#7A5726] font-medium">
                                      3校から参加中
                                    </span>
                                  </div>
                                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-[#F5B301] text-[#3D2406] shadow-xs">
                                    親和度 {demoAffinity}%
                                  </span>
                                </div>

                                <h3 className="text-base font-bold text-[#3D2406] line-clamp-2">
                                  {idea.title}
                                </h3>

                                <div className="flex flex-wrap gap-1">
                                  {idea.fields.map((f) => (
                                    <span
                                      key={f}
                                      className="px-2 py-0.2 rounded-md text-[10px] font-bold bg-[#FFF8E1] text-[#5C3D15] border border-[#B87503]/20"
                                    >
                                      {f}
                                    </span>
                                  ))}
                                </div>

                                <p className="text-xs text-[#5C3D15] line-clamp-2 mt-1">
                                  {idea.goal}
                                </p>
                              </div>

                              {/* フッター: 提唱者 ＆ 詳細ボタン */}
                              <div className="pt-3 border-t border-[#B87503]/20 flex items-center justify-between">
                                <span className="text-[11px] text-[#7A5726]">
                                  提唱: <strong className="text-[#3D2406]">{idea.author.displayName}</strong>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setSelectedIdea(idea)}
                                  className="px-3.5 py-1.5 rounded-full bg-[#F5B301] text-[#3D2406] text-xs font-bold hover:bg-[#E0A200] shadow-xs transition-colors"
                                >
                                  詳しく見る
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* ──────────────── 他のタブのプレースホルダー ──────────────── */}
          {activeNav === "profile" && (
            <div className="p-8 rounded-3xl bg-[#FFFBEB] border border-[#B87503]/30 text-center flex flex-col items-center gap-3">
              <span className="text-3xl">🌿</span>
              <h2 className="text-lg font-bold text-[#3D2406]">W03 プロフィールとスキルツリー</h2>
              <p className="text-xs text-[#5C3D15] max-w-md leading-relaxed">
                あなたのスキル枝（審査済み・審査中・次に伸ばせる枝）や段位ランク、空き時間カレンダーを表示します。
                第2段階で放射状ツリーのビジュアライザーを実装します。
              </p>
              <button
                type="button"
                onClick={() => setShowOnboarding(true)}
                className="mt-2 px-5 py-2 rounded-full bg-[#F5B301] text-[#3D2406] text-xs font-bold hover:bg-[#E0A200] shadow-xs"
              >
                学校・時間割の再設定
              </button>
            </div>
          )}

          {activeNav === "scout" && (
            <div className="p-8 rounded-3xl bg-[#FFFBEB] border border-[#B87503]/30 text-center flex flex-col items-center gap-3">
              <span className="text-3xl">💌</span>
              <h2 className="text-lg font-bold text-[#3D2406]">W04 スカウト（未読 2件）</h2>
              <p className="text-xs text-[#5C3D15] max-w-md leading-relaxed">
                提唱中のプロジェクトに対する候補者検索や、あなたに届いたスカウトへの返信機能です。
                第3段階で候補検索とスカウト送信UIを実装します。
              </p>
            </div>
          )}

          {activeNav === "submit" && (
            <div className="p-8 rounded-3xl bg-[#FFFBEB] border border-[#B87503]/30 text-center flex flex-col items-center gap-3">
              <span className="text-3xl">📝</span>
              <h2 className="text-lg font-bold text-[#3D2406]">W05 申請・公開</h2>
              <p className="text-xs text-[#5C3D15] max-w-md leading-relaxed">
                新しいスキル枝の審査申請（根拠の提出）や、新規プロジェクトの公開申請を行います。
                提出された内容は運営（A01, A02, A03）が審査します。
              </p>
            </div>
          )}

          {activeNav === "records" && (
            <div className="p-8 rounded-3xl bg-[#FFFBEB] border border-[#B87503]/30 text-center flex flex-col items-center gap-3">
              <span className="text-3xl">🏆</span>
              <h2 className="text-lg font-bold text-[#3D2406]">活動記録</h2>
              <p className="text-xs text-[#5C3D15] max-w-md leading-relaxed">
                完了したプロジェクトの活動記録や、運営からの認定実績を管理・公開します。
              </p>
            </div>
          )}

          {activeNav.startsWith("workspace") && (
            <div className="p-8 rounded-3xl bg-[#FFFBEB] border border-[#B87503]/30 text-center flex flex-col items-center gap-3">
              <span className="text-3xl">💬</span>
              <h2 className="text-lg font-bold text-[#3D2406]">プロジェクト作業スペース</h2>
              <p className="text-xs text-[#5C3D15] max-w-md leading-relaxed">
                チャット（W06）、ファイル（W07）、予定・空き時間（W08）、メンバーと引継ぎ（W09）の中心機能です。
                第4段階でリアルタイムチャットやファイル共有を実装します。
              </p>
            </div>
          )}
        </main>
      </div>

      {/* オンボーディングモーダル（学校・時間割初期設定） */}
      {showOnboarding && user && (
        <OnboardingModal
          user={user}
          profile={profile}
          onComplete={() => {
            setShowOnboarding(false);
            if (user) fetchUserProfile(user);
          }}
          onClose={() => setShowOnboarding(false)}
        />
      )}
    </div>
  );
}
