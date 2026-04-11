"use client";

import { useEffect, useState, useMemo } from "react";
// ── Types ──────────────────────────────────────────────────────────────────

interface DebtEntry {
  id:         string;
  name:       string;
  balance:    number;
  annualRate: number;
  minMonthly: number;
  type:       "loan" | "cc";
}

interface SimResult {
  months:        number;
  totalInterest: number;
  payoffLabel:   string;
  debtMonths:    Record<string, number>;
  debtPayoffDates: Record<string, string>;  // id → "YYYY年M月"
}

interface RawLoanPayment { totalPaid: string | number }
interface RawLoan {
  id: string; name: string; status: string;
  remainingPrincipal: string | number;
  interestRate: string | number;
  payments: RawLoanPayment[];
}
interface RawCCBill { minimumPayment: string | number | null }
interface RawCC {
  id: string; name: string;
  currentBalance: string | number;
  bills: RawCCBill[];
}

// ── Simulation ─────────────────────────────────────────────────────────────

function simulatePayoff(debts: DebtEntry[], totalBudget: number, strategy: "snowball" | "avalanche"): SimResult {
  const st      = debts.map(d => ({ ...d }));
  const minTotal = st.reduce((s, d) => s + d.minMonthly, 0);
  const extra    = Math.max(0, totalBudget - minTotal);

  let totalInterest = 0;
  let months        = 0;
  const debtMonths: Record<string, number> = {};
  const now = new Date();

  while (st.some(d => d.balance > 0.5) && months < 600) {
    months++;
    for (const d of st) {
      if (d.balance <= 0) continue;
      const interest = d.balance * (d.annualRate / 100 / 12);
      totalInterest += interest;
      d.balance     += interest;
    }
    for (const d of st) {
      if (d.balance <= 0) continue;
      d.balance = Math.max(0, d.balance - d.minMonthly);
    }
    const active = st.filter(d => d.balance > 0.5);
    if (strategy === "snowball") active.sort((a, b) => a.balance - b.balance);
    else                         active.sort((a, b) => b.annualRate - a.annualRate);
    let rem = extra;
    for (const d of active) {
      if (rem <= 0) break;
      const pay = Math.min(rem, d.balance);
      d.balance -= pay;
      rem       -= pay;
    }
    for (const d of st) {
      if (!(d.id in debtMonths) && d.balance <= 0.5) debtMonths[d.id] = months;
    }
  }

  const base = new Date(now);
  base.setMonth(base.getMonth() + months);
  const payoffLabel = `${base.getFullYear()}年${base.getMonth() + 1}月`;

  // build per-debt payoff calendar dates
  const debtPayoffDates: Record<string, string> = {};
  for (const [id, m] of Object.entries(debtMonths)) {
    const d2 = new Date(now);
    d2.setMonth(d2.getMonth() + m);
    debtPayoffDates[id] = `${d2.getFullYear()}/${String(d2.getMonth() + 1).padStart(2, "0")}`;
  }

  return { months, totalInterest, payoffLabel, debtMonths, debtPayoffDates };
}

// 計算本月各負債建議還款金額
function computeMonthlyPlan(debts: DebtEntry[], totalBudget: number, strategy: "snowball" | "avalanche"): Record<string, number> {
  const minTotal = debts.reduce((s, d) => s + d.minMonthly, 0);
  const extra    = Math.max(0, totalBudget - minTotal);
  const plan: Record<string, number> = {};
  debts.forEach(d => { plan[d.id] = d.minMonthly; });

  const sorted = [...debts].filter(d => d.balance > 0);
  if (strategy === "snowball") sorted.sort((a, b) => a.balance - b.balance);
  else                         sorted.sort((a, b) => b.annualRate - a.annualRate);

  let rem = extra;
  for (const d of sorted) {
    if (rem <= 0) break;
    const add = Math.min(rem, d.balance - d.minMonthly);
    if (add > 0) { plan[d.id] += add; rem -= add; }
    else         { plan[d.id] += rem; rem = 0; }
  }
  return plan;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number) { return Math.round(n).toLocaleString("zh-TW"); }

function fmtMonths(m: number) {
  if (m >= 600) return "600月+";
  const y = Math.floor(m / 12), mo = m % 12;
  if (y === 0) return `${mo} 個月`;
  if (mo === 0) return `${y} 年`;
  return `${y} 年 ${mo} 個月`;
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border"
      style={{ background: "var(--bg-card)", borderColor: "var(--border)", boxShadow: "var(--card-shadow)" }}>
      {children}
    </div>
  );
}

