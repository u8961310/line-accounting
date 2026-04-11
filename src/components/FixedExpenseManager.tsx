"use client";

import { useEffect, useState, useCallback } from "react";
import { notifyFinanceChanged } from "@/lib/finance-events";

interface FixedExpenseItem {
  id:                   string;
  name:                 string;
  amount:               number;
  category:             string;
  dayOfMonth:           number | null;
  note:                 string;
  matched?:             boolean;
  matchedTransactionId?: string | null;
}

interface LoanSummaryItem {
  id:   string;
  name: string;
  lender: string;
  monthlyPayment: number; // totalPaid from last payment
  interestRate:   number;
}

const EXPENSE_CATEGORIES = [
  "居住", "飲食", "交通", "通訊", "保險", "水電",
  "教育", "訂閱", "運動", "美容", "寵物", "其他",
];

const CATEGORY_ICONS: Record<string, string> = {
  居住: "🏠", 飲食: "🍜", 交通: "🚌", 通訊: "📱",
  保險: "🛡️", 水電: "💡", 教育: "📚", 訂閱: "📺",
  運動: "🏋️", 美容: "💄", 寵物: "🐾", 其他: "📦",
};

function fmt(n: number) {
  return Math.abs(n).toLocaleString("zh-TW", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const inputClass =
  "w-full rounded-xl px-3 py-2 text-sm outline-none" +
  " bg-[var(--bg-input)] border border-[var(--border)] focus:border-[var(--accent)]" +
  " text-[var(--text-primary)] placeholder-[var(--text-muted)]";

const labelClass = "text-[14px] font-medium mb-1 block text-[var(--text-sub)]";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border ${className}`}
      style={{ background: "var(--bg-card)", borderColor: "var(--border)", boxShadow: "var(--card-shadow)" }}>
      {children}
    </div>
  );
}

const emptyForm = { name: "", amount: "", category: "居住", dayOfMonth: "", note: "" };

export default function FixedExpenseManager({ monthlyIncome = 0 }: { monthlyIncome?: number }) {
  const [items,        setItems]        = useState<FixedExpenseItem[]>([]);
  const [loans,        setLoans]        = useState<LoanSummaryItem[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [showForm,     setShowForm]     = useState(false);
  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [form,         setForm]         = useState(emptyForm);
  const [saving,       setSaving]       = useState(false);
  const [deletingId,   setDeletingId]   = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [feRes, loanRes] = await Promise.all([
        fetch("/api/fixed-expenses"),
        fetch("/api/loans"),
      ]);
      const feData   = await feRes.json() as { fixedExpenses: FixedExpenseItem[] };
      const loanData = await loanRes.json() as {
        id: string; name: string; lender: string; status: string;
        interestRate: string; payments: { totalPaid: string }[];
      }[];
      setItems(feData.fixedExpenses ?? []);
      setLoans(
        loanData
          .filter(l => l.status === "active")
          .map(l => ({
            id:             l.id,
            name:           l.name,
            lender:         l.lender,
            monthlyPayment: l.payments?.[0] ? parseFloat(l.payments[0].totalPaid) : 0,
            interestRate:   parseFloat(l.interestRate),
          }))
      );
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  function startAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function startEdit(item: FixedExpenseItem) {
    setEditingId(item.id);
    setForm({
      name:       item.name,
      amount:     String(item.amount),
      category:   item.category,
      dayOfMonth: item.dayOfMonth != null ? String(item.dayOfMonth) : "",
      note:       item.note,
    });
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSave() {
    const amount = parseFloat(form.amount);
    if (!form.name.trim() || isNaN(amount) || amount <= 0) return;
    setSaving(true);
    try {
      const body = {
        name:       form.name.trim(),
        amount,
        category:   form.category,
        dayOfMonth: form.dayOfMonth ? parseInt(form.dayOfMonth) : null,
        note:       form.note,
      };
      if (editingId) {
        await fetch(`/api/fixed-expenses/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        await fetch("/api/fixed-expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      cancelForm();
      fetchAll();
      notifyFinanceChanged();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`確定刪除「${name}」？`)) return;
    setDeletingId(id);
    try {
      await fetch(`/api/fixed-expenses/${id}`, { method: "DELETE" });
      fetchAll();
      notifyFinanceChanged();
    } catch (e) { console.error(e); }
    finally { setDeletingId(null); }
  }

  const totalFixed    = items.reduce((s, i) => s + i.amount, 0);
  const totalLoans    = loans.reduce((s, l) => s + l.monthlyPayment, 0);
  const totalMonthly  = totalFixed + totalLoans;

  // 損益平衡點計算
  const safeIncome    = Math.ceil(totalMonthly / 0.75);   // 25% 儲蓄緩衝
  const incomeRatio   = monthlyIncome > 0 ? Math.min(monthlyIncome / safeIncome, 1.5) : 0;
  const breakEvenMet  = monthlyIncome >= totalMonthly;
  const safeIncomeMet = monthlyIncome >= safeIncome;

  return (
    <div className="space-y-5">
      {/* ── 每月必要支出合計 ── */}
      <div className="rounded-2xl p-5 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#1e1b4b 100%)", border: "1px solid #4338ca40" }}>
        <p className="text-[14px] font-semibold tracking-widest uppercase mb-3" style={{ color: "#a5b4fc" }}>
          每月必要支出合計
        </p>
        <p className="text-[42px] font-black tabular-nums leading-none mb-4" style={{ color: "#e0e7ff" }}>
          NT$ {fmt(totalMonthly)}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl px-4 py-3" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p className="text-[14px] mb-1" style={{ color: "#a5b4fc" }}>固定支出</p>
            <p className="text-[18px] font-bold tabular-nums" style={{ color: "#c7d2fe" }}>NT$ {fmt(totalFixed)}</p>
            <p className="text-[14px] mt-0.5" style={{ color: "#6366f1" }}>{items.length} 項</p>
          </div>
          <div className="rounded-xl px-4 py-3" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p className="text-[14px] mb-1" style={{ color: "#a5b4fc" }}>貸款還款</p>
            <p className="text-[18px] font-bold tabular-nums" style={{ color: "#c7d2fe" }}>NT$ {fmt(totalLoans)}</p>
            <p className="text-[14px] mt-0.5" style={{ color: "#6366f1" }}>{loans.length} 筆貸款</p>
          </div>
        </div>
      </div>

      {/* ── 收支損益平衡點 ── */}
      <div className="rounded-2xl border p-5"
        style={{ background: "var(--bg-card)", borderColor: "var(--border)", boxShadow: "var(--card-shadow)" }}>
        <p className="text-[14px] font-semibold tracking-widest uppercase mb-4" style={{ color: "var(--text-sub)" }}>
          💰 收支損益平衡點
        </p>

        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* 損益平衡 */}
          <div className="rounded-xl p-3" style={{ background: "var(--bg-input)", border: "1px solid var(--border-inner)" }}>
            <p className="text-[14px] mb-1" style={{ color: "var(--text-muted)" }}>損益平衡（0% 儲蓄）</p>
            <p className="text-[16px] font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
              NT$ {fmt(totalMonthly)}
            </p>
            <p className="text-[14px] mt-0.5" style={{ color: breakEvenMet ? "#10b981" : "#ef4444" }}>
              {breakEvenMet ? "✓ 已達標" : "✗ 未達標"}
            </p>
          </div>
          {/* 建議安全收入 */}
          <div className="rounded-xl p-3" style={{ background: "var(--bg-input)", border: "1px solid var(--border-inner)" }}>
            <p className="text-[14px] mb-1" style={{ color: "var(--text-muted)" }}>建議安全收入（+25% 儲蓄）</p>
            <p className="text-[16px] font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
              NT$ {fmt(safeIncome)}
            </p>
            <p className="text-[14px] mt-0.5" style={{ color: safeIncomeMet ? "#10b981" : "#f59e0b" }}>
              {safeIncomeMet ? "✓ 已達標" : `差 NT$ ${fmt(safeIncome - monthlyIncome)}`}
            </p>
          </div>
        </div>

        {/* Progress bar — 只有有 income 資料才顯示 */}
        {monthlyIncome > 0 && (
          <div>
            <div className="flex justify-between text-[14px] mb-1" style={{ color: "var(--text-muted)" }}>
              <span>本月收入 NT$ {fmt(monthlyIncome)}</span>
              <span>{Math.round((monthlyIncome / safeIncome) * 100)}% / 建議安全收入</span>
            </div>
            <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "var(--bg-input)" }}>
              {/* 損益平衡標記線 */}
              <div className="relative h-full">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(incomeRatio / 1.5 * 100, 100)}%`,
                    background: safeIncomeMet
                      ? "linear-gradient(90deg,#6366f1,#10b981)"
                      : breakEvenMet
                      ? "linear-gradient(90deg,#6366f1,#f59e0b)"
                      : "#ef4444",
                  }}
                />
              </div>
            </div>
            {/* 標記點 */}
            <div className="relative mt-1" style={{ height: "14px" }}>
              <span
                className="absolute text-[9px]"
                style={{
                  left: `${Math.min((totalMonthly / safeIncome) / 1.5 * 100, 98)}%`,
                  transform: "translateX(-50%)",
                  color: "var(--text-muted)",
                }}>
                ▲ 平衡
              </span>
              <span
                className="absolute text-[9px]"
                style={{
                  left: `${Math.min(100 / 1.5, 98)}%`,
                  transform: "translateX(-50%)",
                  color: "var(--text-muted)",
                }}>
                ▲ 安全
              </span>
            </div>
          </div>
        )}

        {monthlyIncome === 0 && (
          <p className="text-[14px]" style={{ color: "var(--text-muted)" }}>
            收入資料將在查看當月帳單時自動帶入
          </p>
        )}
      </div>

      {/* ── 本月扣款進度 ── */}
      {!loading && items.length > 0 && (() => {
        const matchedCount = items.filter(i => i.matched).length;
        const total = items.length;
        const pct = Math.round((matchedCount / total) * 100);
        return (
          <div className="rounded-2xl border p-5"
            style={{ background: "var(--bg-card)", borderColor: "var(--border)", boxShadow: "var(--card-shadow)" }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[14px] font-semibold tracking-widest uppercase" style={{ color: "var(--text-sub)" }}>
                📋 本月扣款進度
              </p>
              <span className="text-[14px] font-bold tabular-nums" style={{ color: pct === 100 ? "#10b981" : "var(--text-primary)" }}>
                {matchedCount} / {total} 項（{pct}%）
              </span>
            </div>
            <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "var(--bg-input)" }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${pct}%`,
                  background: pct === 100
                    ? "linear-gradient(90deg,#10b981,#34d399)"
                    : pct >= 50
                    ? "linear-gradient(90deg,#6366f1,#818cf8)"
                    : "linear-gradient(90deg,#f59e0b,#fbbf24)",
                }}
              />
            </div>
            {pct === 100 && (
              <p className="text-[14px] mt-2" style={{ color: "#10b981" }}>本月所有固定支出已確認扣款 ✓</p>
            )}
          </div>
        );
      })()}

      {/* ── 固定支出清單 ── */}
      <Card>
        <div className="px-5 py-4 flex items-center justify-between border-b" style={{ borderColor: "var(--border-inner)" }}>
          <div>
            <p className="font-bold text-[15px]" style={{ color: "var(--text-primary)" }}>固定支出設定</p>
            <p className="text-[14px] mt-0.5" style={{ color: "var(--text-muted)" }}>每月固定扣款項目，如房租、訂閱、保費</p>
          </div>
          <button
            onClick={startAdd}
            className="text-[14px] font-bold px-4 py-1.5 rounded-xl transition-opacity hover:opacity-80"
            style={{ background: "var(--accent)", color: "#fff" }}>
            + 新增
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-[14px]" style={{ color: "var(--text-muted)" }}>尚無固定支出項目</p>
            <p className="text-[14px] mt-1" style={{ color: "var(--text-muted)" }}>點擊「新增」加入房租、訂閱等每月固定費用</p>
          </div>
        ) : (
          items.map((item, idx) => (
            <div key={item.id} className="px-5 py-4 flex items-center gap-3 border-b last:border-0"
              style={{ borderColor: "var(--border-inner)" }}>
              <span className="text-xl flex-shrink-0">{CATEGORY_ICONS[item.category] ?? "📌"}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[14px]" style={{ color: "var(--text-primary)" }}>{item.name}</span>
                  <span className="text-[14px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}>
                    {item.category}
                  </span>
                  {item.dayOfMonth && (
                    <span className="text-[14px]" style={{ color: "var(--text-muted)" }}>每月 {item.dayOfMonth} 日</span>
                  )}
                  {item.matched !== undefined && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded-full font-bold"
                      style={{
                        background: item.matched ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)",
                        color: item.matched ? "#10b981" : "#f59e0b",
                      }}>
                      {item.matched ? "已扣 ✓" : "未扣"}
                    </span>
                  )}
                </div>
                {item.note && (
                  <p className="text-[14px] mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{item.note}</p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[16px] font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
                  NT$ {fmt(item.amount)}
                </p>
                <p className="text-[14px]" style={{ color: "var(--text-muted)" }}>/ 月</p>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <button onClick={() => startEdit(item)}
                  className="text-[14px] px-2.5 py-1 rounded-lg transition-opacity hover:opacity-80"
                  style={{ background: "var(--bg-input)", color: "var(--text-sub)", border: "1px solid var(--border-inner)" }}>
                  編輯
                </button>
                <button onClick={() => handleDelete(item.id, item.name)}
                  disabled={deletingId === item.id}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-opacity hover:opacity-80"
                  style={{ color: "#F87171" }}>
                  ✕
                </button>
              </div>
            </div>
          ))
        )}

        {/* 合計列 */}
        {items.length > 0 && (
          <div className="px-5 py-3 flex items-center justify-between rounded-b-2xl"
            style={{ background: "var(--bg-input)", borderTop: "1px solid var(--border-inner)" }}>
            <span className="text-[14px] font-medium" style={{ color: "var(--text-sub)" }}>固定支出小計</span>
            <span className="text-[15px] font-black tabular-nums" style={{ color: "var(--text-primary)" }}>
              NT$ {fmt(totalFixed)}
            </span>
          </div>
        )}
      </Card>

      {/* ── 貸款還款列表（唯讀摘要）── */}
      {loans.length > 0 && (
        <Card>
          <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border-inner)" }}>
            <p className="font-bold text-[15px]" style={{ color: "var(--text-primary)" }}>貸款每月還款</p>
            <p className="text-[14px] mt-0.5" style={{ color: "var(--text-muted)" }}>依最近一次還款紀錄估算，詳細設定請至「貸款管理」</p>
          </div>
          {loans.map(loan => (
            <div key={loan.id} className="px-5 py-4 flex items-center gap-3 border-b last:border-0"
              style={{ borderColor: "var(--border-inner)" }}>
              <span className="text-xl">🏦</span>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-[14px]" style={{ color: "var(--text-primary)" }}>{loan.name}</span>
                <span className="text-[14px] ml-2" style={{ color: "var(--text-muted)" }}>{loan.lender}</span>
                {loan.interestRate > 0 && (
                  <span className="text-[14px] ml-2" style={{ color: loan.interestRate >= 10 ? "#F87171" : "var(--text-muted)" }}>
                    年利率 {loan.interestRate}%
                  </span>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                {loan.monthlyPayment > 0 ? (
                  <>
                    <p className="text-[16px] font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
                      NT$ {fmt(loan.monthlyPayment)}
                    </p>
                    <p className="text-[14px]" style={{ color: "var(--text-muted)" }}>/ 月（估）</p>
                  </>
                ) : (
                  <p className="text-[14px]" style={{ color: "var(--text-muted)" }}>尚無還款紀錄</p>
                )}
              </div>
            </div>
          ))}
          <div className="px-5 py-3 flex items-center justify-between rounded-b-2xl"
            style={{ background: "var(--bg-input)", borderTop: "1px solid var(--border-inner)" }}>
            <span className="text-[14px] font-medium" style={{ color: "var(--text-sub)" }}>貸款小計</span>
            <span className="text-[15px] font-black tabular-nums" style={{ color: "var(--text-primary)" }}>
              NT$ {fmt(totalLoans)}
            </span>
          </div>
        </Card>
      )}

      {/* ── 新增 / 編輯表單 ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={cancelForm}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}
            onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-5 pb-4 border-b" style={{ borderColor: "var(--border-inner)" }}>
              <p className="font-bold text-[16px]" style={{ color: "var(--text-primary)" }}>
                {editingId ? "編輯固定支出" : "新增固定支出"}
              </p>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className={labelClass}>名稱 *</label>
                <input className={inputClass} placeholder="房租、Netflix、手機費…" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
              </div>
              <div>
                <label className={labelClass}>每月金額 *</label>
                <input className={inputClass} type="number" min="0" placeholder="0" value={form.amount}
                  onWheel={e => e.currentTarget.blur()}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div>
                <label className={labelClass}>分類</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {EXPENSE_CATEGORIES.map(c => (
                    <button key={c} type="button" onClick={() => setForm(f => ({ ...f, category: c }))}
                      className="text-[14px] px-2 py-0.5 rounded-md font-medium transition-all"
                      style={{
                        background: form.category === c ? "var(--accent)" : "var(--bg-input)",
                        color:      form.category === c ? "#fff" : "var(--text-sub)",
                        border:     form.category === c ? "1px solid var(--accent)" : "1px solid var(--border-inner)",
                      }}>
                      {CATEGORY_ICONS[c]} {c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelClass}>每月扣款日（選填，1–31）</label>
                <input className={inputClass} type="number" min={1} max={31} placeholder="如 5（每月 5 日）"
                  value={form.dayOfMonth} onWheel={e => e.currentTarget.blur()}
                  onChange={e => setForm(f => ({ ...f, dayOfMonth: e.target.value }))} />
              </div>
              <div>
                <label className={labelClass}>備註（選填）</label>
                <input className={inputClass} placeholder="說明用途…" value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  onKeyDown={e => { if (e.key === "Enter") handleSave(); }} />
              </div>
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button onClick={cancelForm}
                className="flex-1 py-2.5 rounded-xl text-[14px] font-semibold"
                style={{ border: "1px solid var(--border)", color: "var(--text-sub)" }}>
                取消
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-[14px] font-bold transition-opacity"
                style={{ background: "var(--accent)", color: "#fff", opacity: saving ? 0.6 : 1 }}>
                {saving ? "儲存中…" : "儲存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
