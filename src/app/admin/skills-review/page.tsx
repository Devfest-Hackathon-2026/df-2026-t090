"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { formatJSTDateTime } from "@/lib/theme";

interface SkillReviewItem {
  id: string;
  userId: string;
  applicantName: string;
  applicantSchool: string;
  applicantFaculty: string;
  applicantGrade: string;
  skillId: string;
  skillName: string;
  categoryName: string;
  status: "verified" | "pending" | "rejected";
  level?: number;
  score?: string;
  period?: string;
  evidence: {
    evidenceType?: string;
    description?: string;
    fileUrls?: string[];
    links?: string[];
  };
  reviewerComment?: string;
  submittedAt: string;
}

export default function SkillsReviewPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [branches, setBranches] = useState<SkillReviewItem[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<SkillReviewItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [updating, setUpdating] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 審査入力フォーム
  const [evalLevel, setEvalLevel] = useState<number>(2);
  const [evalComment, setEvalComment] = useState<string>("");

  const fetchBranches = useCallback(async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    setError(null);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/admin/skills-review", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("申請一覧取得失敗");
      const data = await res.json();
      setBranches(data.branches || []);
      if (data.branches?.length > 0 && !selectedBranch) {
        setSelectedBranch(data.branches[0]);
      }
    } catch {
      setError("審査一覧の取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  }, [selectedBranch]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) fetchBranches();
    });
    return () => unsubscribe();
  }, [fetchBranches]);

  const handleDecision = async (decision: "approve" | "request_evidence" | "reject") => {
    if (!selectedBranch || !currentUser) return;
    setUpdating(true);
    setMessage(null);
    setError(null);

    try {
      const token = await currentUser.getIdToken();
      const res = await fetch("/api/admin/skills-review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          branchId: selectedBranch.id,
          decision,
          level: evalLevel,
          comment: evalComment || (decision === "approve" ? "提出された根拠を確認し、スキル枝として認定しました。" : "根拠の再提出をお願いします。"),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMessage(data.message);
      setEvalComment("");
      fetchBranches();
    } catch (err: unknown) {
      setError((err as Error).message || "審査の確定に失敗しました。");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between border-b border-[#B87503]/30 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[#3D2406] flex items-center gap-2">
            <span>🔍</span>
            <span>A02 スキル申請の審査</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#5C3D15] mt-1">
            学生から提出されたスキルの枝と根拠を審査し、スキルツリーに反映・追加根拠要請・見送りを判定します。
          </p>
        </div>
        <Link
          href="/admin"
          className="px-4 py-2 rounded-full border border-[#B87503] bg-[#FFF8E1] text-[#3D2406] text-xs font-bold hover:bg-[#F5B301]"
        >
          ← 受付箱に戻る
        </Link>
      </div>

      {message && (
        <div className="p-3.5 rounded-xl bg-[#EDF7ED] border border-[#81C784] text-[#1E4620] text-xs sm:text-sm font-bold">
          ✓ {message}
        </div>
      )}
      {error && (
        <div className="p-3.5 rounded-xl bg-[#FDEAEA] border border-[#E57373] text-[#5F1313] text-xs sm:text-sm font-bold">
          ⚠ {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 左カラム: 申請一覧 */}
        <div className="md:col-span-1 flex flex-col gap-2">
          <span className="text-xs font-bold text-[#7A5726]">審査待ち一覧（{branches.length}件）</span>
          <div className="flex flex-col gap-2 max-h-[550px] overflow-y-auto no-scrollbar">
            {loading ? (
              <div className="py-8 text-center text-xs text-[#7A5726] font-bold">読み込み中...</div>
            ) : branches.length === 0 ? (
              <div className="p-6 rounded-2xl bg-[#FFFBEB] border border-[#B87503]/30 text-center text-xs text-[#7A5726]">
                現在審査待ちの申請はありません。
              </div>
            ) : (
              branches.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelectedBranch(b)}
                  className={`w-full text-left p-3.5 rounded-2xl border transition-all flex flex-col gap-1 ${
                    selectedBranch?.id === b.id
                      ? "bg-[#FFF4CA] border-2 border-[#F5B301] shadow-md"
                      : "bg-[#FFFBEB] border-[#B87503]/25 hover:bg-[#FFF8E1]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-[#3D2406]">{b.skillName}</span>
                    <span
                      className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${
                        b.status === "verified"
                          ? "bg-[#EDF7ED] text-[#1E4620]"
                          : b.status === "rejected"
                          ? "bg-[#FDEAEA] text-[#5F1313]"
                          : "bg-[#FFF8E1] text-[#B87503]"
                      }`}
                    >
                      {b.status === "verified" ? "認定済" : b.status === "rejected" ? "見送り" : "審査待ち"}
                    </span>
                  </div>
                  <span className="text-[11px] text-[#5C3D15]">
                    {b.applicantSchool} {b.applicantGrade} ({b.applicantName})
                  </span>
                  <span className="text-[10px] text-[#7A5726]">
                    提出日: {formatJSTDateTime(b.submittedAt)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* 右カラム: 申請詳細 ＆ 審査判定アクション */}
        <div className="md:col-span-2">
          {selectedBranch ? (
            <div className="p-6 rounded-3xl bg-[#FFFBEB] border-2 border-[#B87503]/40 shadow-xs flex flex-col gap-4 text-left">
              <div className="border-b border-[#B87503]/25 pb-3">
                <span className="text-xs font-bold text-[#B87503] block mb-1">
                  分野: {selectedBranch.categoryName}
                </span>
                <h2 className="text-xl font-black text-[#3D2406]">{selectedBranch.skillName}</h2>
                <span className="text-xs text-[#5C3D15] mt-1 block">
                  申請者: <strong>{selectedBranch.applicantName}</strong>（{selectedBranch.applicantSchool} {selectedBranch.applicantFaculty} {selectedBranch.applicantGrade}）
                </span>
              </div>

              {/* 活動実績・説明 */}
              <div className="p-3.5 rounded-2xl bg-[#FFFDF7] border border-[#B87503]/20 flex flex-col gap-1 text-xs">
                <span className="font-bold text-[#7A5726]">何をしてきたか（活動実績）:</span>
                <p className="text-[#3D2406] leading-relaxed">
                  {selectedBranch.evidence?.description || "説明記載なし"}
                </p>
              </div>

              {/* 根拠リンク・ファイル */}
              <div className="p-3.5 rounded-2xl bg-[#FFFDF7] border border-[#B87503]/20 flex flex-col gap-1 text-xs">
                <span className="font-bold text-[#7A5726]">提出された根拠（成果物・URL・レポート）:</span>
                {selectedBranch.evidence?.links && selectedBranch.evidence.links.length > 0 ? (
                  <div className="flex flex-col gap-1 mt-1">
                    {selectedBranch.evidence.links.map((link, idx) => (
                      <a
                        key={idx}
                        href={link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#B87503] underline font-bold truncate hover:text-[#E0A200]"
                      >
                        🔗 {link}
                      </a>
                    ))}
                  </div>
                ) : (
                  <span className="text-[#7A5726]">提出根拠ファイル: 確認用PDF（添付済）</span>
                )}
              </div>

              {/* 審査結果の入力フォーム */}
              <div className="p-4 rounded-2xl bg-[#FFF8E1] border border-[#F5B301] flex flex-col gap-3 text-xs">
                <span className="font-black text-[#3D2406] block">審査判定の入力</span>

                <div>
                  <label className="font-bold text-[#3D2406] block mb-1">認定レベル</label>
                  <select
                    value={evalLevel}
                    onChange={(e) => setEvalLevel(Number(e.target.value))}
                    className="p-2 border border-[#B87503]/30 rounded-xl bg-[#FFFDF7] text-xs font-bold"
                  >
                    <option value={1}>Lv1: 教わりながらできる</option>
                    <option value={2}>Lv2: ひとりでできる</option>
                    <option value={3}>Lv3: 人に教えられる</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-[#3D2406] block mb-1">
                    学生への一言（ツリーの根拠として本人に見えます）
                  </label>
                  <textarea
                    rows={2}
                    placeholder="例: 実験レポートとソースコードを確認しました。基礎がしっかり身についているためLv2としてツリーに反映します。"
                    value={evalComment}
                    onChange={(e) => setEvalComment(e.target.value)}
                    className="w-full bg-[#FFFDF7] border border-[#B87503]/30 rounded-xl p-2.5 text-xs text-[#3D2406]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#B87503]/20">
                  <button
                    type="button"
                    onClick={() => handleDecision("reject")}
                    disabled={updating}
                    className="px-3.5 py-2 rounded-full border border-[#E57373] bg-[#FDEAEA] text-[#5F1313] text-xs font-bold hover:bg-[#FCD8D8]"
                  >
                    見送る
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDecision("request_evidence")}
                    disabled={updating}
                    className="px-3.5 py-2 rounded-full border border-[#B87503] bg-[#FFF8E1] text-[#B87503] text-xs font-bold hover:bg-[#F5B301]/30"
                  >
                    根拠の追加をお願いする
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDecision("approve")}
                    disabled={updating}
                    className="px-5 py-2 rounded-full bg-[#F5B301] text-[#3D2406] text-xs font-black shadow-xs hover:bg-[#E0A200]"
                  >
                    ツリーに反映する（承認）✓
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 rounded-3xl bg-[#FFFBEB] border border-[#B87503]/30 text-center text-xs text-[#7A5726]">
              左のリストから審査したい申請を選択してください。
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
