"use client";

import { useEffect, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

interface GoalItem { id: string; name: string; emoji: string; savedAmount: number; targetAmount: number; linkedSource: string | null }
interface BalanceItem { source: string; balance: number }
interface MonthlySummary { month: string; income: number; expense: number }
interface SummaryData { monthly: MonthlySummary[]; totals: { income: number; expense: number; net: number } }
interface LoanItem {
  status: string;
  remainingPrincipal: string;
  interestRate: string;
  payments: { principalPaid: string; interestPaid: string }[];
}
interface FixedExpenseItem { amount: number }
interface BudgetItem { amount: number }

const STORAGE_KEY = "emergency_fund_plan_v1";

interface PlanSettings {
  linkedGoalId: string;
  targetMonths: number;
  manualTarget: number;        // 0 = 自動依月支出計算
  initialSavings: number;      // 無連結目標時手動填入
  monthlyContribution: number; // 0 = 依月淨收入估算
  notes: string;
}

const DEFAULT_SETTINGS: PlanSettings = {
  linkedGoalId: "",
  targetMonths: 3,
  manualTarget: 0,
  initialSavings: 0,
  monthlyContribution: 0,
  notes: "",
};

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (!Number.isFinite(n)) return "0";
  return Math.abs(Math.round(n)).toLocaleString("zh-TW");
}

function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + Math.ceil(n));
  return d;
}

