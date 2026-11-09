"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, User } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";

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

type TabType = "profile" | "idea";
type IdeaStep = "input" | "questions" | "review" | "completed";

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // アクティブタブ（スキル登録 / アイデア投稿）
  const [activeTab, setActiveTab] = useState<TabType>("profile");

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
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);

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
          setProfileError("プロフィールの読み込み中に通信エラーが発生しました。");
          setFormData({
            ...initialFormData,
            displayName: currentUser.displayName || "",
          });
        } finally {
          setProfileLoading(false);
        }
      } else {
        setFormData(initialFormData);
        setProfileError(null);
        setProfileSuccess(null);
        // アイデアステートも初期化
        handleResetIdea();
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const authError = err as { code?: string; message?: string };
      if (authError.code === "auth/popup-blocked") {
        setError("ポップアップがブロックされました。ブラウザの設定でポップアップを許可してください。");
      } else if (authError.code === "auth/popup-closed-by-user") {
        setError("ログイン用ポップアップが閉じられました。");
      } else if (authError.code === "auth/cancelled-popup-request") {
        setError("直前の認証リクエストがキャンセルされました。もう一度お試しください。");
      } else if (authError.code === "auth/network-request-failed") {
        setError("通信エラーが発生しました。ネットワーク接続を確認してください。");
      } else {
        setError("ログインに失敗しました。もう一度お試しください。");
      }
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
    } catch {
      setIdeaError("通信エラーが発生しました。もう一度お試しください。");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-start py-8 sm:py-12 px-4 text-[#4A2C0A]">
      <div className="w-full max-w-xl flex flex-col items-center text-center p-6 sm:p-8 bg-[#FFFBEB]/90 backdrop-blur-sm rounded-3xl shadow-xl shadow-amber-900/10 border border-[#F5B301]/40">
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
          {loading ? (
            <div className="flex items-center gap-2 py-3 text-[#4A2C0A]/70 font-medium">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              <span>読み込み中...</span>
            </div>
          ) : user ? (
            <div className="w-full flex flex-col gap-6">
              {/* ユーザーヘッダー & ログアウト */}
              <div className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-[#F5B301]/30">
                <div className="text-left">
                  <span className="text-xs text-[#4A2C0A]/70 font-medium block">ログイン中</span>
                  <span className="text-base font-bold text-[#4A2C0A] break-all">
                    {user.displayName || user.email || "ユーザー"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full sm:w-auto px-4 py-2 rounded-full border border-[#F5B301] bg-[#FFF8E1] text-[#4A2C0A] text-sm font-semibold hover:bg-[#F5B301] transition-colors shadow-sm"
                >
                  ログアウト
                </button>
              </div>

              {/* タブ切り替え: スキル登録 / アイデア投稿 */}
              <div className="w-full grid grid-cols-2 gap-2 p-1.5 bg-[#FFF8E1] rounded-2xl border border-[#F5B301]/40">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("profile");
                    setIdeaError(null);
                  }}
                  className={`py-2 px-3 rounded-xl text-sm font-bold transition-all ${
                    activeTab === "profile"
                      ? "bg-[#F5B301] text-[#4A2C0A] shadow-md"
                      : "text-[#4A2C0A]/70 hover:text-[#4A2C0A] hover:bg-[#F5B301]/20"
                  }`}
                >
                  スキル登録
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("idea");
                    setProfileError(null);
                    setProfileSuccess(null);
                  }}
                  className={`py-2 px-3 rounded-xl text-sm font-bold transition-all ${
                    activeTab === "idea"
                      ? "bg-[#F5B301] text-[#4A2C0A] shadow-md"
                      : "text-[#4A2C0A]/70 hover:text-[#4A2C0A] hover:bg-[#F5B301]/20"
                  }`}
                >
                  アイデア投稿
                </button>
              </div>

              {/* タブ1: スキル登録フォーム */}
              {activeTab === "profile" && (
                profileLoading ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-[#4A2C0A]/70 font-medium">
                    <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    <span>読み込み中...</span>
                  </div>
                ) : (
                  <form onSubmit={handleSaveProfile} className="w-full flex flex-col gap-4 text-left">
                    <h2 className="text-xl font-bold text-[#4A2C0A] border-b border-[#F5B301]/30 pb-2">
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

              {/* タブ2: アイデア投稿フロー */}
              {activeTab === "idea" && (
                <div className="w-full flex flex-col gap-5 text-left">
                  <div className="flex items-center justify-between border-b border-[#F5B301]/30 pb-2">
                    <h2 className="text-xl font-bold text-[#4A2C0A]">
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
                      <button
                        type="button"
                        onClick={handleResetIdea}
                        className="mt-2 px-6 py-2.5 rounded-full bg-[#F5B301] text-[#4A2C0A] text-sm font-bold shadow-md hover:bg-[#E0A200] active:scale-[0.98] transition-all"
                      >
                        新しく別のアイデアを投稿する
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={handleLogin}
              className="w-full sm:w-auto min-w-[220px] flex items-center justify-center gap-3 px-6 py-3 rounded-full bg-[#F5B301] text-[#4A2C0A] text-sm sm:text-base font-bold shadow-md hover:bg-[#E0A200] active:scale-[0.98] transition-all"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
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
          )}
        </div>
      </div>
    </main>
  );
}
