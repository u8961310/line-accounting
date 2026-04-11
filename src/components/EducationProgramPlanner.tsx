"use client";

import { useEffect, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

interface GoalItem { id: string; name: string; emoji: string; savedAmount: number; targetAmount: number; linkedSource: string | null }
interface BalanceItem { source: string; balance: number }
interface MonthlySummary { month: string; income: number; expense: number }
interface SummaryData { monthly: MonthlySummary[] }
interface LoanItem {
  status: string;
  remainingPrincipal: string;
  interestRate: string;
  payments: { principalPaid: string; interestPaid: string }[];
}
interface FixedExpenseItem { amount: number }
interface BudgetItem { amount: number }

const STORAGE_KEY = "education_program_plan_v1";
const GRAD_STORAGE_KEY = "grad_school_plan_v1";

interface PlanSettings {
  linkedGoalId: string;
  augustAmount: number;        // 每年 8 月繳費金額
  februaryAmount: number;      // 每年 2 月繳費金額
  startYear: number;           // 第一次繳費年份
  startMonth: number;          // 第一次繳費月份（2 或 8）
  totalPayments: number;       // 預計總繳費次數（含已繳）
  paidCount: number;           // 已繳次數
  monthlyContribution: number; // 0 = 自動估算
  initialSavings: number;
  notes: string;
}

const DEFAULT_SETTINGS: PlanSettings = {
  linkedGoalId: "",
  augustAmount: 45000,
  februaryAmount: 45000,
  startYear: new Date().getFullYear(),
  startMonth: 8,
  totalPayments: 4,
  paidCount: 0,
  monthlyContribution: 0,
  initialSavings: 0,
  notes: "",
};

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (!Number.isFinite(n)) return "0";
  return Math.abs(Math.round(n)).toLocaleString("zh-TW");
}

interface PaymentEvent {
  label: string;       // "2026 年 8 月"
  date: Date;
  amount: number;
  monthsAway: number;
  isPaid: boolean;
}

function buildPaymentSchedule(settings: PlanSettings): PaymentEvent[] {
  const now = new Date();
  const events: PaymentEvent[] = [];
  // 從 startYear/startMonth 開始，每 6 個月一筆，共 totalPayments 筆
  const cursor = new Date(settings.startYear, settings.startMonth - 1, 1);
  for (let i = 0; i < settings.totalPayments; i++) {
    const month = cursor.getMonth() + 1;
    const y = cursor.getFullYear();
    const amount = month === 8 ? settings.augustAmount : settings.februaryAmount;
    const monthsAway = Math.round(
      (y - now.getFullYear()) * 12 + (cursor.getMonth() - now.getMonth())
    );
    events.push({
      label: `${y} 年 ${month} 月`,
      date: new Date(cursor),
      amount,
      monthsAway,
      isPaid: i < settings.paidCount,
    });
    cursor.setMonth(cursor.getMonth() + 6);
  }
  return events;
}

function getNextPayment(schedule: PaymentEvent[]): PaymentEvent | null {
  return schedule.find(p => !p.isPaid && p.monthsAway >= 0) ?? null;
}

