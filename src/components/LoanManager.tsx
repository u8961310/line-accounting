"use client";

import { useEffect, useState, useCallback } from "react";

interface LoanPayment {
  id: string;
  paymentDate: string;
  principalPaid: number;
  interestPaid: number;
  totalPaid: number;
  remainingPrincipal: number;
  note: string;
}

interface LoanItem {
  id: string;
  name: string;
  lender: string;
  type: string;
  originalPrincipal: number;
  remainingPrincipal: number;
  interestRate: number;
  paymentDay: number | null;
  endDate: string | null;
  status: string;
  note: string;
  payments: LoanPayment[];
}

interface CreditCardBillItem {
  id: string;
  billingMonth: string;
  totalAmount: number;
  minimumPayment: number | null;
  dueDate: string;
  paidAmount: number;
  paidDate: string | null;
  status: string;
}

interface CreditCardItem {
  id: string;
  name: string;
  bank: string;
  creditLimit: number | null;
  statementDay: number | null;
  dueDay: number | null;
  currentBalance: number;
  bills: CreditCardBillItem[];
}

interface RawLoanPayment {
  id: string;
  paymentDate: string;
  principalPaid: string | number;
  interestPaid: string | number;
  totalPaid: string | number;
  remainingPrincipal: string | number;
  note: string;
}

interface RawLoan {
  id: string;
  name: string;
  lender: string;
  type: string;
  originalPrincipal: string | number;
  remainingPrincipal: string | number;
  interestRate: string | number;
  paymentDay: number | null;
  endDate: string | null;
  status: string;
  note: string;
  payments: RawLoanPayment[];
}

interface RawCreditCardBill {
  id: string;
  billingMonth: string;
  totalAmount: string | number;
  minimumPayment: string | number | null;
  dueDate: string;
  paidAmount: string | number;
  paidDate: string | null;
  status: string;
}

interface RawCreditCard {
  id: string;
  name: string;
  bank: string;
  creditLimit: string | number | null;
  statementDay: number | null;
  dueDay: number | null;
  currentBalance: string | number;
  bills: RawCreditCardBill[];
}

