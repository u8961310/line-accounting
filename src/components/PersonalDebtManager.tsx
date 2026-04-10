"use client";

import React, { useEffect, useState, useCallback } from "react";

interface PersonalDebt {
  id:           string;
  counterparty: string;
  direction:    "owed_to_me" | "i_owe";
  amount:       number;
  note:         string;
  dueDate:      string | null;
  settledAt:    string | null;
  createdAt:    string;
}

const fmt = (n: number) =>
  "NT$" + Math.round(n).toLocaleString("zh-TW");

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" });

// ── 新增表單（定義在元件外，避免 re-render 失焦）────────────────────────────────
interface AddFormProps {
  onAdd: (debt: PersonalDebt) => void;
}
function AddForm({ onAdd }: AddFormProps) {
  const [counterparty, setCounterparty] = useState("");
  const [direction,    setDirection]    = useState<"owed_to_me" | "i_owe">("owed_to_me");
  const [amount,       setAmount]       = useState("");
  const [note,         setNote]         = useState("");
  const [dueDate,      setDueDate]      = useState("");
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!counterparty.trim() || isNaN(amt) || amt <= 0) {
      setError("請填寫對象姓名與金額");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/personal-debts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ counterparty, direction, amount: amt, note, dueDate: dueDate || undefined }),
      });
      if (!res.ok) throw new Error();
      const debt = await res.json() as PersonalDebt;
      onAdd(debt);
      setCounterparty(""); setAmount(""); setNote(""); setDueDate("");
    } catch {
      setError("新增失敗");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl p-4 flex flex-col gap-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <p className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>新增借貸紀錄</p>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setDirection("owed_to_me")}
          className="py-2 rounded-lg text-[13px] font-medium transition-colors"
          style={{ background: direction === "owed_to_me" ? "#22c55e" : "var(--bg-input)", color: direction === "owed_to_me" ? "#fff" : "var(--text-secondary)" }}>
          💰 別人欠我
        </button>
        <button type="button" onClick={() => setDirection("i_owe")}
          className="py-2 rounded-lg text-[13px] font-medium transition-colors"
          style={{ background: direction === "i_owe" ? "#ef4444" : "var(--bg-input)", color: direction === "i_owe" ? "#fff" : "var(--text-secondary)" }}>
          🙏 我欠別人
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input value={counterparty} onChange={e => setCounterparty(e.target.value)}
          placeholder="對象姓名" className="px-3 py-2 rounded-lg text-[13px]"
          style={{ background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
        <input value={amount} onChange={e => setAmount(e.target.value)}
          type="number" placeholder="金額" className="px-3 py-2 rounded-lg text-[13px]"
          style={{ background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input value={note} onChange={e => setNote(e.target.value)}
          placeholder="備注（選填）" className="px-3 py-2 rounded-lg text-[13px]"
          style={{ background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
        <input value={dueDate} onChange={e => setDueDate(e.target.value)}
          type="date" className="px-3 py-2 rounded-lg text-[13px]"
          style={{ background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
      </div>

      {error && <p className="text-[12px] text-red-400">{error}</p>}

      <button type="submit" disabled={loading}
        className="py-2 rounded-lg text-[13px] font-semibold transition-colors"
        style={{ background: "var(--accent)", color: "#fff", opacity: loading ? 0.6 : 1 }}>
        {loading ? "新增中…" : "新增"}
      </button>
    </form>
  );
}

// ── 借貸卡片 ──────────────────────────────────────────────────────────────────
interface DebtCardProps {
  debt:      PersonalDebt;
  onSettle:  (id: string) => void;
  onUnsettle:(id: string) => void;
  onDelete:  (id: string) => void;
  onConvert: (debt: PersonalDebt) => void;
}
function DebtCard({ debt, onSettle, onUnsettle, onDelete, onConvert }: DebtCardProps) {
  const settled = !!debt.settledAt;
  const overdue = !settled && debt.dueDate && new Date(debt.dueDate) < new Date();

  return (
    <div className="rounded-xl p-4 flex flex-col gap-2 transition-opacity"
      style={{ background: "var(--bg-card)", border: `1px solid ${settled ? "var(--border)" : overdue ? "#ef4444" : "var(--border)"}`, opacity: settled ? 0.6 : 1 }}>

      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[18px]">{debt.direction === "owed_to_me" ? "💰" : "🙏"}</span>
          <div>
            <p className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>{debt.counterparty}</p>
            {debt.note && <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>{debt.note}</p>}
          </div>
        </div>
        <div className="text-right">
          <p className="text-[16px] font-bold" style={{ color: debt.direction === "owed_to_me" ? "#22c55e" : "#ef4444" }}>
            {fmt(debt.amount)}
          </p>
          {debt.dueDate && (
            <p className="text-[11px]" style={{ color: overdue ? "#ef4444" : "var(--text-muted)" }}>
              {overdue ? "⚠️ 逾期 " : "到期 "}{fmtDate(debt.dueDate)}
            </p>
          )}
        </div>
      </div>

      {settled && (
        <p className="text-[12px]" style={{ color: "#22c55e" }}>✅ 結清於 {fmtDate(debt.settledAt!)}</p>
      )}

      <div className="flex gap-2 pt-1 flex-wrap">
        {!settled && (
          <>
            <button onClick={() => onSettle(debt.id)}
              className="px-3 py-1 rounded-lg text-[12px] font-medium transition-colors"
              style={{ background: "#22c55e20", color: "#22c55e", border: "1px solid #22c55e40" }}>
              ✓ 結清
            </button>
            <button onClick={() => onConvert(debt)}
              className="px-3 py-1 rounded-lg text-[12px] font-medium transition-colors"
              style={{ background: "var(--accent)20", color: "var(--accent)", border: "1px solid var(--accent)40" }}>
              → 轉正式交易
            </button>
          </>
        )}
        {settled && (
          <button onClick={() => onUnsettle(debt.id)}
            className="px-3 py-1 rounded-lg text-[12px] font-medium transition-colors"
            style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}>
            取消結清
          </button>
        )}
        <button onClick={() => onDelete(debt.id)}
          className="px-3 py-1 rounded-lg text-[12px] font-medium ml-auto transition-colors"
          style={{ background: "#ef444420", color: "#ef4444", border: "1px solid #ef444440" }}>
          刪除
        </button>
      </div>
    </div>
  );
}

// ── 主元件 ────────────────────────────────────────────────────────────────────
export default function PersonalDebtManager() {
  const [debts,      setDebts]      = useState<PersonalDebt[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [toast,      setToast]      = useState("");
  const [showSettled, setShowSettled] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/personal-debts");
      if (!res.ok) throw new Error();
      setDebts(await res.json() as PersonalDebt[]);
    } catch {
      setToast("載入失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function handleAdd(debt: PersonalDebt) {
    setDebts(prev => [debt, ...prev]);
  }

  async function handleSettle(id: string) {
    const res = await fetch(`/api/personal-debts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settle: true }),
    });
    if (res.ok) {
      const updated = await res.json() as PersonalDebt;
      setDebts(prev => prev.map(d => d.id === id ? updated : d));
      setToast("已標記結清");
      setTimeout(() => setToast(""), 2500);
    }
  }

  async function handleUnsettle(id: string) {
    const res = await fetch(`/api/personal-debts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unsettle: true }),
    });
    if (res.ok) {
      const updated = await res.json() as PersonalDebt;
      setDebts(prev => prev.map(d => d.id === id ? updated : d));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("確定刪除這筆紀錄？")) return;
    const res = await fetch(`/api/personal-debts/${id}`, { method: "DELETE" });
    if (res.ok) setDebts(prev => prev.filter(d => d.id !== id));
  }

  async function handleConvert(debt: PersonalDebt) {
    if (!confirm(`將「${debt.counterparty} ${fmt(debt.amount)}」轉入正式交易紀錄？`)) return;
    const type     = debt.direction === "owed_to_me" ? "收入" : "支出";
    const category = debt.direction === "owed_to_me" ? "其他" : "其他";
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type, category, amount: debt.amount,
        note: `${debt.counterparty}${debt.note ? " " + debt.note : ""}`,
        date: new Date().toISOString().slice(0, 10),
        source: "manual",
      }),
    });
    if (res.ok) {
      setToast("已新增至交易記錄");
      setTimeout(() => setToast(""), 2500);
      await handleSettle(debt.id);
    }
  }

  const active  = debts.filter(d => !d.settledAt);
  const settled = debts.filter(d =>  d.settledAt);

  const oweMe = active.filter(d => d.direction === "owed_to_me");
  const iOwe  = active.filter(d => d.direction === "i_owe");

  const totalOweMe = oweMe.reduce((s, d) => s + Number(d.amount), 0);
  const totalIOwe  = iOwe.reduce((s, d)  => s + Number(d.amount), 0);

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-5 pb-10">
      {/* 標題 */}
      <div>
        <h2 className="text-[20px] font-bold mb-1" style={{ color: "var(--text-primary)" }}>借貸往來</h2>
        <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>與正式帳務分開記錄，可結清或轉入交易</p>
      </div>

      {/* 摘要卡 */}
      {!loading && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl p-4 text-center" style={{ background: "#22c55e18", border: "1px solid #22c55e40" }}>
            <p className="text-[12px] font-medium mb-1" style={{ color: "#22c55e" }}>別人欠我</p>
            <p className="text-[22px] font-bold" style={{ color: "#22c55e" }}>{fmt(totalOweMe)}</p>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{oweMe.length} 筆</p>
          </div>
          <div className="rounded-xl p-4 text-center" style={{ background: "#ef444418", border: "1px solid #ef444440" }}>
            <p className="text-[12px] font-medium mb-1" style={{ color: "#ef4444" }}>我欠別人</p>
            <p className="text-[22px] font-bold" style={{ color: "#ef4444" }}>{fmt(totalIOwe)}</p>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{iOwe.length} 筆</p>
          </div>
        </div>
      )}

      {/* 新增表單 */}
      <AddForm onAdd={handleAdd} />

      {/* 待結清清單 */}
      {loading ? (
        <p className="text-[14px] text-center py-8" style={{ color: "var(--text-muted)" }}>載入中…</p>
      ) : active.length === 0 ? (
        <p className="text-[13px] text-center py-6" style={{ color: "var(--text-muted)" }}>目前沒有未結清紀錄</p>
      ) : (
        <div className="flex flex-col gap-3">
          {oweMe.length > 0 && (
            <>
              <p className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>別人欠我</p>
              {oweMe.map(d => (
                <DebtCard key={d.id} debt={d}
                  onSettle={handleSettle} onUnsettle={handleUnsettle}
                  onDelete={handleDelete} onConvert={handleConvert} />
              ))}
            </>
          )}
          {iOwe.length > 0 && (
            <>
              <p className="text-[12px] font-semibold uppercase tracking-wide mt-2" style={{ color: "var(--text-muted)" }}>我欠別人</p>
              {iOwe.map(d => (
                <DebtCard key={d.id} debt={d}
                  onSettle={handleSettle} onUnsettle={handleUnsettle}
                  onDelete={handleDelete} onConvert={handleConvert} />
              ))}
            </>
          )}
        </div>
      )}

      {/* 已結清（收合） */}
      {settled.length > 0 && (
        <div>
          <button onClick={() => setShowSettled(s => !s)}
            className="text-[12px] font-medium flex items-center gap-1"
            style={{ color: "var(--text-muted)" }}>
            {showSettled ? "▾" : "▸"} 已結清 ({settled.length} 筆)
          </button>
          {showSettled && (
            <div className="flex flex-col gap-3 mt-3">
              {settled.map(d => (
                <DebtCard key={d.id} debt={d}
                  onSettle={handleSettle} onUnsettle={handleUnsettle}
                  onDelete={handleDelete} onConvert={handleConvert} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl text-[13px] font-medium z-50"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "0 4px 20px rgba(0,0,0,0.4)", color: "var(--text-primary)" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
