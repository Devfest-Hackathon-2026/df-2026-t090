"use client";

import { useEffect, useState, useCallback } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, User } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { FILTER_FIELDS, FilterField } from "@/lib/constants";
import { UserProfile, ProjectApplication, ProjectMessage } from "@/lib/types/hive";
import { formatJSTDateTime } from "@/lib/theme";
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

  // 左メニューのアクティブ項目（home, profile, scout, submit, records, workspace-{id}-{tab}）
  const [activeNav, setActiveNav] = useState<string>("home");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [refreshSidebarTrigger, setRefreshSidebarTrigger] = useState<number>(0);

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

  // ──────── W02 応募モーダル用State ────────
  const [applyModalOpen, setApplyModalOpen] = useState<boolean>(false);
  const [selectedRoleForApply, setSelectedRoleForApply] = useState<RoleItem | null>(null);
  const [applyMotivation, setApplyMotivation] = useState<string>("");
  const [isApplying, setIsApplying] = useState<boolean>(false);
  const [applyMessage, setApplyMessage] = useState<string | null>(null);

  // ──────── W04 スカウト・届いた応募用State ────────
  const [scoutTab, setScoutTab] = useState<"candidates" | "sent" | "received">("received");
  const [applications, setApplications] = useState<ProjectApplication[]>([]);
  const [loadingApps, setLoadingApps] = useState<boolean>(false);
  const [appActionMessage, setAppActionMessage] = useState<string | null>(null);

  // ──────── W06 チャット・全体連絡用State ────────
  const [chatMessages, setChatMessages] = useState<ProjectMessage[]>([]);
  const [chatInputText, setChatInputText] = useState<string>("");
  const [isSendingChat, setIsSendingChat] = useState<boolean>(false);
  const [chatIsAnnouncement, setChatIsAnnouncement] = useState<boolean>(false);
  const [chatDeadline, setChatDeadline] = useState<string>("");
  const [activeChatRoomId, setActiveChatRoomId] = useState<string>("general");

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

  // ユーザー認証＆プロファイル取得
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
          return;
        }
      } catch {
        // リトライ
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

  // ──────── 応募の提出（W02） ────────
  const handleSendApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedIdea || !selectedRoleForApply) return;
    setIsApplying(true);
    setApplyMessage(null);

    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/student/applications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          projectId: selectedIdea.id,
          roleName: selectedRoleForApply.name,
          motivationMessage: applyMotivation,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "応募の送信に失敗しました。");
        return;
      }

      setApplyMessage(data.message || "応募を完了しました！");
      setApplyMotivation("");
      setTimeout(() => {
        setApplyModalOpen(false);
        setApplyMessage(null);
      }, 1500);
    } catch {
      alert("通信エラーが発生しました。");
    } finally {
      setIsApplying(false);
    }
  };

  // ──────── 届いた応募一覧の取得（W04） ────────
  const fetchApplications = useCallback(async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/student/applications?type=${scoutTab === "received" ? "received" : "sent"}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setApplications(data.applications || []);
      }
    } catch (err) {
      console.error("応募取得エラー:", err);
    } finally {
      setLoadingApps(false);
    }
  }, [user, scoutTab]);

  useEffect(() => {
    if (activeNav !== "scout" || !user) return;
    let active = true;

    const load = async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch(`/api/student/applications?type=${scoutTab === "received" ? "received" : "sent"}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (active) setApplications(data.applications || []);
        }
      } catch (err) {
        console.error("応募取得エラー:", err);
      } finally {
        if (active) setLoadingApps(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [activeNav, scoutTab, user]);

  // ──────── 応募の承認／見送り処理（W04） ────────
  const handleApproveApplication = async (appId: string, action: "approve" | "reject") => {
    if (!user) return;
    setAppActionMessage(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/student/applications", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          applicationId: appId,
          action,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "処理に失敗しました。");
        return;
      }

      setAppActionMessage(data.message);
      fetchApplications();
      // サイドバーの参加プロジェクトを再取得
      setRefreshSidebarTrigger((prev) => prev + 1);
    } catch {
      alert("通信エラーが発生しました。");
    }
  };

  // ──────── W06 チャットメッセージの取得・ポーリング ────────
  const activeProjectId = activeNav.startsWith("workspace")
    ? activeNav.split("-")[1]
    : null;

  const fetchChatMessages = useCallback(async () => {
    if (!user || !activeProjectId) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/student/projects/${activeProjectId}/chat?roomId=${activeChatRoomId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setChatMessages(data.messages || []);
      }
    } catch (err) {
      console.error("チャット取得エラー:", err);
    }
  }, [user, activeProjectId, activeChatRoomId]);

  useEffect(() => {
    if (!activeNav.startsWith("workspace") || !activeProjectId || !user) return;
    let active = true;

    const loadChat = async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch(`/api/student/projects/${activeProjectId}/chat?roomId=${activeChatRoomId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (active) setChatMessages(data.messages || []);
        }
      } catch (err) {
        console.error("チャット取得エラー:", err);
      }
    };

    loadChat();
    // リアルタイム更新（3秒ポーリング）
    const interval = setInterval(loadChat, 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [activeNav, activeProjectId, activeChatRoomId, user]);

  // ──────── W06 メッセージ送信 ────────
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeProjectId || !chatInputText.trim()) return;
    setIsSendingChat(true);

    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/student/projects/${activeProjectId}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          roomId: activeChatRoomId,
          text: chatInputText.trim(),
          isAnnouncement: chatIsAnnouncement,
          deadline: chatIsAnnouncement ? chatDeadline : undefined,
        }),
      });

      if (res.ok) {
        setChatInputText("");
        setChatIsAnnouncement(false);
        setChatDeadline("");
        fetchChatMessages();
      } else {
        alert("メッセージ送信に失敗しました。");
      }
    } catch {
      alert("通信エラーが発生しました。");
    } finally {
      setIsSendingChat(false);
    }
  };

  // ──────── W06 全体連絡「確認しました」ボタン ────────
  const handleConfirmAnnouncement = async (messageId: string) => {
    if (!user || !activeProjectId) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/student/projects/${activeProjectId}/chat`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messageId }),
      });
      if (res.ok) {
        fetchChatMessages();
      }
    } catch {
      alert("確認処理に失敗しました。");
    }
  };

  // ログイン・ログアウト
  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const authError = err as { code?: string; message?: string };
      setError(authError.message || "ログインに失敗しました。");
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

  // AI学生マッチング
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
    } catch {
      setMatchingError("通信エラーが発生しました。");
    } finally {
      setMatchingLoading(false);
    }
  };

  // 最上部に固定表示する「全体連絡」（最新の未確認優先）
  const announcementMessage = chatMessages.slice().reverse().find((m) => m.isAnnouncement);

  return (
    <div className="min-h-screen bg-[#FFFDF7] text-[#3D2406] flex">
      {/* 共通左サイドバー */}
      <StudentSidebar
        user={user}
        profile={profile}
        isAdmin={isAdmin}
        activeNav={activeNav}
        refreshTrigger={refreshSidebarTrigger}
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
              className="text-xs font-bold text-[#7A5726]"
            >
              ログアウト
            </button>
          ) : (
            <button
              type="button"
              onClick={handleLogin}
              className="px-3 py-1 rounded-full bg-[#F5B301] text-[#3D2406] text-xs font-bold"
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
                {activeNav === "scout" && "W04 スカウト・届いた応募"}
                {activeNav === "submit" && "W05 申請・公開"}
                {activeNav === "records" && "活動記録"}
                {activeNav.startsWith("workspace") && "W06 プロジェクト作業画面（チャット・全体連絡）"}
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
                  className="px-4 py-2 rounded-full bg-[#F5B301] text-[#3D2406] text-xs font-bold shadow-xs hover:bg-[#E0A200]"
                >
                  Googleでログイン
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

                    {/* 在籍校だけでは実現できない理由 */}
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
                      <span className="text-xs font-bold text-[#7A5726]">募集している役割（ロールを選んで応募できます）</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {selectedIdea.roles.map((r, i) => {
                          const isSelectedRole = selectedRoleForApply?.name === r.name;
                          return (
                            <div
                              key={i}
                              onClick={() => setSelectedRoleForApply(r)}
                              className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                                isSelectedRole
                                  ? "bg-[#FFF4CA] border-2 border-[#F5B301] shadow-md scale-[1.02]"
                                  : "bg-[#FFFDF7] border-[#B87503]/20 hover:border-[#F5B301]"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-xs text-[#3D2406] flex items-center gap-1.5">
                                  <span>{isSelectedRole ? "🔘" : "⚪"}</span>
                                  <span>{r.name}</span>
                                </span>
                                <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-[#FFF8E1] border border-[#B87503]/30 text-[#B87503]">
                                  あなたに合う (親和度 88%)
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
                          );
                        })}
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

                    {/* 応募アクションボタン */}
                    <div className="flex items-center justify-between pt-3 border-t border-[#B87503]/20">
                      <span className="text-xs text-[#5C3D15]">
                        {selectedRoleForApply
                          ? `選択中:「${selectedRoleForApply.name}」`
                          : "上のロールから希望する役割を選択してください"}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (!user) {
                            alert("応募するにはログインが必要です。");
                            return;
                          }
                          if (!selectedRoleForApply) {
                            // デフォルトで1番目のロールを選択
                            setSelectedRoleForApply(selectedIdea.roles[0] || null);
                          }
                          setApplyModalOpen(true);
                        }}
                        className="px-6 py-2.5 rounded-full bg-[#F5B301] text-[#3D2406] text-xs sm:text-sm font-bold shadow-md hover:bg-[#E0A200] transition-all"
                      >
                        このロールに応募する 🚀
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

                    {/* 四角いプロジェクトカード一覧 */}
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
                          const demoAffinity = 92 - (idx % 4) * 8;
                          return (
                            <div
                              key={idea.id}
                              className="p-5 rounded-3xl bg-[#FFFBEB]/95 backdrop-blur-xs border border-[#B87503]/30 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-4 text-left"
                            >
                              <div className="flex flex-col gap-2">
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

          {/* ──────────────── W04 スカウト・届いた応募受付 ──────────────── */}
          {activeNav === "scout" && (
            <div className="flex flex-col gap-6">
              {/* タブ切り替え */}
              <div className="flex items-center gap-2 border-b border-[#B87503]/30 pb-3">
                <button
                  type="button"
                  onClick={() => setScoutTab("received")}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
                    scoutTab === "received"
                      ? "bg-[#F5B301] text-[#3D2406] shadow-xs"
                      : "bg-[#FFFBEB] text-[#5C3D15] hover:bg-[#FFF8E1]"
                  }`}
                >
                  <span>届いた応募</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-[#EA4335] text-white text-[10px] font-black">
                    {applications.filter((a) => a.status === "pending").length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setScoutTab("candidates")}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                    scoutTab === "candidates"
                      ? "bg-[#F5B301] text-[#3D2406] shadow-xs"
                      : "bg-[#FFFBEB] text-[#5C3D15] hover:bg-[#FFF8E1]"
                  }`}
                >
                  候補を探す（提唱者向け）
                </button>
                <button
                  type="button"
                  onClick={() => setScoutTab("sent")}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                    scoutTab === "sent"
                      ? "bg-[#F5B301] text-[#3D2406] shadow-xs"
                      : "bg-[#FFFBEB] text-[#5C3D15] hover:bg-[#FFF8E1]"
                  }`}
                >
                  送ったスカウト
                </button>
              </div>

              {appActionMessage && (
                <div className="p-3.5 rounded-xl bg-[#EDF7ED] border border-[#81C784] text-[#1E4620] text-xs sm:text-sm font-bold shadow-xs">
                  ✓ {appActionMessage}
                </div>
              )}

              {/* 届いた応募一覧 */}
              {scoutTab === "received" && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#7A5726]">
                      あなたが提唱したプロジェクトに届いた応募一覧です（承認するとメンバーに追加されます）:
                    </span>
                    <button
                      type="button"
                      onClick={fetchApplications}
                      className="text-xs text-[#B87503] hover:underline font-bold"
                    >
                      🔄 更新
                    </button>
                  </div>

                  {loadingApps ? (
                    <div className="py-12 text-center text-[#7A5726] font-bold">読み込み中...</div>
                  ) : applications.length === 0 ? (
                    <div className="p-8 rounded-3xl bg-[#FFFBEB] border border-[#B87503]/30 text-center flex flex-col items-center gap-2">
                      <span className="text-3xl">📭</span>
                      <p className="text-sm font-bold text-[#3D2406]">現在届いている応募はありません。</p>
                      <p className="text-xs text-[#7A5726]">
                        他の学生があなたのプロジェクトのロールに応募すると、ここに届きます。
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {applications.map((app) => (
                        <div
                          key={app.id}
                          className="p-5 rounded-3xl bg-[#FFFBEB] border border-[#B87503]/30 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left"
                        >
                          <div className="flex flex-col gap-1.5 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-[#F5B301] text-[#3D2406]">
                                希望ロール: {app.roleName}
                              </span>
                              <span className="text-xs text-[#7A5726]">
                                対象: <strong className="text-[#3D2406]">{app.projectTitle}</strong>
                              </span>
                              <span
                                className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  app.status === "approved"
                                    ? "bg-[#EDF7ED] text-[#1E4620]"
                                    : app.status === "rejected"
                                    ? "bg-[#FDEAEA] text-[#5F1313]"
                                    : "bg-[#FFF8E1] text-[#B87503]"
                                }`}
                              >
                                {app.status === "approved" ? "参加承認済み" : app.status === "rejected" ? "見送り" : "審査待ち"}
                              </span>
                            </div>

                            <div className="text-xs font-bold text-[#3D2406] mt-1">
                              応募者: {app.applicantName} ({app.applicantSchool} {app.applicantFaculty} {app.applicantGrade})
                            </div>

                            {app.motivationMessage && (
                              <p className="text-xs text-[#5C3D15] bg-[#FFFDF7] p-2.5 rounded-xl border border-[#B87503]/20 mt-1 leading-relaxed">
                                志望動機・メッセージ: {app.motivationMessage}
                              </p>
                            )}

                            <span className="text-[10px] text-[#7A5726]">
                              応募日時: {formatJSTDateTime(app.createdAt)}
                            </span>
                          </div>

                          {/* 提唱者による承認／見送りボタン */}
                          {app.status === "pending" && (
                            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                              <button
                                type="button"
                                onClick={() => handleApproveApplication(app.id, "reject")}
                                className="px-3.5 py-2 rounded-full border border-[#B87503]/40 bg-[#FFFDF7] text-[#5C3D15] text-xs font-bold hover:bg-[#FDEAEA]"
                              >
                                見送る
                              </button>
                              <button
                                type="button"
                                onClick={() => handleApproveApplication(app.id, "approve")}
                                className="px-5 py-2 rounded-full bg-[#F5B301] text-[#3D2406] text-xs font-bold shadow-xs hover:bg-[#E0A200]"
                              >
                                参加を承認する ✓
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {scoutTab === "candidates" && (
                <div className="p-8 rounded-3xl bg-[#FFFBEB] border border-[#B87503]/30 text-center flex flex-col items-center gap-3">
                  <span className="text-3xl">🔍</span>
                  <h3 className="text-sm font-bold text-[#3D2406]">候補を探す（提唱者向け）</h3>
                  <p className="text-xs text-[#5C3D15] max-w-md">
                    プロジェクトが求めるスキルと合致する学生候補を匿名（「候補A」など）で検索し、月10件までスカウトメッセージを送ることができます。
                  </p>
                </div>
              )}

              {scoutTab === "sent" && (
                <div className="p-8 rounded-3xl bg-[#FFFBEB] border border-[#B87503]/30 text-center flex flex-col items-center gap-3">
                  <span className="text-3xl">📤</span>
                  <h3 className="text-sm font-bold text-[#3D2406]">送ったスカウト</h3>
                  <p className="text-xs text-[#5C3D15] max-w-md">
                    これまでに送信したスカウトの一覧と、相手からの返事（受諾／見送り）ステータスを表示します。
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ──────────────── W06 プロジェクト作業画面（チャット・全体連絡） ──────────────── */}
          {activeNav.startsWith("workspace") && (
            <div className="flex flex-col gap-4">
              {/* プロジェクト作業ヘッダー */}
              <div className="flex items-center justify-between border-b border-[#B87503]/30 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">💬</span>
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-[#3D2406]">
                      プロジェクト作業画面（W06 チャット）
                    </h2>
                    <span className="text-xs text-[#7A5726]">
                      ルーム: {activeChatRoomId === "general" ? "全体チャット" : "タスク別チャット"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => alert("ビデオ通話URLを発行しました: https://meet.google.com/hive-demo")}
                    className="px-3.5 py-1.5 rounded-full border border-[#B87503] bg-[#FFF8E1] text-[#3D2406] text-xs font-bold hover:bg-[#F5B301] shadow-xs flex items-center gap-1"
                  >
                    <span>📹</span>
                    <span>ビデオ通話</span>
                  </button>
                  <button
                    type="button"
                    onClick={fetchChatMessages}
                    className="px-3 py-1.5 rounded-full bg-[#F5B301] text-[#3D2406] text-xs font-bold hover:bg-[#E0A200] shadow-xs"
                  >
                    🔄 更新
                  </button>
                </div>
              </div>

              {/* ルーム切り替えタブ */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                {[
                  { id: "general", label: "全体チャット" },
                  { id: "task-analysis", label: "タスク: 解析パイプライン" },
                  { id: "task-poster", label: "タスク: ポスター制作" },
                ].map((room) => (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => setActiveChatRoomId(room.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                      activeChatRoomId === room.id
                        ? "bg-[#F5B301] text-[#3D2406] shadow-xs border border-[#E0A200]"
                        : "bg-[#FFFBEB] text-[#5C3D15] hover:bg-[#FFF8E1] border border-[#B87503]/25"
                    }`}
                  >
                    {room.label}
                  </button>
                ))}
              </div>

              {/* ★仕様書重要項目: 固定表示の「全体連絡」（確認期限・確認ボタン・人数表示） */}
              {announcementMessage && (
                <div className="p-4 rounded-2xl bg-[#FFF4CA] border-2 border-[#F5B301] shadow-md flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-[#B87503] flex items-center gap-1.5">
                      <span>📢</span>
                      <span>進行役からの全体連絡（重要）</span>
                    </span>
                    <div className="flex items-center gap-2 text-xs font-bold text-[#3D2406]">
                      <span>
                        確認済み: {announcementMessage.confirmedUserUids.length} / {announcementMessage.totalMembersCount || 3} 人
                      </span>
                      {announcementMessage.deadline && (
                        <span className="text-[10px] text-[#7A5726] bg-[#FFFBEB] px-2 py-0.5 rounded-md border border-[#B87503]/30">
                          期限: {announcementMessage.deadline}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-[#3D2406] font-medium leading-relaxed bg-[#FFFDF7] p-3 rounded-xl border border-[#B87503]/20">
                    {announcementMessage.text}
                  </p>

                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <span className="text-[#7A5726]">
                      発信: {announcementMessage.senderName} ({announcementMessage.senderRole}) • {formatJSTDateTime(announcementMessage.createdAt)}
                    </span>

                    {/* 「確認しました」ボタン */}
                    {announcementMessage.confirmedUserUids.includes(user?.uid || "") ? (
                      <span className="px-3 py-1 rounded-full bg-[#EDF7ED] text-[#1E4620] font-bold border border-[#81C784]">
                        ✓ 確認済み
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleConfirmAnnouncement(announcementMessage.id)}
                        className="px-4 py-1.5 rounded-full bg-[#F5B301] text-[#3D2406] font-bold shadow-xs hover:bg-[#E0A200] transition-colors"
                      >
                        確認しました
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* チャットタイムライン（メッセージ一覧） */}
              <div className="rounded-3xl border border-[#B87503]/30 bg-[#FFFBEB]/90 p-4 sm:p-6 min-h-[350px] max-h-[480px] overflow-y-auto flex flex-col gap-3 shadow-inner">
                {chatMessages.length === 0 ? (
                  <div className="py-16 text-center text-[#7A5726] font-medium">
                    まだメッセージはありません。最初の発言を投稿してチーム作業を始めましょう！
                  </div>
                ) : (
                  chatMessages.map((msg) => {
                    const isSelf = user?.uid === msg.senderUid;
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col gap-1 max-w-[85%] sm:max-w-[75%] ${
                          isSelf ? "self-end items-end" : "self-start items-start"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 text-[10px] text-[#7A5726]">
                          <span className="font-bold text-[#3D2406]">
                            {isSelf ? "あなた" : msg.senderName}
                          </span>
                          <span>•</span>
                          <span>{msg.senderSchool || msg.senderRole}</span>
                          <span>•</span>
                          <span>{formatJSTDateTime(msg.createdAt)}</span>
                        </div>

                        <div
                          className={`p-3 rounded-2xl text-xs sm:text-sm font-medium leading-relaxed break-words shadow-xs ${
                            isSelf
                              ? "bg-[#F5B301] text-[#3D2406] rounded-br-xs"
                              : "bg-[#FFFDF7] text-[#3D2406] border border-[#B87503]/25 rounded-bl-xs"
                          }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* メッセージ入力欄（仕様: 全体連絡として出す、送信） */}
              <form
                onSubmit={handleSendMessage}
                className="p-3.5 rounded-2xl bg-[#FFFBEB] border border-[#B87503]/30 shadow-xs flex flex-col gap-2.5"
              >
                <div className="flex items-center gap-3 text-xs">
                  <label className="flex items-center gap-1.5 font-bold text-[#3D2406] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={chatIsAnnouncement}
                      onChange={(e) => setChatIsAnnouncement(e.target.checked)}
                      className="rounded accent-[#F5B301]"
                    />
                    <span>全体連絡として出す（進行役向け・上部に固定表示）</span>
                  </label>

                  {chatIsAnnouncement && (
                    <div className="flex items-center gap-1 ml-auto">
                      <span className="text-[11px] text-[#7A5726]">確認期限:</span>
                      <input
                        type="date"
                        value={chatDeadline}
                        onChange={(e) => setChatDeadline(e.target.value)}
                        className="p-1 border border-[#B87503]/30 rounded-lg bg-white text-xs"
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    placeholder={
                      chatIsAnnouncement
                        ? "全員に周知したい重要連絡を入力してください..."
                        : "メッセージを入力..."
                    }
                    value={chatInputText}
                    onChange={(e) => setChatInputText(e.target.value)}
                    className="flex-1 bg-[#FFFDF7] border border-[#B87503]/30 rounded-xl px-3 py-2 text-xs sm:text-sm text-[#3D2406] focus:outline-none focus:border-[#F5B301]"
                  />
                  <button
                    type="submit"
                    disabled={isSendingChat}
                    className="px-5 py-2 rounded-xl bg-[#F5B301] text-[#3D2406] text-xs font-bold hover:bg-[#E0A200] shadow-xs disabled:opacity-50"
                  >
                    {isSendingChat ? "送信中..." : "送信 🚀"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ──────────────── 他のタブ ──────────────── */}
          {activeNav === "profile" && (
            <div className="p-8 rounded-3xl bg-[#FFFBEB] border border-[#B87503]/30 text-center flex flex-col items-center gap-3">
              <span className="text-3xl">🌿</span>
              <h2 className="text-lg font-bold text-[#3D2406]">W03 プロフィールとスキルツリー</h2>
              <p className="text-xs text-[#5C3D15] max-w-md leading-relaxed">
                あなたのスキル枝（審査済み・審査中・次に伸ばせる枝）や段位ランク、空き時間カレンダーを表示します。
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

          {activeNav === "submit" && (
            <div className="p-8 rounded-3xl bg-[#FFFBEB] border border-[#B87503]/30 text-center flex flex-col items-center gap-3">
              <span className="text-3xl">📝</span>
              <h2 className="text-lg font-bold text-[#3D2406]">W05 申請・公開</h2>
              <p className="text-xs text-[#5C3D15] max-w-md leading-relaxed">
                新しいスキル枝の審査申請（根拠の提出）や、新規プロジェクトの公開申請を行います。
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
        </main>
      </div>

      {/* ──────── 応募モーダル（W02） ──────── */}
      {applyModalOpen && selectedIdea && selectedRoleForApply && (
        <div className="fixed inset-0 z-50 bg-[#3D2406]/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSendApplication}
            className="bg-[#FFFBEB] max-w-md w-full rounded-3xl p-6 border-2 border-[#B87503] shadow-2xl flex flex-col gap-4 text-left"
          >
            <div className="flex items-center justify-between border-b border-[#B87503]/30 pb-2">
              <h3 className="text-base font-black text-[#3D2406] flex items-center gap-1.5">
                <span>📝</span>
                <span>プロジェクトのロールに応募する</span>
              </h3>
              <button
                type="button"
                onClick={() => setApplyModalOpen(false)}
                className="text-xs font-bold text-[#7A5726]"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-xl bg-[#FFFDF7] border border-[#B87503]/20 text-xs flex flex-col gap-1">
              <div>
                <span className="text-[#7A5726]">プロジェクト: </span>
                <span className="font-bold text-[#3D2406]">{selectedIdea.title}</span>
              </div>
              <div>
                <span className="text-[#7A5726]">応募する役割（ロール）: </span>
                <span className="font-bold text-[#B87503]">{selectedRoleForApply.name}</span>
              </div>
              <p className="text-[11px] text-[#5C3D15] mt-1">{selectedRoleForApply.reason}</p>
            </div>

            <div>
              <label className="font-bold text-xs text-[#3D2406] block mb-1">
                応募の動機・自己PRメッセージ <span className="text-[#B87503]">*</span>
              </label>
              <textarea
                required
                rows={3}
                placeholder="例: このロールで求められているスキルを持っています。特に発酵プロセス管理やデータ分析の経験を活かしてチームに貢献したいです！"
                value={applyMotivation}
                onChange={(e) => setApplyMotivation(e.target.value)}
                className="w-full bg-[#FFFDF7] border border-[#B87503]/30 rounded-xl p-2.5 text-xs text-[#3D2406] focus:outline-none focus:border-[#F5B301]"
              />
            </div>

            {applyMessage && (
              <div className="p-2.5 rounded-xl bg-[#EDF7ED] border border-[#81C784] text-[#1E4620] text-xs font-bold">
                ✓ {applyMessage}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#B87503]/20">
              <button
                type="button"
                onClick={() => setApplyModalOpen(false)}
                className="px-4 py-1.5 rounded-full border border-[#B87503]/40 bg-[#FFFDF7] text-[#5C3D15] text-xs font-bold"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={isApplying}
                className="px-5 py-2 rounded-full bg-[#F5B301] text-[#3D2406] text-xs font-bold hover:bg-[#E0A200] shadow-xs disabled:opacity-50"
              >
                {isApplying ? "送信中..." : "応募を送信する 🚀"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* オンボーディングモーダル */}
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
