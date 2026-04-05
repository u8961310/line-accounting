"use client";

import { useState, useEffect, useCallback } from "react";

interface PayeeItem {
  id:       string;
  pattern:  string;
  label:    string;
  category: string;
}

const CATEGORIES = ["", "飲食", "交通", "娛樂", "購物", "醫療", "薪資", "獎金", "居住", "其他"];

const CAT_COLORS: Record<string, { bg: string; text: string }> = {
  飲食: { bg: "#F59E0B22", text: "#FBBF24" },
  交通: { bg: "#3B82F622", text: "#60A5FA" },
  娛樂: { bg: "#8B5CF622", text: "#A78BFA" },
  購物: { bg: "#EC489922", text: "#F472B6" },
  醫療: { bg: "#10B98122", text: "#34D399" },
  薪資: { bg: "#06B6D422", text: "#22D3EE" },
  獎金: { bg: "#F97316 22", text: "#FB923C" },
  居住: { bg: "#64748B22", text: "#94A3B8" },
  其他: { bg: "#64748B22", text: "#94A3B8" },
};

const inputClass = "w-full rounded-xl px-3 py-2 text-sm outline-none text-white placeholder-slate-600 bg-[#070C1A] border border-[#1E3054] focus:border-[#3B82F6] transition-colors";
const labelClass = "text-[14px] font-semibold mb-1.5 block tracking-wider uppercase" as const;

function CategoryBadge({ category }: { category: string }) {
  if (!category) return null;
  const c = CAT_COLORS[category] ?? { bg: "#64748B22", text: "#94A3B8" };
  return (
    <span className="text-[14px] px-2 py-0.5 rounded-md font-medium"
      style={{ background: c.bg, color: c.text }}>
      {category}
    </span>
  );
}

