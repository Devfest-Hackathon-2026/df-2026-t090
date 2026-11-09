"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, User } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { FILTER_FIELDS, FilterField } from "@/lib/constants";

interface ProfileFormData {
  displayName: string;
  university: string;
  faculty: string;
  department: string;
  major: string;
  skills: string;
  motivation: string;
}

const initialFormData: ProfileFormData = {
  displayName: "",
  university: "",
  faculty: "",
  department: "",
  major: "",
  skills: "",
  motivation: "",
};

interface RoleItem {
  name: string;
  reason: string;
  skills: string[];
}

interface IdeaResult {
  title: string;
  goal: string;
  roles: RoleItem[];
  firstSteps: string[];
  fields: string[];
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

type TabType = "ideas" | "idea" | "profile";
type IdeaStep = "input" | "questions" | "review" | "completed";

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // アクティブタブ（公開アイデア一覧 / アイデア投稿 / スキル登録）
  const [activeTab, setActiveTab] = useState<TabType>("ideas");

  // 公開アイデア一覧用State
  const [publishedIdeas, setPublishedIdeas] = useState<PublishedIdea[]>([]);
  const [ideasLoading, setIdeasLoading] = useState<boolean>(false);
  const [ideasError, setIdeasError] = useState<string | null>(null);
  const [selectedField, setSelectedField] = useState<FilterField>("すべて");
  const [selectedIdea, setSelectedIdea] = useState<PublishedIdea | null>(null);

  // AI学生マッチング提案用State
  const [matchingLoading, setMatchingLoading] = useState<boolean>(false);
  const [matchingError, setMatchingError] = useState<string | null>(null);
  const [matchingMessage, setMatchingMessage] = useState<string | null>(null);