function formatYM(date: Date): string {
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}`;
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-widest mt-6 mb-2"
      style={{ color: "var(--text-muted)" }}>{children}</p>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function EmergencyFundPlanner() {
  const [settings, setSettings] = useState<PlanSettings>(DEFAULT_SETTINGS);
  const [editMode, setEditMode] = useState(false);
  const [draft,    setDraft]    = useState<PlanSettings>(DEFAULT_SETTINGS);
  const [savings,  setSavings]  = useState<number | null>(null);
  const [goals,    setGoals]    = useState<GoalItem[]>([]);
  const [balances, setBalances] = useState<BalanceItem[]>([]);
  const [avgMonthlyExpense,  setAvgMonthlyExpense]  = useState<number>(0);
  const [avgMonthlyIncome,   setAvgMonthlyIncome]   = useState<number>(0);
  const [totalFixedExpenses, setTotalFixedExpenses] = useState<number>(0);
  const [totalLoanMonthly,   setTotalLoanMonthly]   = useState<number>(0);
  const [totalBudget,        setTotalBudget]        = useState<number>(0);
  const [loading,  setLoading]  = useState(true);

  // 載入 localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<PlanSettings>) };
        setSettings(saved);
        setDraft(saved);
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
      const goalsData: GoalItem[]          = goalsRes.status    === "fulfilled" && Array.isArray(goalsRes.value)    ? goalsRes.value    : [];
      const balancesData: BalanceItem[]    = balancesRes.status === "fulfilled" && Array.isArray(balancesRes.value) ? balancesRes.value : [];
      const sumData: SummaryData | null    = sumRes.status === "fulfilled" && sumRes.value && typeof sumRes.value === "object" && "monthly" in sumRes.value
        ? sumRes.value as SummaryData : null;
      const fixedRaw = fixedRes.status === "fulfilled" && fixedRes.value && typeof fixedRes.value === "object" ? fixedRes.value : {};
      const fixedData: FixedExpenseItem[]  = Array.isArray((fixedRaw as { fixedExpenses?: unknown }).fixedExpenses) ? (fixedRaw as { fixedExpenses: FixedExpenseItem[] }).fixedExpenses : [];
      const loansData: LoanItem[]          = loansRes.status === "fulfilled" && Array.isArray(loansRes.value) ? loansRes.value : [];
      const budgetsRaw = budgetsRes.status === "fulfilled" && budgetsRes.value && typeof budgetsRes.value === "object" ? budgetsRes.value : {};
      const budgetsData: BudgetItem[]      = Array.isArray((budgetsRaw as { budgets?: unknown }).budgets) ? (budgetsRaw as { budgets: BudgetItem[] }).budgets : [];

      setGoals(goalsData);
      setBalances(balancesData);

      const monthly = sumData?.monthly ?? [];
      const recent  = monthly.slice(-3);
      if (recent.length > 0) {
        setAvgMonthlyExpense(recent.reduce((s, m) => s + (Number(m.expense) || 0), 0) / recent.length);
        setAvgMonthlyIncome(recent.reduce((s, m) => s + (Number(m.income) || 0), 0) / recent.length);
      }

      // 固定支出月合計
      setTotalFixedExpenses(fixedData.reduce((s, f) => s + f.amount, 0));

      // 貸款月還款 = 最近一筆還款的本金 + 利息（無還款記錄則估算利息）
      const loanMonthly = loansData
        .filter(l => l.status === "active")
        .reduce((s, l) => {
          const pay = l.payments?.[0];
          if (pay) {
            return s + Number(pay.principalPaid) + Number(pay.interestPaid);
          }
          // fallback：僅估算利息（無還款記錄）
          return s + Number(l.remainingPrincipal) * (Number(l.interestRate) / 100 / 12);
        }, 0);
      setTotalLoanMonthly(loanMonthly);

      // 預算月合計
      setTotalBudget(budgetsData.reduce((s, b) => s + b.amount, 0));
    }).catch(e => console.error("[EmergencyFundPlanner]", e))
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
    // 立即同步已存金額
    if (next.linkedGoalId) {
      const goal = goals.find(g => g.id === next.linkedGoalId);
      if (goal) {
        if (goal.linkedSource) {
          const bank = balances.find(b => b.source === goal.linkedSource);
          setSavings(bank ? bank.balance : goal.savedAmount);
        } else {
          setSavings(goal.savedAmount);
        }
      }
    } else {
      setSavings(next.initialSavings > 0 ? next.initialSavings : null);
    }
  }

  // ── Computed ─────────────────────────────────────────────────────────────

  const currentSavings = savings ?? 0;

  // 目標金額：手動 > 月支出 × 目標月數
  const target = settings.manualTarget > 0
    ? settings.manualTarget
    : settings.targetMonths * avgMonthlyExpense;

  // 目前覆蓋幾個月
  const coverageMonths = avgMonthlyExpense > 0 ? currentSavings / avgMonthlyExpense : 0;

  // 缺口 & 每月可存
  const gap = Math.max(0, target - currentSavings);
  // 每月可存 = 收入 - 固定支出 - 貸款還款 - 預算
  const autoMonthlyAvailable = avgMonthlyIncome - totalFixedExpenses - totalLoanMonthly - totalBudget;
  const effectiveMonthly = settings.monthlyContribution > 0 ? settings.monthlyContribution : autoMonthlyAvailable;
  const monthsToGoal = effectiveMonthly > 0 && gap > 0 ? gap / effectiveMonthly : null;
  const achieveDate  = monthsToGoal ? addMonths(new Date(), monthsToGoal) : null;
  const progressPct  = target > 0 ? Math.min(100, (currentSavings / target) * 100) : 0;

  // 覆蓋等級
  const coverageLevel =
    coverageMonths >= settings.targetMonths ? { label: "目標達成", color: "#10B981", emoji: "✅" } :
    coverageMonths >= 2                     ? { label: "接近目標", color: "#34D399", emoji: "🟢" } :
    coverageMonths >= 1                     ? { label: "警戒",     color: "#F59E0B", emoji: "⚠️" } :
                                              { label: "危險",     color: "#EF4444", emoji: "🚨" };

  // 里程碑
  const milestones = [1, 2, 3].map(m => ({
    months: m,
    target: avgMonthlyExpense * m,
    reached: currentSavings >= avgMonthlyExpense * m,
    label: `${m} 個月`,
  }));

  // ── 設定表單 ────────────────────────────────────────────────────────────

  if (editMode) {
    const inputCls = "w-full rounded-xl px-4 py-2.5 text-[14px] outline-none"
      + " bg-[var(--bg-input)] border border-[var(--border-inner)] text-[var(--text-primary)]"
      + " focus:border-[var(--accent-light)] transition-colors";
    const labelCls = "text-[13px] font-semibold text-[var(--text-sub)]";
    const selectCls = inputCls + " [&>option]:bg-[#1e293b] [&>option]:text-white";

    return (
      <div className="space-y-5 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[20px] font-black" style={{ color: "var(--text-primary)" }}>🛡️ 緊急預備金設定</h2>
            <p className="text-[13px] mt-0.5" style={{ color: "var(--text-muted)" }}>調整目標設定後儲存</p>
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
            <label className={labelCls}>連結財務目標</label>
            <select className={selectCls} value={draft.linkedGoalId}
              onChange={e => setDraft(d => ({ ...d, linkedGoalId: e.target.value }))}>
              <option value="">（不連結，手動輸入）</option>
              {goals.map(g => (
                <option key={g.id} value={g.id}>{g.emoji} {g.name}</option>
              ))}
            </select>
            <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
              連結目標後，已存金額會自動同步連結銀行帳戶或目標進度
            </p>
          </div>

          {/* 若無連結目標：手動輸入已存金額 */}
          {!draft.linkedGoalId && (
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>目前已存金額（手動）</label>
              <input type="number" className={inputCls} min={0}
                value={draft.initialSavings || ""}
                onChange={e => setDraft(d => ({ ...d, initialSavings: Number(e.target.value) }))}
                placeholder="0" />
            </div>
          )}

          {/* 目標覆蓋月數 */}
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>目標覆蓋月數</label>
            <select className={selectCls} value={draft.targetMonths}
              onChange={e => setDraft(d => ({ ...d, targetMonths: Number(e.target.value), manualTarget: 0 }))}>
              {[1, 2, 3, 4, 6, 9, 12].map(m => (
                <option key={m} value={m}>{m} 個月支出</option>
              ))}
            </select>
            <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
              目標金額 = 月均支出 × 月數（目前月均支出 NT$ {fmt(avgMonthlyExpense)}）
            </p>
          </div>

          {/* 手動目標金額（選填，覆蓋月數計算） */}
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>手動指定目標金額（選填，留空則自動計算）</label>
            <input type="number" className={inputCls} min={0}
              value={draft.manualTarget || ""}
              onChange={e => setDraft(d => ({ ...d, manualTarget: Number(e.target.value) }))}
              placeholder={`自動：NT$ ${fmt(draft.targetMonths * avgMonthlyExpense)}`} />
          </div>

          {/* 計畫每月存入 */}
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>計畫每月存入金額（選填，留空則用月淨收入估算）</label>
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
              placeholder="例：放在玉山數位帳戶" />
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

  const linkedGoal = settings.linkedGoalId ? goals.find(g => g.id === settings.linkedGoalId) : null;

  return (
    <div className="space-y-3 max-w-3xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[22px] font-black flex items-center gap-2"
            style={{ color: "var(--text-primary)" }}>
            🛡️ 緊急預備金規劃
          </h2>
          <p className="text-[13px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            目標：{settings.targetMonths} 個月支出覆蓋
            {linkedGoal && <span> · 連結 <span className="font-semibold">{linkedGoal.emoji} {linkedGoal.name}</span></span>}
            {settings.notes && <span> · {settings.notes}</span>}
          </p>
        </div>
        <button onClick={() => { setDraft(settings); setEditMode(true); }}
          className="flex-shrink-0 text-[13px] font-semibold px-4 py-2 rounded-xl transition-opacity hover:opacity-80"
          style={{ background: "var(--bg-input)", color: "var(--text-sub)", border: "1px solid var(--border-inner)" }}>
          ✏️ 編輯設定
        </button>
      </div>

      {/* ── 覆蓋狀態卡 ── */}
      <div className="rounded-2xl p-5 relative overflow-hidden"
        style={{ background: "var(--bg-card)", border: `1px solid ${coverageLevel.color}30`, boxShadow: `0 0 24px ${coverageLevel.color}10` }}>
        <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
          style={{ background: `linear-gradient(90deg, ${coverageLevel.color}, ${coverageLevel.color}80)` }} />

        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[13px] font-semibold tracking-widest uppercase" style={{ color: "var(--text-muted)" }}>
              目前覆蓋能力
            </p>
            <p className="text-[48px] font-black leading-none mt-1 tabular-nums"
              style={{ color: coverageLevel.color }}>
              {coverageMonths.toFixed(1)}
              <span className="text-[22px] font-bold ml-1">個月</span>
            </p>
          </div>
          <div className="text-center">
            <span className="text-[40px]">{coverageLevel.emoji}</span>
            <p className="text-[14px] font-bold mt-1" style={{ color: coverageLevel.color }}>{coverageLevel.label}</p>
          </div>
        </div>

        {/* 進度條 */}
        <div className="mb-1">
          <div className="flex justify-between text-[12px] mb-2" style={{ color: "var(--text-muted)" }}>
            <span>已存 NT$ {fmt(currentSavings)}</span>
            <span>目標 NT$ {fmt(target)}　{Math.round(progressPct)}%</span>
          </div>
          <div className="h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${progressPct}%`, background: `linear-gradient(90deg, ${coverageLevel.color}, ${coverageLevel.color}cc)` }} />
          </div>
        </div>

        {/* 里程碑刻度 */}
        <div className="relative mt-3 grid grid-cols-3 gap-1">
          {milestones.map(ms => (
            <div key={ms.months} className="flex flex-col items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ background: ms.reached ? coverageLevel.color : "rgba(255,255,255,0.15)" }} />
              <p className="text-[11px] font-semibold" style={{ color: ms.reached ? coverageLevel.color : "var(--text-muted)" }}>
                {ms.reached ? "✓ " : ""}{ms.label}
              </p>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>NT$ {fmt(ms.target)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── 統計 ── */}
      <SectionLabel>儲蓄進度</SectionLabel>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="缺口"
          value={gap > 0 ? `NT$ ${fmt(gap)}` : "已達標"}
          sub={gap > 0 ? `距目標還差 ${fmt(gap)} 元` : "超額 NT$ " + fmt(currentSavings - target)}
          color={gap > 0 ? "#F87171" : "#10B981"}
          accent={gap === 0}
        />
        <StatCard
          label="每月可存（估）"
          value={`NT$ ${fmt(Math.max(0, effectiveMonthly))}`}
          sub={settings.monthlyContribution > 0
            ? "手動設定"
            : `收入 ${fmt(avgMonthlyIncome)} − 固定 ${fmt(totalFixedExpenses)} − 貸款 ${fmt(totalLoanMonthly)} − 預算 ${fmt(totalBudget)}`}
          color={effectiveMonthly > 0 ? "#60A5FA" : "#F87171"}
        />
        <StatCard
          label="預計達成"
          value={achieveDate ? formatYM(achieveDate) : gap === 0 ? "已達標" : "—"}
          sub={monthsToGoal ? `約 ${Math.ceil(monthsToGoal)} 個月後` : undefined}
          color={achieveDate ? "#A78BFA" : "#10B981"}
          accent={gap === 0}
        />
        <StatCard
          label="月均支出"
          value={`NT$ ${fmt(avgMonthlyExpense)}`}
          sub="近 3 個月平均"
          color="var(--text-primary)"
        />
      </div>

      {/* ── 里程碑詳情 ── */}
      <SectionLabel>存款里程碑</SectionLabel>
      <div className="space-y-2">
        {milestones.map(ms => {
          const msGap = Math.max(0, ms.target - currentSavings);
          const msMonths = effectiveMonthly > 0 && msGap > 0 ? msGap / effectiveMonthly : null;
          const msDate = msMonths ? addMonths(new Date(), msMonths) : null;
          return (
            <div key={ms.months}
              className="flex items-center gap-4 rounded-xl px-4 py-3"
              style={{
                background: ms.reached ? `${coverageLevel.color}10` : "var(--bg-input)",
                border: `1px solid ${ms.reached ? coverageLevel.color + "30" : "var(--border-inner)"}`,
              }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[14px] font-black"
                style={{ background: ms.reached ? coverageLevel.color : "rgba(255,255,255,0.06)", color: ms.reached ? "#000" : "var(--text-muted)" }}>
                {ms.reached ? "✓" : ms.months}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold" style={{ color: ms.reached ? coverageLevel.color : "var(--text-primary)" }}>
                  {ms.months} 個月緊急預備金
                  {ms.reached && <span className="ml-2 text-[12px] font-normal">✅ 已達成</span>}
                </p>
                <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>NT$ {fmt(ms.target)}</p>
              </div>
              <div className="text-right">
                {ms.reached ? (
                  <p className="text-[13px] font-bold" style={{ color: coverageLevel.color }}>達成</p>
                ) : (
                  <>
                    <p className="text-[13px] font-bold" style={{ color: "var(--text-primary)" }}>
                      {msDate ? formatYM(msDate) : "—"}
                    </p>
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                      缺 NT$ {fmt(msGap)}
                    </p>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 風險分析 ── */}
      <SectionLabel>財務風險分析</SectionLabel>
      <div className="rounded-2xl p-5 space-y-3"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-card)" }}>
        {[
          {
            icon: coverageMonths >= 1 ? "✅" : "❌",
            label: "短期緊急事件（1 個月）",
            desc: coverageMonths >= 1
              ? `目前可支撐 ${coverageMonths.toFixed(1)} 個月，短期緊急事件有保障`
              : `缺口 NT$ ${fmt(avgMonthlyExpense - currentSavings)}，遭遇緊急支出恐需借貸`,
            ok: coverageMonths >= 1,
          },
          {
            icon: coverageMonths >= 3 ? "✅" : coverageMonths >= 1 ? "⚠️" : "❌",
            label: "中期失業或重病（3 個月）",
            desc: coverageMonths >= 3
              ? "已達 3 個月標準，失業或重病期間可維持生活"
              : `建議儲備至 NT$ ${fmt(avgMonthlyExpense * 3)}（目前 ${coverageMonths.toFixed(1)} 個月）`,
            ok: coverageMonths >= 3,
          },
          {
            icon: coverageMonths >= 6 ? "✅" : "⚠️",
            label: "長期職涯轉換（6 個月）",
            desc: coverageMonths >= 6
              ? "超過 6 個月，可安心規劃職涯轉換或進修"
              : `進修或轉職前建議累積至 NT$ ${fmt(avgMonthlyExpense * 6)}`,
            ok: coverageMonths >= 6,
          },
        ].map(item => (
          <div key={item.label} className="flex items-start gap-3">
            <span className="text-[18px] mt-0.5 flex-shrink-0">{item.icon}</span>
            <div>
              <p className="text-[14px] font-semibold" style={{ color: item.ok ? "#34D399" : "var(--text-primary)" }}>{item.label}</p>
              <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── 行動建議 ── */}
      {gap > 0 && (
        <>
          <SectionLabel>行動建議</SectionLabel>
          <div className="rounded-2xl p-5 space-y-2"
            style={{ background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.2)" }}>
            {[
              effectiveMonthly > 0 && gap > 0 && `每月持續存入 NT$ ${fmt(effectiveMonthly)}，預計 ${monthsToGoal ? Math.ceil(monthsToGoal) : "—"} 個月達標`,
              settings.monthlyContribution === 0 && autoMonthlyAvailable < gap / 6 && "建議在設定中指定固定每月存入金額，讓規劃更精準",
              coverageMonths < 1 && "⚡ 優先建立 1 個月緊急預備金，避免臨時借貸",
              !settings.linkedGoalId && "建議在財務目標中新增「緊急預備金」目標並連結專用帳戶",
              settings.notes && `備註：${settings.notes}`,
            ].filter(Boolean).map((tip, i) => (
              <div key={i} className="flex items-start gap-2 text-[13px]" style={{ color: "var(--text-primary)" }}>
                <span className="mt-0.5 flex-shrink-0 text-indigo-400">›</span>
                <span>{tip}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* 已達標訊息 */}
      {gap === 0 && (
        <div className="rounded-2xl p-5 text-center"
          style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)" }}>
          <p className="text-[32px] mb-2">🎉</p>
          <p className="text-[16px] font-bold" style={{ color: "#10B981" }}>緊急預備金目標已達成！</p>
          <p className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>
            目前已存 NT$ {fmt(currentSavings)}，可覆蓋 {coverageMonths.toFixed(1)} 個月支出。
            {coverageMonths < 6 && " 考慮繼續存到 6 個月以應對更長期的不確定性。"}
          </p>
        </div>
      )}

    </div>
  );
}