interface StrategyCardProps {
  label: string; icon: string; desc: string;
  result: SimResult; isWinner: boolean; savings: number; color: string;
}

function StrategyCard({ label, icon, desc, result, isWinner, savings, color }: StrategyCardProps) {
  return (
    <div className="flex-1 rounded-xl p-4 relative"
      style={{ background: isWinner ? `${color}18` : "var(--bg-input)", border: `1px solid ${isWinner ? color : "var(--border-inner)"}` }}>
      {isWinner && (
        <span className="absolute top-2 right-2 text-[13px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: color, color: "#fff" }}>推薦</span>
      )}
      <p className="text-[15px] font-bold mb-0.5" style={{ color: isWinner ? color : "var(--text-primary)" }}>
        {icon} {label}
      </p>
      <p className="text-[13px] mb-3" style={{ color: "var(--text-muted)" }}>{desc}</p>
      <div className="space-y-2.5">
        <div>
          <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>預計還清</p>
          <p className="text-[22px] font-black tabular-nums leading-tight" style={{ color: isWinner ? color : "var(--text-primary)" }}>
            {fmtMonths(result.months)}
          </p>
          <p className="text-[13px]" style={{ color: "var(--text-sub)" }}>{result.payoffLabel}</p>
        </div>
        <div>
          <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>累計利息支出</p>
          <p className="text-[16px] font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
            NT$ {fmt(result.totalInterest)}
          </p>
        </div>
        {savings > 0 && (
          <div className="rounded-lg px-3 py-1.5 text-[13px] font-semibold"
            style={{ background: `${color}22`, color }}>
            💡 省 NT$ {fmt(savings)} 利息
          </div>
        )}
      </div>
    </div>
  );
}

// ── Single-loan prepay simulation ─────────────────────────────────────────

function simulateSingleLoan(balance: number, annualRate: number, monthly: number): { months: number; totalInterest: number } {
  let bal = balance;
  let totalInterest = 0;
  let months = 0;
  const monthlyRate = annualRate / 100 / 12;
  while (bal > 0.5 && months < 600) {
    months++;
    const interest = bal * monthlyRate;
    totalInterest += interest;
    bal = Math.max(0, bal + interest - monthly);
  }
  return { months, totalInterest };
}

// ── PrepaySimulator sub-component ─────────────────────────────────────────

