"use client";

import { useState, useEffect, useRef } from "react";
import { SchoolMaster } from "@/lib/types/hive";

interface SchoolComboboxProps {
  value: string; // 現在選択中の学校名
  schoolId: string;
  onChange: (school: { id: string; name: string; isCustomRequest: boolean }) => void;
  required?: boolean;
}

export default function SchoolCombobox({
  value,
  schoolId,
  onChange,
  required = true,
}: SchoolComboboxProps) {
  const [inputText, setInputText] = useState<string>(value || "");
  const [prevValue, setPrevValue] = useState<string>(value || "");
  const [schools, setSchools] = useState<SchoolMaster[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // propのvalueが変わった場合にstateを調整（React公式推奨パターン）
  if (value !== prevValue) {
    setPrevValue(value);
    setInputText(value || "");
  }

  useEffect(() => {
    let active = true;
    const fetchSchools = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/schools");
        if (res.ok) {
          const data = await res.json();
          if (active) setSchools(data.schools || []);
        }
      } catch (err) {
        console.error("学校マスター取得エラー:", err);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchSchools();
    return () => {
      active = false;
    };
  }, []);

  // 外側クリックでプルダウンを閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 入力文字列による候補の絞り込み
  const filteredSchools = inputText.trim()
    ? schools.filter((s) => {
        const query = inputText.trim().toLowerCase();
        return (
          s.name.toLowerCase().includes(query) ||
          s.prefecture.toLowerCase().includes(query)
        );
      })
    : schools;

  const hasExactMatch = schools.some(
    (s) => s.name.toLowerCase() === inputText.trim().toLowerCase()
  );

  const handleSelect = (school: SchoolMaster) => {
    setInputText(school.name);
    setIsOpen(false);
    onChange({ id: school.id, name: school.name, isCustomRequest: false });
  };

  const handleRequestCustom = () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;
    setIsOpen(false);
    onChange({ id: "custom-requested", name: trimmed, isCustomRequest: true });
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <input
          type="text"
          required={required}
          placeholder="大学・高専名を入力（例: 東京、農工大、早稲田、高専...）"
          value={inputText}
          onChange={(e) => {
            setInputText(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="w-full bg-[#FFFDF7] border border-[#B87503]/30 rounded-xl p-2.5 pr-8 text-xs text-[#3D2406] focus:outline-none focus:border-[#F5B301] shadow-inner"
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#7A5726] pointer-events-none">
          🔍
        </span>
      </div>

      {/* 選択済みの学校バッジ（確定表示） */}
      {schoolId && !isOpen && (
        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[#7A5726]">
          <span>確定された正式名称:</span>
          <span className="font-bold text-[#3D2406] bg-[#FFF8E1] px-2 py-0.5 rounded-md border border-[#F5B301]/40">
            {value}
          </span>
        </div>
      )}

      {/* プルダウン候補リスト */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-[#FFFBEB] border-2 border-[#B87503] rounded-2xl shadow-xl max-h-60 overflow-y-auto no-scrollbar p-1.5 flex flex-col gap-1">
          {loading ? (
            <div className="p-3 text-center text-xs text-[#7A5726]">
              学校一覧を検索中...
            </div>
          ) : filteredSchools.length > 0 ? (
            <>
              <div className="px-2 py-1 text-[10px] font-bold text-[#7A5726] border-b border-[#B87503]/20">
                該当する大学・高専（クリックで正式名称を選択）:
              </div>
              {filteredSchools.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleSelect(s)}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs hover:bg-[#FFF2BE] transition-colors flex items-center justify-between text-[#3D2406]"
                >
                  <span className="font-bold">{s.name}</span>
                  <span className="text-[10px] text-[#7A5726] bg-[#FFF8E1] px-1.5 py-0.5 rounded-md border border-[#B87503]/20">
                    {s.type === "university" ? "大学" : "高専"} • {s.prefecture}
                  </span>
                </button>
              ))}
            </>
          ) : (
            <div className="p-3 text-center text-xs text-[#7A5726]">
              一致する登録済みの学校が見つかりませんでした。
            </div>
          )}

          {/* 一覧にない場合の「学校の追加を依頼する」選択肢 */}
          {inputText.trim() && !hasExactMatch && (
            <div className="p-1 border-t border-[#B87503]/20 mt-1">
              <button
                type="button"
                onClick={handleRequestCustom}
                className="w-full text-left p-2.5 rounded-xl bg-[#FFF8E1] hover:bg-[#FFF2BE] border border-[#F5B301] text-xs font-bold text-[#B87503] flex items-center gap-1.5 transition-colors"
              >
                <span>➕</span>
                <span>「{inputText.trim()}」の新規追加を依頼して選択</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
