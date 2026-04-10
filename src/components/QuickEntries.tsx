"use client";

import { useState, useEffect } from "react";
import { QuickEntry } from "@/app/api/quick-entries/route";

interface Props {
  onAdd: (entry: QuickEntry) => void;
  refreshKey?: number;
}

const PINNED_KEY = "quick-entries-pinned";

export default function QuickEntries({ onAdd, refreshKey }: Props) {
  const [suggestions, setSuggestions] = useState<QuickEntry[]>([]);
  const [pinned, setPinned]           = useState<QuickEntry[]>([]);
  const [loading, setLoading]         = useState(true);

  // 載入釘選（localStorage）
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PINNED_KEY);
      if (saved) setPinned(JSON.parse(saved) as QuickEntry[]);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch("/api/quick-entries")
      .then(r => r.json())
      .then(d => { setSuggestions(d.suggestions ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [refreshKey]);

  function togglePin(entry: QuickEntry) {
    const key = `${entry.type}|${entry.category}|${entry.amount}`;
    const exists = pinned.some(p => `${p.type}|${p.category}|${p.amount}` === key);
    const next = exists
      ? pinned.filter(p => `${p.type}|${p.category}|${p.amount}` !== key)
      : [...pinned, entry];
    setPinned(next);
    localStorage.setItem(PINNED_KEY, JSON.stringify(next));
  }

  // 合併：釘選在前，其餘依次數排序，去重
  const pinnedKeys = new Set(pinned.map(p => `${p.type}|${p.category}|${p.amount}`));
  const rest = suggestions.filter(s => !pinnedKeys.has(`${s.type}|${s.category}|${s.amount}`));
  const all = [...pinned, ...rest];

  if (loading || all.length === 0) return null;

  return (
    <div className="px-1 pb-1">
      <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>
        ⚡ 快捷記帳
      </p>
      <div className="flex flex-wrap gap-1.5">
        {all.map((entry, i) => {
          const key = `${entry.type}|${entry.category}|${entry.amount}`;
          const isPinned = pinnedKeys.has(key);
          return (
            <div key={i} className="flex items-center rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-inner)" }}>
              <button
                onClick={() => onAdd(entry)}
                className="px-3 py-1.5 text-[13px] font-semibold transition-opacity hover:opacity-80"
                style={{ background: entry.type === "支出" ? "rgba(239,68,68,0.08)" : "rgba(16,185,129,0.08)", color: entry.type === "支出" ? "#F87171" : "#34D399" }}
              >
                {entry.category} NT${entry.amount}
              </button>
              <button
                onClick={() => togglePin(entry)}
                className="px-2 py-1.5 text-[12px] transition-opacity hover:opacity-70"
                style={{ background: "var(--bg-input)", color: isPinned ? "#F59E0B" : "var(--text-muted)", borderLeft: "1px solid var(--border-inner)" }}
                title={isPinned ? "取消釘選" : "釘選"}
              >
                {isPinned ? "📌" : "·"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