function addMonthsToNow(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + Math.ceil(n));
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}`;
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
      {sub && <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>{sub}</p>}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-widest mt-6 mb-2"
      style={{ color: "var(--text-muted)" }}>{children}</p>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function EducationProgramPlanner() {
  const [settings, setSettings] = useState<PlanSettings>(DEFAULT_SETTINGS);
  const [editMode, setEditMode] = useState(false);
  const [draft,    setDraft]    = useState<PlanSettings>(DEFAULT_SETTINGS);
  const [savings,  setSavings]  = useState<number | null>(null);
  const [goals,    setGoals]    = useState<GoalItem[]>([]);
  const [balances, setBalances] = useState<BalanceItem[]>([]);
  const [avgMonthlyIncome,   setAvgMonthlyIncome]   = useState<number>(0);
  const [totalFixedExpenses, setTotalFixedExpenses] = useState<number>(0);
  const [totalLoanMonthly,   setTotalLoanMonthly]   = useState<number>(0);
  const [totalBudget,        setTotalBudget]        = useState<number>(0);
  const [loading,  setLoading]  = useState(true);

  // 載入 localStorage，預設 linkedGoalId 與研究所計畫相同
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<PlanSettings>) };
        setSettings(saved);
        setDraft(saved);
      } else {
        try {
          const gradRaw = localStorage.getItem(GRAD_STORAGE_KEY);
          if (gradRaw) {
            const gradPlan = JSON.parse(gradRaw) as { linkedGoalId?: string };
            if (gradPlan.linkedGoalId) {
              const init = { ...DEFAULT_SETTINGS, linkedGoalId: gradPlan.linkedGoalId };
              setSettings(init);
              setDraft(init);
            }
          }
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  }, []);

  // 載入 API 資料
  useEffect(() => {
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
      const goalsData: GoalItem[]       = goalsRes.status    === "fulfilled" && Array.isArray(goalsRes.value)    ? goalsRes.value    : [];
      const balancesData: BalanceItem[] = balancesRes.status === "fulfilled" && Array.isArray(balancesRes.value) ? balancesRes.value : [];
      const sumData: SummaryData | null = sumRes.status === "fulfilled" && sumRes.value && typeof sumRes.value === "object" && "monthly" in sumRes.value
        ? sumRes.value as SummaryData : null;
      const fixedRaw   = fixedRes.status   === "fulfilled" && fixedRes.value   && typeof fixedRes.value   === "object" ? fixedRes.value   : {};
      const budgetsRaw = budgetsRes.status === "fulfilled" && budgetsRes.value && typeof budgetsRes.value === "object" ? budgetsRes.value : {};
      const fixedData: FixedExpenseItem[] = Array.isArray((fixedRaw   as { fixedExpenses?: unknown }).fixedExpenses) ? (fixedRaw   as { fixedExpenses: FixedExpenseItem[] }).fixedExpenses : [];
      const budgetsData: BudgetItem[]     = Array.isArray((budgetsRaw as { budgets?:       unknown }).budgets)       ? (budgetsRaw as { budgets:       BudgetItem[]     }).budgets       : [];
      const loansData: LoanItem[]         = loansRes.status === "fulfilled" && Array.isArray(loansRes.value) ? loansRes.value : [];

      setGoals(goalsData);
      setBalances(balancesData);

      const recent = (sumData?.monthly ?? []).slice(-3);
      if (recent.length > 0)
        setAvgMonthlyIncome(recent.reduce((s, m) => s + (Number(m.income) || 0), 0) / recent.length);

      setTotalFixedExpenses(fixedData.reduce((s, f) => s + f.amount, 0));
      setTotalLoanMonthly(loansData
        .filter(l => l.status === "active")
        .reduce((s, l) => {
          const pay = l.payments?.[0];
          return pay
            ? s + Number(pay.principalPaid) + Number(pay.interestPaid)
            : s + Number(l.remainingPrincipal) * (Number(l.interestRate) / 100 / 12);
        }, 0));
      setTotalBudget(budgetsData.reduce((s, b) => s + b.amount, 0));
    }).catch(e => console.error("[EducationProgramPlanner]", e))
      .finally(() => setLoading(false));
  }, []);

  // 同步已存金額
  useEffect(() => {
    if (settings.linkedGoalId) {
      const goal = goals.find(g => g.id === settings.linkedGoalId);
      if (!goal) { setSavings(settings.initialSavings || null); return; }
      if (goal.linkedSource) {
        const bank = balances.find(b => b.source === goal.linkedSource);
        setSavings(bank ? bank.balance : goal.savedAmount);
      } else {
        setSavings(goal.savedAmount);
      }
    } else {
      setSavings(settings.initialSavings > 0 ? settings.initialSavings : null);
    }
  }, [settings.linkedGoalId, settings.initialSavings, goals, balances]);

  function saveSettings() {
    const next = { ...draft };
    setSettings(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setEditMode(false);
    if (next.linkedGoalId) {
      const goal = goals.find(g => g.id === next.linkedGoalId);
      if (goal?.linkedSource) {
        const bank = balances.find(b => b.source === goal.linkedSource);
        setSavings(bank ? bank.balance : goal.savedAmount);
      } else if (goal) {
        setSavings(goal.savedAmount);
      }
    } else {
      setSavings(next.initialSavings > 0 ? next.initialSavings : null);
    }
  }

  // ── Computed ──────────────────────────────────────────────────────────────

  const currentSavings = savings ?? 0;
  const schedule = buildPaymentSchedule(settings);
  const nextPayment = getNextPayment(schedule);
  const remainingPayments = schedule.filter(p => !p.isPaid);
  const totalRemaining = remainingPayments.reduce((s, p) => s + p.amount, 0);
  const paidTotal = schedule.filter(p => p.isPaid).reduce((s, p) => s + p.amount, 0);
  const grandTotal = schedule.reduce((s, p) => s + p.amount, 0);

  // 每月可存 = 收入 - 固定支出 - 貸款 - 預算
  const autoMonthlyAvailable = avgMonthlyIncome - totalFixedExpenses - totalLoanMonthly - totalBudget;
  const effectiveMonthly = settings.monthlyContribution > 0 ? settings.monthlyContribution : autoMonthlyAvailable;

  // 下一筆繳費的缺口
  const nextAmount = nextPayment?.amount ?? 0;
  const nextMonthsAway = nextPayment?.monthsAway ?? 0;
  const nextGap = Math.max(0, nextAmount - currentSavings);
  const nextMonthlyNeeded = nextMonthsAway > 0 && nextGap > 0 ? nextGap / nextMonthsAway : 0;
  const canMeetNext = nextGap === 0 || (effectiveMonthly >= nextMonthlyNeeded && nextMonthsAway > 0);
  const progressPctNext = nextAmount > 0 ? Math.min(100, (currentSavings / nextAmount) * 100) : 100;

  const statusColor = !nextPayment ? "#10B981" : nextGap === 0 ? "#10B981" : canMeetNext ? "#F59E0B" : "#EF4444";
  const statusLabel = !nextPayment ? "全數繳清" : nextGap === 0 ? "已備妥" : canMeetNext ? "進行中" : "需加速";
  const statusIcon  = !nextPayment ? "✅" : nextGap === 0 ? "✅" : canMeetNext ? "📚" : "⚠️";

  const monthsToGoalAuto = effectiveMonthly > 0 && nextGap > 0 ? nextGap / effectiveMonthly : null;
  const achieveDate = monthsToGoalAuto ? addMonthsToNow(monthsToGoalAuto) : null;

  const linkedGoal = settings.linkedGoalId ? goals.find(g => g.id === settings.linkedGoalId) : null;
  const gradGoalId = (() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(GRAD_STORAGE_KEY) : null;
      if (raw) return (JSON.parse(raw) as { linkedGoalId?: string }).linkedGoalId ?? "";
    } catch { /* ignore */ }
    return "";
  })();
  const sharesBankWithGrad = !!linkedGoal && linkedGoal.id === gradGoalId;

  // ── 設定表單 ────────────────────────────────────────────────────────────

  if (editMode) {
    const inputCls = "w-full rounded-xl px-4 py-2.5 text-[14px] outline-none"
      + " bg-[var(--bg-input)] border border-[var(--border-inner)] text-[var(--text-primary)]"
      + " focus:border-[var(--accent-light)] transition-colors";
    const labelCls = "text-[13px] font-semibold text-[var(--text-sub)]";
    const selectCls = inputCls + " [&>option]:bg-[#1e293b] [&>option]:text-white";
    const currentYear = new Date().getFullYear();

    return (
      <div className="space-y-5 max-w-2xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[20px] font-black" style={{ color: "var(--text-primary)" }}>📚 教育學程設定</h2>
            <p className="text-[13px] mt-0.5" style={{ color: "var(--text-muted)" }}>每年 2 月、8 月各繳一次</p>
          </div>
          <button onClick={() => setEditMode(false)}
            className="text-[13px] px-4 py-2 rounded-xl"
            style={{ background: "var(--bg-input)", color: "var(--text-muted)", border: "1px solid var(--border-inner)" }}>
            取消
          </button>
        </div>

        <div className="rounded-2xl p-5 space-y-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border-card)" }}>
          {/* 連結財務目標 */}
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>連結財務目標（銀行帳戶）</label>
            <select className={selectCls} value={draft.linkedGoalId}
              onChange={e => setDraft(d => ({ ...d, linkedGoalId: e.target.value }))}>
              <option value="">（不連結，手動輸入）</option>
              {goals.map(g => (
                <option key={g.id} value={g.id}>
                  {g.emoji} {g.name}{g.id === gradGoalId ? "（與研究所相同）" : ""}
                </option>
              ))}
            </select>
          </div>

          {!draft.linkedGoalId && (
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>目前已存金額（手動）</label>
              <input type="number" className={inputCls} min={0}
                value={draft.initialSavings || ""}
                onChange={e => setDraft(d => ({ ...d, initialSavings: Number(e.target.value) }))}
                placeholder="0" />
            </div>
          )}

          {/* 第一次繳費年月 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>第一次繳費年份</label>
              <select className={selectCls} value={draft.startYear}
                onChange={e => setDraft(d => ({ ...d, startYear: Number(e.target.value) }))}>
                {[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map(y => (
                  <option key={y} value={y}>{y} 年</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>第一次繳費月份</label>
              <select className={selectCls} value={draft.startMonth}
                onChange={e => setDraft(d => ({ ...d, startMonth: Number(e.target.value) }))}>
                <option value={2}>2 月</option>
                <option value={8}>8 月</option>
              </select>
            </div>
          </div>

          {/* 每次繳費金額 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>8 月繳費金額</label>
              <input type="number" className={inputCls} min={0}
                value={draft.augustAmount || ""}
                onChange={e => setDraft(d => ({ ...d, augustAmount: Number(e.target.value) }))}
                placeholder="45000" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>2 月繳費金額</label>
              <input type="number" className={inputCls} min={0}
                value={draft.februaryAmount || ""}
                onChange={e => setDraft(d => ({ ...d, februaryAmount: Number(e.target.value) }))}
                placeholder="45000" />
            </div>
          </div>

          {/* 總繳費次數 & 已繳次數 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>總繳費次數</label>
              <select className={selectCls} value={draft.totalPayments}
                onChange={e => setDraft(d => ({ ...d, totalPayments: Number(e.target.value) }))}>
                {[2, 3, 4, 5, 6, 8].map(n => (
                  <option key={n} value={n}>{n} 次（{n % 2 === 0 ? n / 2 : Math.ceil(n / 2)} 學年）</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>已繳次數</label>
              <select className={selectCls} value={draft.paidCount}
                onChange={e => setDraft(d => ({ ...d, paidCount: Number(e.target.value) }))}>
                {Array.from({ length: draft.totalPayments + 1 }, (_, i) => i).map(n => (
                  <option key={n} value={n}>{n} 次</option>
                ))}
              </select>
            </div>
          </div>

          {/* 每月存入 */}
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>計畫每月存入（選填，留空則自動估算）</label>
            <input type="number" className={inputCls} min={0}
              value={draft.monthlyContribution || ""}
              onChange={e => setDraft(d => ({ ...d, monthlyContribution: Number(e.target.value) }))}
              placeholder={`自動估算 NT$ ${fmt(Math.max(0, autoMonthlyAvailable))}`} />
          </div>

          {/* 備注 */}
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>備註</label>
            <input type="text" className={inputCls}
              value={draft.notes}
              onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
              placeholder="例：師培學程、暑期班..." />
          </div>
        </div>

        <button onClick={saveSettings}
          className="w-full py-3 rounded-2xl text-[15px] font-bold text-white"
          style={{ background: "var(--btn-gradient)" }}>
          儲存設定
        </button>
      </div>
    );
  }

  // ── 主頁面 ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 rounded-full animate-spin"
          style={{ borderColor: "var(--accent-light)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  return (
    <div className="space-y-3 max-w-3xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[22px] font-black" style={{ color: "var(--text-primary)" }}>
            📚 教育學程規劃
          </h2>
          <p className="text-[13px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            每年 2 月 / 8 月各繳一次 · 共 {settings.totalPayments} 次 · 已繳 {settings.paidCount} 次
            {linkedGoal && <span> · 連結 <span className="font-semibold">{linkedGoal.emoji} {linkedGoal.name}</span></span>}
            {sharesBankWithGrad && (
              <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full"
                style={{ background: "rgba(99,102,241,0.15)", color: "#818CF8" }}>
                與研究所共用帳戶
              </span>
            )}
          </p>
          {settings.notes && <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>{settings.notes}</p>}
        </div>
        <button onClick={() => { setDraft(settings); setEditMode(true); }}
          className="flex-shrink-0 text-[13px] font-semibold px-4 py-2 rounded-xl transition-opacity hover:opacity-80"
          style={{ background: "var(--bg-input)", color: "var(--text-sub)", border: "1px solid var(--border-inner)" }}>
          ✏️ 編輯設定
        </button>
      </div>

      {/* ── 共用帳戶提示 ── */}
      {sharesBankWithGrad && (
        <div className="flex items-start gap-3 rounded-xl px-4 py-3"
          style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
          <span className="text-indigo-400 mt-0.5 flex-shrink-0">🔗</span>
          <div>
            <p className="text-[13px] font-semibold" style={{ color: "#818CF8" }}>與研究所計畫共用銀行帳戶</p>
            <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>
              帳戶餘額 NT$ {fmt(currentSavings)} 同時支援教育學程與研究所存款目標，每次繳費後餘額會減少。
            </p>
          </div>
        </div>
      )}

      {/* ── 下一筆繳費狀態卡 ── */}
      {nextPayment ? (
        <div className="rounded-2xl p-5 relative overflow-hidden"
          style={{ background: "var(--bg-card)", border: `1px solid ${statusColor}30`, boxShadow: `0 0 24px ${statusColor}08` }}>
          <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
            style={{ background: `linear-gradient(90deg, ${statusColor}, ${statusColor}80)` }} />

          <div className="flex items-start justify-between mb-4 gap-3">
            <div>
              <p className="text-[12px] font-semibold tracking-widest uppercase" style={{ color: "var(--text-muted)" }}>
                下一筆繳費
              </p>
              <p className="text-[20px] font-black mt-0.5" style={{ color: "var(--text-primary)" }}>
                {nextPayment.label}
              </p>
              <p className="text-[13px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                NT$ {fmt(nextPayment.amount)} · 還有 {nextPayment.monthsAway} 個月
              </p>
            </div>
            <div className="text-right">
              <span className="text-[32px]">{statusIcon}</span>
              <p className="text-[13px] font-bold mt-0.5" style={{ color: statusColor }}>{statusLabel}</p>
            </div>
          </div>

          {/* 進度條 */}
          <div className="flex justify-between text-[12px] mb-2" style={{ color: "var(--text-muted)" }}>
            <span>已存 NT$ {fmt(currentSavings)}</span>
            <span>需要 NT$ {fmt(nextPayment.amount)}　{Math.round(progressPctNext)}%</span>
          </div>
          <div className="h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${progressPctNext}%`, background: `linear-gradient(90deg, ${statusColor}, ${statusColor}cc)` }} />
          </div>

          {nextGap > 0 && (
            <p className="text-[12px] mt-2" style={{ color: "var(--text-muted)" }}>
              還差 NT$ {fmt(nextGap)}，每月需再存 NT$ {fmt(Math.ceil(nextMonthlyNeeded))}
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-2xl p-5 text-center"
          style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)" }}>
          <p className="text-[32px] mb-2">🎉</p>
          <p className="text-[16px] font-bold" style={{ color: "#10B981" }}>所有學費已繳清！</p>
          <p className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>
            共 {settings.totalPayments} 次，合計 NT$ {fmt(grandTotal)}
          </p>
        </div>
      )}

      {/* ── 統計 ── */}
      <SectionLabel>存款進度</SectionLabel>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="下筆缺口"
          value={nextGap > 0 ? `NT$ ${fmt(nextGap)}` : nextPayment ? "已備妥" : "—"}
          sub={nextPayment ? `下筆 NT$ ${fmt(nextPayment.amount)}` : undefined}
          color={nextGap > 0 ? "#F87171" : "#10B981"}
          accent={nextGap === 0 && !!nextPayment}
        />
        <StatCard
          label="下筆每月需存"
          value={nextMonthlyNeeded > 0 ? `NT$ ${fmt(nextMonthlyNeeded)}` : nextGap === 0 ? "已足夠" : "—"}
          sub={nextPayment ? `${nextPayment.monthsAway} 個月後到期` : undefined}
          color={canMeetNext ? "#60A5FA" : "#F59E0B"}
        />
        <StatCard
          label="每月可存（估）"
          value={`NT$ ${fmt(Math.max(0, effectiveMonthly))}`}
          sub={settings.monthlyContribution > 0
            ? "手動設定"
            : `收入 ${fmt(avgMonthlyIncome)} − 固定 ${fmt(totalFixedExpenses)} − 貸款 ${fmt(totalLoanMonthly)} − 預算 ${fmt(totalBudget)}`}
          color={effectiveMonthly >= nextMonthlyNeeded ? "#10B981" : "#F59E0B"}
        />
        <StatCard
          label="預計存滿"
          value={achieveDate ?? (nextGap === 0 ? "已完成" : "—")}
          sub={monthsToGoalAuto ? `約 ${Math.ceil(monthsToGoalAuto)} 個月後` : undefined}
          color={canMeetNext ? "#A78BFA" : "#F87171"}
          accent={nextGap === 0 && !!nextPayment}
        />
      </div>

      {/* ── 行動計畫 ── */}
      <SectionLabel>行動建議</SectionLabel>
      <div className="rounded-2xl border p-5 space-y-4" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>

        {/* Monthly formula breakdown */}
        <div className="rounded-xl p-4 space-y-2" style={{ background: "var(--bg-input)", border: "1px solid var(--border-inner)" }}>
          <p className="text-[12px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>每月可存金額試算</p>
          {[
            { label: "平均月收入（近 3 個月）", amount: avgMonthlyIncome, sign: "+", color: "#34D399" },
            { label: "固定支出", amount: totalFixedExpenses, sign: "−", color: "#F87171" },
            { label: "貸款月付", amount: totalLoanMonthly, sign: "−", color: "#F87171" },
            { label: "月預算上限", amount: totalBudget, sign: "−", color: "#F87171" },
          ].map(({ label, amount, sign, color }) => (
            <div key={label} className="flex items-center justify-between text-[13px]">
              <span style={{ color: "var(--text-sub)" }}>{sign} {label}</span>
              <span className="tabular-nums font-semibold" style={{ color }}>NT$ {fmt(amount)}</span>
            </div>
          ))}
          <div className="border-t pt-2 flex items-center justify-between" style={{ borderColor: "var(--border-inner)" }}>
            <span className="text-[14px] font-bold" style={{ color: "var(--text-primary)" }}>= 每月可存（估）</span>
            <span className="text-[18px] font-black tabular-nums"
              style={{ color: effectiveMonthly >= nextMonthlyNeeded ? "#34D399" : "#F59E0B" }}>
              NT$ {fmt(Math.max(0, effectiveMonthly))}
            </span>
          </div>
        </div>

        {/* Status */}
        {!nextPayment ? (
          <div className="rounded-xl px-4 py-3" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
            <p className="text-[14px] font-semibold" style={{ color: "#34D399" }}>✅ 所有學費已備妥，無需額外儲蓄行動</p>
          </div>
        ) : nextGap === 0 ? (
          <div className="rounded-xl px-4 py-3" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
            <p className="text-[14px] font-semibold" style={{ color: "#34D399" }}>✅ 下筆繳費 NT$ {fmt(nextPayment.amount)} 已備妥</p>
            <p className="text-[13px] mt-0.5" style={{ color: "var(--text-muted)" }}>繳款後記得更新「已繳次數」</p>
          </div>
        ) : canMeetNext ? (
          <div className="rounded-xl px-4 py-3" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
            <p className="text-[14px] font-semibold" style={{ color: "#FCD34D" }}>
              📚 距 {nextPayment.label} 還有 {nextPayment.monthsAway} 個月，每月存 NT$ {fmt(Math.ceil(nextMonthlyNeeded))} 可達標
            </p>
            <p className="text-[13px] mt-0.5" style={{ color: "var(--text-muted)" }}>
              還差 NT$ {fmt(nextGap)}，按目前可存 NT$ {fmt(Math.max(0, effectiveMonthly))}/月 預計達標
            </p>
          </div>
        ) : (
          <div className="rounded-xl px-4 py-3" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <p className="text-[14px] font-semibold" style={{ color: "#FCA5A5" }}>
              ⚠ 下筆 {nextPayment.label} NT$ {fmt(nextPayment.amount)} 需加速存款
            </p>
            <p className="text-[13px] mt-0.5" style={{ color: "#F87171" }}>
              還差 NT$ {fmt(nextGap)}，需每月存 NT$ {fmt(Math.ceil(nextMonthlyNeeded))}，但可存 NT$ {fmt(Math.max(0, effectiveMonthly))} 不足
            </p>
          </div>
        )}

        {/* Concrete recommendations */}
        <div className="space-y-2">
          {nextPayment && nextGap > 0 && (
            <div className="flex items-start gap-2.5 rounded-xl px-4 py-3"
              style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)" }}>
              <span className="mt-0.5 flex-shrink-0">📅</span>
              <div>
                <p className="text-[13px] font-semibold" style={{ color: "#818CF8" }}>
                  每月定存 NT$ {fmt(Math.ceil(nextMonthlyNeeded))} 至教育基金
                </p>
                <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                  建議設定自動轉帳，{nextPayment.monthsAway} 個月後（{nextPayment.label}）繳款 NT$ {fmt(nextPayment.amount)}
                </p>
              </div>
            </div>
          )}
          {sharesBankWithGrad && (
            <div className="flex items-start gap-2.5 rounded-xl px-4 py-3"
              style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)" }}>
              <span className="mt-0.5 flex-shrink-0">🔗</span>
              <div>
                <p className="text-[13px] font-semibold" style={{ color: "#818CF8" }}>共用帳戶：繳費前確認餘額不影響研究所存款目標</p>
                <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                  繳款 NT$ {fmt(nextPayment?.amount ?? 0)} 後，帳戶餘額約 NT$ {fmt(Math.max(0, currentSavings - (nextPayment?.amount ?? 0)))}
                </p>
              </div>
            </div>
          )}
          <div className="flex items-start gap-2.5 rounded-xl px-4 py-3"
            style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)" }}>
            <span className="mt-0.5 flex-shrink-0">💡</span>
            <div>
              <p className="text-[13px] font-semibold" style={{ color: "#34D399" }}>薪資正常發放，無需中斷儲蓄</p>
              <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                教育學程就讀期間仍持續工作，月收入 NT$ {fmt(avgMonthlyIncome)} 維持不變，與研究所規劃最大差異
              </p>
            </div>
          </div>
          {totalRemaining > 0 && (
            <div className="flex items-start gap-2.5 rounded-xl px-4 py-3"
              style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)" }}>
              <span className="mt-0.5 flex-shrink-0">🎯</span>
              <div>
                <p className="text-[13px] font-semibold" style={{ color: "#FCD34D" }}>
                  剩餘學費共 NT$ {fmt(totalRemaining)}，分 {remainingPayments.length} 次繳完
                </p>
                <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                  按目前可存速率，預計 {achieveDate ? achieveDate + " 存足下筆" : "持續追蹤"}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 繳費時間表 ── */}
      <SectionLabel>繳費時間表</SectionLabel>
      <div className="space-y-2">
        {schedule.map((p, i) => {
          const isNext = !p.isPaid && p.monthsAway >= 0 && schedule.find(x => !x.isPaid && x.monthsAway >= 0) === p;
          const monthsUntil = p.monthsAway;
          const canAfford = currentSavings >= p.amount;
          const accumulatedByThen = effectiveMonthly > 0 && monthsUntil > 0
            ? currentSavings + effectiveMonthly * monthsUntil
            : currentSavings;
          const projectedOk = accumulatedByThen >= p.amount;

          return (
            <div key={i}
              className="flex items-center gap-4 rounded-xl px-4 py-3"
              style={{
                background: p.isPaid
                  ? "rgba(16,185,129,0.06)"
                  : isNext
                    ? `${statusColor}0d`
                    : "var(--bg-input)",
                border: `1px solid ${p.isPaid ? "rgba(16,185,129,0.2)" : isNext ? statusColor + "30" : "var(--border-inner)"}`,
              }}>
              {/* 序號 */}
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[13px] font-black"
                style={{
                  background: p.isPaid ? "#10B981" : isNext ? statusColor : "rgba(255,255,255,0.06)",
                  color: p.isPaid || isNext ? "#000" : "var(--text-muted)",
                }}>
                {p.isPaid ? "✓" : i + 1}
              </div>

              {/* 日期 & 金額 */}
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold" style={{ color: p.isPaid ? "#10B981" : isNext ? statusColor : "var(--text-primary)" }}>
                  {p.label}
                  {isNext && <span className="ml-2 text-[11px] font-normal px-1.5 py-0.5 rounded-full"
                    style={{ background: `${statusColor}25`, color: statusColor }}>下一筆</span>}
                </p>
                <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                  NT$ {fmt(p.amount)}
                  {p.isPaid && " · 已繳"}
                  {!p.isPaid && p.monthsAway >= 0 && ` · ${p.monthsAway} 個月後`}
                </p>
              </div>

              {/* 右側狀態 */}
              <div className="text-right flex-shrink-0">
                {p.isPaid ? (
                  <p className="text-[13px] font-bold" style={{ color: "#10B981" }}>已繳</p>
                ) : p.monthsAway < 0 ? (
                  <p className="text-[13px] font-bold" style={{ color: "#F87171" }}>待確認</p>
                ) : (
                  <p className="text-[13px] font-bold" style={{ color: projectedOk ? "#34D399" : "#F59E0B" }}>
                    {projectedOk ? "預測可達" : "需加速"}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 總覽 ── */}
      <SectionLabel>學費總覽</SectionLabel>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="已繳金額"    value={`NT$ ${fmt(paidTotal)}`}     sub={`${settings.paidCount} 次`}                                color="#10B981" />
        <StatCard label="剩餘學費"    value={`NT$ ${fmt(totalRemaining)}`} sub={`${remainingPayments.length} 次`}                         color="#F87171" />
        <StatCard label="全程學費"    value={`NT$ ${fmt(grandTotal)}`}     sub={`${settings.totalPayments} 次 · 平均 NT$ ${fmt(grandTotal / Math.max(1, settings.totalPayments))}/次`} color="var(--text-primary)" />
      </div>

    </div>
  );
}
