"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
  AreaChart, Area,
} from "recharts";
import {
  DEMO_INCOME_12, DEMO_ACCOUNT_FLOW, DEMO_FIXED_EXPENSES,
  DEMO_SUMMARY, DEMO_BUDGETS, DEMO_BALANCES,
} from "@/lib/demo-data";
import type { AccountFlowResponse } from "@/app/api/account-flow/route";

// ── Shared helpers ─────────────────────────────────────────────────────────

function fmt(n: number) {
  return Math.round(Math.abs(n)).toLocaleString("zh-TW");
}

function monthLabel(yyyymm: string) {
  return `${parseInt(yyyymm.slice(5, 7))}月`;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/** Compound interest: months until balance >= target. Returns -1 if never. */
function monthsToTarget(current: number, monthly: number, annualRate: number, target: number): number {
  if (target <= 0 || current >= target) return 0;
  const r = annualRate / 100 / 12;
  let bal = current;
  for (let n = 1; n <= 600; n++) {
    bal = r > 0 ? bal * (1 + r) + monthly : bal + monthly;
    if (bal >= target) return n;
  }
  return -1;
}

// ── Shared UI ──────────────────────────────────────────────────────────────

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border ${className}`}
      style={{ background: "var(--bg-card)", borderColor: "var(--border)", boxShadow: "var(--card-shadow)" }}>
      {children}
    </div>
  );
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border-inner)" }}>
      <p className="font-bold text-[15px]" style={{ color: "var(--text-primary)" }}>{title}</p>
      {sub && <p className="text-[14px] mt-0.5" style={{ color: "var(--text-muted)" }}>{sub}</p>}
    </div>
  );
}

const inputClass =
  "w-full rounded-xl px-3 py-2 text-sm outline-none" +
  " bg-[var(--bg-input)] border border-[var(--border)] focus:border-[var(--accent)]" +
  " text-[var(--text-primary)]";
const labelClass = "text-[14px] font-medium mb-1 block text-[var(--text-sub)]";

function ChartTip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-4 py-2.5 text-[14px]"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
      <p className="font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>{label}</p>
      {payload.map(p => (
        <p key={p.name} className="tabular-nums" style={{ color: p.color }}>
          {p.name}：NT$ {fmt(p.value)}
        </p>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// 1. 退休金試算
// ══════════════════════════════════════════════════════════════════════════

export function RetirementCalc({ isDemo }: { isDemo: boolean }) {
  const [target,   setTarget]   = useState("20000000");
  const [current,  setCurrent]  = useState("149280");   // demo: total assets
  const [monthly,  setMonthly]  = useState("10000");
  const [rate,     setRate]     = useState("5");

  // load current savings from balances once
  useEffect(() => {
    if (isDemo) return;
    fetch("/api/balances")
      .then(r => r.json())
      .then((b: { source: string; balance: number }[]) => {
        const total = b.filter(x => x.balance > 0).reduce((s, x) => s + x.balance, 0);
        if (total > 0) setCurrent(String(Math.round(total)));
      })
      .catch(() => {/* ignore */});
  }, [isDemo]);

  const targetN  = parseFloat(target)  || 0;
  const currentN = parseFloat(current) || 0;
  const monthlyN = parseFloat(monthly) || 0;
  const rateN    = parseFloat(rate)    || 0;

  const months = monthsToTarget(currentN, monthlyN, rateN, targetN);
  const years  = months > 0 ? Math.floor(months / 12) : 0;
  const remMo  = months > 0 ? months % 12 : 0;
  const pct    = targetN > 0 ? Math.min((currentN / targetN) * 100, 100) : 0;

  const timeLabel = months === -1 ? "無法達成（請增加儲蓄或報酬率）"
    : months === 0 ? "已達成 🎉"
    : years > 0 && remMo > 0 ? `${years} 年 ${remMo} 個月`
    : years > 0 ? `${years} 年`
    : `${months} 個月`;

  return (
    <Card>
      <SectionHeader title="🏖️ 退休金試算" sub="複利滾存，計算達到退休目標所需年數" />
      <div className="px-5 py-4 space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>退休目標金額（NT$）</label>
            <input className={inputClass} type="number" value={target}
              onWheel={e => e.currentTarget.blur()} onChange={e => setTarget(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>目前累積儲蓄（NT$）</label>
            <input className={inputClass} type="number" value={current}
              onWheel={e => e.currentTarget.blur()} onChange={e => setCurrent(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>每月儲蓄（NT$）</label>
            <input className={inputClass} type="number" value={monthly}
              onWheel={e => e.currentTarget.blur()} onChange={e => setMonthly(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>預期年化報酬率（%）</label>
            <input className={inputClass} type="number" step="0.1" value={rate}
              onWheel={e => e.currentTarget.blur()} onChange={e => setRate(e.target.value)} />
          </div>
        </div>

        {/* Progress */}
        <div className="rounded-2xl p-4" style={{ background: "var(--bg-input)", border: "1px solid var(--border-inner)" }}>
          <div className="flex justify-between items-baseline mb-2">
            <p className="text-[14px]" style={{ color: "var(--text-sub)" }}>目前進度</p>
            <p className="text-[14px] font-bold tabular-nums" style={{ color: "var(--accent-light)" }}>
              {pct.toFixed(1)}%
            </p>
          </div>
          <div className="h-3 rounded-full overflow-hidden mb-2" style={{ background: "var(--border)" }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${pct}%`, background: "linear-gradient(90deg,#6366f1,#10b981)" }} />
          </div>
          <div className="flex justify-between text-[14px]" style={{ color: "var(--text-muted)" }}>
            <span>NT$ {fmt(currentN)}</span>
            <span>目標 NT$ {fmt(targetN)}</span>
          </div>
        </div>

        {/* Result */}
        <div className="rounded-2xl p-4 text-center"
          style={{
            background: months === 0 ? "rgba(16,185,129,0.1)" : months === -1 ? "rgba(239,68,68,0.1)" : "rgba(99,102,241,0.1)",
            border: `1px solid ${months === 0 ? "#10b981" : months === -1 ? "#ef4444" : "#6366f1"}40`,
          }}>
          <p className="text-[14px] mb-1" style={{ color: "var(--text-muted)" }}>預計達成時間</p>
          <p className="text-[26px] font-black"
            style={{ color: months === 0 ? "#10b981" : months === -1 ? "#ef4444" : "#6366f1" }}>
            {timeLabel}
          </p>
          {months > 0 && (
            <p className="text-[14px] mt-1" style={{ color: "var(--text-muted)" }}>
              每月儲蓄 NT$ {fmt(monthlyN)}，年報酬率 {rateN}%
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// 2. FIRE 財務獨立試算
// ══════════════════════════════════════════════════════════════════════════

export function FireCalc({ isDemo }: { isDemo: boolean }) {
  const [assets,   setAssets]   = useState("149280");
  const [monthly,  setMonthly]  = useState("10000");
  const [expense,  setExpense]  = useState("42000");  // avg monthly expense
  const [rate,     setRate]     = useState("5");

  useEffect(() => {
    if (isDemo) return;
    Promise.all([
      fetch("/api/balances").then(r => r.json()),
      fetch("/api/summary?months=6").then(r => r.json()),
    ]).then(([balances, summary]: [{ balance: number }[], { monthly: { expense: number }[] }]) => {
      const totalAssets = balances.filter((b) => b.balance > 0).reduce((s, b) => s + b.balance, 0);
      if (totalAssets > 0) setAssets(String(Math.round(totalAssets)));
      const months = summary.monthly ?? [];
      if (months.length > 0) {
        const avgExpense = months.reduce((s, m) => s + m.expense, 0) / months.length;
        setExpense(String(Math.round(avgExpense)));
      }
    }).catch(() => {/* ignore */});
  }, [isDemo]);

  const assetsN  = parseFloat(assets)  || 0;
  const monthlyN = parseFloat(monthly) || 0;
  const expenseN = parseFloat(expense) || 0;
  const rateN    = parseFloat(rate)    || 0;

  // FI target: annual expense / 4% = monthly expense * 300
  const fiTarget  = expenseN * 300;
  const pct       = fiTarget > 0 ? Math.min((assetsN / fiTarget) * 100, 100) : 0;
  const remaining = Math.max(0, fiTarget - assetsN);
  const months    = monthsToTarget(assetsN, monthlyN, rateN, fiTarget);
  const years     = months > 0 ? (months / 12).toFixed(1) : "0";

  const timeLabel = months === -1 ? "無法達成"
    : months === 0 ? "已財務自由 🎉"
    : `約 ${years} 年後`;

  const srPct = expenseN > 0 && monthlyN > 0
    ? Math.round((monthlyN / (expenseN + monthlyN)) * 100) : 0;

  return (
    <Card>
      <SectionHeader title="🔥 FIRE 財務獨立試算" sub="4% 法則：投資組合年提領 4% 等於月支出×300" />
      <div className="px-5 py-4 space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>月均生活支出（NT$）</label>
            <input className={inputClass} type="number" value={expense}
              onWheel={e => e.currentTarget.blur()} onChange={e => setExpense(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>目前資產/投資（NT$）</label>
            <input className={inputClass} type="number" value={assets}
              onWheel={e => e.currentTarget.blur()} onChange={e => setAssets(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>每月新增投資（NT$）</label>
            <input className={inputClass} type="number" value={monthly}
              onWheel={e => e.currentTarget.blur()} onChange={e => setMonthly(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>預期年化報酬率（%）</label>
            <input className={inputClass} type="number" step="0.1" value={rate}
              onWheel={e => e.currentTarget.blur()} onChange={e => setRate(e.target.value)} />
          </div>
        </div>

        {/* FI Target card */}
        <div className="rounded-xl p-4 flex items-center justify-between"
          style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)" }}>
          <div>
            <p className="text-[14px]" style={{ color: "#fca5a5" }}>FIRE 目標（4% rule）</p>
            <p className="text-[22px] font-black tabular-nums" style={{ color: "#f87171" }}>
              NT$ {fmt(fiTarget)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[14px]" style={{ color: "var(--text-muted)" }}>還差</p>
            <p className="text-[16px] font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
              NT$ {fmt(remaining)}
            </p>
          </div>
        </div>

        {/* Progress */}
        <div>
          <div className="flex justify-between items-baseline mb-1.5">
            <p className="text-[14px]" style={{ color: "var(--text-sub)" }}>目前進度</p>
            <p className="text-[14px] font-bold" style={{ color: "#f59e0b" }}>{pct.toFixed(1)}%</p>
          </div>
          <div className="h-3 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${pct}%`, background: "linear-gradient(90deg,#f59e0b,#10b981)" }} />
          </div>
        </div>

        {/* Result + stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl p-4 text-center"
            style={{ background: "rgba(99,102,241,0.1)", border: "1px solid #6366f140" }}>
            <p className="text-[14px] mb-1" style={{ color: "var(--text-muted)" }}>預計達到 FIRE</p>
            <p className="text-[20px] font-black" style={{ color: "#818cf8" }}>{timeLabel}</p>
          </div>
          <div className="rounded-xl p-4 text-center"
            style={{ background: "var(--bg-input)", border: "1px solid var(--border-inner)" }}>
            <p className="text-[14px] mb-1" style={{ color: "var(--text-muted)" }}>當前儲蓄率</p>
            <p className="text-[20px] font-black"
              style={{ color: srPct >= 30 ? "#10b981" : srPct >= 15 ? "#f59e0b" : "#ef4444" }}>
              {srPct > 0 ? `${srPct}%` : "—"}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// 3. 收入穩定性分析
// ══════════════════════════════════════════════════════════════════════════

export function IncomeStability({ isDemo }: { isDemo: boolean }) {
  const [mdata,   setMdata]   = useState<{ month: string; income: number; expense: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemo) { setMdata(DEMO_INCOME_12); setLoading(false); return; }
    fetch("/api/summary?months=12")
      .then(r => r.json())
      .then((d: { monthly: { month: string; income: number; expense: number }[] }) => setMdata(d.monthly ?? []))
      .finally(() => setLoading(false));
  }, [isDemo]);

  const incomes = mdata.map(m => m.income).filter(v => v > 0);
  const mean    = incomes.length ? incomes.reduce((a, b) => a + b, 0) / incomes.length : 0;
  const sd      = stdDev(incomes);
  const cv      = mean > 0 ? (sd / mean) * 100 : 0;
  const maxMo   = mdata.reduce((a, b) => b.income > a.income ? b : a, mdata[0] ?? { month: "", income: 0 });
  const minMo   = mdata.filter(m => m.income > 0).reduce((a, b) => b.income < a.income ? b : a, mdata.find(m => m.income > 0) ?? { month: "", income: 0 });

  const stabilityLabel = cv < 5 ? "非常穩定 🏆" : cv < 10 ? "穩定 ✅" : cv < 20 ? "中等波動 ⚠️" : "高度波動 🚨";
  const stabilityColor = cv < 5 ? "#10b981" : cv < 10 ? "#10b981" : cv < 20 ? "#f59e0b" : "#ef4444";

  if (loading) return <Card><div className="flex justify-center py-10"><div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} /></div></Card>;

  return (
    <Card>
      <SectionHeader title="📈 收入穩定性分析" sub="過去 12 個月月收入波動統計" />
      <div className="px-5 py-4 space-y-5">
        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "月均收入",    value: `NT$ ${fmt(mean)}`,         color: "var(--text-primary)" },
            { label: "穩定性",      value: stabilityLabel,              color: stabilityColor },
            { label: "標準差",      value: `NT$ ${fmt(sd)}`,            color: "var(--text-sub)" },
            { label: "變異係數",    value: `${cv.toFixed(1)}%`,         color: cv < 10 ? "#10b981" : cv < 20 ? "#f59e0b" : "#ef4444" },
            { label: "最高月收入",  value: maxMo.month ? `${monthLabel(maxMo.month)} NT$ ${fmt(maxMo.income)}` : "—", color: "#10b981" },
            { label: "最低月收入",  value: minMo.month ? `${monthLabel(minMo.month)} NT$ ${fmt(minMo.income)}` : "—", color: "#f59e0b" },
          ].map(s => (
            <div key={s.label} className="rounded-xl px-4 py-3"
              style={{ background: "var(--bg-input)", border: "1px solid var(--border-inner)" }}>
              <p className="text-[14px] mb-0.5" style={{ color: "var(--text-muted)" }}>{s.label}</p>
              <p className="text-[14px] font-bold" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Bar chart with mean reference line */}
        <div>
          <p className="text-[14px] font-semibold mb-2" style={{ color: "var(--text-sub)" }}>月收入走勢</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={mdata} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border-inner)" strokeDasharray="3 3" />
              <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={n => `${Math.round(n / 1000)}K`} tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} width={34} />
              <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              {mean > 0 && <ReferenceLine y={mean} stroke="#6366f1" strokeDasharray="4 4" label={{ value: "均值", position: "right", fill: "#6366f1", fontSize: 10 }} />}
              <Bar dataKey="income" name="收入" radius={[3, 3, 0, 0]} maxBarSize={22}>
                {mdata.map((m, i) => (
                  <Cell key={i} fill={m.income >= mean ? "#10b981" : "#6366f1"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// 4. 固定 vs 變動支出比
// ══════════════════════════════════════════════════════════════════════════

export function ExpenseRatio({ isDemo }: { isDemo: boolean }) {
  const [mdata,    setMdata]    = useState<{ month: string; income: number; expense: number }[]>([]);
  const [fixedAmt, setFixedAmt] = useState(0);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    if (isDemo) {
      setMdata(DEMO_INCOME_12.slice(-6));
      setFixedAmt(DEMO_FIXED_EXPENSES.fixedExpenses.reduce((s, f) => s + f.amount, 0));
      setLoading(false);
      return;
    }
    Promise.all([
      fetch("/api/summary?months=6").then(r => r.json()),
      fetch("/api/fixed-expenses").then(r => r.json()),
    ]).then(([summary, fe]: [
      { monthly: { month: string; income: number; expense: number }[] },
      { fixedExpenses: { amount: number }[] },
    ]) => {
      setMdata(summary.monthly ?? []);
      setFixedAmt((fe.fixedExpenses ?? []).reduce((s, f) => s + f.amount, 0));
    }).finally(() => setLoading(false));
  }, [isDemo]);

  const chartData = mdata.filter(m => m.expense > 0).map(m => ({
    month:    m.month,
    fixed:    Math.min(fixedAmt, m.expense),
    variable: Math.max(0, m.expense - fixedAmt),
  }));

  const avgFixed    = chartData.length ? chartData.reduce((s, m) => s + m.fixed, 0) / chartData.length : 0;
  const avgVariable = chartData.length ? chartData.reduce((s, m) => s + m.variable, 0) / chartData.length : 0;
  const avgTotal    = avgFixed + avgVariable;
  const fixedPct    = avgTotal > 0 ? Math.round((avgFixed / avgTotal) * 100) : 0;
  const varPct      = 100 - fixedPct;

  if (loading) return <Card><div className="flex justify-center py-10"><div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} /></div></Card>;

  return (
    <Card>
      <SectionHeader title="⚖️ 固定 vs 變動支出" sub="每月必要固定支出與可控變動支出比例" />
      <div className="px-5 py-4 space-y-5">
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "固定支出（月均）", value: `NT$ ${fmt(avgFixed)}`, pct: `${fixedPct}%`, color: "#6366f1" },
            { label: "變動支出（月均）", value: `NT$ ${fmt(avgVariable)}`, pct: `${varPct}%`, color: "#f59e0b" },
            { label: "彈性空間",         value: varPct >= 40 ? "充足 ✅" : varPct >= 25 ? "普通 ⚠️" : "偏低 🚨", pct: `變動 ${varPct}%`, color: varPct >= 40 ? "#10b981" : varPct >= 25 ? "#f59e0b" : "#ef4444" },
          ].map(s => (
            <div key={s.label} className="rounded-xl px-3 py-3 text-center"
              style={{ background: "var(--bg-input)", border: "1px solid var(--border-inner)" }}>
              <p className="text-[14px] mb-0.5" style={{ color: "var(--text-muted)" }}>{s.label}</p>
              <p className="text-[14px] font-bold tabular-nums" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[14px] font-semibold mt-0.5" style={{ color: s.color }}>{s.pct}</p>
            </div>
          ))}
        </div>

        {/* Ratio bar */}
        <div>
          <p className="text-[14px] mb-1.5 font-medium" style={{ color: "var(--text-sub)" }}>平均月支出結構</p>
          <div className="h-6 rounded-full overflow-hidden flex"
            style={{ background: "var(--bg-input)" }}>
            <div className="h-full flex items-center justify-center text-[14px] font-bold text-white"
              style={{ width: `${fixedPct}%`, background: "#6366f1", minWidth: fixedPct > 0 ? "30px" : 0 }}>
              {fixedPct}%
            </div>
            <div className="h-full flex items-center justify-center text-[14px] font-bold text-white flex-1"
              style={{ background: "#f59e0b", minWidth: varPct > 0 ? "30px" : 0 }}>
              {varPct}%
            </div>
          </div>
          <div className="flex justify-between text-[14px] mt-1" style={{ color: "var(--text-muted)" }}>
            <span style={{ color: "#6366f1" }}>● 固定支出</span>
            <span style={{ color: "#f59e0b" }}>● 變動支出</span>
          </div>
        </div>

        {/* Stacked bar chart */}
        <div>
          <p className="text-[14px] font-semibold mb-2" style={{ color: "var(--text-sub)" }}>近 6 個月支出結構</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border-inner)" strokeDasharray="3 3" />
              <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={n => `${Math.round(n / 1000)}K`} tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} width={34} />
              <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Bar dataKey="fixed"    name="固定" stackId="a" fill="#6366f1" />
              <Bar dataKey="variable" name="變動" stackId="a" fill="#f59e0b" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// 5. 各帳戶月度流量分析
// ══════════════════════════════════════════════════════════════════════════

const SOURCE_LABELS: Record<string, string> = {
  esun_bank: "玉山銀行", ctbc_bank: "中國信託", kgi_bank: "凱基銀行",
  mega_bank: "兆豐銀行", sinopac_bank: "永豐銀行", yuanta_bank: "元大銀行",
  tbank: "台灣銀行", cathay_bank: "國泰世華",
  esun_cc: "玉山信用卡", ctbc_cc: "中信信用卡", cathay_cc: "國泰信用卡",
  taishin_cc: "台新信用卡", sinopac_cc: "永豐信用卡",
  line: "LINE Pay", cash: "現金",
};

const ACCOUNT_COLORS = ["#6366f1","#10b981","#f59e0b","#ef4444","#8b5cf6","#14b8a6","#f97316"];

export function AccountFlow({ isDemo }: { isDemo: boolean }) {
  const [data,    setData]    = useState<AccountFlowResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(() => {
    if (isDemo) {
      setData(DEMO_ACCOUNT_FLOW as AccountFlowResponse);
      setLoading(false);
      return;
    }
    fetch("/api/account-flow?months=6")
      .then(r => r.json())
      .then((d: AccountFlowResponse) => setData(d))
      .finally(() => setLoading(false));
  }, [isDemo]);

  useEffect(() => { load(); }, [load]);

  if (loading || !data) return <Card><div className="flex justify-center py-10"><div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} /></div></Card>;

  const showAccounts = selected ? data.accounts.filter(a => a.source === selected) : data.accounts;
  const chartData = data.months.map(month => {
    const row: Record<string, string | number> = { month };
    for (const acc of showAccounts) {
      const m = acc.monthly.find(x => x.month === month);
      row[`${acc.source}_in`]  = m?.income  ?? 0;
      row[`${acc.source}_out`] = m?.expense ?? 0;
    }
    return row;
  });

  return (
    <Card>
      <SectionHeader title="🏦 帳戶月度流量分析" sub="各帳戶每月資金流入/流出" />
      <div className="px-5 py-4 space-y-5">
        {/* Account selector */}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setSelected(null)}
            className="text-[14px] px-3 py-1 rounded-full font-medium"
            style={{
              background: !selected ? "var(--accent)" : "var(--bg-input)",
              color:      !selected ? "#fff" : "var(--text-sub)",
              border: `1px solid ${!selected ? "var(--accent)" : "var(--border-inner)"}`,
            }}>
            全部帳戶
          </button>
          {data.accounts.map((acc, i) => (
            <button key={acc.source} onClick={() => setSelected(s => s === acc.source ? null : acc.source)}
              className="text-[14px] px-3 py-1 rounded-full font-medium"
              style={{
                background: selected === acc.source ? ACCOUNT_COLORS[i % 7] : "var(--bg-input)",
                color:      selected === acc.source ? "#fff" : "var(--text-sub)",
                border: `1px solid ${selected === acc.source ? ACCOUNT_COLORS[i % 7] : "var(--border-inner)"}`,
              }}>
              {acc.alias ?? SOURCE_LABELS[acc.source] ?? acc.source}
            </button>
          ))}
        </div>

        {/* Summary cards */}
        <div className="space-y-2">
          {data.accounts.map((acc, i) => {
            const netFlow = acc.totalIncome - acc.totalExpense;
            return (
              <div key={acc.source} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                style={{
                  background: selected === acc.source ? `${ACCOUNT_COLORS[i % 7]}18` : "var(--bg-input)",
                  border: `1px solid ${selected === acc.source ? ACCOUNT_COLORS[i % 7] : "var(--border-inner)"}`,
                }}>
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: ACCOUNT_COLORS[i % 7] }} />
                <span className="flex-1 text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>
                  {acc.alias ?? SOURCE_LABELS[acc.source] ?? acc.source}
                </span>
                <span className="text-[14px] tabular-nums" style={{ color: "#10b981" }}>
                  +{fmt(acc.totalIncome)}
                </span>
                <span className="text-[14px] tabular-nums" style={{ color: "#ef4444" }}>
                  -{fmt(acc.totalExpense)}
                </span>
                <span className="text-[14px] font-bold tabular-nums"
                  style={{ color: netFlow >= 0 ? "#10b981" : "#ef4444", minWidth: "80px", textAlign: "right" }}>
                  {netFlow >= 0 ? "+" : ""}{fmt(netFlow)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Chart */}
        <div>
          <p className="text-[14px] font-semibold mb-2" style={{ color: "var(--text-sub)" }}>月度流量明細</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border-inner)" strokeDasharray="3 3" />
              <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={n => `${Math.round(n / 1000)}K`} tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} width={34} />
              <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              {showAccounts.map((acc, i) => (
                <Bar key={`${acc.source}_in`}  dataKey={`${acc.source}_in`}  name={`${acc.alias ?? acc.source} 流入`} fill={ACCOUNT_COLORS[i % 7]} maxBarSize={14} radius={[2, 2, 0, 0]} />
              ))}
              {showAccounts.map((acc, i) => (
                <Bar key={`${acc.source}_out`} dataKey={`${acc.source}_out`} name={`${acc.alias ?? acc.source} 流出`} fill={ACCOUNT_COLORS[i % 7]} maxBarSize={14} radius={[2, 2, 0, 0]} opacity={0.4} />
              ))}
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[14px] mt-1 text-center" style={{ color: "var(--text-muted)" }}>實色 ＝ 流入；半透明 ＝ 流出</p>
        </div>
      </div>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// 6. 消費預測警示
// ══════════════════════════════════════════════════════════════════════════

interface ForecastItem {
  category: string;
  spent:    number;
  budget:   number;
  projected: number;
  alert:    "ok" | "warn" | "danger";
}

export function SpendingForecast({ isDemo }: { isDemo: boolean }) {
  const [items,   setItems]   = useState<ForecastItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dayNum,  setDayNum]  = useState(1);
  const [daysInM, setDaysInM] = useState(30);

  useEffect(() => {
    const now   = new Date();
    const day   = now.getDate();
    const dim   = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    setDayNum(day);
    setDaysInM(dim);

    if (isDemo) {
      // use demo summary byCategory + budgets
      const budgetMap = new Map(DEMO_BUDGETS.budgets.map(b => [b.category, b.amount]));
      const cats = DEMO_SUMMARY.byCategory.filter(c => c.type === "支出");
      const built: ForecastItem[] = cats.map(c => {
        const budget    = budgetMap.get(c.category) ?? 0;
        const spent     = c.total;
        const projected = day > 0 ? Math.round((spent / day) * dim) : spent;
        const alert: ForecastItem["alert"] =
          spent > budget && budget > 0 ? "danger"
          : projected > budget && budget > 0 ? "warn"
          : "ok";
        return { category: c.category, spent, budget, projected, alert };
      });
      built.sort((a, b) => {
        const order = { danger: 0, warn: 1, ok: 2 };
        return order[a.alert] - order[b.alert] || b.projected - a.projected;
      });
      setItems(built);
      setLoading(false);
      return;
    }

    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    Promise.all([
      fetch(`/api/summary?month=${month}`).then(r => r.json()),
      fetch("/api/budgets").then(r => r.json()),
    ]).then(([summary, budgets]: [
      { byCategory: { category: string; type: string; total: number }[] },
      { budgets: { category: string; amount: number }[] },
    ]) => {
      const budgetMap = new Map((budgets.budgets ?? []).map((b) => [b.category, b.amount]));
      const cats = (summary.byCategory ?? []).filter(c => c.type === "支出");
      const built: ForecastItem[] = cats.map(c => {
        const budget    = budgetMap.get(c.category) ?? 0;
        const projected = day > 0 ? Math.round((c.total / day) * dim) : c.total;
        const alert: ForecastItem["alert"] =
          c.total > budget && budget > 0 ? "danger"
          : projected > budget && budget > 0 ? "warn"
          : "ok";
        return { category: c.category, spent: c.total, budget, projected, alert };
      });
      built.sort((a, b) => {
        const order = { danger: 0, warn: 1, ok: 2 };
        return order[a.alert] - order[b.alert] || b.projected - a.projected;
      });
      setItems(built);
    }).finally(() => setLoading(false));
  }, [isDemo]);

  const dangerCount = items.filter(i => i.alert === "danger").length;
  const warnCount   = items.filter(i => i.alert === "warn").length;

  const alertIcon  = (a: ForecastItem["alert"]) => a === "danger" ? "🚨" : a === "warn" ? "⚠️" : "✅";
  const alertColor = (a: ForecastItem["alert"]) => a === "danger" ? "#ef4444" : a === "warn" ? "#f59e0b" : "#10b981";

  if (loading) return <Card><div className="flex justify-center py-10"><div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} /></div></Card>;

  return (
    <Card>
      <SectionHeader
        title="⚠️ 消費預測警示"
        sub={`${dayNum} 日資料，依速率推算月底預計金額（共 ${daysInM} 日）`}
      />
      <div className="px-5 py-4 space-y-4">
        {/* Status bar */}
        <div className="flex gap-3">
          {dangerCount > 0 && (
            <div className="flex-1 rounded-xl px-3 py-2 text-center"
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
              <p className="text-[20px] font-black" style={{ color: "#ef4444" }}>{dangerCount}</p>
              <p className="text-[14px]" style={{ color: "#fca5a5" }}>已超標 🚨</p>
            </div>
          )}
          {warnCount > 0 && (
            <div className="flex-1 rounded-xl px-3 py-2 text-center"
              style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)" }}>
              <p className="text-[20px] font-black" style={{ color: "#f59e0b" }}>{warnCount}</p>
              <p className="text-[14px]" style={{ color: "#fde68a" }}>預計超標 ⚠️</p>
            </div>
          )}
          {dangerCount === 0 && warnCount === 0 && (
            <div className="flex-1 rounded-xl px-3 py-2 text-center"
              style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)" }}>
              <p className="text-[16px] font-black" style={{ color: "#10b981" }}>所有分類在預算內 ✅</p>
            </div>
          )}
        </div>

        {/* Category list */}
        <div className="space-y-2">
          {items.map(item => {
            const barWidth = item.budget > 0 ? Math.min((item.spent / item.budget) * 100, 100) : 0;
            const projWidth = item.budget > 0 ? Math.min((item.projected / item.budget) * 100, 100) : 0;
            return (
              <div key={item.category} className="rounded-xl px-4 py-3"
                style={{
                  background: item.alert !== "ok" ? `${alertColor(item.alert)}0d` : "var(--bg-input)",
                  border: `1px solid ${item.alert !== "ok" ? `${alertColor(item.alert)}40` : "var(--border-inner)"}`,
                }}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span>{alertIcon(item.alert)}</span>
                    <span className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>{item.category}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[14px] tabular-nums font-bold" style={{ color: alertColor(item.alert) }}>
                      {fmt(item.spent)}
                    </span>
                    {item.budget > 0 && (
                      <span className="text-[14px] ml-1" style={{ color: "var(--text-muted)" }}>
                        / {fmt(item.budget)}
                      </span>
                    )}
                  </div>
                </div>
                {item.budget > 0 && (
                  <>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                      <div className="h-full rounded-full" style={{ width: `${barWidth}%`, background: alertColor(item.alert) }} />
                    </div>
                    <div className="flex justify-between text-[14px] mt-1" style={{ color: "var(--text-muted)" }}>
                      <span>已花 {barWidth.toFixed(0)}%</span>
                      <span>預計月底：<span style={{ color: alertColor(item.alert), fontWeight: 600 }}>NT$ {fmt(item.projected)}</span>（{projWidth.toFixed(0)}%）</span>
                    </div>
                  </>
                )}
              </div>
            );
          })}
          {items.length === 0 && (
            <p className="text-center py-6 text-[14px]" style={{ color: "var(--text-muted)" }}>本月尚無消費記錄</p>
          )}
        </div>

        <p className="text-[14px] text-center" style={{ color: "var(--text-muted)" }}>
          * 預測以線性速率計算，固定支出（如房租）可能導致月初預測偏高
        </p>
      </div>
    </Card>
  );
}

// ── CashflowForecast ───────────────────────────────────────────────────────

interface CashflowMonth {
  label: string;
  balance: number;
  income: number;
  fixedExpense: number;
  variableExpense: number;
  net: number;
}

export function CashflowForecast({ isDemo }: { isDemo: boolean }) {
  const [rows,    setRows]    = useState<CashflowMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [months,  setMonths]  = useState<3 | 6>(6);

  const build = useCallback((
    monthlyData:   { month: string; income: number; expense: number }[],
    balances:      { balance: number }[],
    fixedExpenses: { amount: number }[],
    horizon:       number,
  ): CashflowMonth[] => {
    const totalBalance = balances.reduce((s, b) => s + b.balance, 0);
    const totalFixed   = fixedExpenses.reduce((s, f) => s + f.amount, 0);
    const now = new Date();
    const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const historical = monthlyData.filter(m => m.month < currentYM).slice(-6);
    const avgIncome   = historical.length ? historical.reduce((s, m) => s + m.income,  0) / historical.length : 0;
    const avgVariable = historical.length
      ? Math.max(0, historical.reduce((s, m) => s + m.expense, 0) / historical.length - totalFixed)
      : 0;

    let balance = totalBalance;
    return Array.from({ length: horizon }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
      const net = avgIncome - totalFixed - avgVariable;
      balance = balance + net;
      return {
        label:           `${d.getMonth() + 1}月`,
        balance:         Math.round(balance),
        income:          Math.round(avgIncome),
        fixedExpense:    Math.round(totalFixed),
        variableExpense: Math.round(avgVariable),
        net:             Math.round(net),
      };
    });
  }, []);

  useEffect(() => {
    if (isDemo) {
      setRows(build(DEMO_SUMMARY.monthly, DEMO_BALANCES, DEMO_FIXED_EXPENSES.fixedExpenses, months));
      setLoading(false);
      return;
    }

    setLoading(true);
    const now = new Date();
    const monthPromises = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return fetch(`/api/summary?month=${ym}`).then(r => r.json()).then((data: { totals?: { income: number; expense: number } }) => ({
        month:   ym,
        income:  data.totals?.income  ?? 0,
        expense: data.totals?.expense ?? 0,
      }));
    });

    Promise.all([
      Promise.all(monthPromises),
      fetch("/api/balances").then(r => r.json()),
      fetch("/api/fixed-expenses").then(r => r.json()),
    ]).then(([monthly, balData, feData]) => {
      setRows(build(
        monthly,
        (balData as { balance: number }[]),
        ((feData as { fixedExpenses: { amount: number }[] }).fixedExpenses ?? []),
        months,
      ));
    }).finally(() => setLoading(false));
  }, [isDemo, months, build]);

  const minBalance      = Math.min(...rows.map(r => r.balance), 0);
  const maxBalance      = Math.max(...rows.map(r => r.balance));
  const dangerThreshold = 50000;

  if (loading) return (
    <Card>
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
      </div>
    </Card>
  );

  return (
    <Card>
      <SectionHeader
        title="💰 多月現金流預測"
        sub="以歷史平均收支 + 固定支出推算未來各月帳戶結餘"
      />
      <div className="px-5 py-4 space-y-4">

        {/* Horizon selector */}
        <div className="flex items-center gap-2">
          <span className="text-[14px]" style={{ color: "var(--text-muted)" }}>預測期間：</span>
          {([3, 6] as const).map(m => (
            <button key={m} onClick={() => setMonths(m)}
              className="text-[14px] font-semibold px-3 py-1 rounded-lg transition-all"
              style={{
                background: months === m ? "var(--accent)" : "var(--bg-input)",
                color:      months === m ? "#fff"          : "var(--text-sub)",
                border:     `1px solid ${months === m ? "var(--accent)" : "var(--border-inner)"}`,
              }}>
              {m} 個月
            </button>
          ))}
        </div>

        {/* Area chart */}
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="cfGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3B82F6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-inner)" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false}
                tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                domain={[Math.min(minBalance * 1.1, 0), maxBalance * 1.1]} />
              <Tooltip
                contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }}
                formatter={(v: number) => [`NT$ ${Math.round(v).toLocaleString("zh-TW")}`, ""]}
              />
              <ReferenceLine y={dangerThreshold} stroke="#EF4444" strokeDasharray="4 4"
                label={{ value: "警戒線", position: "insideTopRight", fontSize: 10, fill: "#EF4444" }} />
              <Area type="monotone" dataKey="balance" stroke="#3B82F6" strokeWidth={2}
                fill="url(#cfGradient)" dot={{ fill: "#3B82F6", r: 4 }} name="預測結餘" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly breakdown table */}
        <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--border-inner)" }}>
          <table className="w-full text-[14px]">
            <thead>
              <tr style={{ color: "var(--text-muted)", background: "var(--bg-input)" }}>
                <th className="text-left px-4 py-2.5 font-medium">月份</th>
                <th className="text-right px-4 py-2.5 font-medium">預估收入</th>
                <th className="text-right px-4 py-2.5 font-medium">固定支出</th>
                <th className="text-right px-4 py-2.5 font-medium">變動支出</th>
                <th className="text-right px-4 py-2.5 font-medium">當月淨額</th>
                <th className="text-right px-4 py-2.5 font-medium">帳戶餘額</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const balColor = r.balance < dangerThreshold         ? "#EF4444"
                  : r.balance < dangerThreshold * 2 ? "#F59E0B"
                  : "#10B981";
                const netColor = r.net >= 0 ? "#10B981" : "#EF4444";
                return (
                  <tr key={i} style={{ borderTop: "1px solid var(--border-inner)" }}>
                    <td className="px-4 py-3 font-semibold" style={{ color: "var(--text-primary)" }}>{r.label}</td>
                    <td className="px-4 py-3 text-right tabular-nums" style={{ color: "#10B981" }}>
                      +{r.income.toLocaleString("zh-TW")}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums" style={{ color: "#F87171" }}>
                      -{r.fixedExpense.toLocaleString("zh-TW")}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums" style={{ color: "#F87171" }}>
                      -{r.variableExpense.toLocaleString("zh-TW")}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold" style={{ color: netColor }}>
                      {r.net >= 0 ? "+" : ""}{r.net.toLocaleString("zh-TW")}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold" style={{ color: balColor }}>
                      {r.balance.toLocaleString("zh-TW")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="text-[14px] text-center" style={{ color: "var(--text-muted)" }}>
          * 以近 6 個月歷史均值估算，紅色警戒線 NT$ {dangerThreshold.toLocaleString("zh-TW")}
        </p>
      </div>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// 8. 財務里程碑時間軸
// ══════════════════════════════════════════════════════════════════════════

interface MilestoneItem {
  id: string;
  label: string;
  emoji: string;
  date: Date;
  color: string;
  pct?: number;
}

export function MilestoneTimeline({ isDemo }: { isDemo: boolean }) {
  const [items,   setItems]   = useState<MilestoneItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemo) {
      const now = new Date();
      setItems([
        { id: "g1",   label: "緊急備用金",   emoji: "🛡️", date: new Date(now.getFullYear() + 1, 5, 1),   color: "#3B82F6", pct: 60 },
        { id: "g2",   label: "換電腦",        emoji: "💻", date: new Date(now.getFullYear() + 2, 0, 1),   color: "#3B82F6", pct: 30 },
        { id: "grad", label: "研究所入學",     emoji: "🎓", date: new Date(2028, 8, 1),                    color: "#8B5CF6", pct: 35 },
        { id: "loan", label: "凱基貸款還清",   emoji: "🏦", date: new Date(now.getFullYear() + 5, 3, 1),  color: "#EF4444" },
        { id: "fire", label: "FIRE 財務獨立",  emoji: "🔥", date: new Date(now.getFullYear() + 15, 0, 1), color: "#F59E0B", pct: 5 },
      ]);
      setLoading(false);
      return;
    }

    Promise.all([
      fetch("/api/goals").then(r => r.json()),
      fetch("/api/balances").then(r => r.json()),
      fetch("/api/summary?months=6").then(r => r.json()),
      fetch("/api/loans").then(r => r.json()),
    ]).then(([goals, balances, summary, loans]: [
      { id: string; name: string; emoji: string; savedAmount: number; targetAmount: number; deadline: string | null }[],
      { balance: number }[],
      { monthly: { income: number; expense: number }[] },
      { id: string; name: string; status: string; endDate: string | null }[],
    ]) => {
      const now = new Date();
      const result: MilestoneItem[] = [];

      const months6 = summary.monthly ?? [];
      const avgMonthlyNet = months6.length > 0
        ? months6.reduce((s, m) => s + (m.income - m.expense), 0) / months6.length
        : 0;
      const avgExpense = months6.length > 0
        ? months6.reduce((s, m) => s + m.expense, 0) / months6.length
        : 0;

      // Goals
      for (const g of goals) {
        if (g.targetAmount > 0 && g.savedAmount >= g.targetAmount) continue;
        const pct = g.targetAmount > 0 ? Math.min(100, (g.savedAmount / g.targetAmount) * 100) : undefined;
        if (g.deadline) {
          result.push({ id: `goal-${g.id}`, label: g.name, emoji: g.emoji || "🎯", date: new Date(g.deadline), color: "#3B82F6", pct });
        } else if (g.targetAmount > 0 && avgMonthlyNet > 0) {
          const remaining = g.targetAmount - g.savedAmount;
          const mths = Math.ceil(remaining / avgMonthlyNet);
          if (mths > 0 && mths <= 600) {
            const d = new Date(now);
            d.setMonth(d.getMonth() + mths);
            result.push({ id: `goal-${g.id}`, label: g.name, emoji: g.emoji || "🎯", date: d, color: "#3B82F6", pct });
          }
        }
      }

      // Grad school (fixed)
      result.push({ id: "grad-school", label: "研究所入學", emoji: "🎓", date: new Date(2028, 8, 1), color: "#8B5CF6" });

      // Active loans with end dates
      for (const loan of loans) {
        if (loan.status === "active" && loan.endDate) {
          result.push({ id: `loan-${loan.id}`, label: `${loan.name} 還清`, emoji: "🏦", date: new Date(loan.endDate), color: "#EF4444" });
        }
      }

      // FIRE (4% rule, 5% annual return)
      const totalAssets = balances.filter(b => b.balance > 0).reduce((s, b) => s + b.balance, 0);
      if (avgExpense > 0) {
        const fireTarget = avgExpense * 12 * 25;
        if (totalAssets < fireTarget) {
          const mths = monthsToTarget(totalAssets, Math.max(avgMonthlyNet, 0), 5, fireTarget);
          if (mths > 0 && mths <= 600) {
            const fireDate = new Date(now);
            fireDate.setMonth(fireDate.getMonth() + mths);
            result.push({
              id: "fire", label: "FIRE 財務獨立", emoji: "🔥", date: fireDate, color: "#F59E0B",
              pct: Math.min(100, (totalAssets / fireTarget) * 100),
            });
          }
        }
      }

      result.sort((a, b) => a.date.getTime() - b.date.getTime());
      setItems(result);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [isDemo]);

  if (loading) return (
    <Card>
      <SectionHeader title="📍 財務里程碑時間軸" sub="從現在到財務獨立的重要節點一覽" />
      <div className="px-5 py-10 text-center text-[14px]" style={{ color: "var(--text-muted)" }}>載入中…</div>
    </Card>
  );

  if (items.length === 0) return (
    <Card>
      <SectionHeader title="📍 財務里程碑時間軸" sub="從現在到財務獨立的重要節點一覽" />
      <div className="px-5 py-10 text-center text-[14px]" style={{ color: "var(--text-muted)" }}>
        尚無里程碑資料，請先設定財務目標或貸款
      </div>
    </Card>
  );

  // ── Layout ────────────────────────────────────────────────────────────────
  const now       = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const last      = items[items.length - 1];
  const endDate   = new Date(last.date.getFullYear(), last.date.getMonth() + 4, 1);
  const totalMs   = endDate.getTime() - startDate.getTime();

  // 52px per month keeps it readable
  const totalMonths = Math.ceil(totalMs / (1000 * 60 * 60 * 24 * 30.44));
  const totalWidth  = Math.max(totalMonths * 52, 700);

  function xOf(date: Date) {
    return ((date.getTime() - startDate.getTime()) / totalMs) * totalWidth;
  }

  const todayX = xOf(now);

  // Year tick marks
  const yearTicks: { year: number; x: number }[] = [];
  for (let y = startDate.getFullYear(); y <= endDate.getFullYear() + 1; y++) {
    const x = xOf(new Date(y, 0, 1));
    if (x >= 0 && x <= totalWidth + 10) yearTicks.push({ year: y, x });
  }

  // Alternating top/bottom layout constants
  const LINE_Y    = 140;
  const CONNECTOR = 36;
  const CARD_W    = 104;
  const CARD_H    = 88;
  const TOTAL_H   = LINE_Y + CONNECTOR + CARD_H + 32; // ~296

  return (
    <Card>
      <SectionHeader title="📍 財務里程碑時間軸" sub="從現在到財務獨立的重要節點一覽" />
      <div className="px-4 py-4 space-y-3">
        <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--border-inner)" }}>
          <div style={{ position: "relative", width: totalWidth, height: TOTAL_H, padding: "0 16px" }}>

            {/* Vertical year grid lines */}
            {yearTicks.map(t => (
              <div key={t.year} style={{
                position: "absolute", top: 0, bottom: 0, left: t.x,
                width: 1, background: "var(--border-inner)", opacity: 0.4,
              }} />
            ))}

            {/* Year labels (at bottom) */}
            {yearTicks.map(t => (
              <div key={`y${t.year}`} style={{
                position: "absolute", bottom: 6, left: t.x - 14,
                fontSize: 11, color: "var(--text-muted)", fontWeight: 600, userSelect: "none",
              }}>{t.year}</div>
            ))}

            {/* Main axis */}
            <div style={{
              position: "absolute", top: LINE_Y, left: 0, right: 0, height: 2,
              background: "var(--border)",
            }} />

            {/* Today marker */}
            {todayX >= 0 && (
              <div style={{ position: "absolute", top: LINE_Y - 22, left: todayX - 1, zIndex: 5 }}>
                <div style={{ width: 2, height: 44, background: "#10B981" }} />
                <div style={{
                  position: "absolute", top: -17, left: "50%", transform: "translateX(-50%)",
                  fontSize: 10, color: "#10B981", fontWeight: 700, whiteSpace: "nowrap",
                  background: "var(--bg-card)", padding: "1px 5px", borderRadius: 4,
                  border: "1px solid #10B98140",
                }}>今天</div>
              </div>
            )}

            {/* Milestones */}
            {items.map((item, i) => {
              const x       = xOf(item.date);
              const isTop   = i % 2 === 0;
              const connTop = isTop ? LINE_Y - CONNECTOR - 2 : LINE_Y + 2;
              const cardTop = isTop ? connTop - CARD_H        : connTop + CONNECTOR;

              return (
                <div key={item.id}>
                  {/* Dot on axis */}
                  <div style={{
                    position: "absolute", top: LINE_Y - 7, left: x - 7,
                    width: 14, height: 14, borderRadius: "50%",
                    background: item.color, border: "2px solid var(--bg-card)",
                    zIndex: 4,
                  }} />
                  {/* Connector */}
                  <div style={{
                    position: "absolute", top: connTop, left: x - 1,
                    width: 2, height: CONNECTOR, background: item.color + "60",
                  }} />
                  {/* Label card */}
                  <div style={{
                    position: "absolute", top: cardTop, left: x - CARD_W / 2,
                    width: CARD_W, padding: "6px 6px",
                    borderRadius: 10,
                    background: "var(--bg-input)",
                    border: `1px solid ${item.color}50`,
                    textAlign: "center",
                    zIndex: 3,
                  }}>
                    <div style={{ fontSize: 20, lineHeight: 1 }}>{item.emoji}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.3, marginTop: 3 }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: 9, color: item.color, marginTop: 2, fontWeight: 600 }}>
                      {item.date.getFullYear()}/{String(item.date.getMonth() + 1).padStart(2, "0")}
                    </div>
                    {item.pct !== undefined && (
                      <div style={{ marginTop: 5, height: 3, borderRadius: 2, background: "var(--border)" }}>
                        <div style={{ width: `${item.pct}%`, height: "100%", borderRadius: 2, background: item.color }} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-[13px]">
          {[
            { color: "#3B82F6", label: "財務目標" },
            { color: "#8B5CF6", label: "人生規劃" },
            { color: "#EF4444", label: "貸款還清" },
            { color: "#F59E0B", label: "FIRE" },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1.5">
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: l.color, flexShrink: 0 }} />
              <span style={{ color: "var(--text-muted)" }}>{l.label}</span>
            </div>
          ))}
        </div>

        <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
          * 無截止日的目標依當前月均淨收入估算；FIRE 採 4% 法則（25× 月支出）＋ 5% 年化報酬率試算
        </p>
      </div>
    </Card>
  );
}

// ── PersonalityReport ──────────────────────────────────────────────────────

interface PersonalityReport {
  generatedAt:     string;
  totalExpense:    number;
  topCategories:   { category: string; amount: number; pct: number }[];
  dowStats:        { dow: string; amount: number; pct: number }[];
  impulseRatio:    number;
  essentialRatio:  number;
  highRiskCats:    string[];
  advice:          string[];
  summary:         string;
}

export function PersonalityReport({ isDemo }: { isDemo: boolean }) {
  const [report,  setReport]  = useState<PersonalityReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  function generate() {
    if (isDemo) { setError("Demo 模式不支援 AI 報告"); return; }
    setLoading(true);
    setError(null);
    fetch("/api/ai-personality-report")
      .then(async r => {
        const d = await r.json() as PersonalityReport & { error?: string };
        if (d.error) { setError(d.error); return; }
        setReport(d);
      })
      .catch(() => setError("生成失敗，請稍後再試"))
      .finally(() => setLoading(false));
  }

  const maxDow = report ? Math.max(...report.dowStats.map(d => d.amount)) : 1;

  return (
    <Card>
      <div className="space-y-5">
        <h3 className="font-semibold text-[15px]" style={{ color: "#8B5CF6" }}>🧠 消費性格 AI 報告</h3>

        {!report && (
          <div className="text-center py-10 space-y-3">
            <p className="text-4xl">🧠</p>
            <p className="text-[14px]" style={{ color: "var(--text-muted)" }}>
              分析近 3 個月交易，生成個人化消費性格報告
            </p>
            <button onClick={generate} disabled={loading}
              className="px-6 py-2.5 rounded-xl text-[14px] font-bold transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{ background: "#8B5CF6", color: "#fff" }}>
              {loading ? "AI 分析中…" : "生成報告"}
            </button>
            {error && <p className="text-[13px]" style={{ color: "#EF4444" }}>{error}</p>}
          </div>
        )}

        {report && (
          <>
            {/* Summary card */}
            <div className="rounded-2xl p-4" style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.3)" }}>
              <p className="text-[12px] font-bold uppercase tracking-wider mb-2" style={{ color: "#8B5CF6" }}>消費性格摘要</p>
              <p className="text-[14px] leading-relaxed" style={{ color: "var(--text-primary)" }}>{report.summary}</p>
            </div>

            {/* Ratio stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "衝動消費", value: `${report.impulseRatio}%`, color: "#F87171", icon: "🛒" },
                { label: "必要支出", value: `${report.essentialRatio}%`, color: "#34D399", icon: "🏠" },
                { label: "3 月總支出", value: `NT$ ${fmt(report.totalExpense)}`, color: "#60A5FA", icon: "💸" },
              ].map(s => (
                <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: "var(--bg-input)", border: "1px solid var(--border-inner)" }}>
                  <p className="text-[18px] mb-0.5">{s.icon}</p>
                  <p className="text-[18px] font-black tabular-nums" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{s.label}</p>
                </div>
              ))}
            </div>

            {/* Top categories bar */}
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>分類佔比</p>
              <div className="space-y-2">
                {report.topCategories.slice(0, 6).map((c, i) => {
                  const colors = ["#60A5FA","#C084FC","#34D399","#FB923C","#F472B6","#FBBF24"];
                  const color  = colors[i % colors.length];
                  return (
                    <div key={c.category}>
                      <div className="flex justify-between text-[12px] mb-1">
                        <span style={{ color: "var(--text-sub)" }}>{c.category}</span>
                        <span className="tabular-nums" style={{ color: "var(--text-muted)" }}>NT$ {fmt(c.amount)} ({c.pct}%)</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-input)" }}>
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${c.pct}%`, background: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Day-of-week spending */}
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>星期消費分佈</p>
              <div className="flex items-end gap-1.5 h-20">
                {report.dowStats.map(d => {
                  const h = maxDow > 0 ? Math.round((d.amount / maxDow) * 100) : 0;
                  const isMax = d.amount === maxDow;
                  return (
                    <div key={d.dow} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full rounded-t-md transition-all duration-500"
                        style={{ height: `${h}%`, background: isMax ? "#8B5CF6" : "rgba(139,92,246,0.3)", minHeight: 3 }} />
                      <span className="text-[10px]" style={{ color: isMax ? "#8B5CF6" : "var(--text-muted)" }}>{d.dow.replace("週","")}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* High risk */}
            {report.highRiskCats.length > 0 && (
              <div className="rounded-xl px-4 py-3" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
                <p className="text-[12px] font-bold mb-1" style={{ color: "#EF4444" }}>⚠️ 高風險分類</p>
                <p className="text-[13px]" style={{ color: "var(--text-sub)" }}>{report.highRiskCats.join("、")}</p>
              </div>
            )}

            {/* AI advice */}
            {report.advice.length > 0 && (
              <div className="space-y-2.5">
                <p className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>AI 行為建議</p>
                {report.advice.map((a, i) => (
                  <div key={i} className="rounded-xl px-4 py-3 flex gap-3"
                    style={{ background: "var(--bg-input)", border: "1px solid var(--border-inner)" }}>
                    <span className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-black mt-0.5"
                      style={{ background: "#8B5CF6", color: "#fff" }}>{i + 1}</span>
                    <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-sub)" }}>{a}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Footer: re-generate + generated time */}
            <div className="flex items-center justify-between">
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                生成於 {new Date(report.generatedAt).toLocaleString("zh-TW")}
              </p>
              <button onClick={generate} disabled={loading}
                className="px-3 py-1 rounded-lg text-[12px] font-semibold transition-opacity hover:opacity-80"
                style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}>
                {loading ? "分析中…" : "重新生成"}
              </button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
