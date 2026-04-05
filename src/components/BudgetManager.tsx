"use client";

import { useState, useEffect, useCallback } from "react";

interface BudgetItem {
  id:       string;
  category: string;
  amount:   number;
  spent:    number;
}

interface FixedExpenseItem { id: string; name: string; amount: number }
interface LoanItem { id: string; name: string; status: string; payments: { totalPaid: string | number }[] }

const EXPENSE_CATEGORIES = [
  "飲食", "交通", "娛樂", "購物", "醫療", "居住",
  "教育", "通訊", "保險", "水電", "美容", "運動",
  "旅遊", "訂閱", "寵物", "現金", "其他",
];

// 50/30/20 分組定義
const NEEDS_CATS = ["居住", "水電", "保險", "通訊", "交通", "醫療", "教育"];
const WANTS_CATS = ["飲食", "娛樂", "購物", "美容", "運動", "旅遊", "訂閱", "寵物", "其他"];

const CATEGORY_ICONS: Record<string, string> = {
  飲食: "🍜", 交通: "🚌", 娛樂: "🎮", 購物: "🛍️",
  醫療: "💊", 居住: "🏠", 教育: "📚", 通訊: "📱",
  保險: "🛡️", 水電: "💡", 美容: "💄", 運動: "🏋️",
  旅遊: "✈️", 訂閱: "📺", 寵物: "🐾", 現金: "💵",
  其他: "📦",
};

function fmt(n: number) {
  return Math.abs(n).toLocaleString("zh-TW", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function statusOf(spent: number, amount: number): "over" | "near" | "ok" | "none" {
  if (amount <= 0) return "none";
  const r = spent / amount;
  if (r > 1)   return "over";
  if (r >= 0.8) return "near";
  return "ok";
}

const STATUS_META = {
  over: { label: "超標",   color: "#EF4444", bg: "#EF444418", barColor: "#EF4444" },
  near: { label: "接近上限", color: "#F59E0B", bg: "#F59E0B18", barColor: "#F59E0B" },
  ok:   { label: "正常",   color: "#10B981", bg: "#10B98118", barColor: "#10B981" },
  none: { label: "",       color: "#94A3B8", bg: "transparent", barColor: "#3B82F6" },
};

// ── Sub-components (defined outside to prevent remount) ────────────────────────

function EditInput({
  value,
  onChange,
  onSave,
  onCancel,
  saving,
}: {
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: "1px solid var(--border-inner)" }}>
      <div className="flex-1 relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[14px]" style={{ color: "var(--text-muted)" }}>NT$</span>
        <input
          type="number"
          min="0"
          value={value}
          onChange={e => onChange(e.target.value)}
          onWheel={e => e.currentTarget.blur()}
          onKeyDown={e => { if (e.key === "Enter") onSave(); if (e.key === "Escape") onCancel(); }}
          className="w-full pl-9 pr-3 py-2 rounded-xl text-sm font-bold outline-none"
          style={{ background: "var(--bg-input)", border: "1px solid var(--accent)", color: "var(--text-primary)" }}
          autoFocus
        />
      </div>
      <button
        onClick={onSave}
        disabled={saving}
        className="px-4 py-2 rounded-xl text-[14px] font-bold text-white transition-opacity disabled:opacity-50"
        style={{ background: "linear-gradient(135deg,#2563EB,#3B82F6)" }}>
        {saving ? "…" : "儲存"}
      </button>
      <button
        onClick={onCancel}
        className="px-3 py-2 rounded-xl text-[14px]"
        style={{ color: "var(--text-muted)", background: "var(--bg-input)" }}>
        取消
      </button>
    </div>
  );
}