// ── 單筆列 ────────────────────────────────────────────────────────────────────
function PayeeRow({
  item,
  onSave,
  onDelete,
}: {
  item: PayeeItem;
  onSave: (id: string, patch: Partial<Omit<PayeeItem, "id">>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing,  setEditing]  = useState(false);
  const [pattern,  setPattern]  = useState(item.pattern);
  const [label,    setLabel]    = useState(item.label);
  const [category, setCategory] = useState(item.category);
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    setPattern(item.pattern);
    setLabel(item.label);
    setCategory(item.category);
  }, [item]);

  async function handleSave() {
    if (!pattern.trim() || !label.trim()) return;
    setSaving(true);
    await onSave(item.id, { pattern: pattern.trim(), label: label.trim(), category: category.trim() });
    setSaving(false);
    setEditing(false);
  }

  async function handleDelete() {
    if (!confirm(`確定刪除「${item.label}」對照？`)) return;
    await onDelete(item.id);
  }

  if (!editing) {
    return (
      <div className="group flex items-center gap-4 px-4 py-3.5 rounded-xl transition-colors"
        style={{ background: "#070C1A", border: "1px solid #1A2845" }}>
        {/* 左側 accent */}
        <div className="w-0.5 h-8 rounded-full flex-shrink-0" style={{ background: "linear-gradient(180deg,#3B82F6,#1D4ED8)" }} />

        {/* 主要內容 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-semibold" style={{ color: "#E2E8F0" }}>{item.label}</span>
            <CategoryBadge category={item.category} />
          </div>
          <p className="text-xs font-mono truncate" style={{ color: "#38BDF8", opacity: 0.7 }}>
            {item.pattern}
          </p>
        </div>

        {/* 操作按鈕 */}
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => setEditing(true)}
            className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
            style={{ background: "#1E3A5F", color: "#60A5FA" }}>
            編輯
          </button>
          <button onClick={handleDelete}
            className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
            style={{ background: "#3B0A0A", color: "#F87171" }}>
            刪除
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: "#070C1A", border: "1px solid #3B82F6", boxShadow: "0 0 0 1px #3B82F620" }}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass} style={{ color: "#4B6FA8" }}>比對字串</label>
          <input className={inputClass} value={pattern} onChange={e => setPattern(e.target.value)}
            placeholder="如：807-001360" />
        </div>
        <div>
          <label className={labelClass} style={{ color: "#4B6FA8" }}>顯示名稱</label>
          <input className={inputClass} value={label} onChange={e => setLabel(e.target.value)}
            placeholder="如：房租" />
        </div>
      </div>
      <div>
        <label className={labelClass} style={{ color: "#4B6FA8" }}>覆蓋分類（選填）</label>
        <select className={inputClass} value={category} onChange={e => setCategory(e.target.value)}>
          {CATEGORIES.map(c => (
            <option key={c} value={c} style={{ background: "#070C1A" }}>{c || "— 不覆蓋 —"}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <button
          onClick={() => { setEditing(false); setPattern(item.pattern); setLabel(item.label); setCategory(item.category); }}
          className="text-xs px-4 py-2 rounded-lg font-medium transition-colors"
          style={{ background: "#0F1729", color: "#64748B", border: "1px solid #1E3054" }}>
          取消
        </button>
        <button onClick={handleSave} disabled={saving || !pattern.trim() || !label.trim()}
          className="text-xs px-5 py-2 rounded-lg font-medium disabled:opacity-40 transition-opacity"
          style={{ background: "linear-gradient(135deg,#1D4ED8,#3B82F6)", color: "white" }}>
          {saving ? "儲存中…" : "儲存"}
        </button>
      </div>
    </div>
  );
}

interface TxHit { id: string; date: string; amount: number; note: string; category: string }

// ── 新增表單 ──────────────────────────────────────────────────────────────────
function AddForm({ onAdd }: { onAdd: (item: Omit<PayeeItem, "id">) => Promise<void> }) {
  const [pattern,   setPattern]   = useState("");
  const [label,     setLabel]     = useState("");
  const [category,  setCategory]  = useState("");
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState("");

  // 搜尋交易
  const [search,    setSearch]    = useState("");
  const [hits,      setHits]      = useState<TxHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [showHits,  setShowHits]  = useState(false);
  const timerRef = useState<ReturnType<typeof setTimeout> | null>(null);

  function handleSearchChange(val: string) {
    setSearch(val);
    if (timerRef[0]) clearTimeout(timerRef[0]);
    if (!val.trim()) { setHits([]); setShowHits(false); return; }
    timerRef[1](setTimeout(async () => {
      setSearching(true);
      const res = await fetch(`/api/transactions?note=${encodeURIComponent(val)}&limit=8`);
      const data = await res.json() as { items: TxHit[] };
      setHits(data.items ?? []);
      setShowHits(true);
      setSearching(false);
    }, 300));
  }

  function pickTx(tx: TxHit) {
    setPattern(tx.note);
    setShowHits(false);
    setSearch("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pattern.trim() || !label.trim()) { setError("比對字串和顯示名稱為必填"); return; }
    setSaving(true);
    setError("");
    try {
      await onAdd({ pattern: pattern.trim(), label: label.trim(), category: category.trim() });
      setPattern("");
      setLabel("");
      setCategory("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "新增失敗");
    }
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 步驟一：從交易搜尋（選填） */}
      <div>
        <label className={labelClass} style={{ color: "#4B6FA8" }}>從交易記錄選取（選填）</label>
        <div className="relative">
          <input
            className={inputClass}
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            onBlur={() => setTimeout(() => setShowHits(false), 150)}
            placeholder="輸入備注關鍵字，如「網際轉」「薪資」…"
          />
          {searching && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: "#4B6FA8" }}>搜尋中…</span>
          )}
          {showHits && hits.length > 0 && (
            <div className="absolute z-20 top-full mt-1 w-full rounded-xl border overflow-hidden"
              style={{ background: "#070C1A", borderColor: "#1E3054", boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
              {hits.map(tx => (
                <button key={tx.id} type="button"
                  onMouseDown={() => pickTx(tx)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[#0F1729]">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono truncate" style={{ color: "#38BDF8" }}>{tx.note}</p>
                    <p className="text-[14px] mt-0.5" style={{ color: "#4B6FA8" }}>
                      {tx.date} · NT$ {Math.abs(tx.amount).toLocaleString()} · {tx.category}
                    </p>
                  </div>
                  <span className="text-[14px] flex-shrink-0" style={{ color: "#1E3054" }}>選取 →</span>
                </button>
              ))}
            </div>
          )}
          {showHits && hits.length === 0 && !searching && (
            <div className="absolute z-20 top-full mt-1 w-full rounded-xl border px-4 py-3"
              style={{ background: "#070C1A", borderColor: "#1E3054" }}>
              <p className="text-xs" style={{ color: "#2D4A7A" }}>找不到符合的交易</p>
            </div>
          )}
        </div>
      </div>

      {/* 步驟二：填寫欄位 */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass} style={{ color: "#4B6FA8" }}>比對字串 *</label>
          <input className={inputClass} value={pattern} onChange={e => setPattern(e.target.value)}
            placeholder="如：807-001360" />
        </div>
        <div>
          <label className={labelClass} style={{ color: "#4B6FA8" }}>顯示名稱 *</label>
          <input className={inputClass} value={label} onChange={e => setLabel(e.target.value)}
            placeholder="如：房租" />
        </div>
        <div>
          <label className={labelClass} style={{ color: "#4B6FA8" }}>覆蓋分類</label>
          <select className={inputClass} value={category} onChange={e => setCategory(e.target.value)}>
            {CATEGORIES.map(c => (
              <option key={c} value={c} style={{ background: "#070C1A" }}>{c || "— 不覆蓋 —"}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between">
        {error
          ? <p className="text-xs" style={{ color: "#F87171" }}>{error}</p>
          : <p className="text-xs" style={{ color: "#1E3054" }}>* 為必填欄位</p>
        }
        <button type="submit" disabled={saving}
          className="text-sm px-5 py-2 rounded-xl font-medium disabled:opacity-40 transition-opacity"
          style={{ background: "linear-gradient(135deg,#1D4ED8,#3B82F6)", color: "white" }}>
          {saving ? "新增中…" : "+ 新增對照"}
        </button>
      </div>
    </form>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function PayeeManager() {
  const [payees,  setPayees]  = useState<PayeeItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/payees");
    setPayees(await res.json() as PayeeItem[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAdd(item: Omit<PayeeItem, "id">) {
    const res = await fetch("/api/payees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    });
    if (!res.ok) {
      const err = await res.json() as { error?: string };
      throw new Error(err.error ?? "新增失敗");
    }
    await load();
  }

  async function handleSave(id: string, patch: Partial<Omit<PayeeItem, "id">>) {
    await fetch(`/api/payees/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    await load();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/payees/${id}`, { method: "DELETE" });
    setPayees(prev => prev.filter(p => p.id !== id));
  }

  return (
    <div className="space-y-4">
      {/* 新增表單卡片 */}
      <div className="rounded-2xl border p-6"
        style={{ background: "var(--bg-card)", borderColor: "var(--border)", boxShadow: "var(--card-shadow)" }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold text-white">轉帳帳號對照</h2>
            <p className="text-xs mt-0.5" style={{ color: "#4B6FA8" }}>
              交易備注含有比對字串時，自動套用顯示名稱與分類
            </p>
          </div>
          {payees.length > 0 && (
            <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
              style={{ background: "#1D4ED815", color: "#60A5FA", border: "1px solid #1D4ED840" }}>
              {payees.length} 筆規則
            </span>
          )}
        </div>
        <div className="h-px mb-5" style={{ background: "#1A2845" }} />
        <AddForm onAdd={handleAdd} />
      </div>

      {/* 列表卡片 */}
      <div className="rounded-2xl border p-6"
        style={{ background: "var(--bg-card)", borderColor: "var(--border)", boxShadow: "var(--card-shadow)" }}>
        <h3 className="text-sm font-semibold mb-4" style={{ color: "#94A3B8" }}>現有規則</h3>
        {loading ? (
          <div className="py-10 text-center">
            <p className="text-sm" style={{ color: "#2D4A7A" }}>載入中…</p>
          </div>
        ) : payees.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-2xl mb-2">🗂️</p>
            <p className="text-sm" style={{ color: "#2D4A7A" }}>尚未設定任何對照規則</p>
            <p className="text-xs mt-1" style={{ color: "#1E3054" }}>在上方新增第一條規則</p>
          </div>
        ) : (
          <div className="space-y-2">
            {payees.map(p => (
              <PayeeRow key={p.id} item={p} onSave={handleSave} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
