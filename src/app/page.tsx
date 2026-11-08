"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, User } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
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
    try {
      await signOut(auth);
    } catch {
      setError("ログアウトに失敗しました。もう一度お試しください。");
    }
  };

  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-center px-4 py-8 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <div className="w-full max-w-sm sm:max-w-md flex flex-col items-center text-center p-6 sm:p-8 bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800">
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">HIVE</h1>
        <p className="mt-4 text-base sm:text-lg text-zinc-600 dark:text-zinc-400">
          その夢を実現させる仲間を見つけよう。
        </p>

        {error && (
          <div
            role="alert"
            className="mt-6 w-full p-3 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-sm font-medium border border-red-200 dark:border-red-900/50"
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
            <div className="w-full flex flex-col items-center gap-4">
              <div className="text-base sm:text-lg font-medium text-zinc-800 dark:text-zinc-200 break-all">
                {user.displayName || user.email || "ユーザー"}
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full sm:w-auto min-w-[160px] px-6 py-2.5 rounded-full border border-zinc-300 dark:border-zinc-700 bg-transparent text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                ログアウト
              </button>
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
