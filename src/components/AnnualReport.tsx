"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import type { AnnualReportResponse } from "@/app/api/annual-report/route";

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return Math.abs(n).toLocaleString("zh-TW");
}

function monthLabel(yyyymm: string) {
  return `${parseInt(yyyymm.slice(5, 7))}月`;
}

function fullMonthLabel(yyyymm: string) {
  const [y, m] = yyyymm.split("-");
  return `${y}年${parseInt(m)}月`;
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border ${className}`}
      style={{ background: "var(--bg-card)", borderColor: "var(--border)", boxShadow: "var(--card-shadow)" }}>
      {children}
    </div>
  );
}

interface StatTileProps { label: string; value: string; sub?: string; accent?: string }
function StatTile({ label, value, sub, accent }: StatTileProps) {
  return (
    <div className="rounded-xl p-4" style={{ background: "var(--bg-input)", border: "1px solid var(--border-inner)" }}>
      <p className="text-[14px] mb-1" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="text-[20px] font-black tabular-nums leading-tight" style={{ color: accent ?? "var(--text-primary)" }}>
        {value}
      </p>
      {sub && <p className="text-[14px] mt-0.5" style={{ color: "var(--text-muted)" }}>{sub}</p>}
    </div>
  );
}

interface HighlightTileProps { emoji: string; label: string; value: string }
function HighlightTile({ emoji, label, value }: HighlightTileProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-4 py-3"
      style={{ background: "var(--bg-input)", border: "1px solid var(--border-inner)" }}>
      <span className="text-xl">{emoji}</span>
      <div>
        <p className="text-[14px]" style={{ color: "var(--text-muted)" }}>{label}</p>
        <p className="text-[14px] font-bold" style={{ color: "var(--text-primary)" }}>{value}</p>
      </div>
    </div>
  );
}

interface ChartTooltipProps { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }
function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-4 py-3 text-[14px]"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
      <p className="font-semibold mb-2" style={{ color: "var(--text-primary)" }}>{label}</p>
      {payload.map(p => (
        <p key={p.name} className="tabular-nums" style={{ color: p.color }}>
          {p.name}：NT$ {fmt(p.value)}
        </p>
      ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function AnnualReport() {
  const [data,    setData]    = useState<AnnualReportResponse | null>(null);
  const [year,    setYear]    = useState<number>(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  const load = useCallback((y: number) => {
    setLoading(true);
    fetch(`/api/annual-report?year=${y}`)
      .then(r => r.json())
      .then((d: AnnualReportResponse) => setData(d))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // default: previous year if we have data, else current year
    const defaultYear = new Date().getFullYear();
    setYear(defaultYear);
    load(defaultYear);
  }, [load]);

  const switchYear = (y: number) => {
    setYear(y);
    load(y);
  };

  if (loading || !data) {
    return (
      <Card>
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
        </div>
      </Card>
    );
  }

  const { totals, monthly, byCategory, highlights, availableYears } = data;

  const expenseCategories = byCategory
    .filter(c => c.type === "支出")
    .slice(0, 8);

  const maxExpense = expenseCategories[0]?.total ?? 1;

  // months with actual data (non-zero)
  const activeMonths = monthly.filter(m => m.income > 0 || m.expense > 0);

  // savings rate color
  const srColor = totals.savingsRate >= 30 ? "#10b981"
    : totals.savingsRate >= 15 ? "#f59e0b"
    : "#ef4444";

  // current year flag (partial year)
  const isCurrentYear = year === new Date().getFullYear();

  return (
    <div className="space-y-5">
      {/* ── Year Selector ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[14px] font-semibold" style={{ color: "var(--text-sub)" }}>年度：</span>
        {(availableYears.length > 0 ? availableYears : [year]).map(y => (
          <button key={y} onClick={() => switchYear(y)}
            className="text-[14px] font-bold px-4 py-1.5 rounded-xl transition-all"
            style={{
              background: y === year ? "var(--accent)" : "var(--bg-card)",
              color:      y === year ? "#fff"          : "var(--text-sub)",
              border:     `1px solid ${y === year ? "var(--accent)" : "var(--border-inner)"}`,
            }}>
            {y} {y === new Date().getFullYear() ? "（至今）" : ""}
          </button>
        ))}
        <a href={`/api/print-annual-report?year=${year}`}
          target="_blank" rel="noopener noreferrer"
          className="ml-auto text-[14px] font-semibold px-3 py-1.5 rounded-xl transition-opacity hover:opacity-80 inline-flex items-center gap-1"
          style={{ background: "var(--bg-input)", border: "1px solid var(--border-inner)", color: "var(--text-sub)" }}>
          🖨 列印年報
        </a>
      </div>

      {/* ── Hero Summary ── */}
      <div className="rounded-2xl p-5 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg,#0f172a 0%,#1e293b 50%,#0f172a 100%)", border: "1px solid #334155" }}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[14px] font-semibold tracking-widest uppercase" style={{ color: "#94a3b8" }}>
              {year} 年度財報{isCurrentYear ? "（進行中）" : ""}
            </p>
            <p className="text-[38px] font-black tabular-nums leading-tight mt-1"
              style={{ color: totals.net >= 0 ? "#10b981" : "#ef4444" }}>
              {totals.net >= 0 ? "+" : ""}NT$ {fmt(totals.net)}
            </p>
            <p className="text-[14px] mt-0.5" style={{ color: "#64748b" }}>全年淨儲蓄</p>
          </div>
          <div className="text-right">
            <p className="text-[14px]" style={{ color: "#94a3b8" }}>儲蓄率</p>
            <p className="text-[32px] font-black tabular-nums" style={{ color: srColor }}>
              {totals.savingsRate >= 0 ? `${totals.savingsRate}%` : "—"}
            </p>
            <p className="text-[14px] mt-0.5" style={{ color: "#64748b" }}>{totals.txCount} 筆交易</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl px-4 py-3" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
            <p className="text-[14px] mb-0.5" style={{ color: "#6ee7b7" }}>全年收入</p>
            <p className="text-[18px] font-bold tabular-nums" style={{ color: "#10b981" }}>NT$ {fmt(totals.income)}</p>
          </div>
          <div className="rounded-xl px-4 py-3" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <p className="text-[14px] mb-0.5" style={{ color: "#fca5a5" }}>全年支出</p>
            <p className="text-[18px] font-bold tabular-nums" style={{ color: "#ef4444" }}>NT$ {fmt(totals.expense)}</p>
          </div>
        </div>
      </div>

      {/* ── Highlights ── */}
      {activeMonths.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {highlights.peakIncomeMonth && (
            <HighlightTile emoji="📈" label="收入最高月"  value={fullMonthLabel(highlights.peakIncomeMonth)} />
          )}
          {highlights.peakExpenseMonth && (
            <HighlightTile emoji="💸" label="支出最高月"  value={fullMonthLabel(highlights.peakExpenseMonth)} />
          )}
          {highlights.lowestExpenseMonth && (
            <HighlightTile emoji="🐢" label="支出最低月"  value={fullMonthLabel(highlights.lowestExpenseMonth)} />
          )}
          {highlights.bestSavingsMonth && (
            <HighlightTile emoji="🏆" label="儲蓄率最佳月" value={fullMonthLabel(highlights.bestSavingsMonth)} />
          )}
        </div>
      )}

      {/* ── Monthly Chart ── */}
      <Card>
        <div className="px-5 pt-4 pb-1">
          <p className="font-bold text-[14px]" style={{ color: "var(--text-primary)" }}>月度收支走勢</p>
        </div>
        <div className="px-2 pb-4">
          {activeMonths.length === 0 ? (
            <p className="text-center py-8 text-[14px]" style={{ color: "var(--text-muted)" }}>
              {year} 年尚無交易記錄
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
                <CartesianGrid vertical={false} stroke="var(--border-inner)" strokeDasharray="3 3" />
                <XAxis dataKey="month" tickFormatter={monthLabel}
                  tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={n => `${Math.round(n / 1000)}K`}
                  tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} width={36} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                <Bar dataKey="income"  name="收入" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={18} />
                <Bar dataKey="expense" name="支出" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* ── Monthly Savings Rate ── */}
      {activeMonths.length > 0 && (
        <Card>
          <div className="px-5 pt-4 pb-4">
            <p className="font-bold text-[14px] mb-3" style={{ color: "var(--text-primary)" }}>月度儲蓄率</p>
            <div className="space-y-2">
              {monthly.filter(m => m.income > 0).map(m => {
                const rate    = m.savingsRate;
                const barPct  = Math.max(0, rate);
                const color   = rate >= 30 ? "#10b981" : rate >= 15 ? "#f59e0b" : "#ef4444";
                return (
                  <div key={m.month} className="flex items-center gap-2">
                    <span className="text-[14px] w-8 text-right tabular-nums flex-shrink-0"
                      style={{ color: "var(--text-muted)" }}>
                      {monthLabel(m.month)}
                    </span>
                    <div className="flex-1 h-2 rounded-full overflow-hidden"
                      style={{ background: "var(--bg-input)" }}>
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(barPct, 100)}%`, background: color }} />
                    </div>
                    <span className="text-[14px] w-8 tabular-nums flex-shrink-0 font-semibold"
                      style={{ color }}>
                      {rate >= 0 ? `${rate}%` : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {/* ── Top Expense Categories ── */}
      {expenseCategories.length > 0 && (
        <Card>
          <div className="px-5 pt-4 pb-4">
            <p className="font-bold text-[14px] mb-3" style={{ color: "var(--text-primary)" }}>支出分類排行</p>
            <div className="space-y-3">
              {expenseCategories.map((c, i) => {
                const pct    = Math.round((c.total / totals.expense) * 100);
                const barPct = (c.total / maxExpense) * 100;
                const COLORS  = ["#6366f1","#8b5cf6","#a78bfa","#c4b5fd","#818cf8","#7c3aed","#5b21b6","#4c1d95"];
                return (
                  <div key={c.category}>
                    <div className="flex justify-between items-baseline mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[14px] font-bold" style={{ color: COLORS[i] }}>#{i + 1}</span>
                        <span className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>{c.category}</span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-[14px]" style={{ color: "var(--text-muted)" }}>{pct}%</span>
                        <span className="text-[14px] font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
                          NT$ {fmt(c.total)}
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-input)" }}>
                      <div className="h-full rounded-full"
                        style={{ width: `${barPct}%`, background: COLORS[i] }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {/* ── Monthly Detail Table ── */}
      <Card>
        <div className="px-5 pt-4 pb-2">
          <p className="font-bold text-[14px]" style={{ color: "var(--text-primary)" }}>月度明細</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[14px]">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-inner)" }}>
                {["月份", "收入", "支出", "淨儲蓄", "儲蓄率"].map(h => (
                  <th key={h} className="px-4 py-2 text-right first:text-left font-semibold"
                    style={{ color: "var(--text-muted)", background: "var(--bg-input)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthly.map((m, i) => {
                const hasData = m.income > 0 || m.expense > 0;
                const netColor = m.net >= 0 ? "#10b981" : "#ef4444";
                const srColor2 = m.savingsRate >= 30 ? "#10b981" : m.savingsRate >= 15 ? "#f59e0b" : m.savingsRate >= 0 ? "#ef4444" : "var(--text-muted)";
                return (
                  <tr key={m.month}
                    style={{
                      borderBottom: "1px solid var(--border-inner)",
                      background: i % 2 === 0 ? "transparent" : "var(--bg-input)",
                      opacity: hasData ? 1 : 0.35,
                    }}>
                    <td className="px-4 py-2.5 font-medium" style={{ color: "var(--text-primary)" }}>
                      {monthLabel(m.month)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: "#10b981" }}>
                      {hasData ? `${fmt(m.income)}` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: "#ef4444" }}>
                      {hasData ? `${fmt(m.expense)}` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold" style={{ color: netColor }}>
                      {hasData ? `${m.net >= 0 ? "+" : ""}${fmt(m.net)}` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-bold" style={{ color: srColor2 }}>
                      {m.savingsRate >= 0 ? `${m.savingsRate}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Full year totals row */}
            <tfoot>
              <tr style={{ borderTop: "2px solid var(--border)" }}>
                <td className="px-4 py-3 font-bold text-[14px]" style={{ color: "var(--text-primary)" }}>全年</td>
                <td className="px-4 py-3 text-right tabular-nums font-bold text-[14px]" style={{ color: "#10b981" }}>
                  {fmt(totals.income)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-bold text-[14px]" style={{ color: "#ef4444" }}>
                  {fmt(totals.expense)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-bold text-[14px]"
                  style={{ color: totals.net >= 0 ? "#10b981" : "#ef4444" }}>
                  {totals.net >= 0 ? "+" : ""}{fmt(totals.net)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-bold text-[14px]"
                  style={{ color: srColor }}>
                  {totals.savingsRate >= 0 ? `${totals.savingsRate}%` : "—"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}
