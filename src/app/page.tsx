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

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // プロフィールフォーム用State
  const [formData, setFormData] = useState<ProfileFormData>(initialFormData);
  const [profileLoading, setProfileLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

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

  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-start py-8 px-4 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <div className="w-full max-w-xl flex flex-col items-center text-center p-6 sm:p-8 bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800">
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">HIVE</h1>
        <p className="mt-4 text-base sm:text-lg text-zinc-600 dark:text-zinc-400">
          その夢を実現させる仲間を見つけよう。
        </p>

        {error && (
          <div
            role="alert"
            className="mt-6 w-full p-3 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-sm font-medium border border-red-200 dark:border-red-900/50 text-left"
          >
            {error}
          </div>
        )}

        <div className="mt-8 w-full flex flex-col items-center">
          {loading ? (
            <div className="flex items-center gap-2 py-3 text-zinc-500 dark:text-zinc-400 font-medium">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              <span>読み込み中...</span>
            </div>
          ) : user ? (
            <div className="w-full flex flex-col gap-6">
              {/* ユーザーヘッダー & ログアウト */}
              <div className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-zinc-200 dark:border-zinc-800">
                <div className="text-left">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 block">ログイン中</span>
                  <span className="text-base font-semibold text-zinc-800 dark:text-zinc-200 break-all">
                    {user.displayName || user.email || "ユーザー"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full sm:w-auto px-4 py-2 rounded-full border border-zinc-300 dark:border-zinc-700 bg-transparent text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  ログアウト
                </button>
              </div>

              {/* スキル登録フォーム */}
              {profileLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-zinc-500 dark:text-zinc-400 font-medium">
                  <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  <span>読み込み中...</span>
                </div>
              ) : (
                <form onSubmit={handleSaveProfile} className="w-full flex flex-col gap-4 text-left">
                  <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-800 pb-2">
                    スキル登録
                  </h2>

                  {/* ステータスメッセージ */}
                  {profileError && (
                    <div
                      role="alert"
                      className="w-full p-3 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-sm font-medium border border-red-200 dark:border-red-900/50"
                    >
                      エラー: {profileError}
                    </div>
                  )}

                  {profileSuccess && (
                    <div
                      role="status"
                      className="w-full p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-sm font-medium border border-emerald-200 dark:border-emerald-900/50"
                    >
                      {profileSuccess}
                    </div>
                  )}

                  {/* 表示名 */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="displayName" className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                      表示名 <span className="text-red-500">*</span>
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
                      className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                    />
                  </div>

                  {/* 大学名 */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="university" className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                      大学名 <span className="text-red-500">*</span>
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
                      className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                    />
                  </div>

                  {/* 学部 & 学科 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="faculty" className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                        学部 <span className="text-red-500">*</span>
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
                        className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="department" className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                        学科 <span className="text-red-500">*</span>
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
                        className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                      />
                    </div>
                  </div>

                  {/* 専攻・分野 */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="major" className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                      専攻・分野 <span className="text-red-500">*</span>
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
                      className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                    />
                  </div>

                  {/* できること */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="skills" className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                      できること <span className="text-red-500">*</span>
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
                      className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 resize-y"
                    />
                  </div>

                  {/* 協力したいテーマや動機（任意） */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="motivation" className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
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
                      className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 resize-y"
                    />
                  </div>

                  {/* 保存ボタン */}
                  <div className="mt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={saving}
                      className="w-full sm:w-auto min-w-[140px] px-6 py-2.5 rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-sm font-semibold shadow hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
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
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={handleLogin}
              className="w-full sm:w-auto min-w-[220px] flex items-center justify-center gap-3 px-6 py-3 rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-sm sm:text-base font-semibold shadow hover:opacity-90 transition-opacity"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
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