  // プロフィールフォーム用State
  const [formData, setFormData] = useState<ProfileFormData>(initialFormData);
  const [profileLoading, setProfileLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // アイデア投稿用State
  const [ideaStep, setIdeaStep] = useState<IdeaStep>("input");
  const [rawText, setRawText] = useState<string>("");
  const [currentIdeaId, setCurrentIdeaId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<[string, string, string]>(["", "", ""]);
  const [ideaResult, setIdeaResult] = useState<IdeaResult | null>(null);

  const [ideaLoading, setIdeaLoading] = useState<boolean>(false);
  const [ideaLoadingText, setIdeaLoadingText] = useState<string>("");
  const [ideaError, setIdeaError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState<boolean>(false);

  // 公開アイデア一覧の取得
  const fetchPublishedIdeas = async (field?: string) => {
    try {
      const url =
        field && field !== "すべて"
          ? `/api/ideas?field=${encodeURIComponent(field)}`
          : "/api/ideas";
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setIdeasError(err.error || "アイデア一覧の取得に失敗しました。");
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
          if (active) {
            setIdeasError(err.error || "アイデア一覧の取得に失敗しました。");
          }
          return;
        }
        const data = await res.json();
        if (active) {
          setPublishedIdeas(data.ideas || []);
          setIdeasError(null);
        }
      } catch {
        if (active) {
          setIdeasError("通信エラーが発生しました。");
        }
      } finally {
        if (active) {
          setIdeasLoading(false);
        }
      }
    };

    loadIdeas();

    // フェイルセーフ: 万一通信が遅延しても最大3秒でローディングを必ず解除
    const timer = setTimeout(() => {
      if (active) {
        setIdeasLoading(false);
      }
    }, 3000);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [selectedField]);

  // アイデア投稿用ハンドラー（初期化）
  const handleResetIdea = () => {
    setIdeaStep("input");
    setRawText("");
    setCurrentIdeaId(null);
    setQuestions([]);
    setAnswers(["", "", ""]);
    setIdeaResult(null);
    setIdeaError(null);
    setIdeaLoading(false);
    setPublishing(false);
  };

  useEffect(() => {
    let isMounted = true;
    let unsubscribe: (() => void) | undefined;

    try {
      unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        if (!isMounted) return;
        setUser(currentUser);

        if (currentUser) {
          setProfileLoading(true);
          setProfileError(null);
          setProfileSuccess(null);
          try {
            const token = await currentUser.getIdToken();
            const res = await fetch("/api/profile", {
              method: "GET",
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });

            if (!isMounted) return;

            if (res.ok) {
              const data = await res.json();
              setFormData({
                displayName: data.displayName || currentUser.displayName || "",
                university: data.university || "",
                faculty: data.faculty || "",
                department: data.department || "",
                major: data.major || "",
                skills: data.skills || "",
                motivation: data.motivation || "",
              });
            } else if (res.status === 404) {
              // 未保存の場合はGoogleの表示名を初期値に設定
              setFormData({
                ...initialFormData,
                displayName: currentUser.displayName || "",
              });
            } else {
              const errData = await res.json().catch(() => ({}));
              setProfileError(errData.error || "プロフィールの読み込みに失敗しました。");
              setFormData({
                ...initialFormData,
                displayName: currentUser.displayName || "",
              });
            }
          } catch {
            if (isMounted) {
              setProfileError("プロフィールの読み込み中に通信エラーが発生しました。");
              setFormData({
                ...initialFormData,
                displayName: currentUser.displayName || "",
              });
            }
          } finally {
            if (isMounted) {
              setProfileLoading(false);
            }
          }
        } else {
          setFormData(initialFormData);
          setProfileError(null);
          setProfileSuccess(null);
          handleResetIdea();
        }
      });
    } catch (err) {
      console.error("Auth初期化エラー:", err);
    }

    return () => {
      isMounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      console.error("ログインエラー詳細:", err);
      const authError = err as { code?: string; message?: string };
      if (authError.code === "auth/popup-blocked") {
        setError("ブラウザによってログインポップアップがブロックされました。アドレスバー右側の設定でポップアップを許可してください。");
      } else if (authError.code === "auth/popup-closed-by-user") {
        setError("ログイン画面が途中で閉じられました。もう一度お試しください。");
      } else if (authError.code === "auth/cancelled-popup-request") {
        setError("直前の認証リクエストがキャンセルされました。もう一度お試しください。");
      } else if (authError.code === "auth/network-request-failed") {
        setError("通信エラーが発生しました。ネットワーク接続を確認してください。");
      } else if (authError.code === "auth/unauthorized-domain") {
        const currentDomain = typeof window !== "undefined" ? window.location.hostname : "";
        setError(
          `このドメイン（${currentDomain}）はFirebase Authenticationの「承認済みドメイン」に登録されていません。Firebaseコンソール（Authentication > 設定 > 承認済みドメイン）に「${currentDomain}」を追加してください。`
        );
      } else {
        setError(
          `ログインエラー (${authError.code || "不明"}): ${
            authError.message || "もう一度お試しください。"
          }`
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setError(null);
    setProfileError(null);
    setProfileSuccess(null);
    setIdeaError(null);
    try {
      await signOut(auth);
    } catch {
      setError("ログアウトに失敗しました。もう一度お試しください。");
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setProfileError(null);
    setProfileSuccess(null);

    // クライアント側簡易バリデーション
    if (!formData.displayName.trim()) {
      setProfileError("表示名を入力してください。");
      return;
    }
    if (!formData.university.trim()) {
      setProfileError("大学名を入力してください。");
      return;
    }
    if (!formData.faculty.trim()) {
      setProfileError("学部を入力してください。");
      return;
    }
    if (!formData.department.trim()) {
      setProfileError("学科を入力してください。");
      return;
    }
    if (!formData.major.trim()) {
      setProfileError("専攻・分野を入力してください。");
      return;
    }
    if (!formData.skills.trim()) {
      setProfileError("できることを入力してください。");
      return;
    }

    setSaving(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setProfileSuccess("保存完了：プロフィールを保存しました。");
      } else {
        const data = await res.json().catch(() => ({}));
        setProfileError(data.error || "保存に失敗しました。");
      }
    } catch {
      setProfileError("通信エラーが発生しました。もう一度お試しください。");
    } finally {
      setSaving(false);
    }
  };

  // ステップ1: アイデア文章送信 → 質問3つ取得
  const handleSubmitRawText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIdeaError(null);
    if (!rawText.trim()) {
      setIdeaError("アイデアの文章を入力してください。");
      return;
    }
    if (rawText.trim().length > 2000) {
      setIdeaError("アイデアの文章は2000文字以内で入力してください。");
      return;
    }

    setIdeaLoading(true);
    setIdeaLoadingText("AIがアイデアを分析し、深掘り質問を作成しています...");
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/ideas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rawText: rawText.trim() }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setIdeaError(data.error || "質問の作成に失敗しました。");
        return;
      }

      setCurrentIdeaId(data.ideaId);
      setQuestions(data.questions || []);
      setAnswers(["", "", ""]);
      setIdeaStep("questions");
    } catch {
      setIdeaError("通信エラーが発生しました。もう一度お試しください。");
    } finally {
      setIdeaLoading(false);
      setIdeaLoadingText("");
    }
  };

  // ステップ2: 3つの回答送信 → 整理結果取得
  const handleSubmitAnswers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !currentIdeaId) return;

    setIdeaError(null);
    if (answers.some((a) => !a.trim())) {
      setIdeaError("すべての質問に回答を入力してください。");
      return;
    }
    if (answers.some((a) => a.trim().length > 1000)) {
      setIdeaError("各回答は1000文字以内で入力してください。");
      return;
    }

    setIdeaLoading(true);
    setIdeaLoadingText("AIが回答をもとにアイデアを整理し、必要なスキル・役割に翻訳しています...");
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/ideas/${currentIdeaId}/answers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          answers: answers.map((a) => a.trim()),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setIdeaError(data.error || "アイデアの整理に失敗しました。");
        return;
      }

      setIdeaResult(data.result);
      setIdeaStep("review");
    } catch {
      setIdeaError("通信エラーが発生しました。もう一度お試しください。");
    } finally {
      setIdeaLoading(false);
      setIdeaLoadingText("");
    }
  };

  // ステップ3: 公開ボタン押下 → 公開完了
  const handlePublish = async () => {
    if (!user || !currentIdeaId) return;

    setIdeaError(null);
    setPublishing(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/ideas/${currentIdeaId}/publish`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setIdeaError(data.error || "アイデアの公開に失敗しました。");
        return;
      }

      setIdeaStep("completed");
      // 公開一覧を再取得
      fetchPublishedIdeas(selectedField);
    } catch {
      setIdeaError("通信エラーが発生しました。もう一度お試しください。");
    } finally {
      setPublishing(false);
    }
  };

  // 足りない役割に合う学生候補をAIでマッチング
  const handleMatchStudents = async (ideaId: string) => {
    if (!user) {
      setMatchingError("学生候補の提案機能を利用するにはログインが必要です。");
      return;
    }
    setMatchingLoading(true);
    setMatchingError(null);
    setMatchingMessage(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/ideas/${ideaId}/match`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMatchingError(data.error || "学生候補の提案に失敗しました。");
        return;
      }

      setMatchingMessage(data.message || null);
      if (selectedIdea && selectedIdea.id === ideaId) {
        setSelectedIdea({
          ...selectedIdea,
          aiSuggestions: data.suggestions || [],
        });
      }
      setPublishedIdeas((prev) =>
        prev.map((item) =>
          item.id === ideaId
            ? { ...item, aiSuggestions: data.suggestions || [] }
            : item
        )
      );
    } catch {
      setMatchingError("通信エラーが発生しました。もう一度お試しください。");
    } finally {
      setMatchingLoading(false);
    }
  };

  const formatDate = (isoString: string | null) => {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      return new Intl.DateTimeFormat("ja-JP", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d);
    } catch {
      return "";
    }
  };

  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-start py-8 sm:py-12 px-3 sm:px-4 text-[#4A2C0A]">
      <div className="w-full max-w-3xl flex flex-col items-center text-center p-5 sm:p-8 bg-[#FFFBEB]/90 backdrop-blur-sm rounded-3xl shadow-xl shadow-amber-900/10 border border-[#F5B301]/40">
        {/* 六角形4つのHIVEロゴ */}
        <h1
          aria-label="HIVE"
          className="flex items-center justify-center -space-x-1 sm:-space-x-1.5 py-2 my-1 select-none"
        >
          {[
            { char: "H", offset: "-translate-y-1.5 sm:-translate-y-2" },
            { char: "I", offset: "translate-y-1.5 sm:translate-y-2" },
            { char: "V", offset: "-translate-y-1.5 sm:-translate-y-2" },
            { char: "E", offset: "translate-y-1.5 sm:translate-y-2" },
          ].map(({ char, offset }) => (
            <div
              key={char}
              className={`relative flex items-center justify-center w-12 h-14 sm:w-16 sm:h-18 transition-transform ${offset} filter drop-shadow-sm`}
            >
              <div
                className="absolute inset-0 bg-[#F5B301]"
                style={{
                  clipPath:
                    "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
                }}
              />
              <span className="relative z-10 text-2xl sm:text-3xl font-black text-[#4A2C0A] tracking-wider">
                {char}
              </span>
            </div>
          ))}
        </h1>

        <p className="mt-4 text-base sm:text-lg font-medium text-[#4A2C0A]">
          その夢を実現させる仲間を見つけよう。
        </p>

        {error && (
          <div
            role="alert"
            className="mt-6 w-full p-3.5 rounded-xl bg-[#FFF1DC] text-[#7A2500] text-sm font-medium border border-[#F5B301] text-left shadow-sm"
          >
            {error}
          </div>
        )}

        <div className="mt-8 w-full flex flex-col items-center">
          {/* ユーザーログイン状態表示ヘッダー */}
          <div className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 mb-6 border-b border-[#F5B301]/30">
            {loading ? (
              <div className="flex items-center gap-2 py-1 text-[#4A2C0A]/70 text-sm font-medium">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                <span>認証確認中...</span>
              </div>
            ) : user ? (
              <>
                <div className="text-left">
                  <span className="text-xs text-[#4A2C0A]/70 font-medium block">ログイン中</span>
                  <span className="text-base font-bold text-[#4A2C0A] break-all">
                    {formData.displayName || user.displayName || "ユーザー"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full sm:w-auto px-4 py-1.5 rounded-full border border-[#F5B301] bg-[#FFF8E1] text-[#4A2C0A] text-sm font-semibold hover:bg-[#F5B301] transition-colors shadow-sm"
                >
                  ログアウト
                </button>
              </>
            ) : (
              <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3">
                <span className="text-xs sm:text-sm text-[#4A2C0A]/70 font-medium">
                  ログインすると、アイデアの投稿やスキルの登録ができます。
                </span>
                <button
                  type="button"
                  onClick={handleLogin}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-[#F5B301] text-[#4A2C0A] text-xs sm:text-sm font-bold shadow-sm hover:bg-[#E0A200] active:scale-[0.98] transition-all shrink-0"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.97 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                  Googleでログイン
                </button>
              </div>
            )}
          </div>

          {/* 3つのタブ切り替え: アイデアを探す / アイデア投稿 / スキル登録 */}
          <div className="w-full grid grid-cols-3 gap-1.5 sm:gap-2 p-1.5 bg-[#FFF8E1] rounded-2xl border border-[#F5B301]/40 mb-6">
            <button
              type="button"
              onClick={() => {
                setActiveTab("ideas");
                setSelectedIdea(null);
                setMatchingError(null);
                setMatchingMessage(null);
              }}
              className={`py-2 px-2 sm:px-3 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === "ideas"
                  ? "bg-[#F5B301] text-[#4A2C0A] shadow-md"
                  : "text-[#4A2C0A]/70 hover:text-[#4A2C0A] hover:bg-[#F5B301]/20"
              }`}
            >
              アイデアを探す
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("idea");
                setSelectedIdea(null);
                setProfileError(null);
                setProfileSuccess(null);
              }}
              className={`py-2 px-2 sm:px-3 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === "idea"
                  ? "bg-[#F5B301] text-[#4A2C0A] shadow-md"
                  : "text-[#4A2C0A]/70 hover:text-[#4A2C0A] hover:bg-[#F5B301]/20"
              }`}
            >
              アイデア投稿
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("profile");
                setSelectedIdea(null);
                setIdeaError(null);
              }}
              className={`py-2 px-2 sm:px-3 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === "profile"
                  ? "bg-[#F5B301] text-[#4A2C0A] shadow-md"
                  : "text-[#4A2C0A]/70 hover:text-[#4A2C0A] hover:bg-[#F5B301]/20"
              }`}
            >
              スキル登録
            </button>
          </div>

          {/* タブ1: 公開されたアイデアの一覧と分野フィルター */}
          {activeTab === "ideas" && (
            <div className="w-full flex flex-col gap-5 text-left">
              {/* アイデア詳細表示モード */}
              {selectedIdea ? (
                <div className="w-full flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedIdea(null);
                        setMatchingError(null);
                        setMatchingMessage(null);
                      }}
                      className="px-4 py-1.5 rounded-full border border-[#F5B301] bg-[#FFF8E1] text-[#4A2C0A] text-xs sm:text-sm font-bold hover:bg-[#F5B301]/40 transition-colors flex items-center gap-1.5"
                    >
                      <span>← 一覧に戻る</span>
                    </button>
                    {selectedIdea.publishedAt && (
                      <span className="text-xs text-[#4A2C0A]/60">
                        公開日: {formatDate(selectedIdea.publishedAt)}
                      </span>
                    )}
                  </div>

                  <div className="p-5 sm:p-6 rounded-2xl bg-[#FFFDF5] border border-[#F5B301] shadow-md flex flex-col gap-5">
                    {/* 分野バッジ */}
                    <div className="flex flex-wrap gap-1.5">
                      {selectedIdea.fields.map((f, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#F5B301]/30 text-[#4A2C0A] border border-[#F5B301]/60"
                        >
                          {f}
                        </span>
                      ))}
                    </div>

                    {/* タイトル */}
                    <div>
                      <h2 className="text-xl sm:text-2xl font-black text-[#4A2C0A]">
                        {selectedIdea.title}
                      </h2>
                    </div>

                    {/* 投稿者情報 */}
                    <div className="p-3.5 rounded-xl bg-[#FFF8E1]/80 border border-[#F5B301]/40 text-xs sm:text-sm flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#4A2C0A]">投稿者:</span>
                        <span className="font-semibold text-[#4A2C0A]">
                          {selectedIdea.author.displayName}
                        </span>
                      </div>
                      {(selectedIdea.author.university || selectedIdea.author.faculty || selectedIdea.author.major) && (
                        <div className="text-[#4A2C0A]/70 text-xs">
                          {[
                            selectedIdea.author.university,
                            selectedIdea.author.faculty,
                            selectedIdea.author.department,
                            selectedIdea.author.major,
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        </div>
                      )}
                    </div>

                    {/* 目指すゴール */}
                    <div>
                      <span className="text-xs font-bold text-[#4A2C0A]/70 block mb-1">
                        目指すゴール
                      </span>
                      <p className="text-sm sm:text-base text-[#4A2C0A] font-medium leading-relaxed whitespace-pre-wrap">
                        {selectedIdea.goal}
                      </p>
                    </div>

                    {/* 募集する役割とスキル */}
                    <div>
                      <span className="text-xs font-bold text-[#4A2C0A]/70 block mb-2">
                        募集する役割とスキル（他専攻向け翻訳）
                      </span>
                      <div className="flex flex-col gap-3">
                        {selectedIdea.roles.map((role, idx) => (
                          <div
                            key={idx}
                            className="p-3.5 rounded-xl bg-[#FFF8E1]/80 border border-[#F5B301]/50 flex flex-col gap-1.5"
                          >
                            <div className="font-bold text-[#4A2C0A] text-sm sm:text-base">
                              {role.name}
                            </div>
                            <div className="text-xs text-[#4A2C0A]/80 leading-relaxed">
                              {role.reason}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {role.skills.map((skill, sIdx) => (
                                <span
                                  key={sIdx}
                                  className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#FFFDF5] text-[#4A2C0A] border border-[#F5B301]/40"
                                >
                                  {skill}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 最初に取り組むステップ */}
                    {selectedIdea.firstSteps && selectedIdea.firstSteps.length > 0 && (
                      <div>
                        <span className="text-xs font-bold text-[#4A2C0A]/70 block mb-1.5">
                          最初に取り組むステップ
                        </span>
                        <ol className="list-decimal list-inside text-xs sm:text-sm text-[#4A2C0A] flex flex-col gap-1 font-medium pl-1">
                          {selectedIdea.firstSteps.map((step, idx) => (
                            <li key={idx} className="leading-relaxed">
                              {step}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {/* 足りない役割に合う学生の提案（AIマッチング） */}
                    <div className="pt-4 border-t border-[#F5B301]/40 flex flex-col gap-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div>
                          <h3 className="text-sm sm:text-base font-bold text-[#4A2C0A] flex items-center gap-1.5">
                            <span>🤝</span>
                            <span>足りない役割に合う学生の提案</span>
                          </h3>
                          <p className="text-xs text-[#4A2C0A]/70 mt-0.5">
                            Geminiが募集中の役割を読み取り、登録された学生のスキルから最適な候補と推薦理由を提案します。
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleMatchStudents(selectedIdea.id)}
                          disabled={matchingLoading}
                          className="w-full sm:w-auto px-4 py-2 rounded-full bg-[#F5B301] text-[#4A2C0A] text-xs font-bold hover:bg-[#E0A200] active:scale-[0.98] transition-all shadow-sm flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50"
                        >
                          {matchingLoading ? (
                            <>
                              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                              <span>AIが候補を選定中...</span>
                            </>
                          ) : (
                            <span>
                              {selectedIdea.aiSuggestions && selectedIdea.aiSuggestions.length > 0
                                ? "最新スキルから再提案"
                                : "AIで学生候補を提案してもらう"}
                            </span>
                          )}
                        </button>
                      </div>

                      {/* マッチングステータス / エラー表示 */}
                      {matchingError && (
                        <div
                          role="alert"
                          className="w-full p-3 rounded-xl bg-[#FFF1DC] text-[#7A2500] text-xs font-medium border border-[#F5B301]"
                        >
                          エラー: {matchingError}
                        </div>
                      )}

                      {matchingMessage && (
                        <div
                          role="status"
                          className="w-full p-2.5 rounded-xl bg-[#FFF8E1] text-[#4A2C0A] text-xs font-semibold border border-[#F5B301]/60"
                        >
                          {matchingMessage}
                        </div>
                      )}

                      {/* 提案された候補リスト */}
                      {selectedIdea.aiSuggestions && selectedIdea.aiSuggestions.length > 0 ? (
                        <div className="flex flex-col gap-3 mt-1">
                          {selectedIdea.aiSuggestions.map((candidate, cIdx) => (
                            <div
                              key={cIdx}
                              className="p-4 rounded-xl bg-[#FFF8E1]/90 border border-[#F5B301] shadow-sm flex flex-col gap-2.5"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-[#F5B301] text-[#4A2C0A]">
                                  推薦する役割: {candidate.matchedRole}
                                </span>
                                <div className="text-xs text-[#4A2C0A]/80">
                                  <span className="font-bold text-sm text-[#4A2C0A] mr-1">
                                    {candidate.displayName}
                                  </span>
                                  <span>さん</span>
                                  {(candidate.university || candidate.faculty || candidate.major) && (
                                    <span className="ml-1.5 text-[#4A2C0A]/60">
                                      (
                                      {[
                                        candidate.university,
                                        candidate.faculty,
                                        candidate.department,
                                        candidate.major,
                                      ]
                                        .filter(Boolean)
                                        .join(" ")}
                                      )
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="text-xs text-[#4A2C0A]/85 bg-[#FFFDF5] p-2.5 rounded-lg border border-[#F5B301]/30">
                                <span className="font-bold text-[#4A2C0A] block mb-0.5">
                                  登録スキル（できること）:
                                </span>
                                <p className="whitespace-pre-wrap">{candidate.skills}</p>
                              </div>

                              <div className="text-xs text-[#7A3E00] bg-[#FFFBEB] p-2.5 rounded-lg border border-[#F5B301]/50">
                                <span className="font-bold block mb-0.5">
                                  💡 AIがこの学生を選んだ理由:
                                </span>
                                <p className="leading-relaxed whitespace-pre-wrap">{candidate.reason}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        !matchingLoading && (
                          <div className="p-4 rounded-xl bg-[#FFF8E1]/50 border border-[#F5B301]/30 text-xs text-[#4A2C0A]/70 text-center">
                            「AIで学生候補を提案してもらう」ボタンを押すと、登録された学生の中からこのプロジェクトの各役割に合う候補と理由をGeminiが提案します。
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between border-b border-[#F5B301]/30 pb-2">
                    <h2 className="text-lg sm:text-xl font-bold text-[#4A2C0A]">
                      公開されたアイデア一覧
                    </h2>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-[#4A2C0A]/70">
                        {publishedIdeas.length} 件
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setIdeasLoading(true);
                          fetchPublishedIdeas(selectedField);
                        }}
                        disabled={ideasLoading}
                        title="最新の一覧に更新"
                        className="px-2.5 py-1 rounded-full text-xs font-bold border border-[#F5B301] bg-[#FFF8E1] text-[#4A2C0A] hover:bg-[#F5B301]/30 disabled:opacity-50 transition-colors flex items-center gap-1"
                      >
                        <span>🔄</span>
                        <span>更新</span>
                      </button>
                    </div>
                  </div>

                  {/* 分野フィルターバー */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-[#4A2C0A]/70">
                      分野で絞り込む:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {FILTER_FIELDS.map((field) => (
                        <button
                          key={field}
                          type="button"
                          onClick={() => setSelectedField(field)}
                          className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                            selectedField === field
                              ? "bg-[#F5B301] text-[#4A2C0A] shadow-sm scale-105 border border-[#E0A200]"
                              : "bg-[#FFF8E1] text-[#4A2C0A]/70 hover:text-[#4A2C0A] border border-[#F5B301]/40 hover:bg-[#F5B301]/20"
                          }`}
                        >
                          {field}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* エラー表示 */}
                  {ideasError && (
                    <div
                      role="alert"
                      className="w-full p-3.5 rounded-xl bg-[#FFF1DC] text-[#7A2500] text-sm font-medium border border-[#F5B301] shadow-sm"
                    >
                      {ideasError}
                    </div>
                  )}

                  {/* ローディング表示 */}
                  {ideasLoading ? (
                    <div className="flex items-center justify-center gap-2 py-12 text-[#4A2C0A]/70 font-medium">
                      <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      <span>アイデアを読み込み中...</span>
                    </div>
                  ) : publishedIdeas.length === 0 ? (
                    /* アイデア0件の場合 */
                    <div className="w-full p-8 rounded-2xl bg-[#FFF8E1]/80 border border-[#F5B301]/40 flex flex-col items-center justify-center gap-3 text-center">
                      <span className="text-3xl">💡</span>
                      <p className="text-sm sm:text-base font-bold text-[#4A2C0A]">
                        {selectedField === "すべて"
                          ? "まだ公開されたアイデアがありません。"
                          : `「${selectedField}」分野の公開アイデアはまだありません。`}
                      </p>
                      <p className="text-xs text-[#4A2C0A]/70 max-w-sm">
                        あなたのアイデアを投稿して、異なる専門分野の仲間を見つけてみませんか？
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab("idea");
                          handleResetIdea();
                        }}
                        className="mt-2 px-5 py-2 rounded-full bg-[#F5B301] text-[#4A2C0A] text-xs sm:text-sm font-bold shadow-sm hover:bg-[#E0A200] transition-all"
                      >
                        最初のアイデアを投稿する
                      </button>
                    </div>
                  ) : (
                    /* アイデアカード一覧 */
                    <div className="flex flex-col gap-4">
                      {publishedIdeas.map((idea) => (
                        <div
                          key={idea.id}
                          className="p-4 sm:p-5 rounded-2xl bg-[#FFFDF5] border border-[#F5B301]/60 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-3 text-left"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap gap-1">
                              {idea.fields.map((f, i) => (
                                <span
                                  key={i}
                                  className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#F5B301]/30 text-[#4A2C0A] border border-[#F5B301]/60"
                                >
                                  {f}
                                </span>
                              ))}
                            </div>
                            {idea.publishedAt && (
                              <span className="text-[11px] text-[#4A2C0A]/60">
                                {formatDate(idea.publishedAt)}
                              </span>
                            )}
                          </div>

                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-base sm:text-lg font-bold text-[#4A2C0A]">
                              {idea.title}
                            </h3>
                            {idea.aiSuggestions && idea.aiSuggestions.length > 0 && (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#FFF8E1] text-[#7A3E00] border border-[#F5B301]/60 shrink-0">
                                候補 {idea.aiSuggestions.length}名
                              </span>
                            )}
                          </div>

                          <p className="text-xs sm:text-sm text-[#4A2C0A]/85 line-clamp-2 leading-relaxed">
                            {idea.goal}
                          </p>

                          {/* 募集中の役割タグ */}
                          {idea.roles && idea.roles.length > 0 && (
                            <div className="pt-1 flex flex-col gap-1">
                              <span className="text-[11px] font-bold text-[#4A2C0A]/70">
                                募集中の役割:
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {idea.roles.map((r, rIdx) => (
                                  <span
                                    key={rIdx}
                                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#FFF8E1] text-[#4A2C0A] border border-[#F5B301]/50"
                                  >
                                    {r.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* フッター: 投稿者と詳細ボタン */}
                          <div className="pt-2 border-t border-[#F5B301]/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                            <div className="text-xs text-[#4A2C0A]/80">
                              <span className="font-semibold text-[#4A2C0A]">
                                {idea.author.displayName}
                              </span>
                              {idea.author.university && (
                                <span className="ml-1.5 text-[#4A2C0A]/60">
                                  ({idea.author.university}
                                  {idea.author.faculty ? ` ${idea.author.faculty}` : ""}
                                  )
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedIdea(idea);
                                setMatchingError(null);
                                setMatchingMessage(null);
                              }}
                              className="w-full sm:w-auto px-4 py-1.5 rounded-full bg-[#F5B301] text-[#4A2C0A] text-xs font-bold hover:bg-[#E0A200] transition-colors shadow-sm text-center"
                            >
                              詳細を見る
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* タブ2: アイデア投稿フロー */}
          {activeTab === "idea" && (
            !user ? (
              <div className="w-full p-8 rounded-2xl bg-[#FFF8E1]/80 border border-[#F5B301]/40 flex flex-col items-center justify-center gap-4 text-center">
                <span className="text-3xl">💡</span>
                <p className="text-sm sm:text-base font-bold text-[#4A2C0A]">
                  アイデアを投稿するにはログインが必要です
                </p>
                <p className="text-xs text-[#4A2C0A]/70 max-w-sm">
                  Googleアカウントでログインすると、アイデアの投稿やAIによる深掘り質問の作成ができます。
                </p>
                <button
                  type="button"
                  onClick={handleLogin}
                  disabled={loading}
                  className="px-6 py-2.5 rounded-full bg-[#F5B301] text-[#4A2C0A] text-sm font-bold shadow-md hover:bg-[#E0A200] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      <span>ログイン処理中...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          fill="#4285F4"
                          d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.97 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                        />
                      </svg>
                      <span>Googleでログイン</span>
                    </>
                  )}
                </button>
                {error && (
                  <div
                    role="alert"
                    className="w-full max-w-md p-3.5 rounded-xl bg-[#FFF1DC] text-[#7A2500] text-xs font-medium border border-[#F5B301] text-left shadow-sm mt-1"
                  >
                    {error}
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full flex flex-col gap-5 text-left">
                <div className="flex items-center justify-between border-b border-[#F5B301]/30 pb-2">
                  <h2 className="text-lg sm:text-xl font-bold text-[#4A2C0A]">
                    アイデア投稿
                  </h2>
                  {ideaStep !== "completed" && (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#FFF8E1] text-[#4A2C0A] border border-[#F5B301]/40">
                      {ideaStep === "input" && "ステップ 1/3: 文章の入力"}
                      {ideaStep === "questions" && "ステップ 2/3: 質問への回答"}
                      {ideaStep === "review" && "ステップ 3/3: 整理結果の確認"}
                    </span>
                  )}
                </div>

                {/* エラーメッセージ表示 */}
                {ideaError && (
                  <div
                    role="alert"
                    className="w-full p-3.5 rounded-xl bg-[#FFF1DC] text-[#7A2500] text-sm font-medium border border-[#F5B301] shadow-sm"
                  >
                    エラー: {ideaError}
                  </div>
                )}

                {/* ローディング表示 */}
                {ideaLoading && (
                  <div className="w-full p-6 rounded-2xl bg-[#FFF8E1] border border-[#F5B301]/50 flex flex-col items-center justify-center gap-3 text-center shadow-sm">
                    <span className="inline-block h-7 w-7 animate-spin rounded-full border-3 border-[#F5B301] border-t-transparent" />
                    <p className="text-sm sm:text-base font-bold text-[#4A2C0A]">
                      {ideaLoadingText || "処理中..."}
                    </p>
                    <p className="text-xs text-[#4A2C0A]/70">
                      Geminiがあなたのアイデアを分析しています。少々お待ちください。
                    </p>
                  </div>
                )}

                {/* ステップ1: アイデア文章の入力 */}
                {!ideaLoading && ideaStep === "input" && (
                  <form onSubmit={handleSubmitRawText} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="rawText" className="text-sm font-bold text-[#4A2C0A]">
                        実現したいアイデアや夢の文章 <span className="text-[#C2410C]">*</span>
                      </label>
                      <p className="text-xs text-[#4A2C0A]/70">
                        どんなことをやってみたいか、思いついたまま自由に書いてみてください。AIが足りない要素を深掘りするための質問を作成します。
                      </p>
                      <textarea
                        id="rawText"
                        required
                        rows={6}
                        maxLength={2000}
                        value={rawText}
                        onChange={(e) => setRawText(e.target.value)}
                        placeholder="例: 大学の空き教室を活用して、農学部の育てた野菜を工学部の自動調理ロボットで提供する学生向けカフェを作りたいです。地域の人も巻き込んでフードロス削減に貢献したいと考えています。"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#F5B301]/60 bg-[#FFFDF5]/90 text-[#4A2C0A] placeholder-[#4A2C0A]/40 text-sm focus:outline-none focus:border-[#F5B301] focus:ring-2 focus:ring-[#F5B301]/50 shadow-inner resize-y"
                      />
                      <div className="text-right text-xs text-[#4A2C0A]/60">
                        {rawText.length} / 2000文字
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="w-full sm:w-auto min-w-[160px] px-6 py-2.5 rounded-full bg-[#F5B301] text-[#4A2C0A] text-sm font-bold shadow-md hover:bg-[#E0A200] active:scale-[0.98] transition-all"
                      >
                        深掘り質問を作成する
                      </button>
                    </div>
                  </form>
                )}

                {/* ステップ2: 3つの質問への回答 */}
                {!ideaLoading && ideaStep === "questions" && (
                  <form onSubmit={handleSubmitAnswers} className="flex flex-col gap-5">
                    <div className="p-3.5 rounded-xl bg-[#FFF8E1] border border-[#F5B301]/40 text-xs text-[#4A2C0A]">
                      <span className="font-bold block mb-1">【投稿したアイデア】</span>
                      <p className="line-clamp-3 text-[#4A2C0A]/80 whitespace-pre-wrap">{rawText}</p>
                    </div>

                    <p className="text-xs text-[#4A2C0A]/80 font-medium">
                      アイデアを具体化し仲間を集めやすくするため、以下の3つの質問に回答してください（各1000文字以内）。
                    </p>

                    {questions.map((q, idx) => (
                      <div key={idx} className="flex flex-col gap-1.5 p-3.5 rounded-xl bg-[#FFFDF5] border border-[#F5B301]/50 shadow-sm">
                        <label htmlFor={`answer-${idx}`} className="text-sm font-bold text-[#4A2C0A]">
                          質問 {idx + 1}: {q} <span className="text-[#C2410C]">*</span>
                        </label>
                        <textarea
                          id={`answer-${idx}`}
                          required
                          rows={3}
                          maxLength={1000}
                          value={answers[idx]}
                          onChange={(e) => {
                            const newAns = [...answers] as [string, string, string];
                            newAns[idx] = e.target.value;
                            setAnswers(newAns);
                          }}
                          placeholder="回答を入力してください"
                          className="w-full px-3.5 py-2 rounded-xl border border-[#F5B301]/60 bg-[#FFFBEB]/50 text-[#4A2C0A] placeholder-[#4A2C0A]/40 text-sm focus:outline-none focus:border-[#F5B301] focus:ring-2 focus:ring-[#F5B301]/50 shadow-inner resize-y"
                        />
                        <div className="text-right text-xs text-[#4A2C0A]/60">
                          {answers[idx].length} / 1000文字
                        </div>
                      </div>
                    ))}

                    <div className="flex flex-col sm:flex-row justify-between gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setIdeaStep("input")}
                        className="px-5 py-2 rounded-full border border-[#F5B301] bg-[#FFF8E1] text-[#4A2C0A] text-sm font-semibold hover:bg-[#F5B301]/40 transition-colors"
                      >
                        文章の入力に戻る
                      </button>
                      <button
                        type="submit"
                        className="w-full sm:w-auto min-w-[160px] px-6 py-2.5 rounded-full bg-[#F5B301] text-[#4A2C0A] text-sm font-bold shadow-md hover:bg-[#E0A200] active:scale-[0.98] transition-all"
                      >
                        アイデアを整理する
                      </button>
                    </div>
                  </form>
                )}

                {/* ステップ3: 整理結果の確認 & 公開ボタン */}
                {!ideaLoading && ideaStep === "review" && ideaResult && (
                  <div className="flex flex-col gap-5">
                    <div className="p-4 sm:p-5 rounded-2xl bg-[#FFFDF5] border border-[#F5B301] shadow-md flex flex-col gap-4">
                      {/* タイトル */}
                      <div>
                        <span className="text-xs font-bold text-[#4A2C0A]/60 block">タイトル</span>
                        <h3 className="text-lg sm:text-xl font-black text-[#4A2C0A] mt-0.5">
                          {ideaResult.title}
                        </h3>
                      </div>

                      {/* ゴール */}
                      <div>
                        <span className="text-xs font-bold text-[#4A2C0A]/60 block">目指すゴール</span>
                        <p className="text-sm text-[#4A2C0A] font-medium mt-1 leading-relaxed whitespace-pre-wrap">
                          {ideaResult.goal}
                        </p>
                      </div>

                      {/* 該当分野 */}
                      <div>
                        <span className="text-xs font-bold text-[#4A2C0A]/60 block mb-1.5">関連分野</span>
                        <div className="flex flex-wrap gap-1.5">
                          {ideaResult.fields.map((f, i) => (
                            <span
                              key={i}
                              className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#F5B301]/30 text-[#4A2C0A] border border-[#F5B301]/60"
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* 必要な役割とスキル */}
                      <div>
                        <span className="text-xs font-bold text-[#4A2C0A]/60 block mb-1.5">
                          募集する役割とスキル（他専攻向け翻訳）
                        </span>
                        <div className="flex flex-col gap-2.5">
                          {ideaResult.roles.map((role, idx) => (
                            <div
                              key={idx}
                              className="p-3 rounded-xl bg-[#FFF8E1]/80 border border-[#F5B301]/50 text-xs sm:text-sm"
                            >
                              <div className="font-bold text-[#4A2C0A] text-sm sm:text-base">
                                {role.name}
                              </div>
                              <div className="text-xs text-[#4A2C0A]/80 mt-1">
                                {role.reason}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-1">
                                {role.skills.map((skill, sIdx) => (
                                  <span
                                    key={sIdx}
                                    className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#FFFDF5] text-[#4A2C0A] border border-[#F5B301]/40"
                                  >
                                    {skill}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 最初の一歩 */}
                      <div>
                        <span className="text-xs font-bold text-[#4A2C0A]/60 block mb-1">
                          最初に取り組むステップ
                        </span>
                        <ol className="list-decimal list-inside text-xs sm:text-sm text-[#4A2C0A] flex flex-col gap-1 font-medium pl-1">
                          {ideaResult.firstSteps.map((step, idx) => (
                            <li key={idx} className="leading-relaxed">
                              {step}
                            </li>
                          ))}
                        </ol>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-between gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setIdeaStep("questions")}
                        disabled={publishing}
                        className="px-5 py-2.5 rounded-full border border-[#F5B301] bg-[#FFF8E1] text-[#4A2C0A] text-sm font-semibold hover:bg-[#F5B301]/40 transition-colors disabled:opacity-50"
                      >
                        回答を修正する
                      </button>
                      <button
                        type="button"
                        onClick={handlePublish}
                        disabled={publishing}
                        className="w-full sm:w-auto min-w-[160px] px-8 py-2.5 rounded-full bg-[#F5B301] text-[#4A2C0A] text-sm font-bold shadow-md hover:bg-[#E0A200] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {publishing ? (
                          <>
                            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            <span>公開中...</span>
                          </>
                        ) : (
                          <span>公開する</span>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* ステップ4: 公開完了 */}
                {ideaStep === "completed" && (
                  <div className="w-full p-6 sm:p-8 rounded-2xl bg-[#FFF8E1] border border-[#F5B301] flex flex-col items-center justify-center gap-4 text-center shadow-md">
                    <div className="w-12 h-12 rounded-full bg-[#F5B301] flex items-center justify-center text-2xl text-[#4A2C0A] shadow-inner font-black">
                      ✓
                    </div>
                    <h3 className="text-xl font-black text-[#4A2C0A]">
                      アイデアを公開しました！
                    </h3>
                    <p className="text-sm text-[#4A2C0A]/80 leading-relaxed max-w-sm">
                      あなたのアイデアが保存され、公開状態になりました。他分野の仲間を見つけてプロジェクトを始動させましょう！
                    </p>
                    <div className="mt-2 flex flex-col sm:flex-row gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab("ideas");
                          handleResetIdea();
                        }}
                        className="px-6 py-2.5 rounded-full bg-[#F5B301] text-[#4A2C0A] text-sm font-bold shadow-md hover:bg-[#E0A200] active:scale-[0.98] transition-all"
                      >
                        公開アイデア一覧を見る
                      </button>
                      <button
                        type="button"
                        onClick={handleResetIdea}
                        className="px-6 py-2.5 rounded-full border border-[#F5B301] bg-[#FFF8E1] text-[#4A2C0A] text-sm font-semibold hover:bg-[#F5B301]/40 transition-colors"
                      >
                        新しく別のアイデアを投稿する
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          )}

          {/* タブ3: スキル登録フォーム */}
          {activeTab === "profile" && (
            !user ? (
              <div className="w-full p-8 rounded-2xl bg-[#FFF8E1]/80 border border-[#F5B301]/40 flex flex-col items-center justify-center gap-4 text-center">
                <span className="text-3xl">👤</span>
                <p className="text-sm sm:text-base font-bold text-[#4A2C0A]">
                  スキル登録にはログインが必要です
                </p>
                <p className="text-xs text-[#4A2C0A]/70 max-w-sm">
                  Googleアカウントでログインして、あなたの大学や学部、得意なこと、参加したいプロジェクトのスキルを登録してください。
                </p>
                <button
                  type="button"
                  onClick={handleLogin}
                  disabled={loading}
                  className="px-6 py-2.5 rounded-full bg-[#F5B301] text-[#4A2C0A] text-sm font-bold shadow-md hover:bg-[#E0A200] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      <span>ログイン処理中...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          fill="#4285F4"
                          d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.97 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                        />
                      </svg>
                      <span>Googleでログイン</span>
                    </>
                  )}
                </button>
                {error && (
                  <div
                    role="alert"
                    className="w-full max-w-md p-3.5 rounded-xl bg-[#FFF1DC] text-[#7A2500] text-xs font-medium border border-[#F5B301] text-left shadow-sm mt-1"
                  >
                    {error}
                  </div>
                )}
              </div>
            ) : profileLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-[#4A2C0A]/70 font-medium">
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                <span>読み込み中...</span>
              </div>
            ) : (
              <form onSubmit={handleSaveProfile} className="w-full flex flex-col gap-4 text-left">
                <h2 className="text-lg sm:text-xl font-bold text-[#4A2C0A] border-b border-[#F5B301]/30 pb-2">
                  スキル登録
                </h2>

                {/* ステータスメッセージ */}
                {profileError && (
                  <div
                    role="alert"
                    className="w-full p-3.5 rounded-xl bg-[#FFF1DC] text-[#7A2500] text-sm font-medium border border-[#F5B301] shadow-sm"
                  >
                    エラー: {profileError}
                  </div>
                )}

                {profileSuccess && (
                  <div
                    role="status"
                    className="w-full p-3.5 rounded-xl bg-[#FFF8E1] text-[#4A2C0A] text-sm font-semibold border border-[#F5B301] shadow-sm"
                  >
                    {profileSuccess}
                  </div>
                )}

                {/* 表示名 */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="displayName" className="text-sm font-bold text-[#4A2C0A]">
                    表示名 <span className="text-[#C2410C]">*</span>
                  </label>
                  <input
                    id="displayName"
                    name="displayName"
                    type="text"
                    required
                    maxLength={50}
                    value={formData.displayName}
                    onChange={handleChange}
                    placeholder="例: 山田 太郎"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#F5B301]/60 bg-[#FFFDF5]/90 text-[#4A2C0A] placeholder-[#4A2C0A]/40 text-sm focus:outline-none focus:border-[#F5B301] focus:ring-2 focus:ring-[#F5B301]/50 shadow-inner"
                  />
                </div>

                {/* 大学名 */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="university" className="text-sm font-bold text-[#4A2C0A]">
                    大学名 <span className="text-[#C2410C]">*</span>
                  </label>
                  <input
                    id="university"
                    name="university"
                    type="text"
                    required
                    maxLength={100}
                    value={formData.university}
                    onChange={handleChange}
                    placeholder="例: ○○大学"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#F5B301]/60 bg-[#FFFDF5]/90 text-[#4A2C0A] placeholder-[#4A2C0A]/40 text-sm focus:outline-none focus:border-[#F5B301] focus:ring-2 focus:ring-[#F5B301]/50 shadow-inner"
                  />
                </div>

                {/* 学部 & 学科 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="faculty" className="text-sm font-bold text-[#4A2C0A]">
                      学部 <span className="text-[#C2410C]">*</span>
                    </label>
                    <input
                      id="faculty"
                      name="faculty"
                      type="text"
                      required
                      maxLength={100}
                      value={formData.faculty}
                      onChange={handleChange}
                      placeholder="例: 工学部"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#F5B301]/60 bg-[#FFFDF5]/90 text-[#4A2C0A] placeholder-[#4A2C0A]/40 text-sm focus:outline-none focus:border-[#F5B301] focus:ring-2 focus:ring-[#F5B301]/50 shadow-inner"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="department" className="text-sm font-bold text-[#4A2C0A]">
                      学科 <span className="text-[#C2410C]">*</span>
                    </label>
                    <input
                      id="department"
                      name="department"
                      type="text"
                      required
                      maxLength={100}
                      value={formData.department}
                      onChange={handleChange}
                      placeholder="例: 情報工学科"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#F5B301]/60 bg-[#FFFDF5]/90 text-[#4A2C0A] placeholder-[#4A2C0A]/40 text-sm focus:outline-none focus:border-[#F5B301] focus:ring-2 focus:ring-[#F5B301]/50 shadow-inner"
                    />
                  </div>
                </div>

                {/* 専攻・分野 */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="major" className="text-sm font-bold text-[#4A2C0A]">
                    専攻・分野 <span className="text-[#C2410C]">*</span>
                  </label>
                  <input
                    id="major"
                    name="major"
                    type="text"
                    required
                    maxLength={100}
                    value={formData.major}
                    onChange={handleChange}
                    placeholder="例: 人工知能・自然言語処理"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#F5B301]/60 bg-[#FFFDF5]/90 text-[#4A2C0A] placeholder-[#4A2C0A]/40 text-sm focus:outline-none focus:border-[#F5B301] focus:ring-2 focus:ring-[#F5B301]/50 shadow-inner"
                  />
                </div>

                {/* できること */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="skills" className="text-sm font-bold text-[#4A2C0A]">
                    できること <span className="text-[#C2410C]">*</span>
                  </label>
                  <textarea
                    id="skills"
                    name="skills"
                    required
                    rows={4}
                    maxLength={2000}
                    value={formData.skills}
                    onChange={handleChange}
                    placeholder="例: TypeScript / Reactを用いたWebフロントエンド開発、Pythonでのデータ分析、UI/UXデザインなど"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#F5B301]/60 bg-[#FFFDF5]/90 text-[#4A2C0A] placeholder-[#4A2C0A]/40 text-sm focus:outline-none focus:border-[#F5B301] focus:ring-2 focus:ring-[#F5B301]/50 shadow-inner resize-y"
                  />
                </div>

                {/* 協力したいテーマや動機（任意） */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="motivation" className="text-sm font-bold text-[#4A2C0A]">
                    協力したいテーマや動機（任意）
                  </label>
                  <textarea
                    id="motivation"
                    name="motivation"
                    rows={3}
                    maxLength={1000}
                    value={formData.motivation}
                    onChange={handleChange}
                    placeholder="例: 教育系のWebサービスやハッカソンでのプロダクト開発に参加したいです。"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#F5B301]/60 bg-[#FFFDF5]/90 text-[#4A2C0A] placeholder-[#4A2C0A]/40 text-sm focus:outline-none focus:border-[#F5B301] focus:ring-2 focus:ring-[#F5B301]/50 shadow-inner resize-y"
                  />
                </div>

                {/* 保存ボタン */}
                <div className="mt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full sm:w-auto min-w-[140px] px-6 py-2.5 rounded-full bg-[#F5B301] text-[#4A2C0A] text-sm font-bold shadow-md hover:bg-[#E0A200] active:scale-[0.98] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <>
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        <span>保存中...</span>
                      </>
                    ) : (
                      <span>保存</span>
                    )}
                  </button>
                </div>
              </form>
            )
          )}
        </div>
      </div>
    </main>
  );
}
