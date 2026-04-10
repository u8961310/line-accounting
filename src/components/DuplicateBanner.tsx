"use client";

import { useState, useEffect } from "react";
import { DuplicatePair } from "@/app/api/duplicate-candidates/route";
import { sourceLabel } from "@/lib/source-labels";

interface Props {
  refreshKey?: number;
  onRefresh?: () => void;
}

export default function DuplicateBanner({ refreshKey, onRefresh }: Props) {
  const [pairs, setPairs]       = useState<DuplicatePair[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch("/api/duplicate-candidates")
      .then(r => r.json())
      .then(d => { setPairs(d.pairs ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [refreshKey]);

  async function deleteTx(id: string) {
    await fetch("/api/duplicate-candidates", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setPairs(prev => prev.filter(p => p.a.id !== id && p.b.id !== id));
    onRefresh?.();
  }

  async function dismiss(aId: string, bId: string) {
    await fetch("/api/duplicate-candidates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionAId: aId, transactionBId: bId }),
    });
    setPairs(prev => prev.filter(p =>
      !((p.a.id === aId && p.b.id === bId) || (p.a.id === bId && p.b.id === aId))
    ));
  }

  if (loading || pairs.length === 0) return null;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(245,158,11,0.35)", background: "rgba(245,158,11,0.05)" }}>
      <button
        className="w-full px-5 py-3 flex items-center justify-between transition-opacity hover:opacity-80"
        onClick={() => setExpanded(e => !e)}
      >
        <span className="text-[14px] font-semibold" style={{ color: "#F59E0B" }}>
          ⚠️ 偵測到 {pairs.length} 組可能重複交易
        </span>
        <span className="text-[13px]" style={{ color: "#F59E0B" }}>
          {expanded ? "收起 ▲" : "展開查看 ▼"}
        </span>
      </button>

      {expanded && (
        <div className="px-5 pb-4 space-y-3">
          {pairs.map((pair, i) => (
            <div key={i} className="rounded-xl p-4 space-y-3"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <div className="grid grid-cols-2 gap-4 text-[13px]">
                {([pair.a, pair.b] as const).map((tx, idx) => (
                  <div key={idx} className="space-y-1">
                    <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                      交易 {idx === 0 ? "A" : "B"}
                    </p>
                    <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{tx.date}</p>
                    <p className="font-black" style={{ color: "#F87171" }}>NT$ {tx.amount.toLocaleString()}</p>
                    <span className="inline-block text-[11px] font-semibold px-1.5 py-0.5 rounded" style={{ background: "rgba(100,116,139,0.12)", color: "var(--text-sub)" }}>
                      {sourceLabel(tx.source)}
                    </span>
                    {tx.note && <p className="truncate text-[12px]" style={{ color: "var(--text-muted)" }}>{tx.note}</p>}
                  </div>
                ))}
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => deleteTx(pair.b.id)}
                  className="text-[13px] px-3 py-1.5 rounded-lg font-semibold transition-opacity hover:opacity-80"
                  style={{ background: "rgba(16,185,129,0.12)", color: "#10B981" }}>
                  保留 A 刪 B
                </button>
                <button
                  onClick={() => deleteTx(pair.a.id)}
                  className="text-[13px] px-3 py-1.5 rounded-lg font-semibold transition-opacity hover:opacity-80"
                  style={{ background: "rgba(16,185,129,0.12)", color: "#10B981" }}>
                  保留 B 刪 A
                </button>
                <button
                  onClick={() => dismiss(pair.a.id, pair.b.id)}
                  className="text-[13px] px-3 py-1.5 rounded-lg font-semibold transition-opacity hover:opacity-80"
                  style={{ background: "rgba(100,116,139,0.1)", color: "var(--text-sub)", border: "1px solid var(--border-inner)" }}>
                  都留著
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
