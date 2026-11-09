"use client";

import { useState, useEffect } from "react";
import { User } from "firebase/auth";
import { UserProfile, DayOfWeek, TimeSlot, TimetableSlot } from "@/lib/types/hive";
import SchoolCombobox from "@/components/SchoolCombobox";

interface OnboardingModalProps {
  user: User;
  profile: UserProfile | null;
  onComplete: () => void;
  onClose?: () => void;
}

const DAYS: { key: DayOfWeek; label: string }[] = [
  { key: "mon", label: "月" },
  { key: "tue", label: "火" },
  { key: "wed", label: "水" },
  { key: "thu", label: "木" },
  { key: "fri", label: "金" },
];

const SLOTS: TimeSlot[] = [1, 2, 3, 4, 5];

interface PeriodTime {
  period: number;
  startTime: string;
  endTime: string;
}

const DEFAULT_PERIOD_TIMES: PeriodTime[] = [
  { period: 1, startTime: "09:00", endTime: "10:30" },
  { period: 2, startTime: "10:45", endTime: "12:15" },
  { period: 3, startTime: "13:00", endTime: "14:30" },
  { period: 4, startTime: "14:45", endTime: "16:15" },
  { period: 5, startTime: "16:30", endTime: "18:00" },
];

export default function OnboardingModal({
  user,
  profile,
  onComplete,
  onClose,
}: OnboardingModalProps) {
  const [step, setStep] = useState<1 | 2>(1); // 1: 学校・所属, 2: 時間割
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // フォームデータ
  const [schoolId, setSchoolId] = useState<string>(profile?.schoolId || "");
  const [schoolName, setSchoolName] = useState<string>(profile?.schoolName || "");
  const [faculty, setFaculty] = useState<string>(profile?.faculty || "");
  const [department, setDepartment] = useState<string>(profile?.department || "");
  const [grade, setGrade] = useState<string>(profile?.grade || "学部2年");
  const [major, setMajor] = useState<string>(profile?.major || "");

  // 大学別時間割提案用State
  const [universityTemplate, setUniversityTemplate] = useState<PeriodTime[] | null>(null);
  const [isFirstUserOfSchool, setIsFirstUserOfSchool] = useState<boolean>(false);
  const [hasAppliedTemplate, setHasAppliedTemplate] = useState<boolean>(false);
  const [periodTimes, setPeriodTimes] = useState<PeriodTime[]>(DEFAULT_PERIOD_TIMES);
  const [isCustomEditingPeriods, setIsCustomEditingPeriods] = useState<boolean>(false);

  // 時間割（空きコマ: true = 空いている）
  const [timetable, setTimetable] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    if (profile?.timetable && profile.timetable.length > 0) {
      for (const t of profile.timetable) {
        map[`${t.day}-${t.slot}`] = t.isAvailable;
      }
    }
    return map;
  });

  // ステップ2に遷移した際、その大学の時間割テンプレートを取得
  useEffect(() => {
    if (step === 2 && schoolId) {
      const fetchTemplate = async () => {
        try {
          const res = await fetch(`/api/schools/timetable?schoolId=${encodeURIComponent(schoolId)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.template && Array.isArray(data.template)) {
              setUniversityTemplate(data.template);
              setIsFirstUserOfSchool(false);
            } else {
              setUniversityTemplate(null);
              setIsFirstUserOfSchool(true);
            }
          }
        } catch {
          setIsFirstUserOfSchool(true);
        }
      };
      fetchTemplate();
    }
  }, [step, schoolId]);

  const toggleSlot = (day: DayOfWeek, slot: TimeSlot) => {
    const key = `${day}-${slot}`;
    setTimetable((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // 大学の提案を適用
  const handleApplyTemplate = () => {
    if (universityTemplate) {
      setPeriodTimes(universityTemplate);
      setHasAppliedTemplate(true);
    }
  };

  // スキップハンドラ（仕様: 「手間のかかる作業なのでスキップできるようにしてあとからでもできるようにして。もしスキップして設定していなくても警告とかはしないで」）
  const handleSkip = () => {
    if (onClose) {
      onClose();
    } else {
      onComplete();
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const token = await user.getIdToken();

      // 時間割配列の構築
      const formattedTimetable: TimetableSlot[] = [];
      for (const d of DAYS) {
        for (const s of SLOTS) {
          formattedTimetable.push({
            day: d.key,
            slot: s,
            isAvailable: Boolean(timetable[`${d.key}-${s}`]),
          });
        }
      }

      // プロフィール保存
      const res = await fetch("/api/auth/me", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          displayName: user.displayName || "学生ユーザー",
          email: user.email || "",
          schoolId,
          schoolName,
          faculty,
          department,
          grade,
          major,
          timetable: formattedTimetable,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "保存に失敗しました。");
      }

      // 大学の最初のユーザーまたは独自設定の場合、大学の共有テンプレートとして保存
      if (schoolId && schoolId !== "custom-requested") {
        fetch("/api/schools/timetable", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            schoolId,
            schoolName,
            periods: periodTimes,
            userUid: user.uid,
          }),
        }).catch(() => {});
      }

      onComplete();
    } catch (err: unknown) {
      setError((err as Error).message || "エラーが発生しました。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#3D2406]/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#FFFBEB] max-w-xl w-full rounded-3xl p-6 sm:p-8 border-2 border-[#B87503] shadow-2xl flex flex-col gap-5 text-left my-8">
        {/* ヘッダー ＆ スキップボタン */}
        <div className="flex items-start justify-between border-b border-[#B87503]/30 pb-3 gap-2">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-[#3D2406] flex items-center gap-2">
              <span>🐝</span>
              <span>初期設定（学校と時間割）</span>
            </h2>
            <p className="text-xs text-[#5C3D15] mt-1">
              {step === 1
                ? "ステップ 1/2: 在籍大学・高専の設定"
                : "ステップ 2/2: 時間割と空きコマの設定（あとからいつでも変更できます）"}
            </p>
          </div>

          {/* 右上のスキップボタン */}
          <button
            type="button"
            onClick={handleSkip}
            className="px-3 py-1 rounded-full text-xs font-bold border border-[#B87503]/40 bg-[#FFF8E1] text-[#7A5726] hover:bg-[#F5B301] hover:text-[#3D2406] transition-colors shrink-0"
          >
            スキップする ✕
          </button>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-[#FDEAEA] border border-[#E57373] text-[#5F1313] text-xs font-bold">
            ⚠ {error}
          </div>
        )}

        {/* ──────── ステップ 1: 学校・所属 ──────── */}
        {step === 1 && (
          <div className="flex flex-col gap-4 text-xs">
            {/* 大学名の入力補完と正式名称プルダウン選択 */}
            <div>
              <label className="font-bold text-[#3D2406] block mb-1">
                在籍する学校（大学または高等専門学校） <span className="text-[#B87503]">*</span>
              </label>

              <SchoolCombobox
                value={schoolName}
                schoolId={schoolId}
                onChange={(sc) => {
                  setSchoolId(sc.id);
                  setSchoolName(sc.name);
                }}
              />
              <span className="text-[11px] text-[#7A5726] block mt-1">
                ※ 入力すると該当大学がプルダウンで表示されます。選んで確定することで表記揺れを防ぎます。
              </span>
            </div>

            {/* 学部・学科・専攻 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-[#3D2406] block mb-1">学部 / 系</label>
                <input
                  type="text"
                  placeholder="例: 農学部 / 工学院"
                  value={faculty}
                  onChange={(e) => setFaculty(e.target.value)}
                  className="w-full bg-[#FFFDF7] border border-[#B87503]/30 rounded-xl p-2.5 text-xs text-[#3D2406]"
                />
              </div>

              <div>
                <label className="font-bold text-[#3D2406] block mb-1">学科 / 類</label>
                <input
                  type="text"
                  placeholder="例: 応用生物科学科"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full bg-[#FFFDF7] border border-[#B87503]/30 rounded-xl p-2.5 text-xs text-[#3D2406]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-[#3D2406] block mb-1">学年</label>
                <select
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className="w-full bg-[#FFFDF7] border border-[#B87503]/30 rounded-xl p-2.5 text-xs text-[#3D2406]"
                >
                  <option value="高専1年">高専1年</option>
                  <option value="高専2年">高専2年</option>
                  <option value="高専3年">高専3年</option>
                  <option value="高専4年">高専4年</option>
                  <option value="高専5年">高専5年</option>
                  <option value="学部1年">学部1年</option>
                  <option value="学部2年">学部2年</option>
                  <option value="学部3年">学部3年</option>
                  <option value="学部4年">学部4年</option>
                  <option value="修士1年">修士1年</option>
                  <option value="修士2年">修士2年</option>
                  <option value="博士課程">博士課程</option>
                  <option value="その他">その他</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-[#3D2406] block mb-1">専門・専攻テーマ</label>
                <input
                  type="text"
                  placeholder="例: 微生物発酵、ロボティクス"
                  value={major}
                  onChange={(e) => setMajor(e.target.value)}
                  className="w-full bg-[#FFFDF7] border border-[#B87503]/30 rounded-xl p-2.5 text-xs text-[#3D2406]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#B87503]/20">
              <button
                type="button"
                onClick={handleSkip}
                className="text-xs text-[#7A5726] hover:underline font-bold"
              >
                あとで設定する（スキップ）
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-6 py-2.5 rounded-full bg-[#F5B301] text-[#3D2406] text-xs font-bold hover:bg-[#E0A200] shadow-xs flex items-center gap-1"
              >
                <span>次へ（時間割の入力）</span>
                <span>→</span>
              </button>
            </div>
          </div>
        )}

        {/* ──────── ステップ 2: 時間割の提案 ＆ 空きコマ設定 ──────── */}
        {step === 2 && (
          <div className="flex flex-col gap-4 text-xs">
            {/* 大学時間割の提案カード（仕様: 大学毎に時間割情報を共有して提案、拒否して独自設定も可能） */}
            {universityTemplate ? (
              <div className="p-3.5 rounded-2xl bg-[#FFF8E1] border-2 border-[#F5B301] flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#3D2406] flex items-center gap-1.5">
                    <span>💡</span>
                    <span>{schoolName || "在籍大学"} の時間割パターンが見つかりました</span>
                  </span>
                  {!hasAppliedTemplate ? (
                    <button
                      type="button"
                      onClick={handleApplyTemplate}
                      className="px-3 py-1 rounded-full bg-[#F5B301] text-[#3D2406] text-xs font-bold hover:bg-[#E0A200] shadow-xs"
                    >
                      この時間割を使う
                    </button>
                  ) : (
                    <span className="text-[11px] text-[#1E4620] font-bold">✓ 適用済み</span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 text-[11px] text-[#5C3D15]">
                  {universityTemplate.map((p) => (
                    <span
                      key={p.period}
                      className="bg-[#FFFDF7] px-2 py-0.5 rounded-md border border-[#B87503]/20"
                    >
                      {p.period}限: {p.startTime}〜{p.endTime}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-[#B87503]/20">
                  <span className="text-[10px] text-[#7A5726]">
                    ※ 例外や独自の時限がある場合は、提案を拒否して自分で変更できます。
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsCustomEditingPeriods(!isCustomEditingPeriods)}
                    className="text-[11px] text-[#B87503] hover:underline font-bold"
                  >
                    {isCustomEditingPeriods ? "閉じる" : "時限の時間を自分で設定する"}
                  </button>
                </div>
              </div>
            ) : isFirstUserOfSchool ? (
              <div className="p-3.5 rounded-2xl bg-[#FFFDF7] border border-[#B87503]/30 flex flex-col gap-1.5">
                <span className="font-bold text-[#3D2406] flex items-center gap-1">
                  <span>ℹ️</span>
                  <span>{schoolName || "あなたの学校"} で最初の時間割登録です</span>
                </span>
                <p className="text-[11px] text-[#5C3D15] leading-relaxed">
                  まだこの大学の時間割の登録例がありません。各時限の開始・終了時刻を設定できます（保存すると次回から同じ大学の仲間に提案されます）。
                </p>
                <button
                  type="button"
                  onClick={() => setIsCustomEditingPeriods(!isCustomEditingPeriods)}
                  className="text-[11px] text-[#B87503] hover:underline font-bold self-start mt-0.5"
                >
                  {isCustomEditingPeriods ? "設定完了" : "時限の時間を調整する"}
                </button>
              </div>
            ) : null}

            {/* 時限時間の個別編集（例外生など自分で設定したい場合） */}
            {isCustomEditingPeriods && (
              <div className="p-3 rounded-2xl bg-[#FFFDF7] border border-[#B87503]/30 flex flex-col gap-2">
                <span className="font-bold text-[#3D2406]">各時限の開始・終了時刻の手動調整:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {periodTimes.map((pt, idx) => (
                    <div key={pt.period} className="flex items-center gap-1 text-[11px]">
                      <span className="font-bold w-8">{pt.period}限:</span>
                      <input
                        type="time"
                        value={pt.startTime}
                        onChange={(e) => {
                          const updated = [...periodTimes];
                          updated[idx] = { ...updated[idx], startTime: e.target.value };
                          setPeriodTimes(updated);
                        }}
                        className="p-1 border border-[#B87503]/30 rounded-md bg-white text-xs"
                      />
                      <span>〜</span>
                      <input
                        type="time"
                        value={pt.endTime}
                        onChange={(e) => {
                          const updated = [...periodTimes];
                          updated[idx] = { ...updated[idx], endTime: e.target.value };
                          setPeriodTimes(updated);
                        }}
                        className="p-1 border border-[#B87503]/30 rounded-md bg-white text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-[11px] text-[#5C3D15] leading-relaxed">
              <strong>空いているコマをクリックして「◯ 空き」</strong>にしてください。
              他のメンバーには予定の中身は見えず、「空き」か「予定あり」だけが重なって表示されます。
            </p>

            {/* 時間割マトリクス */}
            <div className="overflow-x-auto rounded-2xl border border-[#B87503]/30 bg-[#FFFDF7] p-2">
              <table className="w-full text-center">
                <thead>
                  <tr className="border-b border-[#B87503]/20 text-[#3D2406] font-bold">
                    <th className="py-2 px-1 text-[11px]">時限</th>
                    {DAYS.map((d) => (
                      <th key={d.key} className="py-2 px-1 text-xs">
                        {d.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#B87503]/15">
                  {SLOTS.map((slot) => {
                    const timeInfo = periodTimes.find((p) => p.period === slot);
                    return (
                      <tr key={slot}>
                        <td className="py-2 px-1 text-[10px] font-bold text-[#7A5726]">
                          <div>{slot}限</div>
                          {timeInfo && (
                            <div className="text-[9px] opacity-75">{timeInfo.startTime}</div>
                          )}
                        </td>
                        {DAYS.map((d) => {
                          const isAvail = Boolean(timetable[`${d.key}-${slot}`]);
                          return (
                            <td key={d.key} className="p-1">
                              <button
                                type="button"
                                onClick={() => toggleSlot(d.key, slot)}
                                className={`w-full py-2 rounded-xl text-xs font-bold transition-all ${
                                  isAvail
                                    ? "bg-[#F5B301] text-[#3D2406] shadow-xs font-black"
                                    : "bg-[#FFF8E1] text-[#7A5726]/60 hover:bg-[#FFF2BE]"
                                }`}
                              >
                                {isAvail ? "◯ 空き" : "-"}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#B87503]/20">
              <button
                type="button"
                onClick={handleSkip}
                className="text-xs text-[#7A5726] hover:underline font-bold"
              >
                あとで設定する（スキップ）
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2 rounded-full border border-[#B87503]/40 bg-[#FFFDF7] text-[#5C3D15] text-xs font-bold"
                >
                  ← 学校へ戻る
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2.5 rounded-full bg-[#F5B301] text-[#3D2406] text-xs font-bold hover:bg-[#E0A200] shadow-xs disabled:opacity-50"
                >
                  {saving ? "保存中..." : "設定を完了して始める 🚀"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
