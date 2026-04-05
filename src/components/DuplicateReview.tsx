"use client";
import { useState, useEffect } from "react";

interface DuplicateTx {
  id: string;
  date: string;
  amount: number;
  type: string;
  source: string;
  category: string;
  note: string;
}
interface DuplicatePair {
  a: DuplicateTx;
  b: DuplicateTx;
}

const SOURCE_LABELS: Record<string, string> = {
  line: "LINE", manual: "手動",
  esun_bank: "玉山銀行", ctbc_bank: "中國信託", mega_bank: "兆豐銀行",
  yuanta_bank: "元大銀行", sinopac_bank: "永豐銀行", kgi_bank: "凱基銀行",
  cathay_cc: "國泰信用卡", esun_cc: "玉山信用卡", ctbc_cc: "中信信用卡",
  taishin_cc: "台新信用卡", sinopac_cc: "永豐信用卡",
};

function fmt(n: number) {
  return n.toLocaleString("zh-TW", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function TxCard({ tx, side, onDelete, deleting }: {
  tx: DuplicateTx;
  side: "A" | "B";
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <div className="flex-1 rounded-xl p-4 space-y-2"
      style={{ background: "var(--bg-input)", border: "1px solid var(--border-inner)" }}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: side === "A" ? "rgba(59,130,246,0.15)" : "rgba(245,158,11,0.15)", color: side === "A" ? "#60A5FA" : "#F59E0B" }}>
          {side === "A" ? "筆記 A" : "筆記 B"}
        </span>
        <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>{tx.date}</span>
      </div>
      <div>
        <p className="text-[18px] font-black" style={{ color: tx.type === "收入" ? "#10B981" : "#EF4444" }}>
          {tx.type === "收入" ? "+" : "−"}NT$ {fmt(tx.amount)}
        </p>
        <p className="text-[13px] font-semibold mt-0.5" style={{ color: "var(--text-primary)" }}>
          {tx.note || tx.category}
        </p>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <span className="text-[12px] px-1.5 py-0.5 rounded"
            style={{ background: "var(--border-inner)", color: "var(--text-muted)" }}>
            {tx.category}
          </span>
          <span className="text-[12px] px-1.5 py-0.5 rounded"
            style={{ background: "var(--border-inner)", color: "var(--text-muted)" }}>
            {SOURCE_LABELS[tx.source] ?? tx.source}
          </span>
        </div>
      </div>
      <button
        onClick={onDelete}
        disabled={deleting}
        className="w-full py-2 rounded-lg text-[13px] font-semibold transition-all disabled:opacity-40"
        style={{ background: "rgba(239,68,68,0.12)", color: "#F87171", border: "1px solid rgba(239,68,68,0.25)" }}>
        {deleting ? "刪除中…" : "刪除此筆"}
      </button>
    </div>
  );
}

export default function DuplicateReview() {
  const [pairs, setPairs] = useState<DuplicatePair[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/duplicate-candidates")
      .then(r => r.json())
      .then(d => { setPairs(d.pairs ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const pairKey = (p: DuplicatePair) => p.a.id + "|" + p.b.id;

  const deleteOne = async (id: string, pk: string) => {
    setDeleting(id);
    try {
      await fetch("/api/duplicate-candidates", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setDismissed(prev => new Set([...prev, pk]));
    } catch (e) { console.error(e); }
    setDeleting(null);
  };

  const dismiss = (pk: string) => setDismissed(prev => new Set([...prev, pk]));

  const visible = pairs.filter(p => !dismissed.has(pairKey(p)));

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  if (visible.length === 0) {
    return (
      <div className="rounded-2xl p-10 text-center space-y-3"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <p className="text-4xl">✅</p>
        <p className="text-[16px] font-bold" style={{ color: "var(--text-primary)" }}>
          {pairs.length === 0 ? "沒有偵測到疑似重複交易" : "所有重複候選都已處理完畢"}
        </p>
        <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
          系統偵測條件：不同來源、相同類型、相同金額、日期差距 ≤ 1 天
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl p-5 flex items-center gap-4"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex-1">
          <h2 className="text-[15px] font-bold" style={{ color: "var(--text-primary)" }}>疑似重複交易審核</h2>
          <p className="text-[13px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            共 {visible.length} 組需要確認 — 同金額、不同來源、日期差 ≤ 1 天
          </p>
        </div>
        <span className="text-[24px] font-black px-4 py-2 rounded-xl"
          style={{ background: "rgba(239,68,68,0.12)", color: "#F87171" }}>
          {visible.length}
        </span>
      </div>

      {/* Pairs */}
      {visible.map(pair => {
        const pk = pairKey(pair);
        const isDeleting = deleting === pair.a.id || deleting === pair.b.id;
        return (
          <div key={pk} className="rounded-2xl p-5 space-y-4"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="flex gap-3">
              <TxCard tx={pair.a} side="A" onDelete={() => deleteOne(pair.a.id, pk)} deleting={deleting === pair.a.id} />
              <div className="flex flex-col items-center justify-center gap-1 px-1 flex-shrink-0">
                <div className="w-px flex-1" style={{ background: "var(--border-inner)" }} />
                <span className="text-[18px]">⚠️</span>
                <div className="w-px flex-1" style={{ background: "var(--border-inner)" }} />
              </div>
              <TxCard tx={pair.b} side="B" onDelete={() => deleteOne(pair.b.id, pk)} deleting={deleting === pair.b.id} />
            </div>
            <button
              onClick={() => dismiss(pk)}
              disabled={isDeleting}
              className="w-full py-2 rounded-xl text-[13px] font-semibold transition-all disabled:opacity-40"
              style={{ background: "var(--bg-input)", color: "var(--text-sub)", border: "1px solid var(--border-inner)" }}>
              兩筆都保留（不是重複）
            </button>
          </div>
        );
      })}
    </div>
  );
}