function BudgetCard({
  category,
  budget,
  onSave,
  onDelete,
}: {
  category: string;
  budget: BudgetItem;
  onSave:   (category: string, amount: number) => Promise<void>;
  onDelete: (category: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState(String(budget.amount));
  const [saving, setSaving]   = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => { setInputVal(String(budget.amount)); }, [budget.amount]);

  const { spent, amount } = budget;
  const pct    = Math.min((spent / amount) * 100, 100);
  const status = statusOf(spent, amount);
  const meta   = STATUS_META[status];
  const over   = spent - amount;

  async function handleSave() {
    const val = parseFloat(inputVal);
    if (isNaN(val) || val < 0) return;
    setSaving(true);
    await onSave(category, val);
    setSaving(false);
    setEditing(false);
  }

  return (
    <div className="rounded-2xl p-4 transition-all"
      style={{ background: "var(--bg-card)", border: `1px solid ${meta.color}28`, boxShadow: "var(--card-shadow)" }}>
      {/* Row 1: icon + name + status badge + action buttons */}
      <div className="flex items-center gap-2.5">
        <span className="text-[22px] flex-shrink-0">{CATEGORY_ICONS[category] ?? "📌"}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-[14px]" style={{ color: "var(--text-primary)" }}>{category}</span>
            {status !== "ok" && (
              <span className="text-[14px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
            )}
          </div>
          <p className="text-[14px] tabular-nums mt-0.5">
            <span style={{ color: meta.color }} className="font-bold">NT$ {fmt(spent)}</span>
            <span style={{ color: "var(--text-muted)" }}> / NT$ {fmt(amount)}</span>
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[20px] font-black tabular-nums" style={{ color: meta.color }}>
            {pct.toFixed(0)}%
          </span>
          <button onClick={() => { setEditing(e => !e); setConfirmDelete(false); }}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[14px] transition-opacity hover:opacity-80"
            style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}>✎</button>
          {confirmDelete ? (
            <button onClick={() => onDelete(category)}
              className="text-[14px] px-2 py-1 rounded-lg font-bold transition-opacity hover:opacity-80"
              style={{ background: "#EF444420", color: "#EF4444" }}>確認</button>
          ) : (
            <button onClick={() => setConfirmDelete(true)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[14px] transition-opacity hover:opacity-80"
              style={{ color: "#EF444450" }}>✕</button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3">
        <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "var(--bg-input)" }}>
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: `linear-gradient(90deg,${meta.barColor}99,${meta.barColor})` }} />
        </div>
        <div className="flex justify-between mt-1.5 text-[14px]" style={{ color: "var(--text-muted)" }}>
          {status === "over" ? (
            <span style={{ color: "#EF4444" }}>超出 NT$ {fmt(over)}</span>
          ) : (
            <span>剩餘 <span className="font-semibold tabular-nums" style={{ color: "var(--text-sub)" }}>NT$ {fmt(amount - spent)}</span></span>
          )}
          <span>{pct.toFixed(1)}%</span>
        </div>
      </div>

      {/* Inline edit */}
      {editing && (
        <EditInput
          value={inputVal}
          onChange={setInputVal}
          onSave={handleSave}
          onCancel={() => setEditing(false)}
          saving={saving}
        />
      )}
    </div>
  );
}

interface SuggestionItem { category: string; amount: number }
interface HistorySuggestionItem { category: string; avg: number; suggested: number; monthsOfData: number }

interface BudgetSuggestionProps {
  income:   number;
  applying: boolean;
  onApply:  (items: SuggestionItem[]) => Promise<void>;
}

