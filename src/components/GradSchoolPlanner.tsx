"use client";

import { useEffect, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

interface SummaryData { totals: { income: number; expense: number; net: number } }
interface GoalItem { id: string; name: string; emoji: string; savedAmount: number; targetAmount: number; linkedSource: string | null }
interface LoanItem {
  id: string; name: string; lender: string; status: string;
  remainingPrincipal: string; interestRate: string; endDate: string | null;
  payments: { principalPaid: string }[];
}
interface CreditCardItem {
  id: string; name: string; issuer: string; status: string;
  bills: { id: string; isPaid: boolean; totalAmount: string; dueDate: string | null; statementDate: string | null }[];
}
interface BalanceItem { source: string; balance: number }

// ── Constants ──────────────────────────────────────────────────────────────

const ENROLLMENT_DATE = new Date(2028, 8, 1); // 2028-09-01
const STORAGE_KEY = "grad_school_plan_v1";

interface PlanSettings {
  targetAmount: number;
  tuition: number;
  living: number;
  duration: number;
  monthlyStipend: number;  // 每月公費零用金（就學期間收入）
  linkedGoalId: string;
  initialSavings: number;  // 手動輸入已存金額（無連結目標時使用）
  reserveMonths: number;
  notes: string;
}

const DEFAULT_SETTINGS: PlanSettings = {
  targetAmount: 0,
  tuition: 300000,
  living: 25000,
  duration: 24,
  monthlyStipend: 0,
  linkedGoalId: "",
  initialSavings: 0,
  reserveMonths: 3,
  notes: "",
};

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return Math.abs(Math.round(n)).toLocaleString("zh-TW");
}

function getMonthsUntilEnrollment(): number {
  const now = new Date();
  return Math.max(0,
    (ENROLLMENT_DATE.getFullYear() - now.getFullYear()) * 12
    + (ENROLLMENT_DATE.getMonth() - now.getMonth())
  );
}

