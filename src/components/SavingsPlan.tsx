"use client";

import { useEffect, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

interface GoalItem { id: string; name: string; emoji: string; savedAmount: number; targetAmount: number; linkedSource: string | null }
interface BalanceItem { source: string; balance: number }
interface MonthlySummary { month: string; income: number; expense: number }
interface SummaryData { monthly: MonthlySummary[]; totals: { income: number; expense: number; net: number } }
interface LoanItem {
  status: string; remainingPrincipal: string; interestRate: string; endDate: string | null;
  payments: { principalPaid: string; interestPaid: string }[];
}
interface FixedExpenseItem { amount: number }
interface BudgetItem { amount: number }

// ── Storage keys ──────────────────────────────────────────────────────────

const EF_KEY   = "emergency_fund_plan_v1";
const GRAD_KEY = "grad_school_plan_v1";
const EDU_KEY  = "education_program_plan_v1";

interface EFSettings {
  linkedGoalId: string; targetMonths: number; manualTarget: number;
  initialSavings: number; monthlyContribution: number;
}
interface GradPlan {
  linkedGoalId?: string; tuition?: number; living?: number;
  monthlyStipend?: number; duration?: number; initialSavings?: number;
}
interface EduPlan {
  linkedGoalId?: string; augustAmount?: number; februaryAmount?: number;
  startYear?: number; startMonth?: number; totalPayments?: number; paidCount?: number;
}

const EF_DEFAULT: EFSettings = { linkedGoalId: "", targetMonths: 3, manualTarget: 0, initialSavings: 0, monthlyContribution: 0 };

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (!Number.isFinite(n)) return "0";
  return Math.abs(Math.round(n)).toLocaleString("zh-TW");
}

function getMonthsUntil(year: number, month: number): number {
  const now = new Date();
  return Math.max(0, (year - now.getFullYear()) * 12 + (month - 1 - now.getMonth()));
}

function getNextEduPayment(edu: EduPlan): { label: string; amount: number; monthsAway: number } | null {
  const startYear = edu.startYear ?? new Date().getFullYear();
  const startMonth = edu.startMonth ?? 8;
  const total = edu.totalPayments ?? 4;
  const paid  = edu.paidCount ?? 0;
  if (paid >= total) return null;
  const cursor = new Date(startYear, startMonth - 1, 1);
  for (let i = 0; i < total; i++) {
    const month = cursor.getMonth() + 1;
    const y = cursor.getFullYear();
    const monthsAway = getMonthsUntil(y, month);
    const amount = month === 8 ? (edu.augustAmount ?? 45000) : (edu.februaryAmount ?? 45000);
    if (i >= paid && monthsAway >= 0) return { label: `${y} 年 ${month} 月`, amount, monthsAway };
    cursor.setMonth(cursor.getMonth() + 6);
  }
  return null;
}

function getEduTotalRemaining(edu: EduPlan): number {
  const startYear = edu.startYear ?? new Date().getFullYear();
  const startMonth = edu.startMonth ?? 8;
  const total = edu.totalPayments ?? 4;
  const paid  = edu.paidCount ?? 0;
  const cursor = new Date(startYear, startMonth - 1, 1);
  let sum = 0;
  for (let i = 0; i < total; i++) {
    const month = cursor.getMonth() + 1;
    if (i >= paid) sum += month === 8 ? (edu.augustAmount ?? 45000) : (edu.februaryAmount ?? 45000);
    cursor.setMonth(cursor.getMonth() + 6);
  }
  return sum;
}