function BudgetSuggestion({ income, applying, onApply }: BudgetSuggestionProps) {
  const [open, setOpen] = useState(false);

  const needs = Math.round(income * 0.5);
  const wants = Math.round(income * 0.3);
  const saves = Math.round(income * 0.2);

  const groups = [
    { label: "必要支出",  pct: 50, total: needs, color: "#3B82F6", icon: "🏠",
      cats: NEEDS_CATS, desc: "居住、水電、保險、通訊、交通、醫療、教育" },
    { label: "想要支出",  pct: 30, total: wants, color: "#A78BFA", icon: "🎯",
      cats: WANTS_CATS, desc: "飲食、娛樂、購物、美容、運動、旅遊等" },
    { label: "儲蓄/還債", pct: 20, total: saves, color: "#10B981", icon: "💰",
      cats: [],         desc: "建議作為緊急備用金或加速還債" },
  ] as const;

  const allSuggestions: SuggestionItem[] = [
    ...NEEDS_CATS.map(c => ({ category: c, amount: Math.round(needs / NEEDS_CATS.length) })),
    ...WANTS_CATS.map(c => ({ category: c, amount: Math.round(wants / WANTS_CATS.length) })),
  ];

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--card-shadow)" }}>
      <button className="w-full flex items-center justify-between px-5 py-3.5 hover:opacity-80 transition-opacity"
        onClick={() => setOpen(v => !v)}>
        <div className="flex items-center gap-2">
          <span className="text-[16px]">⚖️</span>
          <div className="text-left">
            <p className="text-[15px] font-bold" style={{ color: "var(--text-primary)" }}>50/30/20 預算分配建議</p>
            <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
              依可分配預算 NT$ {fmt(income)} 自動試算
            </p>
          </div>
        </div>
        <span className="text-[14px]" style={{ color: "var(--text-muted)" }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4" style={{ borderTop: "1px solid var(--border-inner)" }}>
          <div className="grid grid-cols-3 gap-3 pt-4">
            {groups.map(g => (
              <div key={g.label} className="rounded-xl p-3 text-center"
                style={{ background: `${g.color}10`, border: `1px solid ${g.color}25` }}>
                <p className="text-[18px] mb-1">{g.icon}</p>
                <p className="text-[13px] font-bold" style={{ color: g.color }}>{g.label}</p>
                <p className="text-[22px] font-black tabular-nums leading-tight" style={{ color: "var(--text-primary)" }}>
                  {g.pct}%
                </p>
                <p className="text-[13px] font-semibold tabular-nums" style={{ color: g.color }}>
                  NT$ {fmt(g.total)}
                </p>
                <p className="text-[12px] mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {g.desc}
                </p>
              </div>
            ))}
          </div>

          {/* Per-category breakdown */}
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-inner)" }}>
            <div className="grid grid-cols-2 px-3 py-2 text-[13px] font-semibold"
              style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}>
              <span>分類</span>
              <span className="text-right">建議上限</span>
            </div>
            {[
              ...NEEDS_CATS.map(c => ({ c, amt: Math.round(needs / NEEDS_CATS.length), color: "#3B82F6" })),
              ...WANTS_CATS.map(c => ({ c, amt: Math.round(wants / WANTS_CATS.length), color: "#A78BFA" })),
            ].map(({ c, amt, color }, i) => (
              <div key={c} className="grid grid-cols-2 px-3 py-2 border-t text-[14px]"
                style={{ borderColor: "var(--border-inner)", background: i % 2 === 0 ? "transparent" : "var(--bg-input)" }}>
                <span className="flex items-center gap-1.5">
                  <span>{CATEGORY_ICONS[c] ?? "📌"}</span>
                  <span style={{ color: "var(--text-primary)" }}>{c}</span>
                  <span className="text-[12px] w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: color, display: "inline-block" }} />
                </span>
                <span className="text-right font-semibold tabular-nums" style={{ color: "var(--text-sub)" }}>
                  NT$ {fmt(amt)}
                </span>
              </div>
            ))}
            <div className="grid grid-cols-2 px-3 py-2.5 border-t text-[14px] font-bold"
              style={{ borderColor: "var(--border-inner)", background: "var(--bg-input)" }}>
              <span style={{ color: "#10B981" }}>💰 儲蓄 / 還債</span>
              <span className="text-right tabular-nums" style={{ color: "#10B981" }}>NT$ {fmt(saves)}</span>
            </div>
          </div>

          <button
            onClick={() => onApply(allSuggestions)}
            disabled={applying}
            className="w-full py-2.5 rounded-xl text-[14px] font-bold text-white transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
            {applying ? "套用中…" : "⚡ 一鍵套用建議預算（16 個分類）"}
          </button>
          <p className="text-[12px] text-center" style={{ color: "var(--text-muted)" }}>
            僅修改尚未設定預算的分類 · 已有預算的分類不受影響
          </p>
        </div>
      )}
    </div>
  );
}