function getDaysUntilEnrollment(): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((ENROLLMENT_DATE.getTime() - now.getTime()) / 86400000));
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color = "var(--accent-light)", accent = false }:
  { label: string; value: string; sub?: string; color?: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl px-5 py-4 flex flex-col gap-1"
      style={{
        background: accent ? `${color}18` : "var(--bg-input)",
        border: `1px solid ${accent ? color + "40" : "var(--border-inner)"}`,
      }}>
      <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="text-[22px] font-black tabular-nums leading-tight" style={{ color }}>{value}</p>
      {sub && <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>{sub}</p>}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function GradSchoolPlanner({ isDemo }: { isDemo: boolean }) {
  const [settings, setSettings]     = useState<PlanSettings>(DEFAULT_SETTINGS);
  const [editMode, setEditMode]     = useState(false);
  const [draft,    setDraft]        = useState<PlanSettings>(DEFAULT_SETTINGS);
  const [currentSavings, setCurrentSavings] = useState<number | null>(null);
  const [monthlyNet,     setMonthlyNet]     = useState<number | null>(null);
  const [goals,          setGoals]          = useState<GoalItem[]>([]);
  const [loans,          setLoans]          = useState<{ name: string; lender: string; remaining: number; monthly: number; payoffDate: string | null; interestRate: number; clearsBeforeEnrollment: boolean; isCC?: boolean }[]>([]);
  const [monthlyExpense, setMonthlyExpense] = useState<number>(0);
  const [balances,       setBalances]       = useState<BalanceItem[]>([]);
  const [loading,        setLoading]        = useState(true);

  // Load settings from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<PlanSettings>;
        const merged = { ...DEFAULT_SETTINGS, ...saved };
        // If targetAmount not set, compute from tuition + living * duration
        if (!merged.targetAmount) {
          const netLiving = Math.max(0, merged.living - merged.monthlyStipend);
          merged.targetAmount = merged.tuition + netLiving * merged.duration;
        }
        setSettings(merged);
        setDraft(merged);
      } else {
        const netLiving = Math.max(0, DEFAULT_SETTINGS.living - DEFAULT_SETTINGS.monthlyStipend);
        const init = {
          ...DEFAULT_SETTINGS,
          targetAmount: DEFAULT_SETTINGS.tuition + netLiving * DEFAULT_SETTINGS.duration,
        };
        setSettings(init);
        setDraft(init);
      }
    } catch { /* ignore */ }
  }, []);

  // Fetch goals + monthly net + loans
  useEffect(() => {
    if (isDemo) {
      setGoals([{ id: "demo", name: "研究所基金", emoji: "🎓", savedAmount: 350000, targetAmount: 900000, linkedSource: null }]);
      setCurrentSavings(350000);
      setMonthlyNet(15000);
      setMonthlyExpense(57000);
      setLoans([
        { name: "凱基速還金", lender: "凱基", remaining: 46239, monthly: 5000, payoffDate: "2026-10", interestRate: 16, clearsBeforeEnrollment: true },
        { name: "永豐信貸", lender: "永豐", remaining: 300000, monthly: 8000, payoffDate: "2029-06", interestRate: 4.5, clearsBeforeEnrollment: false },
      ]);
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.allSettled([
      fetch("/api/goals").then(r => r.json()),
      fetch("/api/summary?months=3").then(r => r.json()),
      fetch("/api/loans").then(r => r.json()),
      fetch("/api/credit-cards").then(r => r.json()),
      fetch("/api/balances").then(r => r.json()),
    ]).then(([goalsRes, sumRes, loansRes, ccRes, balancesRes]) => {
      // 各自安全取值，確保型別為陣列（避免 API 回錯誤物件導致 .filter 爆炸）
      const goalsRaw    = goalsRes.status    === "fulfilled" ? goalsRes.value    : null;
      const sumRaw      = sumRes.status      === "fulfilled" ? sumRes.value      : null;
      const loansRaw    = loansRes.status    === "fulfilled" ? loansRes.value    : null;
      const ccRaw       = ccRes.status       === "fulfilled" ? ccRes.value       : null;
      const balancesRaw = balancesRes.status === "fulfilled" ? balancesRes.value : null;

      const goalsData: GoalItem[]       = Array.isArray(goalsRaw)    ? goalsRaw    : [];
      const sumData: SummaryData | null = sumRaw && typeof sumRaw === "object" && "totals" in sumRaw ? sumRaw as SummaryData : null;
      const loansData: LoanItem[]       = Array.isArray(loansRaw)    ? loansRaw    : [];
      const ccData: CreditCardItem[]    = Array.isArray(ccRaw)       ? ccRaw       : [];
      const balancesData: BalanceItem[] = Array.isArray(balancesRaw) ? balancesRaw : [];

      setGoals(goalsData);
      setBalances(balancesData);
      setMonthlyNet(sumData?.totals?.net ?? 0);
      setMonthlyExpense((sumData?.totals?.expense ?? 0) / 3);

      // 計算每筆貸款的還清時間
      const now = new Date();
      const processedLoans = loansData
        .filter(l => l.status === "active")
        .map(l => {
          const remaining  = Number(l.remainingPrincipal);
          const lastPay    = l.payments?.[0];
          const monthly    = lastPay ? Number(lastPay.principalPaid) : 0;
          let payoffDate: string | null = null;
          if (l.endDate) {
            payoffDate = l.endDate.slice(0, 7);
          } else if (monthly > 0) {
            const m = Math.ceil(remaining / monthly);
            const d = new Date(now.getFullYear(), now.getMonth() + m, 1);
            payoffDate = d.toISOString().slice(0, 7);
          }
          return {
            name: l.name, lender: l.lender, remaining, monthly, payoffDate,
            interestRate: Number(l.interestRate),
            clearsBeforeEnrollment: !!payoffDate && payoffDate < "2028-09",
          };
        });

      // 信用卡未繳帳單視為短期負債
      const processedCC = ccData
        .filter(c => c.status !== "cancelled")
        .flatMap(c => {
          const unpaidBills = (c.bills ?? []).filter(b => !b.isPaid);
          const totalUnpaid = unpaidBills.reduce((s, b) => s + Number(b.totalAmount), 0);
          if (totalUnpaid <= 0) return [];
          return [{
            name: `${c.name}（信用卡未繳）`,
            lender: c.issuer,
            remaining: totalUnpaid,
            monthly: 0,
            payoffDate: null,
            interestRate: 0,
            clearsBeforeEnrollment: false,
            isCC: true as const,
          }];
        });

      setLoans([...processedLoans, ...processedCC]);
    }).catch(e => { console.error("[GradSchoolPlanner] fetch error", e); })
    .finally(() => setLoading(false));
  }, [isDemo]);

  // 當 settings.linkedGoalId / goals / balances / initialSavings 變化時，同步已存金額
  // 優先順序：goal.linkedSource 銀行餘額 → goal.savedAmount → initialSavings（手動）
  useEffect(() => {
    if (isDemo) return;
    if (settings.linkedGoalId) {
      const goal = goals.find(g => g.id === settings.linkedGoalId);
      if (!goal) { setCurrentSavings(settings.initialSavings || null); return; }
      if (goal.linkedSource) {
        const bankBalance = balances.find(b => b.source === goal.linkedSource);
        setCurrentSavings(bankBalance ? bankBalance.balance : goal.savedAmount);
      } else {
        setCurrentSavings(goal.savedAmount);
      }
    } else {
      setCurrentSavings(settings.initialSavings > 0 ? settings.initialSavings : null);
    }
  }, [settings.linkedGoalId, settings.initialSavings, goals, balances, isDemo]);

  function saveSettings() {
    const netLiving = Math.max(0, draft.living - draft.monthlyStipend);
    const next = { ...draft, targetAmount: draft.tuition + netLiving * draft.duration };
    setSettings(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setEditMode(false);
    // 立即同步已存金額
    if (next.linkedGoalId) {
      const goal = goals.find(g => g.id === next.linkedGoalId);
      if (goal) {
        if (goal.linkedSource) {
          const bankBalance = balances.find(b => b.source === goal.linkedSource);
          setCurrentSavings(bankBalance ? bankBalance.balance : goal.savedAmount);
        } else {
          setCurrentSavings(goal.savedAmount);
        }
      }
    } else {
      setCurrentSavings(next.initialSavings > 0 ? next.initialSavings : null);
    }
  }

  // ── Calculations ──────────────────────────────────────────────────────────

  const monthsLeft    = getMonthsUntilEnrollment();
  const daysLeft      = getDaysUntilEnrollment();
  const netLiving     = Math.max(0, settings.living - settings.monthlyStipend);
  const totalStipend  = settings.monthlyStipend * settings.duration;
  const savings       = currentSavings ?? 0;
  const projectedNet  = monthlyNet ?? 0;

  // 預備金
  const reserveAmount = Math.round(monthlyExpense * settings.reserveMonths);

  // 負債彙總
  const totalDebt           = loans.reduce((s, l) => s + l.remaining, 0);
  const loansBeforeEnroll   = loans.filter(l => l.clearsBeforeEnrollment);
  const loansAfterEnroll    = loans.filter(l => !l.clearsBeforeEnrollment && !l.isCC);
  const totalMonthlyLoan    = loans.filter(l => !l.isCC).reduce((s, l) => s + l.monthly, 0);

  // 就學期間仍需還款的貸款月付合計 × 就讀月數（入學後才有還款壓力的部分）
  const loansDuringSchool = loansAfterEnroll.reduce((s, l) => {
    if (!l.monthly) return s;
    // 估算入學後剩餘還款月數（不超過就讀期間）
    const enrollYM = "2028-09";
    let monthsInSchool = settings.duration;
    if (l.payoffDate && l.payoffDate > enrollYM) {
      const [py, pm] = l.payoffDate.split("-").map(Number);
      const [ey, em] = enrollYM.split("-").map(Number);
      monthsInSchool = Math.min(settings.duration, (py - ey) * 12 + (pm - em));
    }
    return s + l.monthly * Math.max(0, monthsInSchool);
  }, 0);

  // 目標金額 = 學費 + 實際生活費（扣公費）× 月數 + 就學期間貸款還款需求
  const totalTarget = settings.tuition + netLiving * settings.duration + loansDuringSchool;

  // 調整後月儲蓄預測（考慮貸款提前還清帶來的月現金流提升）
  const now = new Date();
  let adjustedProjectedSavings = savings;
  {
    let currentMonthly = projectedNet;
    for (let m = 0; m < monthsLeft; m++) {
      const ym = (() => { const d = new Date(now.getFullYear(), now.getMonth() + m, 1); return d.toISOString().slice(0, 7); })();
      for (const loan of loansBeforeEnroll) {
        if (loan.payoffDate === ym) currentMonthly += loan.monthly;
      }
      adjustedProjectedSavings += currentMonthly;
    }
  }

  const gap           = totalTarget - savings;
  const gapNeeded     = Math.max(0, gap);
  const monthlyNeed   = monthsLeft > 0 ? gapNeeded / monthsLeft : gapNeeded;
  const projGap       = totalTarget - adjustedProjectedSavings;
  const progressPct   = totalTarget > 0 ? Math.min(100, (savings / totalTarget) * 100) : 0;
  const onTrack       = adjustedProjectedSavings >= totalTarget;
  const surplusNeeded = Math.max(0, monthlyNeed - projectedNet);

  // 有效月儲蓄率（考慮貸款還清釋放現金流，用於里程碑日期估算）
  const effectiveMonthlyRate = monthsLeft > 0
    ? (adjustedProjectedSavings - savings) / monthsLeft
    : projectedNet;

  // 扣除預備金後的淨財務狀況
  const netPosition   = savings - reserveAmount - totalDebt;

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
    </div>
  );

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="rounded-2xl p-6 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e3a5f 100%)", border: "1px solid #4338CA40" }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[13px] font-semibold tracking-widest uppercase mb-1" style={{ color: "#A5B4FC" }}>研究所規劃</p>
            <p className="text-[28px] font-black" style={{ color: "#fff" }}>2028 年 9 月入學</p>
            <p className="text-[15px] mt-1" style={{ color: "#C7D2FE" }}>
              距入學還有 <span className="font-bold text-white">{monthsLeft}</span> 個月
              （<span className="font-bold text-white">{daysLeft}</span> 天）
            </p>
          </div>
          <div className="text-right">
            <p className="text-[13px]" style={{ color: "#A5B4FC" }}>
              目標存款
              {loansDuringSchool > 0 && <span className="ml-1 text-[11px]">（含就學期間貸款）</span>}
            </p>
            <p className="text-[26px] font-black tabular-nums" style={{ color: onTrack ? "#34D399" : "#FCA5A5" }}>
              NT$ {fmt(totalTarget)}
            </p>
            <span className="text-[12px] px-2 py-0.5 rounded-full"
              style={{ background: onTrack ? "#05966930" : "#EF444420", color: onTrack ? "#34D399" : "#FCA5A5" }}>
              {onTrack ? "✅ 依目前存款速率可達標" : "⚠ 需要調整存款策略"}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-5">
          <div className="flex justify-between text-[13px] mb-1.5" style={{ color: "#A5B4FC" }}>
            <span>已存 NT$ {fmt(savings)}</span>
            <span>{progressPct.toFixed(1)}%</span>
          </div>
          <div className="h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${progressPct}%`,
                background: "linear-gradient(90deg, #6366F1, #818CF8)",
                boxShadow: "0 0 12px #6366F160",
              }} />
          </div>
          <div className="flex justify-between text-[12px] mt-1" style={{ color: "#7C83C8" }}>
            <span>
              {settings.linkedGoalId && goals.find(g => g.id === settings.linkedGoalId)
                ? `來自「${goals.find(g => g.id === settings.linkedGoalId)!.name}」目標`
                : "目前存款"}
            </span>
            <span>目標 NT$ {fmt(totalTarget)}</span>
          </div>
        </div>
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="每月需存金額"
          value={`NT$ ${fmt(monthlyNeed)}`}
          sub={`缺口 ÷ ${monthsLeft} 個月`}
          color="#6366F1"
          accent />
        <StatCard
          label="目前月均淨儲蓄"
          value={`NT$ ${fmt(projectedNet)}`}
          sub={loansBeforeEnroll.length > 0 ? `還清後可達 NT$ ${fmt(projectedNet + loansBeforeEnroll.reduce((s,l)=>s+l.monthly,0))}` : "近期收入 − 支出"}
          color={projectedNet >= monthlyNeed ? "#10B981" : "#F59E0B"}
          accent={projectedNet < monthlyNeed} />
        <StatCard
          label="預計入學時存款"
          value={`NT$ ${fmt(adjustedProjectedSavings)}`}
          sub={projGap > 0 ? `仍缺 NT$ ${fmt(projGap)}` : `超額 NT$ ${fmt(Math.abs(projGap))} ✅`}
          color={projGap > 0 ? "#F87171" : "#34D399"}
          accent={projGap > 0} />
        <StatCard
          label="距入學"
          value={`${monthsLeft} 個月`}
          sub="2028/09/01 入學"
          color="var(--accent-light)" />
      </div>

      {/* 負債 & 預備金概況 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* 預備金 */}
        <div className="rounded-2xl px-5 py-4" style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.25)" }}>
          <p className="text-[13px] font-semibold mb-1" style={{ color: "#A5B4FC" }}>需保留預備金</p>
          <p className="text-[22px] font-black tabular-nums" style={{ color: "#818CF8" }}>NT$ {fmt(reserveAmount)}</p>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>{settings.reserveMonths} 個月生活費（NT$ {fmt(monthlyExpense)}/月）</p>
          <p className="text-[12px] mt-1" style={{ color: "var(--text-muted)" }}>此金額需維持，不計入研究所存款</p>
        </div>
        {/* 貸款餘額 */}
        <div className="rounded-2xl px-5 py-4" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
          <p className="text-[13px] font-semibold mb-1" style={{ color: "#FCA5A5" }}>目前貸款餘額</p>
          <p className="text-[22px] font-black tabular-nums" style={{ color: "#F87171" }}>NT$ {fmt(totalDebt)}</p>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>
          貸款月還款 NT$ {fmt(totalMonthlyLoan)}
          {loans.some(l => l.isCC) && `　信用卡未繳 NT$ ${fmt(loans.filter(l => l.isCC).reduce((s,l)=>s+l.remaining,0))}`}
        </p>
          <p className="text-[12px] mt-1" style={{ color: loansBeforeEnroll.length > 0 ? "#34D399" : "var(--text-muted)" }}>
            {loansBeforeEnroll.length > 0 ? `✅ ${loansBeforeEnroll.length} 筆入學前還清` : "無貸款在入學前還清"}
          </p>
        </div>
        {/* 淨財務狀況 */}
        <div className="rounded-2xl px-5 py-4" style={{
          background: netPosition >= 0 ? "rgba(16,185,129,0.08)" : "rgba(245,158,11,0.08)",
          border: `1px solid ${netPosition >= 0 ? "rgba(16,185,129,0.25)" : "rgba(245,158,11,0.25)"}`,
        }}>
          <p className="text-[13px] font-semibold mb-1" style={{ color: netPosition >= 0 ? "#6EE7B7" : "#FCD34D" }}>淨財務狀況</p>
          <p className="text-[22px] font-black tabular-nums" style={{ color: netPosition >= 0 ? "#34D399" : "#F59E0B" }}>
            {netPosition >= 0 ? "+" : ""}NT$ {fmt(netPosition)}
          </p>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>存款 − 預備金 − 負債</p>
          <p className="text-[12px] mt-1" style={{ color: "var(--text-muted)" }}>
            {fmt(savings)} − {fmt(reserveAmount)} − {fmt(totalDebt)}
          </p>
        </div>
      </div>

      {/* 貸款 & 信用卡明細 */}
      {loans.length > 0 && (
        <div className="rounded-2xl border p-5" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
          <p className="text-[15px] font-bold mb-3" style={{ color: "var(--text-primary)" }}>負債對入學規劃的影響</p>
          <div className="space-y-3">
            {loans.map(loan => (
              <div key={loan.name} className="flex items-center gap-3 rounded-xl px-4 py-3"
                style={{
                  background: loan.clearsBeforeEnrollment ? "rgba(16,185,129,0.07)" : "rgba(239,68,68,0.07)",
                  border: `1px solid ${loan.clearsBeforeEnrollment ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
                }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>{loan.name}</span>
                    {loan.isCC
                      ? <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: "rgba(245,158,11,0.15)", color: "#F59E0B" }}>信用卡</span>
                      : <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>{loan.lender} · 利率 {loan.interestRate}%</span>
                    }
                  </div>
                  <p className="text-[13px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {loan.isCC
                      ? `未繳帳單 NT$ ${fmt(loan.remaining)}`
                      : `剩餘 NT$ ${fmt(loan.remaining)}　月還 NT$ ${fmt(loan.monthly)}${loan.payoffDate ? `　預計 ${loan.payoffDate} 還清` : ""}`
                    }
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  {loan.isCC ? (
                    <span className="text-[12px] px-2 py-1 rounded-lg" style={{ background: "rgba(245,158,11,0.12)", color: "#FCD34D" }}>
                      💳 當期未繳
                    </span>
                  ) : loan.clearsBeforeEnrollment ? (
                    <span className="text-[12px] font-bold px-2 py-1 rounded-lg" style={{ background: "rgba(16,185,129,0.15)", color: "#34D399" }}>
                      ✅ 入學前還清<br />
                      <span className="font-normal">月增 NT$ {fmt(loan.monthly)}</span>
                    </span>
                  ) : (
                    <span className="text-[12px] px-2 py-1 rounded-lg" style={{ background: "rgba(239,68,68,0.12)", color: "#FCA5A5" }}>
                      ⚠ 入學後仍有還款
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {loansBeforeEnroll.length > 0 && (
            <div className="mt-3 px-4 py-2.5 rounded-xl text-[13px]"
              style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", color: "#6EE7B7" }}>
              🎉 {loansBeforeEnroll.length} 筆貸款入學前還清，月現金流將增加 NT$ {fmt(loansBeforeEnroll.reduce((s,l)=>s+l.monthly,0))}，
              已計入入學時預估存款
            </div>
          )}
          {loansAfterEnroll.length > 0 && (
            <div className="mt-2 px-4 py-2.5 rounded-xl text-[13px]"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#FCA5A5" }}>
              ⚠ {loansAfterEnroll.length} 筆貸款在入學後仍需還款（NT$ {fmt(loansAfterEnroll.reduce((s,l)=>s+l.monthly,0))}/月），請納入就學期間生活費規劃
            </div>
          )}
        </div>
      )}

      {/* Action plan */}
      <div className="rounded-2xl border p-6 space-y-4"
        style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
        <p className="text-[16px] font-bold" style={{ color: "var(--text-primary)" }}>存款行動計畫</p>

        {/* Monthly savings gap */}
        {surplusNeeded > 0 ? (
          <div className="rounded-xl px-4 py-3.5" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
            <p className="text-[14px] font-semibold" style={{ color: "#FCA5A5" }}>
              ⚠ 月淨儲蓄不足，每月還需多存 NT$ {fmt(surplusNeeded)}
            </p>
            <p className="text-[13px] mt-1" style={{ color: "#F87171" }}>
              建議增加收入或降低支出，目標每月淨儲蓄達 NT$ {fmt(monthlyNeed)}
            </p>
          </div>
        ) : (
          <div className="rounded-xl px-4 py-3.5" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)" }}>
            <p className="text-[14px] font-semibold" style={{ color: "#34D399" }}>
              ✅ 目前存款速率可於入學前達標，繼續維持！
            </p>
            <p className="text-[13px] mt-1" style={{ color: "#6EE7B7" }}>
              預計入學時超額存款 NT$ {fmt(Math.abs(projGap))}，可作為緊急備用金
            </p>
          </div>
        )}

        {/* Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {[
            ...(settings.tuition > 0 ? [{ label: "學費（估計）", amount: settings.tuition, color: "#6366F1", sign: "" }] : []),
            ...(settings.living > 0 ? [{ label: `生活費（${settings.duration} 個月）`, amount: settings.living * settings.duration, color: "#F59E0B", sign: "" }] : []),
            ...(totalStipend > 0 ? [{ label: `公費收入（${settings.duration} 個月）`, amount: totalStipend, color: "#10B981", sign: "−" }] : []),
            ...(loansDuringSchool > 0 ? [{ label: `就學期間貸款（${settings.duration} 個月）`, amount: loansDuringSchool, color: "#F87171", sign: "" }] : []),
            { label: gap > 0 ? "剩餘缺口" : "已超額存款", amount: Math.abs(gap), color: gap > 0 ? "#EF4444" : "#10B981", sign: gap > 0 ? "" : "+" },
          ].map(({ label, amount, color, sign }) => (
            <div key={label} className="rounded-xl px-4 py-3" style={{ background: "var(--bg-input)", border: "1px solid var(--border-inner)" }}>
              <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>{label}</p>
              <p className="text-[18px] font-black tabular-nums mt-0.5" style={{ color }}>{sign}NT$ {fmt(amount)}</p>
            </div>
          ))}
        </div>

        {/* Timeline milestones */}
        <div>
          <p className="text-[14px] font-semibold mb-3" style={{ color: "var(--text-sub)" }}>存款里程碑</p>
          <div className="space-y-2">
            {[0.25, 0.5, 0.75, 1.0].map(pct => {
              const milestone = totalTarget * pct;
              const needed = milestone - savings;
              const monthsToReach = effectiveMonthlyRate > 0 && needed > 0
                ? Math.ceil(needed / effectiveMonthlyRate)
                : needed <= 0 ? 0 : null;
              const reachDate = monthsToReach === 0
                ? "已達成"
                : monthsToReach !== null
                  ? (() => { const d = new Date(); d.setMonth(d.getMonth() + monthsToReach); return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}`; })()
                  : "—";
              const reached = savings >= milestone;
              return (
                <div key={pct} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center"
                    style={{ background: reached ? "#10B981" : "var(--bg-input)", border: `2px solid ${reached ? "#10B981" : "var(--border-inner)"}` }}>
                    {reached && <span className="text-[10px] text-white font-bold">✓</span>}
                  </div>
                  <div className="flex-1 flex items-center justify-between">
                    <span className="text-[13px]" style={{ color: reached ? "#34D399" : "var(--text-sub)" }}>
                      {(pct * 100).toFixed(0)}% — NT$ {fmt(milestone)}
                    </span>
                    <span className="text-[13px] tabular-nums" style={{ color: "var(--text-muted)" }}>
                      {reached ? "已達成 ✅" : reachDate}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Settings */}
      <div className="rounded-2xl border p-6" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-[16px] font-bold" style={{ color: "var(--text-primary)" }}>規劃參數設定</p>
          {!editMode ? (
            <button onClick={() => { setDraft(settings); setEditMode(true); }}
              className="px-4 py-1.5 rounded-xl text-[13px] font-semibold transition-opacity hover:opacity-80"
              style={{ background: "var(--bg-input)", color: "var(--accent-light)", border: "1px solid var(--border-inner)" }}>
              編輯
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setEditMode(false)}
                className="px-4 py-1.5 rounded-xl text-[13px] font-semibold"
                style={{ background: "var(--bg-input)", color: "var(--text-muted)", border: "1px solid var(--border-inner)" }}>
                取消
              </button>
              <button onClick={saveSettings}
                className="px-4 py-1.5 rounded-xl text-[13px] font-semibold text-white"
                style={{ background: "var(--btn-gradient)" }}>
                儲存
              </button>
            </div>
          )}
        </div>

        {/* 目前已存金額（無連結目標時手動輸入）*/}
        {!settings.linkedGoalId && (
          <div className="mb-4 rounded-xl px-4 py-3" style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
            <label className="text-[13px] font-medium mb-1.5 block" style={{ color: "var(--text-sub)" }}>
              目前已存金額 <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>（連結財務目標後自動同步，此欄停用）</span>
            </label>
            {editMode ? (
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "var(--text-muted)" }}>NT$</span>
                <input
                  type="number" min="0"
                  value={draft.initialSavings}
                  onChange={e => setDraft(d => ({ ...d, initialSavings: parseFloat(e.target.value) || 0 }))}
                  onWheel={e => e.currentTarget.blur()}
                  className="w-full rounded-xl pl-10 pr-3 py-2 text-[14px] outline-none"
                  style={{ background: "var(--bg-input)", border: "1px solid var(--accent)", color: "var(--text-primary)" }}
                />
              </div>
            ) : (
              <p className="text-[20px] font-black tabular-nums" style={{ color: "#818CF8" }}>
                NT$ {(settings.initialSavings || 0).toLocaleString("zh-TW")}
              </p>
            )}
          </div>
        )}

        {/* 連結財務目標 */}
        <div className="mb-4">
          <label className="text-[13px] font-medium mb-1.5 block" style={{ color: "var(--text-sub)" }}>
            連結財務目標 <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>（已存金額自動同步）</span>
          </label>
          {editMode ? (
            <select
              value={draft.linkedGoalId}
              onChange={e => setDraft(d => ({ ...d, linkedGoalId: e.target.value }))}
              className="w-full rounded-xl px-3 py-2 text-[14px] outline-none"
              style={{ background: "var(--bg-input)", border: "1px solid var(--accent)", color: "var(--text-primary)" }}>
              <option value="">— 不連結（手動輸入）—</option>
              {goals.map(g => (
                <option key={g.id} value={g.id} style={{ background: "var(--bg-card)" }}>
                  {g.emoji} {g.name}（已存 NT$ {Math.round(g.savedAmount).toLocaleString("zh-TW")}）
                </option>
              ))}
            </select>
          ) : (
            <div className="flex items-center gap-2">
              {settings.linkedGoalId ? (() => {
                const g = goals.find(x => x.id === settings.linkedGoalId);
                return g ? (
                  <span className="text-[14px] font-semibold px-3 py-1.5 rounded-xl"
                    style={{ background: "var(--bg-input)", color: "var(--accent-light)", border: "1px solid var(--border-inner)" }}>
                    {g.emoji} {g.name}
                    <span className="ml-2 text-[13px] font-normal" style={{ color: "var(--text-muted)" }}>
                      已存 NT$ {Math.round(g.savedAmount).toLocaleString("zh-TW")}
                    </span>
                  </span>
                ) : <span className="text-[14px]" style={{ color: "var(--text-muted)" }}>目標已刪除，請重新選擇</span>;
              })() : (
                <span className="text-[14px]" style={{ color: "var(--text-muted)" }}>未連結財務目標</span>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "學費（總計）NT$", key: "tuition" as const, hint: "兩年學費合計" },
            { label: "每月生活費 NT$", key: "living" as const, hint: "房租 + 飲食 + 雜支" },
            { label: "就讀期間（月）", key: "duration" as const, hint: "如碩士 2 年 = 24 個月" },
            { label: "每月公費零用金 NT$", key: "monthlyStipend" as const, hint: "就學期間每月補助收入（填 0 表示無）" },
            { label: "預備金月數", key: "reserveMonths" as const, hint: "建議保留 3 個月生活費" },
          ].map(({ label, key, hint }) => (
            <div key={key}>
              <label className="text-[13px] font-medium mb-1.5 block" style={{ color: "var(--text-sub)" }}>{label}</label>
              {editMode ? (
                <input
                  type="number"
                  value={draft[key]}
                  onChange={e => setDraft(d => ({ ...d, [key]: parseFloat(e.target.value) || 0 }))}
                  className="w-full rounded-xl px-3 py-2 text-[14px] outline-none"
                  style={{ background: "var(--bg-input)", border: "1px solid var(--accent)", color: "var(--text-primary)" }}
                />
              ) : (
                <p className="text-[16px] font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
                  {settings[key].toLocaleString("zh-TW")}
                </p>
              )}
              <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>{hint}</p>
            </div>
          ))}
        </div>

        {editMode && (
          <div className="mt-4 p-3 rounded-xl" style={{ background: "var(--bg-input)" }}>
            <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
              目標金額預覽：
              {draft.tuition > 0 && <>學費 NT$ {fmt(draft.tuition)} + </>}
              {draft.living > 0 && <>生活費 NT$ {fmt(draft.living * draft.duration)}（{draft.duration} 個月）</>}
              {draft.monthlyStipend > 0 && <> − 公費 NT$ {fmt(draft.monthlyStipend * draft.duration)}</>}
              {loansDuringSchool > 0 && <> + 就學貸款 NT$ {fmt(loansDuringSchool)}</>}
              {" = "}<span className="font-bold" style={{ color: "var(--accent-light)" }}>NT$ {fmt(draft.tuition + Math.max(0, draft.living - draft.monthlyStipend) * draft.duration + loansDuringSchool)}</span>
            </p>
          </div>
        )}

        {settings.notes !== undefined && (
          <div className="mt-4">
            <label className="text-[13px] font-medium mb-1.5 block" style={{ color: "var(--text-sub)" }}>備註</label>
            {editMode ? (
              <textarea
                value={draft.notes}
                onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
                rows={2}
                placeholder="例：申請學校清單、獎學金規劃..."
                className="w-full rounded-xl px-3 py-2 text-[14px] outline-none resize-none"
                style={{ background: "var(--bg-input)", border: "1px solid var(--accent)", color: "var(--text-primary)" }}
              />
            ) : settings.notes ? (
              <p className="text-[14px]" style={{ color: "var(--text-sub)" }}>{settings.notes}</p>
            ) : (
              <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>無備註</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