function getLoansDuringSchool(loans: LoanItem[], duration: number): number {
  const ENROLL_YM = "2028-09";
  return loans.filter(l => l.status === "active").reduce((s, l) => {
    const payoffDate = l.endDate ? l.endDate.slice(0, 7) : null;
    if (payoffDate && payoffDate < ENROLL_YM) return s;
    const pay = l.payments?.[0];
    const monthly = pay ? Number(pay.principalPaid) + Number(pay.interestPaid) : 0;
    if (!monthly) return s;
    const overlapMonths = payoffDate
      ? (() => { const [py, pm] = payoffDate.split("-").map(Number); return Math.min(duration, (py - 2028) * 12 + (pm - 9)); })()
      : duration;
    return s + monthly * Math.max(0, overlapMonths);
  }, 0);
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-widest mt-1 mb-2"
      style={{ color: "var(--text-muted)" }}>{children}</p>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function SavingsPlan({
  isDemo,
  onNavigate,
}: { isDemo: boolean; onNavigate?: (tab: string) => void }) {

  // ── Data state ──
  const [goals,    setGoals]    = useState<GoalItem[]>([]);
  const [balances, setBalances] = useState<BalanceItem[]>([]);
  const [loans,    setLoans]    = useState<LoanItem[]>([]);
  const [avgMonthlyIncome,   setAvgMonthlyIncome]   = useState(0);
  const [avgMonthlyExpense,  setAvgMonthlyExpense]  = useState(0);
  const [totalFixedExpenses, setTotalFixedExpenses] = useState(0);
  const [totalLoanMonthly,   setTotalLoanMonthly]   = useState(0);
  const [totalBudget,        setTotalBudget]        = useState(0);
  const [loading, setLoading] = useState(true);

  // ── Plans state ──
  const [efSettings, setEfSettings] = useState<EFSettings>(EF_DEFAULT);
  const [efDraft,    setEfDraft]    = useState<EFSettings>(EF_DEFAULT);
  const [efEditMode, setEfEditMode] = useState(false);
  const [grad, setGrad] = useState<GradPlan | null>(null);
  const [edu,  setEdu]  = useState<EduPlan  | null>(null);

  // ── Load localStorage ──
  useEffect(() => {
    try {
      const raw = localStorage.getItem(EF_KEY);
      if (raw) { const s = { ...EF_DEFAULT, ...JSON.parse(raw) }; setEfSettings(s); setEfDraft(s); }
    } catch { /* ignore */ }
    try { setGrad(JSON.parse(localStorage.getItem(GRAD_KEY) ?? "null")); } catch { /* ignore */ }
    try { setEdu( JSON.parse(localStorage.getItem(EDU_KEY)  ?? "null")); } catch { /* ignore */ }
  }, []);

  // ── Fetch API ──
  useEffect(() => {
    if (isDemo) {
      setGoals([
        { id: "g1", name: "研究所基金",   emoji: "🎓", savedAmount: 350000, targetAmount: 900000, linkedSource: "esun_bank" },
        { id: "g2", name: "緊急預備金",   emoji: "🛡️", savedAmount: 80000,  targetAmount: 171000, linkedSource: null },
      ]);
      setBalances([{ source: "esun_bank", balance: 350000 }]);
      setAvgMonthlyIncome(75000); setAvgMonthlyExpense(57000);
      setTotalFixedExpenses(30000); setTotalLoanMonthly(13000); setTotalBudget(15000);
      setLoans([
        { status: "active", remainingPrincipal: "46239",  interestRate: "16",  endDate: "2026-10", payments: [{ principalPaid: "4500",  interestPaid: "616"  }] },
        { status: "active", remainingPrincipal: "300000", interestRate: "4.5", endDate: "2029-06", payments: [{ principalPaid: "7500",  interestPaid: "1125" }] },
      ]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const thisMonth = new Date().toISOString().slice(0, 7);
    Promise.allSettled([
      fetch("/api/goals").then(r => r.json()),
      fetch("/api/balances").then(r => r.json()),
      fetch("/api/summary?months=3").then(r => r.json()),
      fetch("/api/fixed-expenses").then(r => r.json()),
      fetch("/api/loans").then(r => r.json()),
      fetch(`/api/budgets?month=${thisMonth}`).then(r => r.json()),
    ]).then(([goalsRes, balancesRes, sumRes, fixedRes, loansRes, budgetsRes]) => {
      const goalsData: GoalItem[]   = goalsRes.status   === "fulfilled" && Array.isArray(goalsRes.value)   ? goalsRes.value   : [];
      const balancesData: BalanceItem[] = balancesRes.status === "fulfilled" && Array.isArray(balancesRes.value) ? balancesRes.value : [];
      const loansData: LoanItem[]   = loansRes.status   === "fulfilled" && Array.isArray(loansRes.value)   ? loansRes.value   : [];
      const sumData: SummaryData | null = sumRes.status === "fulfilled" && sumRes.value && "monthly" in sumRes.value ? sumRes.value as SummaryData : null;
      const fixedRaw   = fixedRes.status   === "fulfilled" && fixedRes.value   && typeof fixedRes.value   === "object" ? fixedRes.value   : {};
      const budgetsRaw = budgetsRes.status === "fulfilled" && budgetsRes.value && typeof budgetsRes.value === "object" ? budgetsRes.value : {};
      const fixedData: FixedExpenseItem[] = Array.isArray((fixedRaw   as { fixedExpenses?: unknown }).fixedExpenses) ? (fixedRaw   as { fixedExpenses: FixedExpenseItem[] }).fixedExpenses : [];
      const budgetsData: BudgetItem[]     = Array.isArray((budgetsRaw as { budgets?:       unknown }).budgets)       ? (budgetsRaw as { budgets:       BudgetItem[]     }).budgets       : [];

      setGoals(goalsData); setBalances(balancesData); setLoans(loansData);
      const recent = (sumData?.monthly ?? []).slice(-3);
      if (recent.length > 0) {
        setAvgMonthlyIncome( recent.reduce((s, m) => s + (Number(m.income)  || 0), 0) / recent.length);
        setAvgMonthlyExpense(recent.reduce((s, m) => s + (Number(m.expense) || 0), 0) / recent.length);
      }
      setTotalFixedExpenses(fixedData.reduce((s, f) => s + f.amount, 0));
      setTotalLoanMonthly(loansData.filter(l => l.status === "active").reduce((s, l) => {
        const pay = l.payments?.[0];
        return pay ? s + Number(pay.principalPaid) + Number(pay.interestPaid)
                   : s + Number(l.remainingPrincipal) * (Number(l.interestRate) / 100 / 12);
      }, 0));
      setTotalBudget(budgetsData.reduce((s, b) => s + b.amount, 0));
    }).catch(e => console.error("[SavingsPlan]", e)).finally(() => setLoading(false));
  }, [isDemo]);

  function saveEfSettings() {
    setEfSettings(efDraft);
    localStorage.setItem(EF_KEY, JSON.stringify(efDraft));
    setEfEditMode(false);
  }

  // ── Computed: 每月可存 ──────────────────────────────────────────────────

  const monthlyCanSave = avgMonthlyIncome - totalFixedExpenses - totalLoanMonthly - totalBudget;

  // ── Computed: 緊急預備金 ────────────────────────────────────────────────

  const efGoal = efSettings.linkedGoalId ? goals.find(g => g.id === efSettings.linkedGoalId) : null;
  const efSavings = (() => {
    if (efGoal?.linkedSource) {
      const bank = balances.find(b => b.source === efGoal!.linkedSource);
      return bank ? bank.balance : (efGoal?.savedAmount ?? 0);
    }
    return efGoal?.savedAmount ?? efSettings.initialSavings;
  })();
  const efTarget = efSettings.manualTarget > 0 ? efSettings.manualTarget : efSettings.targetMonths * avgMonthlyExpense;
  const efCoverageMonths = avgMonthlyExpense > 0 ? efSavings / avgMonthlyExpense : 0;
  const efGap = Math.max(0, efTarget - efSavings);
  const efPct = efTarget > 0 ? Math.min(100, (efSavings / efTarget) * 100) : 0;
  const efMonthlyNeed = efGap > 0 && monthlyCanSave > 0 ? Math.min(efGap, monthlyCanSave * 0.3) : 0; // 最多佔 30% 月可存
  const efColor =
    efCoverageMonths >= efSettings.targetMonths ? "#10B981" :
    efCoverageMonths >= 2 ? "#34D399" :
    efCoverageMonths >= 1 ? "#F59E0B" : "#EF4444";
  const efLabel =
    efCoverageMonths >= efSettings.targetMonths ? "目標達成" :
    efCoverageMonths >= 2 ? "接近目標" :
    efCoverageMonths >= 1 ? "警戒" : "危險";

  // ── Computed: 教育學程 ────────────────────────────────────────────────────

  const nextEdu = edu ? getNextEduPayment(edu) : null;
  const eduMonthsAway    = nextEdu?.monthsAway ?? 0;
  const eduNextAmount    = nextEdu?.amount ?? 0;
  const eduTotalRemaining = edu ? getEduTotalRemaining(edu) : 0;

  // 共用帳戶（以研究所連結帳戶為準）
  const gradGoal = grad?.linkedGoalId ? goals.find(g => g.id === grad!.linkedGoalId) : null;
  const sharedSavings = (() => {
    if (gradGoal?.linkedSource) {
      const bank = balances.find(b => b.source === gradGoal!.linkedSource);
      return bank ? bank.balance : (gradGoal?.savedAmount ?? 0);
    }
    return gradGoal?.savedAmount ?? (grad?.initialSavings ?? 0);
  })();

  const eduMonthlyReserve = eduMonthsAway > 0
    ? Math.max(0, eduNextAmount - sharedSavings) / eduMonthsAway : 0;

  // ── Computed: 研究所 ──────────────────────────────────────────────────────

  const ENROLL_YEAR = 2028; const ENROLL_MONTH = 9;
  const gradMonthsLeft = getMonthsUntil(ENROLL_YEAR, ENROLL_MONTH);
  const gradDuration   = grad?.duration ?? 24;
  const netLiving      = Math.max(0, (grad?.living ?? 0) - (grad?.monthlyStipend ?? 0));
  const loansDuringSchool = getLoansDuringSchool(loans, gradDuration);
  const gradTotalTarget = (grad?.tuition ?? 0) + netLiving * gradDuration + loansDuringSchool;
  const gradGap = Math.max(0, gradTotalTarget - sharedSavings);
  const gradMonthlyNeed = gradMonthsLeft > 0 ? gradGap / gradMonthsLeft : 0;

  // ── Computed: 合計 & 分配 ────────────────────────────────────────────────

  const combinedLearningTarget = eduTotalRemaining + gradTotalTarget;
  const combinedLearningGap    = Math.max(0, combinedLearningTarget - sharedSavings);
  const monthsToLearningFull   = monthlyCanSave > 0 && combinedLearningGap > 0
    ? Math.ceil(combinedLearningGap / monthlyCanSave) : null;

  // 分配：緊急預備金 → 教育 → 研究所 → 其他
  const allocationEF   = efGap > 0 ? efMonthlyNeed : 0;
  const allocationEdu  = Math.min(eduMonthlyReserve, Math.max(0, monthlyCanSave - allocationEF));
  const allocationGrad = Math.min(gradMonthlyNeed,   Math.max(0, monthlyCanSave - allocationEF - allocationEdu));
  const allocationRest = Math.max(0, monthlyCanSave  - allocationEF - allocationEdu - allocationGrad);
  const totalAllocated = allocationEF + allocationEdu + allocationGrad;
  const canCoverAll    = monthlyCanSave >= totalAllocated && monthlyCanSave > 0;

  const feasibilityItems = [
    {
      ok: monthlyCanSave > 0,
      icon: monthlyCanSave > 0 ? "✅" : "❌",
      label: "每月結餘為正",
      desc: monthlyCanSave > 0
        ? `扣除固定支出、貸款、預算後每月可動用 NT$ ${fmt(monthlyCanSave)}`
        : "目前月支出已超過收入，請先調整固定支出或預算",
    },
    {
      ok: efCoverageMonths >= efSettings.targetMonths,
      icon: efCoverageMonths >= efSettings.targetMonths ? "✅" : efCoverageMonths >= 1 ? "⚠️" : "🚨",
      label: `緊急預備金（${efSettings.targetMonths} 個月目標）`,
      desc: efCoverageMonths >= efSettings.targetMonths
        ? `已達成 ${efSettings.targetMonths} 個月覆蓋 NT$ ${fmt(efTarget)}`
        : `目前 ${efCoverageMonths.toFixed(1)} 個月，尚差 NT$ ${fmt(efGap)}，建議每月提撥 NT$ ${fmt(allocationEF)}`,
    },
    {
      ok: !nextEdu || sharedSavings >= eduNextAmount || eduMonthlyReserve <= monthlyCanSave,
      icon: !nextEdu || sharedSavings >= eduNextAmount ? "✅" : eduMonthlyReserve <= monthlyCanSave ? "📚" : "⚠️",
      label: `教育學程下一筆（${nextEdu?.label ?? "無"}）`,
      desc: !nextEdu
        ? "所有學費已繳清"
        : sharedSavings >= eduNextAmount
          ? `帳戶已有 NT$ ${fmt(sharedSavings)}，足以支付 NT$ ${fmt(eduNextAmount)}`
          : `尚缺 NT$ ${fmt(Math.max(0, eduNextAmount - sharedSavings))}，每月預留 NT$ ${fmt(Math.ceil(eduMonthlyReserve))}`,
    },
    {
      ok: canCoverAll,
      icon: canCoverAll ? "✅" : "⚠️",
      label: "同時支援三個目標",
      desc: canCoverAll
        ? `月可存 NT$ ${fmt(monthlyCanSave)} 足以分配三個目標，每月尚餘 NT$ ${fmt(allocationRest)}`
        : `同時支援所有目標需 NT$ ${fmt(totalAllocated)}/月，超出可存 NT$ ${fmt(Math.abs(monthlyCanSave - totalAllocated))}`,
    },
    {
      ok: !(!canCoverAll && gradMonthsLeft <= 30),
      icon: gradMonthsLeft > 30 ? "✅" : canCoverAll ? "✅" : "⚠️",
      label: "研究所入學前存足",
      desc: canCoverAll
        ? `按每月 NT$ ${fmt(gradMonthlyNeed)} 存入，可在入學前備好 NT$ ${fmt(gradTotalTarget)}`
        : `若優先保教育繳費，研究所每月只剩 NT$ ${fmt(Math.max(0, monthlyCanSave - allocationEF - allocationEdu))}，${
            monthlyCanSave - allocationEF - allocationEdu >= gradMonthlyNeed ? "仍可達標" : "需尋找額外收入"}`,
    },
  ];

  const inputCls = "w-full rounded-xl px-4 py-2.5 text-[14px] outline-none"
    + " bg-[var(--bg-input)] border border-[var(--border-inner)] text-[var(--text-primary)]"
    + " focus:border-[var(--accent-light)] transition-colors";
  const labelCls = "text-[13px] font-semibold text-[var(--text-sub)]";
  const selectCls = inputCls + " [&>option]:bg-[#1e293b] [&>option]:text-white";

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 rounded-full animate-spin"
        style={{ borderColor: "var(--accent-light)", borderTopColor: "transparent" }} />
    </div>
  );

  return (
    <div className="space-y-5 max-w-3xl mx-auto">

      {/* ── Header ── */}
      <div>
        <h2 className="text-[22px] font-black" style={{ color: "var(--text-primary)" }}>💰 儲蓄規劃</h2>
        <p className="text-[13px] mt-0.5" style={{ color: "var(--text-muted)" }}>
          緊急預備金 · 教育學程 · 研究所，一次掌握每月儲蓄分配
        </p>
      </div>

      {/* ── 每月可存 Hero ── */}
      <div className="rounded-2xl p-5"
        style={{ background: "var(--bg-card)", border: "1px solid rgba(99,102,241,0.3)", boxShadow: "0 0 24px rgba(99,102,241,0.06)" }}>
        <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
          每月可存（自動試算）
        </p>
        <div className="space-y-1.5 mb-3">
          {[
            { label: "平均月收入（近 3 個月）", v: avgMonthlyIncome,   sign: "+", color: "#34D399" },
            { label: "固定支出",               v: totalFixedExpenses, sign: "−", color: "#F87171" },
            { label: "貸款月付",               v: totalLoanMonthly,   sign: "−", color: "#F87171" },
            { label: "月預算上限",             v: totalBudget,        sign: "−", color: "#F87171" },
          ].map(({ label, v, sign, color }) => (
            <div key={label} className="flex items-center justify-between text-[13px]">
              <span style={{ color: "var(--text-sub)" }}>{sign} {label}</span>
              <span className="tabular-nums font-semibold" style={{ color }}>NT$ {fmt(v)}</span>
            </div>
          ))}
          <div className="border-t pt-2 flex items-center justify-between" style={{ borderColor: "var(--border-inner)" }}>
            <span className="text-[15px] font-bold" style={{ color: "var(--text-primary)" }}>= 每月可存</span>
            <span className="text-[28px] font-black tabular-nums"
              style={{ color: monthlyCanSave > 0 ? "#818CF8" : "#EF4444" }}>
              NT$ {fmt(Math.max(0, monthlyCanSave))}
            </span>
          </div>
        </div>
      </div>

      {/* ── 三目標狀態 Grid ── */}
      <SectionLabel>各目標現況</SectionLabel>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">

        {/* 緊急預備金 */}
        <div className="rounded-2xl p-4 relative overflow-hidden"
          style={{ background: "var(--bg-card)", border: `1px solid ${efColor}30` }}>
          <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
            style={{ background: `linear-gradient(90deg, ${efColor}, ${efColor}80)` }} />
          <div className="flex items-center justify-between mb-2">
            <p className="text-[14px] font-bold" style={{ color: "var(--text-primary)" }}>🛡️ 緊急預備金</p>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: `${efColor}20`, color: efColor }}>{efLabel}</span>
          </div>
          <p className="text-[22px] font-black tabular-nums" style={{ color: efColor }}>
            {efCoverageMonths.toFixed(1)} 個月
          </p>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            目標 {efSettings.targetMonths} 個月 · NT$ {fmt(efSavings)} / {fmt(efTarget)}
          </p>
          <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div className="h-full rounded-full" style={{ width: `${efPct}%`, background: efColor }} />
          </div>
          {efGap > 0 && (
            <p className="text-[11px] mt-1.5" style={{ color: "var(--text-muted)" }}>
              尚差 NT$ {fmt(efGap)}
            </p>
          )}
          <button
            onClick={() => setEfEditMode(v => !v)}
            className="mt-3 text-[12px] px-3 py-1 rounded-lg w-full transition-opacity hover:opacity-70"
            style={{ background: "var(--bg-input)", color: "var(--text-muted)", border: "1px solid var(--border-inner)" }}>
            {efEditMode ? "取消設定" : "⚙ 設定目標"}
          </button>
        </div>

        {/* 教育學程 */}
        <div className="rounded-2xl p-4 relative overflow-hidden"
          style={{ background: "var(--bg-card)", border: "1px solid rgba(245,158,11,0.25)" }}>
          <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
            style={{ background: "linear-gradient(90deg,#F59E0B,#FCD34D)" }} />
          <div className="flex items-center justify-between mb-2">
            <p className="text-[14px] font-bold" style={{ color: "var(--text-primary)" }}>📚 教育學程</p>
            {nextEdu ? (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: "rgba(245,158,11,0.15)", color: "#FCD34D" }}>
                {nextEdu.monthsAway <= 3 ? "即將繳費" : "進行中"}
              </span>
            ) : (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: "rgba(16,185,129,0.15)", color: "#10B981" }}>已繳清</span>
            )}
          </div>
          {nextEdu ? (
            <>
              <p className="text-[22px] font-black tabular-nums" style={{ color: "#F59E0B" }}>
                NT$ {fmt(nextEdu.amount)}
              </p>
              <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                {nextEdu.label} · 還有 {nextEdu.monthsAway} 個月
              </p>
            </>
          ) : (
            <p className="text-[20px] font-black" style={{ color: "#10B981" }}>🎉 全數繳清</p>
          )}
          <p className="text-[12px] mt-2" style={{ color: "var(--text-muted)" }}>
            剩餘學費合計 NT$ {fmt(eduTotalRemaining)}
          </p>
          <button onClick={() => onNavigate?.("education-program")}
            className="mt-3 text-[12px] px-3 py-1 rounded-lg w-full transition-opacity hover:opacity-70"
            style={{ background: "var(--bg-input)", color: "var(--text-muted)", border: "1px solid var(--border-inner)" }}>
            查看詳情 →
          </button>
        </div>

        {/* 研究所 */}
        <div className="rounded-2xl p-4 relative overflow-hidden"
          style={{ background: "var(--bg-card)", border: "1px solid rgba(99,102,241,0.25)" }}>
          <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
            style={{ background: "linear-gradient(90deg,#6366F1,#8B5CF6)" }} />
          <div className="flex items-center justify-between mb-2">
            <p className="text-[14px] font-bold" style={{ color: "var(--text-primary)" }}>🎓 研究所</p>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: "rgba(99,102,241,0.15)", color: "#818CF8" }}>
              {gradMonthsLeft} 個月後入學
            </span>
          </div>
          <p className="text-[22px] font-black tabular-nums" style={{ color: gradGap > 0 ? "#818CF8" : "#10B981" }}>
            {gradGap > 0 ? `差 NT$ ${fmt(gradGap)}` : "✅ 已足夠"}
          </p>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            目標 NT$ {fmt(gradTotalTarget)} · 已存 NT$ {fmt(sharedSavings)}
          </p>
          <p className="text-[12px] mt-2" style={{ color: "var(--text-muted)" }}>
            每月需存 NT$ {fmt(gradMonthlyNeed)}
          </p>
          <button onClick={() => onNavigate?.("grad-school")}
            className="mt-3 text-[12px] px-3 py-1 rounded-lg w-full transition-opacity hover:opacity-70"
            style={{ background: "var(--bg-input)", color: "var(--text-muted)", border: "1px solid var(--border-inner)" }}>
            查看詳情 →
          </button>
        </div>
      </div>

      {/* ── 緊急預備金 設定展開 ── */}
      {efEditMode && (
        <div className="rounded-2xl p-5 space-y-4"
          style={{ background: "var(--bg-card)", border: "1px solid rgba(16,185,129,0.25)" }}>
          <p className="text-[14px] font-bold" style={{ color: "#34D399" }}>🛡️ 緊急預備金設定</p>

          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>連結財務目標</label>
            <select className={selectCls} value={efDraft.linkedGoalId}
              onChange={e => setEfDraft(d => ({ ...d, linkedGoalId: e.target.value }))}>
              <option value="">（不連結，手動輸入）</option>
              {goals.map(g => <option key={g.id} value={g.id}>{g.emoji} {g.name}</option>)}
            </select>
          </div>

          {!efDraft.linkedGoalId && (
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>目前已存金額（手動）</label>
              <input type="number" className={inputCls} min={0}
                value={efDraft.initialSavings || ""}
                onChange={e => setEfDraft(d => ({ ...d, initialSavings: Number(e.target.value) }))}
                placeholder="0" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>目標覆蓋月數</label>
              <select className={selectCls} value={efDraft.targetMonths}
                onChange={e => setEfDraft(d => ({ ...d, targetMonths: Number(e.target.value) }))}>
                {[1, 2, 3, 6, 12].map(m => <option key={m} value={m}>{m} 個月</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>手動目標金額（0 = 自動）</label>
              <input type="number" className={inputCls} min={0}
                value={efDraft.manualTarget || ""}
                onChange={e => setEfDraft(d => ({ ...d, manualTarget: Number(e.target.value) }))}
                placeholder="自動依支出計算" />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={() => setEfEditMode(false)}
              className="flex-1 py-2 rounded-xl text-[13px]"
              style={{ background: "var(--bg-input)", color: "var(--text-muted)", border: "1px solid var(--border-inner)" }}>
              取消
            </button>
            <button onClick={saveEfSettings}
              className="flex-1 py-2 rounded-xl text-[13px] font-semibold text-white"
              style={{ background: "var(--btn-gradient)" }}>
              儲存
            </button>
          </div>
        </div>
      )}

      {/* ── 每月儲蓄分配 ── */}
      <SectionLabel>每月儲蓄分配建議</SectionLabel>
      <div className="rounded-2xl p-5"
        style={{ background: "var(--bg-card)", border: `1px solid ${canCoverAll ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)"}` }}>

        {/* 流向明細 */}
        <div className="space-y-2 mb-4">
          {[
            { label: "每月可存",                                 value: monthlyCanSave,    color: "#34D399", sign: "" },
            { label: `① 緊急預備金${efGap === 0 ? "（已達標）" : ""}`,          value: -allocationEF,    color: "#10B981",  sign: "−" },
            { label: `② 教育學程（距下筆 ${eduMonthsAway} 個月）`, value: -allocationEdu,   color: "#F59E0B",  sign: "−" },
            { label: `③ 研究所（距入學 ${gradMonthsLeft} 個月）`,  value: -allocationGrad,  color: "#818CF8",  sign: "−" },
          ].map((row, i) => (
            <div key={i} className="flex items-center justify-between text-[13px]">
              <span style={{ color: "var(--text-sub)" }}>{row.label}</span>
              <span className="font-bold tabular-nums" style={{ color: row.color }}>
                {row.sign} NT$ {fmt(Math.abs(row.value))}
              </span>
            </div>
          ))}
          <div className="border-t pt-2" style={{ borderColor: "var(--border-inner)" }}>
            <div className="flex items-center justify-between text-[14px] font-bold">
              <span style={{ color: "var(--text-primary)" }}>每月剩餘（自由運用）</span>
              <span style={{ color: allocationRest >= 0 ? "#10B981" : "#EF4444" }}>
                NT$ {fmt(allocationRest)}
              </span>
            </div>
          </div>
        </div>

        {/* 比例視覺化 */}
        {monthlyCanSave > 0 && (
          <div className="mt-2">
            <p className="text-[11px] mb-1.5" style={{ color: "var(--text-muted)" }}>月儲蓄分配比例</p>
            <div className="flex h-5 rounded-full overflow-hidden gap-0.5">
              {[
                { value: allocationEF,   color: "#10B981", label: "緊急預備金" },
                { value: allocationEdu,  color: "#F59E0B", label: "教育學程" },
                { value: allocationGrad, color: "#6366F1", label: "研究所" },
                { value: allocationRest, color: "rgba(255,255,255,0.08)", label: "剩餘" },
              ].map((seg, i) => {
                const pct = (seg.value / Math.max(1, monthlyCanSave)) * 100;
                if (pct < 0.5) return null;
                return (
                  <div key={i} className="h-full rounded-sm"
                    style={{ width: `${Math.min(100, pct)}%`, background: seg.color }} />
                );
              })}
              {!canCoverAll && (
                <div className="h-full rounded-sm flex-shrink-0"
                  style={{ width: "8%", background: "#EF4444" }} />
              )}
            </div>
            <div className="flex gap-4 mt-2 flex-wrap">
              {[
                { color: "#10B981", label: `緊急 NT$ ${fmt(allocationEF)}/月` },
                { color: "#F59E0B", label: `教育 NT$ ${fmt(allocationEdu)}/月` },
                { color: "#6366F1", label: `研究所 NT$ ${fmt(allocationGrad)}/月` },
              ].filter(s => s.label.indexOf("NT$ 0") === -1).map(s => (
                <div key={s.label} className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: s.color }} />
                  {s.label}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── 優先順序 ── */}
      <SectionLabel>建議優先順序</SectionLabel>
      <div className="space-y-2">
        {[
          {
            rank: 1, icon: "🛡️", plan: "緊急預備金", color: "#10B981",
            urgent: efCoverageMonths < 1,
            reason: efCoverageMonths >= efSettings.targetMonths
              ? `已達 ${efSettings.targetMonths} 個月覆蓋，不需額外投入`
              : `目前 ${efCoverageMonths.toFixed(1)} 個月，建議每月提撥 NT$ ${fmt(allocationEF)} 優先補足到 ${efSettings.targetMonths} 個月`,
            monthlyReserve: allocationEF,
          },
          {
            rank: 2, icon: "📚", plan: "教育學程", color: "#F59E0B",
            urgent: eduMonthsAway <= 4,
            reason: nextEdu
              ? `${nextEdu.label}（${eduMonthsAway} 個月後）需繳 NT$ ${fmt(eduNextAmount)}。就學期間仍有薪資收入，繳費後可從薪資補回`
              : "所有學費已繳清，無需預留",
            monthlyReserve: allocationEdu,
          },
          {
            rank: 3, icon: "🎓", plan: "研究所規劃", color: "#818CF8",
            urgent: gradMonthsLeft <= 12,
            reason: `2028/09 入學，還有 ${gradMonthsLeft} 個月。公費生免學費、直接分發公立學校。入學後無薪資收入，入學前是唯一儲蓄窗口`,
            monthlyReserve: allocationGrad,
          },
        ].map(p => (
          <div key={p.rank} className="flex items-start gap-4 rounded-2xl px-5 py-4"
            style={{ background: "var(--bg-card)", border: `1px solid ${p.color}20` }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-black text-[15px]"
              style={{ background: p.color, color: "#000" }}>{p.rank}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[15px] font-bold" style={{ color: p.color }}>{p.icon} {p.plan}</span>
                {p.urgent && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: "#EF444420", color: "#EF4444" }}>緊急</span>
                )}
                <span className="text-[12px] ml-auto tabular-nums" style={{ color: "var(--text-muted)" }}>
                  每月 NT$ {fmt(p.monthlyReserve)}
                </span>
              </div>
              <p className="text-[12px] mt-1" style={{ color: "var(--text-muted)" }}>{p.reason}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── 學習規劃合計 ── */}
      <SectionLabel>學習目標總覽</SectionLabel>
      <div className="rounded-2xl p-5"
        style={{ background: "var(--bg-card)", border: `1px solid ${combinedLearningGap === 0 ? "rgba(16,185,129,0.3)" : "rgba(99,102,241,0.3)"}` }}>
        <div className="space-y-2 mb-3">
          {edu && (
            <div className="flex items-center justify-between text-[13px]">
              <span style={{ color: "var(--text-muted)" }}>📚 教育學程（剩餘）</span>
              <span className="font-bold tabular-nums" style={{ color: "#F59E0B" }}>NT$ {fmt(eduTotalRemaining)}</span>
            </div>
          )}
          {grad && (
            <div className="flex items-center justify-between text-[13px]">
              <span style={{ color: "var(--text-muted)" }}>🎓 研究所規劃</span>
              <span className="font-bold tabular-nums" style={{ color: "#818CF8" }}>NT$ {fmt(gradTotalTarget)}</span>
            </div>
          )}
          <div className="border-t pt-2 flex items-center justify-between text-[14px] font-bold"
            style={{ borderColor: "var(--border-inner)" }}>
            <span style={{ color: "var(--text-primary)" }}>合計需存</span>
            <span style={{ color: "var(--text-primary)" }}>NT$ {fmt(combinedLearningTarget)}</span>
          </div>
          <div className="flex items-center justify-between text-[13px]">
            <span style={{ color: "var(--text-muted)" }}>已存（共用帳戶）</span>
            <span className="font-semibold tabular-nums" style={{ color: "#34D399" }}>− NT$ {fmt(sharedSavings)}</span>
          </div>
          <div className="border-t pt-2 flex items-center justify-between text-[15px] font-bold"
            style={{ borderColor: "var(--border-inner)" }}>
            <span style={{ color: "var(--text-primary)" }}>實際缺口</span>
            <span style={{ color: combinedLearningGap === 0 ? "#10B981" : "#F87171" }}>
              {combinedLearningGap === 0 ? "✅ 已足夠" : `NT$ ${fmt(combinedLearningGap)}`}
            </span>
          </div>
        </div>
        {combinedLearningGap > 0 && monthsToLearningFull && (
          <div className="rounded-xl px-4 py-2.5 mt-1"
            style={{ background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.18)" }}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                以每月可存 NT$ {fmt(monthlyCanSave)} 計算
              </p>
              <div className="text-right">
                <p className="text-[18px] font-black tabular-nums"
                  style={{ color: monthsToLearningFull <= gradMonthsLeft ? "#34D399" : "#F59E0B" }}>
                  {monthsToLearningFull} 個月後存滿
                </p>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {monthsToLearningFull <= gradMonthsLeft
                    ? `入學前 ${gradMonthsLeft - monthsToLearningFull} 個月達標 ✅`
                    : `超出入學時間 ${monthsToLearningFull - gradMonthsLeft} 個月 ⚠️`}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 可行性分析 ── */}
      <SectionLabel>可行性分析</SectionLabel>
      <div className="rounded-2xl p-5 space-y-3"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-card)" }}>
        {feasibilityItems.map(item => (
          <div key={item.label} className="flex items-start gap-3">
            <span className="text-[18px] mt-0.5 flex-shrink-0">{item.icon}</span>
            <div>
              <p className="text-[14px] font-semibold" style={{ color: item.ok ? "#34D399" : "var(--text-primary)" }}>
                {item.label}
              </p>
              <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