function UnsetCategoryGrid({
  categories,
  onSet,
}: {
  categories: string[];
  onSet: (category: string) => void;
}) {
  const [open, setOpen] = useState(false);
  if (categories.length === 0) return null;
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3.5 transition-opacity hover:opacity-80">
        <div className="flex items-center gap-2">
          <span className="text-[16px]" style={{ color: "var(--accent)" }}>＋</span>
          <span className="text-[14px] font-semibold" style={{ color: "var(--text-sub)" }}>
            新增預算分類
          </span>
          <span className="text-[14px] px-1.5 py-0.5 rounded-full tabular-nums"
            style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}>
            {categories.length} 個
          </span>
        </div>
        <span className="text-[14px]" style={{ color: "var(--text-muted)" }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 flex flex-wrap gap-2" style={{ borderTop: "1px solid var(--border-inner)" }}>
          {categories.map(cat => (
            <button key={cat} onClick={() => onSet(cat)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[14px] font-medium transition-all hover:opacity-80"
              style={{ background: "var(--bg-input)", border: "1px solid var(--border-inner)", color: "var(--text-sub)" }}>
              <span>{CATEGORY_ICONS[cat] ?? "📌"}</span>
              <span>{cat}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function HistorySuggestion({
  applying,
  onApply,
}: {
  applying: boolean;
  onApply: (items: SuggestionItem[]) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<HistorySuggestionItem[]>([]);
  const [loadingSugg, setLoadingSugg] = useState(false);
  const [months] = useState(3);

  useEffect(() => {
    if (!open || items.length > 0) return;
    setLoadingSugg(true);
    fetch(`/api/budgets/suggest?months=${months}`)
      .then(r => r.json())
      .then((d: { suggestions?: HistorySuggestionItem[] }) => setItems(d.suggestions ?? []))
      .catch(console.error)
      .finally(() => setLoadingSugg(false));
  }, [open, items.length, months]);

  const toApply: SuggestionItem[] = items.map(i => ({ category: i.category, amount: i.suggested }));

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--card-shadow)" }}>
      <button className="w-full flex items-center justify-between px-5 py-3.5 hover:opacity-80 transition-opacity"
        onClick={() => setOpen(v => !v)}>
        <div className="flex items-center gap-2">
          <span className="text-[16px]">📊</span>
          <div className="text-left">
            <p className="text-[15px] font-bold" style={{ color: "var(--text-primary)" }}>依歷史消費建議預算</p>
            <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
              根據過去 {months} 個月實際支出平均，加 10% 緩衝自動試算
            </p>
          </div>
        </div>
        <span className="text-[14px]" style={{ color: "var(--text-muted)" }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-3" style={{ borderTop: "1px solid var(--border-inner)" }}>
          {loadingSugg ? (
            <p className="text-center py-4 text-[14px]" style={{ color: "var(--text-muted)" }}>載入中…</p>
          ) : items.length === 0 ? (
            <p className="text-center py-4 text-[14px]" style={{ color: "var(--text-muted)" }}>歷史資料不足，無法計算</p>
          ) : (
            <>
              <div className="rounded-xl overflow-hidden mt-3" style={{ border: "1px solid var(--border-inner)" }}>
                <div className="grid grid-cols-3 px-3 py-2 text-[13px] font-semibold"
                  style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}>
                  <span>分類</span>
                  <span className="text-right">近 {months} 月平均</span>
                  <span className="text-right">建議上限</span>
                </div>
                {items.map((item, i) => (
                  <div key={item.category} className="grid grid-cols-3 px-3 py-2 border-t text-[14px]"
                    style={{ borderColor: "var(--border-inner)", background: i % 2 === 0 ? "transparent" : "var(--bg-input)" }}>
                    <span className="flex items-center gap-1.5">
                      <span>{CATEGORY_ICONS[item.category] ?? "📌"}</span>
                      <span style={{ color: "var(--text-primary)" }}>{item.category}</span>
                    </span>
                    <span className="text-right tabular-nums" style={{ color: "var(--text-muted)" }}>
                      NT$ {fmt(item.avg)}
                    </span>
                    <span className="text-right font-semibold tabular-nums" style={{ color: "var(--accent)" }}>
                      NT$ {fmt(item.suggested)}
                    </span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => onApply(toApply)}
                disabled={applying}
                className="w-full py-2.5 rounded-xl text-[14px] font-bold text-white transition-opacity hover:opacity-80 disabled:opacity-40"
                style={{ background: "linear-gradient(135deg,#0ea5e9,#3b82f6)" }}>
                {applying ? "套用中…" : "📊 一鍵套用歷史建議預算"}
              </button>
              <p className="text-[12px] text-center" style={{ color: "var(--text-muted)" }}>
                僅修改尚未設定預算的分類 · 已有預算的分類不受影響
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── 主元件 ─────────────────────────────────────────────────────────────────────
export default function BudgetManager({ extraCategories = [] }: { extraCategories?: string[] }) {
  const today    = new Date();
  const initMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  const [month,      setMonth]      = useState(initMonth);
  const [budgets,    setBudgets]    = useState<BudgetItem[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [income,     setIncome]     = useState(0);
  const [fixedTotal, setFixedTotal] = useState(0);
  const [loanTotal,  setLoanTotal]  = useState(0);
  const [fixedItems, setFixedItems] = useState<FixedExpenseItem[]>([]);
  const [loanItems,  setLoanItems]  = useState<{ name: string; monthly: number }[]>([]);
  const [applying,   setApplying]   = useState(false);
  // category being quick-added from unset grid
  const [quickAdd, setQuickAdd] = useState<string | null>(null);
  const [quickVal,  setQuickVal]  = useState("");
  const [quickSaving, setQuickSaving] = useState(false);

  const fetchBudgets = useCallback(async (m: string) => {
    setLoading(true);
    try {
      const [budgetRes, summaryRes, fixedRes, loanRes] = await Promise.all([
        fetch(`/api/budgets?month=${m}`),
        fetch(`/api/summary?month=${m}`),
        fetch("/api/fixed-expenses"),
        fetch("/api/loans"),
      ]);
      const budgetData  = await budgetRes.json()  as { budgets: BudgetItem[] };
      const summaryData = await summaryRes.json() as { totals?: { income?: number } };
      const fixedData   = await fixedRes.json()   as { fixedExpenses: FixedExpenseItem[] };
      const loanData    = await loanRes.json()    as LoanItem[];

      setBudgets(budgetData.budgets ?? []);
      setIncome(summaryData.totals?.income ?? 0);

      const fItems = fixedData.fixedExpenses ?? [];
      setFixedItems(fItems);
      setFixedTotal(fItems.reduce((s, f) => s + f.amount, 0));

      const activeLoans = Array.isArray(loanData) ? loanData.filter(l => l.status === "active") : [];
      const lItems = activeLoans.map(l => ({
        name:    l.name,
        monthly: l.payments?.[0] ? parseFloat(String(l.payments[0].totalPaid)) : 0,
      }));
      setLoanItems(lItems);
      setLoanTotal(lItems.reduce((s, l) => s + l.monthly, 0));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchBudgets(month); }, [fetchBudgets, month]);

  async function handleApplySuggestion(items: SuggestionItem[]) {
    setApplying(true);
    const budgetMap_ = new Map(budgets.map(b => [b.category, b]));
    for (const item of items) {
      if (budgetMap_.has(item.category)) continue; // 已設定者不覆蓋
      await fetch("/api/budgets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: item.category, amount: item.amount }),
      });
    }
    setApplying(false);
    fetchBudgets(month);
  }

  async function handleSave(category: string, amount: number) {
    await fetch("/api/budgets", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, amount }),
    });
    fetchBudgets(month);
  }

  async function handleDelete(category: string) {
    await fetch(`/api/budgets?category=${encodeURIComponent(category)}`, { method: "DELETE" });
    fetchBudgets(month);
  }

  async function handleQuickSave() {
    if (!quickAdd) return;
    const val = parseFloat(quickVal);
    if (isNaN(val) || val <= 0) return;
    setQuickSaving(true);
    await handleSave(quickAdd, val);
    setQuickSaving(false);
    setQuickAdd(null);
    setQuickVal("");
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const budgetMap   = new Map(budgets.map(b => [b.category, b]));
  const allExpenseCats = [...EXPENSE_CATEGORIES, ...extraCategories.filter(c => !EXPENSE_CATEGORIES.includes(c))];
  const activeCats  = allExpenseCats.filter(c => budgetMap.has(c));
  const unsetCats   = allExpenseCats.filter(c => !budgetMap.has(c));

  // sort active: over → near → ok
  const sortOrder = { over: 0, near: 1, ok: 2, none: 3 };
  const sortedActive = [...activeCats].sort((a, b) => {
    const ba = budgetMap.get(a)!;
    const bb = budgetMap.get(b)!;
    return sortOrder[statusOf(ba.spent, ba.amount)] - sortOrder[statusOf(bb.spent, bb.amount)];
  });

  const totalBudget = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent  = budgets.reduce((s, b) => s + b.spent,  0);
  const totalPct    = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;
  const totalStatus = statusOf(totalSpent, totalBudget);
  const totalMeta   = STATUS_META[totalStatus === "none" ? "ok" : totalStatus];

  const overCount   = activeCats.filter(c => { const b = budgetMap.get(c)!; return b.spent > b.amount; }).length;
  const nearCount   = activeCats.filter(c => { const b = budgetMap.get(c)!; return statusOf(b.spent, b.amount) === "near"; }).length;
  const okCount     = activeCats.length - overCount - nearCount;

  // ── Skeleton ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-5">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="h-5 w-24 rounded-lg animate-pulse" style={{ background: "var(--border-inner)" }} />
            <div className="h-3 w-48 rounded-lg animate-pulse" style={{ background: "var(--border-inner)" }} />
          </div>
          <div className="h-9 w-32 rounded-xl animate-pulse" style={{ background: "var(--border-inner)" }} />
        </div>
        {/* Summary skeleton */}
        <div className="rounded-2xl p-5 animate-pulse" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="h-8 w-20 rounded mb-3" style={{ background: "var(--border-inner)" }} />
          <div className="h-3 rounded-full" style={{ background: "var(--border-inner)" }} />
        </div>
        {/* Rows skeleton */}
        {[1,2,3,4].map(i => (
          <div key={i} className="rounded-2xl p-4 animate-pulse" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-xl" style={{ background: "var(--border-inner)" }} />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-20 rounded" style={{ background: "var(--border-inner)" }} />
                <div className="h-3 w-32 rounded" style={{ background: "var(--border-inner)" }} />
              </div>
            </div>
            <div className="h-2.5 rounded-full" style={{ background: "var(--border-inner)" }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── 標題列 + 月份選擇 ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[17px] font-bold" style={{ color: "var(--text-primary)" }}>預算控制</h2>
          <p className="text-[14px] mt-0.5" style={{ color: "var(--text-muted)" }}>設定各分類月支出上限，追蹤使用狀況</p>
        </div>
        <input
          type="month"
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="px-3 py-1.5 rounded-xl text-sm border outline-none"
          style={{ background: "var(--bg-input)", borderColor: "var(--border)", color: "var(--text-primary)", colorScheme: "dark" }}
        />
      </div>

      {/* ── 空狀態引導 ── */}
      {activeCats.length === 0 && (
        <div className="rounded-2xl py-12 flex flex-col items-center gap-3 text-center"
          style={{ background: "var(--bg-card)", border: "1px dashed var(--border)" }}>
          <p className="text-4xl">💰</p>
          <p className="text-[16px] font-bold" style={{ color: "var(--text-sub)" }}>尚未設定任何預算</p>
          <p className="text-[14px]" style={{ color: "var(--text-muted)" }}>點擊下方分類按鈕，設定每月支出上限</p>
        </div>
      )}

      {/* ── 總覽 Hero ── */}
      {totalBudget > 0 && (
        <div className="rounded-2xl p-5 relative overflow-hidden"
          style={{ background: "var(--bg-card)", border: `1px solid ${totalMeta.color}30`, boxShadow: "var(--card-shadow)" }}>
          <div className="flex items-end justify-between mb-4">
            <div>
              <p className="text-[14px] font-semibold tracking-wide uppercase mb-1" style={{ color: "var(--text-muted)" }}>
                {month} 預算總覽
              </p>
              <div className="flex items-baseline gap-2">
                <p className="text-[42px] font-black leading-none tabular-nums" style={{ color: totalMeta.color }}>
                  {totalPct.toFixed(0)}%
                </p>
                <p className="text-[14px] font-semibold" style={{ color: "var(--text-sub)" }}>
                  NT$ {fmt(totalSpent)} <span style={{ color: "var(--text-muted)" }}>/ {fmt(totalBudget)}</span>
                </p>
              </div>
              <p className="text-[14px] mt-1 tabular-nums" style={{ color: "var(--text-muted)" }}>
                剩餘 NT$ {fmt(Math.max(totalBudget - totalSpent, 0))}
              </p>
            </div>
            {/* Status breakdown */}
            <div className="flex gap-2 flex-wrap justify-end">
              {overCount > 0 && (
                <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl"
                  style={{ background: "#EF444418", border: "1px solid #EF444430" }}>
                  <span className="text-[14px]">🚨</span>
                  <span className="text-[14px] font-bold tabular-nums" style={{ color: "#EF4444" }}>{overCount} 超標</span>
                </div>
              )}
              {nearCount > 0 && (
                <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl"
                  style={{ background: "#F59E0B18", border: "1px solid #F59E0B30" }}>
                  <span className="text-[14px]">⚠️</span>
                  <span className="text-[14px] font-bold tabular-nums" style={{ color: "#F59E0B" }}>{nearCount} 接近</span>
                </div>
              )}
              {okCount > 0 && (
                <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl"
                  style={{ background: "#10B98118", border: "1px solid #10B98130" }}>
                  <span className="text-[14px]">✅</span>
                  <span className="text-[14px] font-bold tabular-nums" style={{ color: "#10B981" }}>{okCount} 正常</span>
                </div>
              )}
            </div>
          </div>
          {/* Total progress bar */}
          <div className="h-3 rounded-full overflow-hidden" style={{ background: "var(--bg-input)" }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${totalPct}%`, background: `linear-gradient(90deg,${totalMeta.barColor}99,${totalMeta.barColor})` }} />
          </div>
        </div>
      )}

      {/* ── 可分配金額 ── */}
      {(income > 0 || fixedTotal > 0 || loanTotal > 0) && (() => {
        const available = income - fixedTotal - loanTotal;
        const availColor = available >= 0 ? "#10B981" : "#EF4444";
        return (
          <div className="rounded-2xl overflow-hidden"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--card-shadow)" }}>

            {/* Header bar */}
            <div className="px-5 py-3 border-b flex items-center justify-between"
              style={{ borderColor: "var(--border-inner)", background: "var(--bg-input)" }}>
              <div>
                <p className="text-[14px] font-bold" style={{ color: "var(--text-primary)" }}>⚡ 可分配預算</p>
                <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>{month}</p>
              </div>
              <span className="text-[18px] font-black tabular-nums"
                style={{ color: availColor }}>
                NT$ {fmt(available)}
              </span>
            </div>

            <div className="px-5 py-3 space-y-1">
              {/* 收入 row */}
              <div className="flex items-center justify-between py-2 rounded-xl px-3"
                style={{ background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.15)" }}>
                <span className="text-[14px] flex items-center gap-2 font-semibold" style={{ color: "#10B981" }}>
                  <span>💰</span> {month} 收入
                </span>
                <span className="text-[15px] font-bold tabular-nums" style={{ color: income > 0 ? "#10B981" : "var(--text-muted)" }}>
                  {income > 0 ? `+ NT$ ${fmt(income)}` : "尚無收入記錄"}
                </span>
              </div>

              {/* 固定支出 */}
              {fixedItems.length > 0 && (
                <div className="rounded-xl overflow-hidden"
                  style={{ border: "1px solid rgba(248,113,113,0.2)" }}>
                  <div className="flex items-center justify-between px-3 py-2"
                    style={{ background: "rgba(248,113,113,0.07)" }}>
                    <span className="text-[14px] font-semibold flex items-center gap-2" style={{ color: "#F87171" }}>
                      <span>📋</span> 固定支出（{fixedItems.length} 項）
                      <span className="text-[12px] font-normal" style={{ color: "var(--text-muted)" }}>依當前設定</span>
                    </span>
                    <span className="text-[15px] font-bold tabular-nums" style={{ color: "#F87171" }}>
                      − NT$ {fmt(fixedTotal)}
                    </span>
                  </div>
                  <div className="px-3 py-2 space-y-1" style={{ background: "rgba(248,113,113,0.03)" }}>
                    {fixedItems.map(f => (
                      <div key={f.id} className="flex justify-between text-[13px] pl-2">
                        <span style={{ color: "var(--text-sub)" }}>{f.name}</span>
                        <span className="tabular-nums font-medium" style={{ color: "var(--text-muted)" }}>
                          NT$ {fmt(f.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 貸款應繳 */}
              {loanItems.length > 0 && (
                <div className="rounded-xl overflow-hidden"
                  style={{ border: "1px solid rgba(251,146,60,0.2)" }}>
                  <div className="flex items-center justify-between px-3 py-2"
                    style={{ background: "rgba(251,146,60,0.07)" }}>
                    <span className="text-[14px] font-semibold flex items-center gap-2" style={{ color: "#FB923C" }}>
                      <span>🏦</span> 貸款應繳（{loanItems.length} 筆）
                      <span className="text-[12px] font-normal" style={{ color: "var(--text-muted)" }}>依最近還款估算</span>
                    </span>
                    <span className="text-[15px] font-bold tabular-nums" style={{ color: "#FB923C" }}>
                      − NT$ {fmt(loanTotal)}
                    </span>
                  </div>
                  <div className="px-3 py-2 space-y-1" style={{ background: "rgba(251,146,60,0.03)" }}>
                    {loanItems.map((l, i) => (
                      <div key={i} className="flex justify-between text-[13px] pl-2">
                        <span style={{ color: "var(--text-sub)" }}>{l.name}</span>
                        <span className="tabular-nums font-medium" style={{ color: "var(--text-muted)" }}>
                          NT$ {fmt(l.monthly)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 合計結果 */}
              <div className="flex items-center justify-between px-3 py-3 rounded-xl mt-1"
                style={{ background: `${availColor}12`, border: `1px solid ${availColor}35` }}>
                <div>
                  <p className="text-[13px] font-semibold" style={{ color: availColor + "BB" }}>
                    {available >= 0 ? "可自由分配至各預算分類" : "⚠ 已超出收入"}
                  </p>
                  <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {fmt(income)} − {fmt(fixedTotal)} − {fmt(loanTotal)} = {fmt(available)}
                  </p>
                </div>
                <p className="text-[24px] font-black tabular-nums" style={{ color: availColor }}>
                  NT$ {fmt(available)}
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── 50/30/20 建議 ── */}
      {(income > 0 || fixedTotal > 0 || loanTotal > 0) && (
        <BudgetSuggestion
          income={Math.max(0, income - fixedTotal - loanTotal)}
          applying={applying}
          onApply={handleApplySuggestion}
        />
      )}

      {/* ── 歷史消費建議 ── */}
      <HistorySuggestion applying={applying} onApply={handleApplySuggestion} />

      {/* ── 新增預算分類（置頂）── */}
      <UnsetCategoryGrid
        categories={unsetCats}
        onSet={cat => { setQuickAdd(cat); setQuickVal(""); }}
      />

      {/* ── 已設定預算的分類 ── */}
      {sortedActive.length > 0 && (
        <div className="space-y-3">
          {sortedActive.map(cat => (
            <BudgetCard
              key={cat}
              category={cat}
              budget={budgetMap.get(cat)!}
              onSave={handleSave}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* ── Quick-add modal ── */}
      {quickAdd && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
          onClick={() => setQuickAdd(null)}>
          <div className="w-full max-w-sm rounded-2xl p-5 space-y-4"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <span className="text-[28px]">{CATEGORY_ICONS[quickAdd] ?? "📌"}</span>
              <div>
                <p className="text-[16px] font-bold" style={{ color: "var(--text-primary)" }}>{quickAdd}</p>
                <p className="text-[14px]" style={{ color: "var(--text-muted)" }}>設定每月預算上限</p>
              </div>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "var(--text-muted)" }}>NT$</span>
              <input
                type="number" min="0" placeholder="例：5000" autoFocus
                value={quickVal}
                onChange={e => setQuickVal(e.target.value)}
                onWheel={e => e.currentTarget.blur()}
                onKeyDown={e => { if (e.key === "Enter") handleQuickSave(); if (e.key === "Escape") setQuickAdd(null); }}
                className="w-full pl-10 pr-3 py-2.5 rounded-xl text-sm font-bold outline-none"
                style={{ background: "var(--bg-input)", border: "1px solid var(--accent)", color: "var(--text-primary)" }}
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setQuickAdd(null)}
                className="flex-1 py-2.5 rounded-xl text-[14px] font-semibold"
                style={{ border: "1px solid var(--border)", color: "var(--text-sub)" }}>取消</button>
              <button onClick={handleQuickSave} disabled={quickSaving || !quickVal}
                className="flex-1 py-2.5 rounded-xl text-[14px] font-bold text-white disabled:opacity-40"
                style={{ background: "linear-gradient(135deg,#2563EB,#3B82F6)" }}>
                {quickSaving ? "儲存中…" : "設定預算"}
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="text-[14px] text-center pb-2" style={{ color: "var(--text-muted)" }}>
        預算為循環月設定 · 切換月份可查看該月實際支出對比
      </p>
    </div>
  );
}