function PrepaySimulator({ debts }: { debts: DebtEntry[] }) {
  const [selectedId, setSelectedId] = useState<string>(debts[0]?.id ?? "");
  const [extra, setExtra]           = useState(0);

  const debt = debts.find(d => d.id === selectedId) ?? debts[0];

  const base = useMemo(
    () => debt ? simulateSingleLoan(debt.balance, debt.annualRate, debt.minMonthly) : null,
    [debt]
  );
  const sim = useMemo(
    () => debt ? simulateSingleLoan(debt.balance, debt.annualRate, debt.minMonthly + extra) : null,
    [debt, extra]
  );

  if (!debt || !base || !sim) return null;

  const monthsSaved    = base.months - sim.months;
  const interestSaved  = base.totalInterest - sim.totalInterest;
  const maxExtra       = Math.max(Math.ceil(debt.balance * 0.2 / 500) * 500, debt.minMonthly * 3);
  const step           = debt.balance > 100000 ? 1000 : 500;

  return (
    <div className="rounded-xl p-4 space-y-4"
      style={{ background: "var(--bg-input)", border: "1px solid var(--border-inner)" }}>
      <p className="text-[14px] font-semibold" style={{ color: "var(--text-sub)" }}>💡 提前還款試算</p>

      {/* Debt selector */}
      {debts.length > 1 && (
        <div>
          <label className="text-[13px] mb-1 block" style={{ color: "var(--text-muted)" }}>選擇負債</label>
          <select value={selectedId} onChange={e => { setSelectedId(e.target.value); setExtra(0); }}
            className="w-full rounded-lg px-3 py-2 text-[13px] outline-none"
            style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
            {debts.map(d => (
              <option key={d.id} value={d.id}
                style={{ background: "var(--bg-card)", color: "var(--text-primary)" }}>
                {d.type === "cc" ? "💳" : "🏦"} {d.name}（{d.annualRate}%）
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Slider */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[13px]" style={{ color: "var(--text-muted)" }}>每月多還</label>
          <span className="text-[14px] font-bold" style={{ color: "var(--accent)" }}>
            NT$ {extra.toLocaleString()}
          </span>
        </div>
        <input
          type="range" min={0} max={maxExtra} step={step} value={extra}
          onChange={e => setExtra(Number(e.target.value))}
          className="w-full accent-[var(--accent)]"
          style={{ accentColor: "var(--accent)" }}
        />
        <div className="flex justify-between text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
          <span>NT$ 0</span>
          <span>NT$ {maxExtra.toLocaleString()}</span>
        </div>
      </div>

      {/* Comparison */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl p-3 text-center" style={{ background: "var(--bg-card)", border: "1px solid var(--border-inner)" }}>
          <p className="text-[11px] mb-1" style={{ color: "var(--text-muted)" }}>目前（最低還款）</p>
          <p className="text-[18px] font-black tabular-nums" style={{ color: "var(--text-primary)" }}>
            {fmtMonths(base.months)}
          </p>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            利息 NT$ {fmt(base.totalInterest)}
          </p>
        </div>
        <div className="rounded-xl p-3 text-center"
          style={{
            background: extra > 0 ? "#10B98110" : "var(--bg-card)",
            border: `1px solid ${extra > 0 ? "#10B98140" : "var(--border-inner)"}`,
          }}>
          <p className="text-[11px] mb-1" style={{ color: "var(--text-muted)" }}>
            多還 NT$ {extra.toLocaleString()} / 月
          </p>
          <p className="text-[18px] font-black tabular-nums"
            style={{ color: extra > 0 ? "#10B981" : "var(--text-primary)" }}>
            {fmtMonths(sim.months)}
          </p>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            利息 NT$ {fmt(sim.totalInterest)}
          </p>
        </div>
      </div>

      {/* Savings badge */}
      {extra > 0 && monthsSaved > 0 && (
        <div className="rounded-xl px-4 py-3 flex items-center justify-between"
          style={{ background: "#10B98115", border: "1px solid #10B98130" }}>
          <div>
            <p className="text-[13px] font-bold" style={{ color: "#10B981" }}>
              🎉 提前 {fmtMonths(monthsSaved)} 還清
            </p>
            <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>
              每月多還 NT$ {extra.toLocaleString()}，共節省 NT$ {fmt(interestSaved)} 利息
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>CP 值</p>
            <p className="text-[14px] font-black" style={{ color: "#10B981" }}>
              {interestSaved > 0 ? `${Math.round(interestSaved / (extra * sim.months) * 100)}%` : "—"}
            </p>
          </div>
        </div>
      )}
      {extra > 0 && monthsSaved <= 0 && (
        <p className="text-[12px] text-center" style={{ color: "var(--text-muted)" }}>
          此金額對還清時間影響不顯著
        </p>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function DebtOptimizer() {
  const [debts,   setDebts]   = useState<DebtEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [budget,  setBudget]  = useState("");
  const [strategy, setStrategy] = useState<"recommended" | "snowball" | "avalanche">("recommended");

  useEffect(() => {
    Promise.all([
      fetch("/api/loans").then(r => r.json()),
      fetch("/api/credit-cards").then(r => r.json()),
    ]).then(([rawLoans, rawCCs]: [RawLoan[], RawCC[]]) => {
      const loans: DebtEntry[] = rawLoans
        .filter((l: RawLoan) => l.status === "active")
        .map((l: RawLoan) => ({
          id: l.id, name: l.name, type: "loan" as const,
          balance:    parseFloat(String(l.remainingPrincipal)),
          annualRate: parseFloat(String(l.interestRate)),
          minMonthly: l.payments?.[0] ? parseFloat(String(l.payments[0].totalPaid)) : 0,
        }));
      const ccs: DebtEntry[] = rawCCs
        .filter((c: RawCC) => parseFloat(String(c.currentBalance)) > 0)
        .map((c: RawCC) => {
          const bal = parseFloat(String(c.currentBalance));
          return {
            id: c.id, name: c.name, type: "cc" as const,
            balance: bal, annualRate: 18,
            minMonthly: c.bills?.[0]?.minimumPayment ? parseFloat(String(c.bills[0].minimumPayment)) : Math.ceil(bal * 0.02),
          };
        });
      const all = [...loans, ...ccs];
      setDebts(all);
      if (all.length > 0) setBudget(String(all.reduce((s, d) => s + d.minMonthly, 0) + 2000));
    }).finally(() => setLoading(false));
  }, []);

  const totalDebt  = debts.reduce((s, d) => s + d.balance, 0);
  const totalMin   = debts.reduce((s, d) => s + d.minMonthly, 0);
  const budgetNum  = Math.max(parseInt(budget) || 0, totalMin);

  const snowball  = debts.length > 0 ? simulatePayoff(debts, budgetNum, "snowball")  : null;
  const avalanche = debts.length > 0 ? simulatePayoff(debts, budgetNum, "avalanche") : null;

  const avalancheWins = (avalanche && snowball) ? avalanche.totalInterest <= snowball.totalInterest : false;
  const interestDiff  = (avalanche && snowball) ? Math.abs(snowball.totalInterest - avalanche.totalInterest) : 0;
  const recommendedStrategy: "snowball" | "avalanche" = avalancheWins ? "avalanche" : "snowball";
  const activeStrategy = strategy === "recommended" ? recommendedStrategy : strategy;

  const monthlyPlan = debts.length > 0 ? computeMonthlyPlan(debts, budgetNum, activeStrategy) : {};

  if (loading) return (
    <Card>
      <div className="flex justify-center py-10">
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
      </div>
    </Card>
  );

  if (debts.length === 0) return (
    <Card>
      <div className="text-center py-10 px-6">
        <p className="text-2xl mb-2">🎉</p>
        <p className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>目前沒有待還負債</p>
        <p className="text-[14px] mt-1" style={{ color: "var(--text-muted)" }}>新增貸款或信用卡後即可查看還債優化建議</p>
      </div>
    </Card>
  );

  return (
    <Card>
      {/* ── Header ── */}
      <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border-inner)" }}>
        <p className="font-bold text-[16px]" style={{ color: "var(--text-primary)" }}>還債優化建議</p>
        <div className="flex gap-4 mt-2">
          {[
            { label: "總負債", value: `NT$ ${fmt(totalDebt)}`, color: "#F87171" },
            { label: "月最低合計", value: `NT$ ${fmt(totalMin)}`, color: "#F59E0B" },
            { label: "負債筆數", value: `${debts.length} 筆`, color: "#A78BFA" },
          ].map(item => (
            <div key={item.label} className="rounded-xl px-3 py-2 flex-1 text-center"
              style={{ background: `${item.color}12`, border: `1px solid ${item.color}25` }}>
              <p className="text-[13px]" style={{ color: item.color + "CC" }}>{item.label}</p>
              <p className="text-[15px] font-black tabular-nums" style={{ color: item.color }}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-5 py-4 space-y-5">

        {/* ── Budget Input ── */}
        <div>
          <label className="text-[14px] font-semibold block mb-1.5" style={{ color: "var(--text-sub)" }}>
            每月可還款總預算（NT$）
          </label>
          <input
            type="number" min={totalMin} value={budget}
            onWheel={e => e.currentTarget.blur()}
            onChange={e => setBudget(e.target.value)}
            className="w-full rounded-xl px-3 py-2.5 text-[15px] outline-none"
            style={{ background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          />
          <p className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>
            最低合計 NT$ {fmt(totalMin)}
            {budgetNum > totalMin && (
              <span style={{ color: "var(--accent-light)" }}>
                　額外加速 NT$ {fmt(budgetNum - totalMin)} / 月
              </span>
            )}
          </p>
        </div>

        {snowball && avalanche && (
          <>
            {/* ── Strategy Comparison ── */}
            <div className="flex gap-3">
              <StrategyCard label="雪球法" icon="⛄" desc="最小餘額優先，先還清小筆負債"
                result={snowball} isWinner={!avalancheWins} savings={avalancheWins ? 0 : interestDiff} color="#6366f1" />
              <StrategyCard label="雪崩法" icon="🏔️" desc="最高利率優先，總利息最小化"
                result={avalanche} isWinner={avalancheWins} savings={avalancheWins ? interestDiff : 0} color="#10b981" />
            </div>

            {/* ── Strategy Selector ── */}
            <div>
              <p className="text-[13px] font-semibold mb-2" style={{ color: "var(--text-muted)" }}>
                本月還款計畫依據
              </p>
              <div className="flex gap-2">
                {([
                  { value: "recommended", label: `⭐ 推薦（${recommendedStrategy === "avalanche" ? "雪崩" : "雪球"}）` },
                  { value: "snowball",    label: "⛄ 雪球法" },
                  { value: "avalanche",   label: "🏔️ 雪崩法" },
                ] as const).map(s => (
                  <button key={s.value}
                    onClick={() => setStrategy(s.value)}
                    className="flex-1 text-[13px] font-semibold py-1.5 rounded-lg transition-all"
                    style={{
                      background: strategy === s.value ? "var(--accent)" : "var(--bg-input)",
                      border:     `1px solid ${strategy === s.value ? "var(--accent)" : "var(--border-inner)"}`,
                      color:      strategy === s.value ? "#fff" : "var(--text-muted)",
                    }}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Monthly Plan + Per-Debt Table ── */}
            <div>
              <p className="text-[14px] font-semibold mb-2" style={{ color: "var(--text-sub)" }}>
                各負債明細 · 本月還款計畫
              </p>
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-inner)" }}>
                {/* Header */}
                <div className="grid px-3 py-2 text-[13px] font-semibold"
                  style={{ gridTemplateColumns: "minmax(0,2fr) repeat(4,minmax(0,1fr))", background: "var(--bg-input)", color: "var(--text-muted)" }}>
                  <span>名稱</span>
                  <span className="text-right">剩餘本金</span>
                  <span className="text-right">利率</span>
                  <span className="text-right">本月還款</span>
                  <span className="text-right">預計還清</span>
                </div>

                {debts.map((d, i) => {
                  const planAmt   = monthlyPlan[d.id] ?? d.minMonthly;
                  const isExtra   = planAmt > d.minMonthly + 0.5;
                  const extraAmt  = planAmt - d.minMonthly;
                  const result    = activeStrategy === "snowball" ? snowball : avalanche;
                  const payoffDate = result.debtPayoffDates[d.id] ?? result.payoffLabel;

                  return (
                    <div key={d.id}
                      className="grid px-3 py-3 border-t text-[14px] items-start"
                      style={{
                        gridTemplateColumns: "minmax(0,2fr) repeat(4,minmax(0,1fr))",
                        borderColor: "var(--border-inner)",
                        background:  i % 2 === 0 ? "transparent" : "var(--bg-input)",
                      }}>
                      {/* Name */}
                      <div className="flex items-center gap-1.5">
                        <span>{d.type === "cc" ? "💳" : "🏦"}</span>
                        <div>
                          <p className="truncate font-medium" style={{ color: "var(--text-primary)" }}>{d.name}</p>
                          <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                            最低 NT$ {fmt(d.minMonthly)}
                          </p>
                        </div>
                      </div>

                      {/* 剩餘本金 */}
                      <div className="text-right">
                        <p className="font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
                          {fmt(d.balance)}
                        </p>
                      </div>

                      {/* 利率 */}
                      <div className="text-right">
                        <p className="font-semibold tabular-nums"
                          style={{ color: d.annualRate >= 15 ? "#EF4444" : d.annualRate >= 8 ? "#F59E0B" : "#10B981" }}>
                          {d.annualRate}%
                        </p>
                      </div>

                      {/* 本月還款 */}
                      <div className="text-right">
                        <p className="font-bold tabular-nums"
                          style={{ color: isExtra ? (activeStrategy === "avalanche" ? "#10B981" : "#6366f1") : "var(--text-primary)" }}>
                          NT$ {fmt(planAmt)}
                        </p>
                        {isExtra && (
                          <p className="text-[12px] font-semibold"
                            style={{ color: activeStrategy === "avalanche" ? "#10B981" : "#6366f1" }}>
                            +{fmt(extraAmt)} 加速
                          </p>
                        )}
                      </div>

                      {/* 預計還清 */}
                      <div className="text-right">
                        <p className="text-[13px] tabular-nums font-medium" style={{ color: "var(--text-sub)" }}>
                          {payoffDate}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {/* Footer: 合計 */}
                <div className="grid px-3 py-2.5 border-t text-[14px] font-bold"
                  style={{
                    gridTemplateColumns: "minmax(0,2fr) repeat(4,minmax(0,1fr))",
                    borderColor: "var(--border-inner)",
                    background: "var(--bg-input)",
                    color: "var(--text-primary)",
                  }}>
                  <span>合計</span>
                  <span className="text-right tabular-nums">{fmt(totalDebt)}</span>
                  <span />
                  <span className="text-right tabular-nums"
                    style={{ color: "var(--accent)" }}>
                    NT$ {fmt(Object.values(monthlyPlan).reduce((s, v) => s + v, 0))}
                  </span>
                  <span />
                </div>
              </div>
            </div>

            {/* ── Strategy Explanation ── */}
            <div className="rounded-xl p-4 space-y-2"
              style={{ background: "var(--bg-input)", border: "1px solid var(--border-inner)" }}>
              <p className="text-[14px] font-semibold" style={{ color: "var(--text-sub)" }}>策略說明</p>
              <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                <span style={{ color: "#6366f1" }}>⛄ 雪球法</span>：先還清最小筆負債，每還清一筆釋放心理壓力，適合需要動力的人。<br />
                <span style={{ color: "#10b981" }}>🏔️ 雪崩法</span>：先還最高利率負債，數學上累計利息最少，適合理性決策者。
              </p>
            </div>

            {/* ── Prepay Simulator ── */}
            <PrepaySimulator debts={debts} />
          </>
        )}
      </div>
    </Card>
  );
}