function fmt(n: number) {
  return n.toLocaleString("zh-TW", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmt2(n: number) {
  return n.toLocaleString("zh-TW", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseLoan(raw: RawLoan): LoanItem {
  return {
    ...raw,
    originalPrincipal: parseFloat(String(raw.originalPrincipal)),
    remainingPrincipal: parseFloat(String(raw.remainingPrincipal)),
    interestRate: parseFloat(String(raw.interestRate)),
    payments: raw.payments.map(p => ({
      ...p,
      principalPaid: parseFloat(String(p.principalPaid)),
      interestPaid: parseFloat(String(p.interestPaid)),
      totalPaid: parseFloat(String(p.totalPaid)),
      remainingPrincipal: parseFloat(String(p.remainingPrincipal)),
    })),
  };
}

function parseCreditCard(raw: RawCreditCard): CreditCardItem {
  return {
    ...raw,
    creditLimit: raw.creditLimit != null ? parseFloat(String(raw.creditLimit)) : null,
    currentBalance: parseFloat(String(raw.currentBalance)),
    bills: raw.bills.map(b => ({
      ...b,
      totalAmount: parseFloat(String(b.totalAmount)),
      minimumPayment: b.minimumPayment != null ? parseFloat(String(b.minimumPayment)) : null,
      paidAmount: parseFloat(String(b.paidAmount)),
    })),
  };
}

const inputClass =
  "w-full rounded-xl px-3 py-2 text-sm outline-none"
  + " bg-[var(--bg-input)] border border-[var(--border)] focus:border-[var(--accent)]"
  + " text-[var(--text-primary)] placeholder-[var(--text-muted)]";

const labelClass = "text-[12px] font-medium mb-1 block text-[var(--text-sub)]";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active:   { label: "還款中", color: "#F59E0B" },
  paid_off: { label: "已還清", color: "#10B981" },
};

const BILL_STATUS: Record<string, { label: string; color: string }> = {
  unpaid:  { label: "未繳",   color: "#EF4444" },
  partial: { label: "部分繳", color: "#F59E0B" },
  paid:    { label: "已繳清", color: "#10B981" },
};

// ── Shared modal components (defined outside to prevent remount on every render) ──

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border" style={{ background: "var(--bg-card)", borderColor: "var(--border)", boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}>
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ title, sub, onClose }: { title: string; sub?: string; onClose: () => void }) {
  return (
    <div className="px-6 pt-6 pb-4 flex items-start justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
      <div>
        <p className="text-[17px] font-bold text-[var(--text-primary)]">{title}</p>
        {sub && <p className="text-[12px] mt-0.5" style={{ color: "var(--text-sub)" }}>{sub}</p>}
      </div>
      <button onClick={onClose} className="text-xl leading-none ml-4 hover:opacity-60 transition-opacity" style={{ color: "var(--text-sub)" }}>×</button>
    </div>
  );
}

function ModalFooter({ onCancel, onConfirm, confirmLabel }: { onCancel: () => void; onConfirm: () => void; confirmLabel: string }) {
  return (
    <div className="px-6 pb-6 pt-4 flex gap-3" style={{ borderTop: "1px solid var(--border)" }}>
      <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-[14px] font-semibold" style={{ border: "1px solid var(--border)", color: "var(--text-sub)" }}>取消</button>
      <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl text-[14px] font-bold text-white" style={{ background: "linear-gradient(135deg,#2563EB,#3B82F6)" }}>{confirmLabel}</button>
    </div>
  );
}

export default function LoanManager() {
  const [loans, setLoans] = useState<LoanItem[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCardItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [loanTab, setLoanTab] = useState<"loans" | "cards">("loans");
  const [showAddLoan, setShowAddLoan] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<LoanItem | null>(null);
  const [selectedLoanPayments, setSelectedLoanPayments] = useState<LoanPayment[]>([]);
  const [expandedLoanId, setExpandedLoanId] = useState<string | null>(null);

  const [selectedCardForBill, setSelectedCardForBill] = useState<CreditCardItem | null>(null);
  const [selectedBillForPayment, setSelectedBillForPayment] = useState<{ cardId: string; bill: CreditCardBillItem } | null>(null);

  // Add Loan form
  const [loanForm, setLoanForm] = useState({
    name: "", lender: "", type: "個人信貸",
    originalPrincipal: "", remainingPrincipal: "",
    interestRate: "", paymentDay: "", endDate: "", note: "",
  });

  // Record Payment form
  const [paymentForm, setPaymentForm] = useState({
    paymentDate: new Date().toISOString().split("T")[0],
    totalPaid: "",
    interestPaid: "",
    note: "",
  });

  // Add Card form
  const [cardForm, setCardForm] = useState({
    name: "永豐信用卡", bank: "永豐銀行",
    creditLimit: "", statementDay: "", dueDay: "",
  });

  // Add Bill form
  const [billForm, setBillForm] = useState({
    billingMonth: "", totalAmount: "",
    minimumPayment: "", dueDate: "",
    paidAmount: "0", paidDate: "",
  });

  // Record bill payment form
  const [billPayForm, setBillPayForm] = useState({
    paidAmount: "", paidDate: new Date().toISOString().split("T")[0],
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [lRes, cRes] = await Promise.all([
        fetch("/api/loans"),
        fetch("/api/credit-cards"),
      ]);
      const rawLoans = await lRes.json() as RawLoan[];
      const rawCards = await cRes.json() as RawCreditCard[];
      setLoans(rawLoans.map(parseLoan));
      setCreditCards(rawCards.map(parseCreditCard));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-calc interest when totalPaid changes for payment form
  function handleTotalPaidChange(val: string) {
    const total = parseFloat(val) || 0;
    if (selectedLoan) {
      if (selectedLoan.remainingPrincipal === 0) {
        // 本金清零，全額計為利息
        setPaymentForm(f => ({ ...f, totalPaid: val, interestPaid: val }));
      } else {
        const monthlyInterest = selectedLoan.remainingPrincipal * selectedLoan.interestRate / 100 / 12;
        const interest = Math.min(monthlyInterest, total);
        setPaymentForm(f => ({ ...f, totalPaid: val, interestPaid: fmt2(interest) }));
      }
    } else {
      setPaymentForm(f => ({ ...f, totalPaid: val }));
    }
  }

  function openPaymentModal(loan: LoanItem) {
    const monthlyInterest = loan.remainingPrincipal === 0
      ? 0
      : loan.remainingPrincipal * loan.interestRate / 100 / 12;
    setSelectedLoan(loan);
    setPaymentForm({
      paymentDate: new Date().toISOString().split("T")[0],
      totalPaid: "",
      interestPaid: fmt2(monthlyInterest),
      note: "",
    });
  }

  async function toggleLoanHistory(loanId: string) {
    if (expandedLoanId === loanId) {
      setExpandedLoanId(null);
      return;
    }
    setExpandedLoanId(loanId);
    try {
      const res = await fetch(`/api/loans/${loanId}/payments`);
      const raw = await res.json() as RawLoanPayment[];
      setSelectedLoanPayments(raw.map(p => ({
        ...p,
        principalPaid: parseFloat(String(p.principalPaid)),
        interestPaid: parseFloat(String(p.interestPaid)),
        totalPaid: parseFloat(String(p.totalPaid)),
        remainingPrincipal: parseFloat(String(p.remainingPrincipal)),
      })));
    } catch (e) {
      console.error(e);
    }
  }

  async function handleAddLoan() {
    if (!loanForm.name || !loanForm.lender || !loanForm.originalPrincipal) return;
    try {
      await fetch("/api/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: loanForm.name,
          lender: loanForm.lender,
          type: loanForm.type,
          originalPrincipal: parseFloat(loanForm.originalPrincipal),
          remainingPrincipal: parseFloat(loanForm.remainingPrincipal || loanForm.originalPrincipal),
          interestRate: parseFloat(loanForm.interestRate) || 0,
          paymentDay: loanForm.paymentDay ? parseInt(loanForm.paymentDay) : undefined,
          endDate: loanForm.endDate || undefined,
          note: loanForm.note,
        }),
      });
      setShowAddLoan(false);
      setLoanForm({ name: "", lender: "", type: "個人信貸", originalPrincipal: "", remainingPrincipal: "", interestRate: "", paymentDay: "", endDate: "", note: "" });
      await fetchData();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleRecordPayment() {
    if (!selectedLoan) return;
    // 本金為 0 時可只填利息
    if (!paymentForm.totalPaid && !paymentForm.interestPaid) return;
    try {
      await fetch(`/api/loans/${selectedLoan.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentDate: paymentForm.paymentDate,
          totalPaid: parseFloat(paymentForm.totalPaid) || parseFloat(paymentForm.interestPaid) || 0,
          interestPaid: parseFloat(paymentForm.interestPaid) || 0,
          note: paymentForm.note,
        }),
      });
      setSelectedLoan(null);
      await fetchData();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleDeleteLoan(id: string) {
    if (!confirm("確定要刪除這筆貸款？")) return;
    try {
      await fetch(`/api/loans/${id}`, { method: "DELETE" });
      await fetchData();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleAddCard() {
    if (!cardForm.name || !cardForm.bank) return;
    try {
      await fetch("/api/credit-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cardForm.name,
          bank: cardForm.bank,
          creditLimit: cardForm.creditLimit ? parseFloat(cardForm.creditLimit) : undefined,
          statementDay: cardForm.statementDay ? parseInt(cardForm.statementDay) : undefined,
          dueDay: cardForm.dueDay ? parseInt(cardForm.dueDay) : undefined,
        }),
      });
      setShowAddCard(false);
      setCardForm({ name: "永豐信用卡", bank: "永豐銀行", creditLimit: "", statementDay: "", dueDay: "" });
      await fetchData();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleAddBill() {
    if (!selectedCardForBill || !billForm.billingMonth || !billForm.totalAmount || !billForm.dueDate) return;
    try {
      await fetch(`/api/credit-cards/${selectedCardForBill.id}/bills`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billingMonth: billForm.billingMonth,
          totalAmount: parseFloat(billForm.totalAmount),
          minimumPayment: billForm.minimumPayment ? parseFloat(billForm.minimumPayment) : undefined,
          dueDate: billForm.dueDate,
          paidAmount: parseFloat(billForm.paidAmount) || 0,
          paidDate: billForm.paidDate || undefined,
        }),
      });
      setSelectedCardForBill(null);
      setBillForm({ billingMonth: "", totalAmount: "", minimumPayment: "", dueDate: "", paidAmount: "0", paidDate: "" });
      await fetchData();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleRecordBillPayment() {
    if (!selectedBillForPayment || !billPayForm.paidAmount) return;
    try {
      await fetch(`/api/credit-cards/${selectedBillForPayment.cardId}/bills/${selectedBillForPayment.bill.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paidAmount: parseFloat(billPayForm.paidAmount),
          paidDate: billPayForm.paidDate || null,
        }),
      });
      setSelectedBillForPayment(null);
      setBillPayForm({ paidAmount: "", paidDate: new Date().toISOString().split("T")[0] });
      await fetchData();
    } catch (e) {
      console.error(e);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* ── Inner tab: 貸款 / 信用卡 ── */}
      <div className="flex items-center justify-between">
        <div className="flex rounded-xl overflow-hidden" style={{ background: "var(--bg-input)", border: "1px solid var(--border)" }}>
          {([["loans", "貸款"], ["cards", "信用卡"]] as const).map(([id, label]) => (
            <button key={id} onClick={() => setLoanTab(id)}
              className="px-5 py-2 text-[14px] font-semibold transition-all"
              style={loanTab === id
                ? { background: "var(--btn-gradient)", color: "#fff" }
                : { color: "var(--text-sub)" }}>
              {label}
              <span className="ml-1.5 text-[11px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: loanTab === id ? "rgba(255,255,255,0.2)" : "var(--border-inner)", color: loanTab === id ? "#fff" : "var(--text-sub)" }}>
                {id === "loans" ? loans.length : creditCards.length}
              </span>
            </button>
          ))}
        </div>
        <button
          onClick={() => loanTab === "loans" ? setShowAddLoan(true) : setShowAddCard(true)}
          className="px-4 py-2 rounded-xl text-[13px] font-semibold text-white"
          style={{ background: "var(--btn-gradient)", boxShadow: "0 0 12px rgba(59,130,246,0.3)" }}>
          + 新增{loanTab === "loans" ? "貸款" : "信用卡"}
        </button>
      </div>

      {/* ── Loans list ── */}
      {loanTab === "loans" && (
        loans.length === 0
          ? <div className="rounded-2xl p-10 text-center" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>尚無貸款記錄</p>
            </div>
          : <div className="space-y-3">
              {loans.map(loan => {
                const progress = loan.originalPrincipal > 0 ? loan.remainingPrincipal / loan.originalPrincipal : 0;
                const monthlyInterest = loan.remainingPrincipal * loan.interestRate / 100 / 12;
                const statusInfo = STATUS_LABELS[loan.status] ?? { label: loan.status, color: "#94A3B8" };
                const isExpanded = expandedLoanId === loan.id;
                return (
                  <div key={loan.id} className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>

                    {/* ── Always-visible body ── */}
                    <div className="px-6 pt-5 pb-4">
                      {/* Row 1: name + status + amount */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[19px] font-bold text-[var(--text-primary)]">{loan.name}</span>
                          <span className="text-[12px] font-semibold px-2.5 py-0.5 rounded-full"
                            style={{ color: statusInfo.color, background: statusInfo.color + "20" }}>{statusInfo.label}</span>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-[26px] font-black leading-none" style={{ color: "#F87171" }}>NT$ {fmt(loan.remainingPrincipal)}</p>
                          <p className="text-[12px] mt-1" style={{ color: "var(--text-muted)" }}>原始 NT$ {fmt(loan.originalPrincipal)}</p>
                        </div>
                      </div>

                      {/* Row 2: lender / type / rate */}
                      <div className="flex items-center gap-2 mb-4 flex-wrap">
                        <span className="text-[14px]" style={{ color: "var(--text-sub)" }}>{loan.lender}</span>
                        <span style={{ color: "var(--text-muted)" }}>·</span>
                        <span className="text-[14px]" style={{ color: "var(--text-sub)" }}>{loan.type}</span>
                        {loan.interestRate > 0 && (
                          <span className="text-[12px] font-semibold px-2 py-0.5 rounded"
                            style={{ background: "var(--border-inner)", color: "var(--accent-light)" }}>
                            年利率 {loan.interestRate}%
                          </span>
                        )}
                      </div>

                      {/* Row 3: 3 key info chips — always visible */}
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        <div className="rounded-xl px-3 py-3 text-center" style={{ background: "var(--bg-input)", border: "1px solid var(--border-inner)" }}>
                          <p className="text-[11px] font-medium mb-1.5 tracking-wide" style={{ color: "var(--text-muted)" }}>還款日</p>
                          <p className="text-[15px] font-bold text-[var(--text-primary)]">
                            {loan.paymentDay ? `每月 ${loan.paymentDay} 日` : "—"}
                          </p>
                        </div>
                        <div className="rounded-xl px-3 py-3 text-center" style={{ background: "var(--bg-input)", border: "1px solid var(--border-inner)" }}>
                          <p className="text-[11px] font-medium mb-1.5 tracking-wide" style={{ color: "var(--text-muted)" }}>到期日</p>
                          <p className="text-[15px] font-bold text-[var(--text-primary)]">
                            {loan.endDate ? loan.endDate.slice(0, 10) : "—"}
                          </p>
                        </div>
                        <div className="rounded-xl px-3 py-3 text-center" style={{ background: "var(--bg-input)", border: "1px solid var(--border-inner)" }}>
                          <p className="text-[11px] font-medium mb-1.5 tracking-wide" style={{ color: "var(--text-muted)" }}>月利息估計</p>
                          <p className="text-[15px] font-bold" style={{ color: "#F87171" }}>
                            NT$ {fmt2(monthlyInterest)}
                          </p>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="mb-1">
                        <div className="flex justify-between text-[12px] mb-1.5" style={{ color: "var(--text-muted)" }}>
                          <span>已還 NT$ {fmt(loan.originalPrincipal - loan.remainingPrincipal)}</span>
                          <span>{Math.round((1 - progress) * 100)}%</span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-input)" }}>
                          <div className="h-full rounded-full transition-all"
                            style={{ width: `${Math.min((1 - progress) * 100, 100)}%`, background: "linear-gradient(90deg,#EF4444,#F87171)", boxShadow: "0 0 8px rgba(239,68,68,0.3)" }} />
                        </div>
                      </div>
                    </div>

                    {/* ── Action row + expand toggle ── */}
                    <div className="px-6 py-3 flex items-center gap-2" style={{ borderTop: "1px solid var(--border-inner)" }}>
                      <button onClick={() => openPaymentModal(loan)}
                        className="px-4 py-2 rounded-lg text-[13px] font-semibold text-white transition-opacity hover:opacity-80"
                        style={{ background: "var(--btn-gradient)" }}>記錄還款</button>
                      <button onClick={() => handleDeleteLoan(loan.id)}
                        className="px-4 py-2 rounded-lg text-[13px] font-semibold transition-opacity hover:opacity-80"
                        style={{ border: "1px solid var(--border)", color: "#EF4444" }}>刪除</button>
                      <div className="flex-1" />
                      <button onClick={() => toggleLoanHistory(loan.id)}
                        className="text-[13px] font-semibold px-3 py-2 rounded-lg transition-colors"
                        style={{ color: "var(--text-sub)", background: "var(--bg-input)" }}>
                        {isExpanded ? "▲ 收起還款記錄" : "▼ 還款記錄"}
                      </button>
                    </div>

                    {/* ── Expanded: payment history ── */}
                    {isExpanded && selectedLoanPayments.length > 0 && (
                      <div className="px-5 pb-4 space-y-2" style={{ borderTop: "1px solid var(--border-inner)" }}>
                        <p className="text-[11px] font-bold tracking-widest uppercase pt-3" style={{ color: "var(--accent)" }}>還款記錄</p>
                        {selectedLoanPayments.slice(0, 5).map(p => (
                          <div key={p.id} className="flex items-center justify-between rounded-xl px-4 py-2.5"
                            style={{ background: "var(--bg-input)", border: "1px solid var(--border-inner)" }}>
                            <div>
                              <p className="text-[13px] font-medium text-[var(--text-primary)]">{p.paymentDate.slice(0, 10)}</p>
                              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>本金 {fmt(p.principalPaid)} · 利息 {fmt(p.interestPaid)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[14px] font-bold" style={{ color: "var(--accent-light)" }}>NT$ {fmt(p.totalPaid)}</p>
                              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>餘 {fmt(p.remainingPrincipal)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {isExpanded && selectedLoanPayments.length === 0 && (
                      <p className="px-5 pb-4 pt-3 text-[12px]" style={{ color: "var(--text-muted)" }}>尚無還款記錄</p>
                    )}
                  </div>
                );
              })}
            </div>
      )}

      {/* ── Credit cards list ── */}
      {loanTab === "cards" && (
        creditCards.length === 0
          ? <div className="rounded-2xl p-10 text-center" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>尚無信用卡記錄</p>
            </div>
          : <div className="space-y-3">
              {creditCards.map(card => {
                const isExpanded = expandedLoanId === card.id;
                return (
                  <div key={card.id} className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                    <button className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-white/[0.02] transition-colors"
                      onClick={() => setExpandedLoanId(isExpanded ? null : card.id)}>
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-bold text-[var(--text-primary)] mb-1">{card.name}</p>
                        <div className="flex items-center gap-3 text-[12px]" style={{ color: "var(--text-sub)" }}>
                          <span>{card.bank}</span>
                          {card.creditLimit && <span>額度 NT$ {fmt(card.creditLimit)}</span>}
                          {card.statementDay && <span>帳單日 {card.statementDay}日</span>}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[20px] font-black" style={{ color: "#F59E0B" }}>NT$ {fmt(card.currentBalance)}</p>
                        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>未繳餘額</p>
                      </div>
                      <span className="text-slate-600 text-lg">{isExpanded ? "▲" : "▼"}</span>
                    </button>

                    {isExpanded && (
                      <div className="px-5 pb-4 space-y-3" style={{ borderTop: "1px solid var(--border-inner)" }}>
                        {card.bills.length > 0 && (
                          <div className="space-y-2 pt-3">
                            <p className="text-[11px] font-bold tracking-widest uppercase" style={{ color: "#F59E0B" }}>帳單記錄</p>
                            {card.bills.map(bill => {
                              const bs = BILL_STATUS[bill.status] ?? { label: bill.status, color: "#94A3B8" };
                              const canPay = bill.status === "unpaid" || bill.status === "partial";
                              return (
                                <div key={bill.id} className="rounded-xl px-4 py-3" style={{ background: "var(--bg-input)", border: "1px solid var(--border-inner)" }}>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-[13px] font-semibold text-[var(--text-primary)]">{bill.billingMonth}</span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ color: bs.color, background: bs.color + "20" }}>{bs.label}</span>
                                      <span className="text-[15px] font-bold text-[var(--text-primary)]">NT$ {fmt(bill.totalAmount)}</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                                      截止 {bill.dueDate.slice(0, 10)}{bill.minimumPayment ? ` · 最低 NT$ ${fmt(bill.minimumPayment)}` : ""}
                                    </span>
                                    {bill.paidAmount > 0 && <span className="text-[11px]" style={{ color: "#10B981" }}>已繳 NT$ {fmt(bill.paidAmount)}</span>}
                                  </div>
                                  {canPay && (
                                    <button onClick={() => { setSelectedBillForPayment({ cardId: card.id, bill }); setBillPayForm({ paidAmount: String(bill.totalAmount - bill.paidAmount), paidDate: new Date().toISOString().split("T")[0] }); }}
                                      className="mt-2 text-[12px] font-semibold" style={{ color: "var(--accent)" }}>
                                      記錄繳款 →
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <button onClick={() => { setSelectedCardForBill(card); setBillForm({ billingMonth: "", totalAmount: "", minimumPayment: "", dueDate: "", paidAmount: "0", paidDate: "" }); }}
                          className="px-4 py-2 rounded-xl text-[13px] font-semibold text-white"
                          style={{ background: "linear-gradient(135deg,#78350F,#F59E0B)" }}>
                          記錄帳單
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
      )}

      {/* ── Modals ── */}
      {showAddLoan && (
        <Modal onClose={() => setShowAddLoan(false)}>
          <ModalHeader title="新增貸款" onClose={() => setShowAddLoan(false)} />
          <div className="px-6 py-5 space-y-4">
            {[
              { label: "貸款名稱 *", field: "name", placeholder: "例：玉山個人信貸" },
              { label: "貸款機構 *", field: "lender", placeholder: "例：玉山銀行" },
            ].map(({ label, field, placeholder }) => (
              <div key={field}>
                <label className={labelClass}>{label}</label>
                <input className={inputClass} placeholder={placeholder} value={(loanForm as Record<string, string>)[field]}
                  onChange={e => setLoanForm(f => ({ ...f, [field]: e.target.value }))} />
              </div>
            ))}
            <div>
              <label className={labelClass}>類型</label>
              <select className={inputClass} value={loanForm.type} onChange={e => setLoanForm(f => ({ ...f, type: e.target.value }))}>
                {["個人信貸", "房貸", "車貸", "分期", "民間"].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>原始貸款金額 *</label>
              <input className={inputClass} type="number" placeholder="500000" value={loanForm.originalPrincipal}
                onChange={e => setLoanForm(f => ({ ...f, originalPrincipal: e.target.value }))} />
            </div>
            <div>
              <label className={labelClass}>目前剩餘本金（留空同原始金額）</label>
              <input className={inputClass} type="number" value={loanForm.remainingPrincipal}
                onChange={e => setLoanForm(f => ({ ...f, remainingPrincipal: e.target.value }))} />
            </div>
            <div>
              <label className={labelClass}>年利率 % <span className="text-slate-600">（選填）</span></label>
              <input className={inputClass} type="number" step="0.01" placeholder="9.88" value={loanForm.interestRate}
                onChange={e => setLoanForm(f => ({ ...f, interestRate: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>每月還款日</label>
                <input className={inputClass} type="number" min={1} max={31} placeholder="15" value={loanForm.paymentDay}
                  onChange={e => setLoanForm(f => ({ ...f, paymentDay: e.target.value }))} />
              </div>
              <div>
                <label className={labelClass}>到期日 <span className="text-slate-600">（選填）</span></label>
                <input className={inputClass} type="date" value={loanForm.endDate ?? ""}
                  onChange={e => setLoanForm(f => ({ ...f, endDate: e.target.value || null }))} />
              </div>
            </div>
            <div>
              <label className={labelClass}>備註</label>
              <input className={inputClass} placeholder="選填" value={loanForm.note}
                onChange={e => setLoanForm(f => ({ ...f, note: e.target.value }))} />
            </div>
          </div>
          <ModalFooter onCancel={() => setShowAddLoan(false)} onConfirm={handleAddLoan} confirmLabel="新增貸款" />
        </Modal>
      )}

      {selectedLoan && (
        <Modal onClose={() => setSelectedLoan(null)}>
          <ModalHeader title="記錄還款" sub={selectedLoan.name} onClose={() => setSelectedLoan(null)} />
          <div className="px-6 py-5 space-y-4">
            {selectedLoan.remainingPrincipal === 0 && (
              <div className="rounded-xl px-4 py-3" style={{ background: "#1C0A00", border: "1px solid #92400E" }}>
                <p className="text-[13px]" style={{ color: "#FCD34D" }}>本金已還清，本次還款全額計為利息</p>
              </div>
            )}
            <div>
              <label className={labelClass}>還款日期</label>
              <input className={inputClass} type="date" value={paymentForm.paymentDate}
                onChange={e => setPaymentForm(f => ({ ...f, paymentDate: e.target.value }))} />
            </div>
            {selectedLoan.remainingPrincipal === 0 ? (
              <div>
                <label className={labelClass}>利息金額</label>
                <input className={inputClass} type="number" step="0.01" placeholder="0" value={paymentForm.interestPaid}
                  onChange={e => setPaymentForm(f => ({ ...f, interestPaid: e.target.value, totalPaid: e.target.value }))} />
              </div>
            ) : (
              <>
                <div>
                  <label className={labelClass}>本次總還款</label>
                  <input className={inputClass} type="number" placeholder="0" value={paymentForm.totalPaid}
                    onChange={e => handleTotalPaidChange(e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>其中利息（可調整）</label>
                  <input className={inputClass} type="number" step="0.01" value={paymentForm.interestPaid}
                    onChange={e => setPaymentForm(f => ({ ...f, interestPaid: e.target.value }))} />
                </div>
                <div className="rounded-xl px-4 py-3 flex items-center justify-between" style={{ background: "var(--bg-input)", border: "1px solid var(--border-inner)" }}>
                  <span className="text-[13px]" style={{ color: "var(--text-sub)" }}>其中本金</span>
                  <span className="text-[15px] font-bold text-[var(--text-primary)]">NT$ {fmt2(Math.max(0, (parseFloat(paymentForm.totalPaid) || 0) - (parseFloat(paymentForm.interestPaid) || 0)))}</span>
                </div>
              </>
            )}
            <div>
              <label className={labelClass}>備註</label>
              <input className={inputClass} placeholder="選填" value={paymentForm.note}
                onChange={e => setPaymentForm(f => ({ ...f, note: e.target.value }))} />
            </div>
          </div>
          <ModalFooter onCancel={() => setSelectedLoan(null)} onConfirm={handleRecordPayment} confirmLabel="確認還款" />
        </Modal>
      )}

      {showAddCard && (
        <Modal onClose={() => setShowAddCard(false)}>
          <ModalHeader title="新增信用卡" onClose={() => setShowAddCard(false)} />
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className={labelClass}>卡片名稱 *</label>
              <input className={inputClass} value={cardForm.name} onChange={e => setCardForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className={labelClass}>銀行 *</label>
              <input className={inputClass} value={cardForm.bank} onChange={e => setCardForm(f => ({ ...f, bank: e.target.value }))} />
            </div>
            <div>
              <label className={labelClass}>信用額度 <span className="text-slate-600">（選填）</span></label>
              <input className={inputClass} type="number" placeholder="0" value={cardForm.creditLimit}
                onChange={e => setCardForm(f => ({ ...f, creditLimit: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>帳單日（1–31）</label>
                <input className={inputClass} type="number" min={1} max={31} placeholder="選填" value={cardForm.statementDay}
                  onChange={e => setCardForm(f => ({ ...f, statementDay: e.target.value }))} />
              </div>
              <div>
                <label className={labelClass}>繳款截止日（1–31）</label>
                <input className={inputClass} type="number" min={1} max={31} placeholder="選填" value={cardForm.dueDay}
                  onChange={e => setCardForm(f => ({ ...f, dueDay: e.target.value }))} />
              </div>
            </div>
          </div>
          <ModalFooter onCancel={() => setShowAddCard(false)} onConfirm={handleAddCard} confirmLabel="新增信用卡" />
        </Modal>
      )}

      {selectedCardForBill && (
        <Modal onClose={() => setSelectedCardForBill(null)}>
          <ModalHeader title="記錄帳單" sub={selectedCardForBill.name} onClose={() => setSelectedCardForBill(null)} />
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className={labelClass}>帳單月份 *</label>
              <input className={inputClass} type="month" value={billForm.billingMonth}
                onChange={e => setBillForm(f => ({ ...f, billingMonth: e.target.value }))} />
            </div>
            <div>
              <label className={labelClass}>帳單金額 *</label>
              <input className={inputClass} type="number" placeholder="0" value={billForm.totalAmount}
                onChange={e => setBillForm(f => ({ ...f, totalAmount: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>最低應繳</label>
                <input className={inputClass} type="number" placeholder="選填" value={billForm.minimumPayment}
                  onChange={e => setBillForm(f => ({ ...f, minimumPayment: e.target.value }))} />
              </div>
              <div>
                <label className={labelClass}>繳款截止日 *</label>
                <input className={inputClass} type="date" value={billForm.dueDate}
                  onChange={e => setBillForm(f => ({ ...f, dueDate: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>已繳金額</label>
                <input className={inputClass} type="number" value={billForm.paidAmount}
                  onChange={e => setBillForm(f => ({ ...f, paidAmount: e.target.value }))} />
              </div>
              <div>
                <label className={labelClass}>繳款日期</label>
                <input className={inputClass} type="date" value={billForm.paidDate}
                  onChange={e => setBillForm(f => ({ ...f, paidDate: e.target.value }))} />
              </div>
            </div>
          </div>
          <ModalFooter onCancel={() => setSelectedCardForBill(null)} onConfirm={handleAddBill} confirmLabel="新增帳單" />
        </Modal>
      )}

      {selectedBillForPayment && (
        <Modal onClose={() => setSelectedBillForPayment(null)}>
          <ModalHeader title="記錄繳款" sub={`${selectedBillForPayment.bill.billingMonth} · NT$ ${fmt(selectedBillForPayment.bill.totalAmount)}`} onClose={() => setSelectedBillForPayment(null)} />
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className={labelClass}>繳款金額 *</label>
              <input className={inputClass} type="number" value={billPayForm.paidAmount}
                onChange={e => setBillPayForm(f => ({ ...f, paidAmount: e.target.value }))} />
            </div>
            <div>
              <label className={labelClass}>繳款日期</label>
              <input className={inputClass} type="date" value={billPayForm.paidDate}
                onChange={e => setBillPayForm(f => ({ ...f, paidDate: e.target.value }))} />
            </div>
          </div>
          <ModalFooter onCancel={() => setSelectedBillForPayment(null)} onConfirm={handleRecordBillPayment} confirmLabel="確認繳款" />
        </Modal>
      )}

    </div>
  );
}
