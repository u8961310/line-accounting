"use client";

import { useEffect, useState, useCallback } from "react";
import type { SubItem, SubscriptionsResponse } from "@/app/api/subscriptions/route";

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number) { return Math.round(n).toLocaleString("zh-TW"); }

const PAYMENT_COLOR: Record<string, string> = {
  "合作金庫":   "#4ADE80",
  "玉山銀行":   "#FBBF24",
  "兆豐銀行":   "#60A5FA",
  "永豐信用卡": "#C084FC",
  "永豐銀行":   "#A78BFA",
  "國泰信用卡": "#F472B6",
  "中信信用卡": "#FB923C",
  "台新信用卡": "#34D399",
  "玉山信用卡": "#FDE68A",
};
function paymentColor(m: string) { return PAYMENT_COLOR[m] ?? "#94A3B8"; }

const TAG_PALETTE = [
  "#60A5FA", "#C084FC", "#34D399", "#FB923C",
  "#F472B6", "#FBBF24", "#A78BFA", "#06B6D4",
  "#4ADE80", "#F87171",
];
function tagColor(i: number) { return TAG_PALETTE[i % TAG_PALETTE.length]; }

const MONTHLY_CYCLES  = new Set(["每月", "月繳", "月付", "月"]);
const YEARLY_CYCLES   = new Set(["每年", "年繳", "年付", "年"]);
const QUARTER_CYCLES  = new Set(["每季", "季繳", "季付", "季"]);

type GroupKey = "monthly" | "yearly" | "quarterly" | "other";
type SortKey  = "monthly" | "total" | "name" | "start";

function cycleGroup(cycle: string): GroupKey {
  if (MONTHLY_CYCLES.has(cycle))  return "monthly";
  if (YEARLY_CYCLES.has(cycle))   return "yearly";
  if (QUARTER_CYCLES.has(cycle))  return "quarterly";
  return "other";
}

const GROUP_META: Record<GroupKey, { label: string; suffix: string; color: string }> = {
  monthly:   { label: "月費", suffix: "/月", color: "#60A5FA" },
  yearly:    { label: "年費", suffix: "/年", color: "#C084FC" },
  quarterly: { label: "季費", suffix: "/季", color: "#34D399" },
  other:     { label: "其他", suffix: "",    color: "#94A3B8" },
};

// ── Sub-components ─────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, accent, icon,
}: { label: string; value: string; sub: string; accent?: string; icon?: string }) {
  return (
    <div className="rounded-2xl px-5 py-4 flex flex-col gap-1.5 relative overflow-hidden"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      {icon && (
        <span className="absolute right-4 top-3.5 text-[22px] opacity-20 select-none">{icon}</span>
      )}
      <p className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="text-[22px] font-black tracking-tight leading-none" style={{ color: accent ?? "var(--text-primary)" }}>
        {value}
      </p>
      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{sub}</p>
    </div>
  );
}

function PaymentBreakdown({ items }: { items: SubItem[] }) {
  const byMethod = new Map<string, number>();
  for (const item of items) {
    const key = item.paymentMethod || "其他";
    byMethod.set(key, (byMethod.get(key) ?? 0) + item.monthlyAmount);
  }
  const sorted = Array.from(byMethod.entries()).sort((a, b) => b[1] - a[1]);
  const total  = sorted.reduce((s, [, v]) => s + v, 0);
  if (sorted.length === 0) return null;

  return (
    <div className="rounded-2xl px-5 py-4 space-y-3.5"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          付款方式月費分布
        </p>
        <p className="text-[12px] tabular-nums" style={{ color: "var(--text-muted)" }}>
          合計 NT$ {fmt(total)}/月
        </p>
      </div>

      {/* Stacked bar */}
      <div className="flex h-2 rounded-full overflow-hidden gap-px">
        {sorted.map(([method, amount]) => (
          <div key={method}
            className="h-full transition-all duration-500"
            style={{ width: `${(amount / total) * 100}%`, background: paymentColor(method) }} />
        ))}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-2">
        {sorted.map(([method, amount]) => {
          const color = paymentColor(method);
          const pct   = total > 0 ? Math.round((amount / total) * 100) : 0;
          return (
            <div key={method} className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                <span className="text-[12px] truncate" style={{ color: "var(--text-sub)" }}>{method}</span>
                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>({pct}%)</span>
              </div>
              <span className="text-[12px] font-semibold tabular-nums ml-2 flex-shrink-0" style={{ color: "var(--text-primary)" }}>
                {fmt(amount)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SubRow({ item, group }: { item: SubItem; group: GroupKey }) {
  const color    = paymentColor(item.paymentMethod);
  const isYearly = group === "yearly";
  const isOther  = group === "other" || group === "quarterly";

  // 主要金額：年費顯示實際扣款金額，月費顯示月費
  const primaryAmt    = (isYearly || isOther) && item.fee > 0 ? item.fee : item.monthlyAmount;
  const primarySuffix = (isYearly || isOther) && item.fee > 0
    ? (GROUP_META[group]?.suffix ?? "/月")
    : "/月";
  const showMonthly   = isYearly && item.monthlyAmount > 0 && Math.round(item.fee) !== Math.round(item.monthlyAmount);

  return (
    <div className="px-5 py-3.5 flex items-center gap-3.5 transition-colors"
      style={{ borderBottom: "1px solid var(--border-inner)" }}
      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.025)")}
      onMouseLeave={e => (e.currentTarget.style.background = "")}>

      {/* Payment color dot */}
      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5"
        style={{ background: color, boxShadow: `0 0 6px ${color}60` }} />

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap mb-1">
          <span className="text-[14px] font-bold" style={{ color: "var(--text-primary)" }}>
            {item.name || "—"}
          </span>
          {item.tags.map(tag => (
            <span key={tag} className="text-[11px] px-1.5 py-0.5 rounded-md"
              style={{ background: "var(--bg-input)", color: "var(--text-muted)", border: "1px solid var(--border-inner)" }}>
              {tag}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {item.paymentMethod && (
            <span className="text-[11px] px-2 py-0.5 rounded-full font-medium"
              style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}>
              {item.paymentMethod}
            </span>
          )}
          {item.startDate && (
            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>起 {item.startDate}</span>
          )}
          {item.totalSpent > 0 && (
            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              · 累計 NT$ {fmt(item.totalSpent)}
            </span>
          )}
        </div>
      </div>

      {/* Amount */}
      <div className="text-right flex-shrink-0">
        <p className="text-[15px] font-black tabular-nums leading-tight" style={{ color: "var(--text-primary)" }}>
          NT$ {fmt(primaryAmt)}
          <span className="text-[11px] font-normal" style={{ color: "var(--text-muted)" }}>{primarySuffix}</span>
        </p>
        {showMonthly && (
          <p className="text-[11px] tabular-nums mt-0.5" style={{ color: "var(--text-muted)" }}>
            折合 NT$ {fmt(item.monthlyAmount)}/月
          </p>
        )}
      </div>
    </div>
  );
}

function GroupSection({ groupKey, items }: { groupKey: GroupKey; items: SubItem[] }) {
  const meta         = GROUP_META[groupKey];
  const groupMonthly = items.reduce((s, i) => s + i.monthlyAmount, 0);
  const groupFee     = items.reduce((s, i) => s + i.fee, 0);
  const isYearly     = groupKey === "yearly";

  return (
    <div>
      {/* Group header */}
      <div className="px-5 py-2 flex items-center justify-between"
        style={{
          background:   "var(--bg-input)",
          borderTop:    "1px solid var(--border-inner)",
          borderBottom: "1px solid var(--border-inner)",
          borderLeft:   `3px solid ${meta.color}`,
        }}>
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold" style={{ color: meta.color }}>{meta.label}</span>
          <span className="text-[11px] px-1.5 py-0.5 rounded-md tabular-nums"
            style={{ background: `${meta.color}18`, color: meta.color }}>
            {items.length} 項
          </span>
        </div>
        <div className="flex items-center gap-3">
          {isYearly && groupFee > 0 && (
            <span className="text-[12px] tabular-nums" style={{ color: "var(--text-muted)" }}>
              NT$ {fmt(groupFee)}/年
            </span>
          )}
          <span className="text-[13px] font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
            NT$ {fmt(groupMonthly)}
            <span className="text-[11px] font-normal ml-0.5" style={{ color: "var(--text-muted)" }}>/月</span>
          </span>
        </div>
      </div>

      {/* Rows */}
      {items.map(item => <SubRow key={item.id} item={item} group={groupKey} />)}
    </div>
  );
}

function TagPieChart({ items }: { items: SubItem[] }) {
  const tagMap = new Map<string, number>();
  for (const item of items) {
    const tags = item.tags.length > 0 ? item.tags : ["未分類"];
    for (const tag of tags) {
      tagMap.set(tag, (tagMap.get(tag) ?? 0) + item.monthlyAmount);
    }
  }
  const sorted = Array.from(tagMap.entries()).sort((a, b) => b[1] - a[1]);
  const total  = sorted.reduce((s, [, v]) => s + v, 0);

  const r    = 52;
  const cx   = 70;
  const cy   = 70;
  const circ = 2 * Math.PI * r;

  let cumPct = 0;
  const segments = sorted.map(([tag, amount], i) => {
    const pct        = total > 0 ? amount / total : 0;
    const startAngle = cumPct * 360;
    cumPct += pct;
    return { tag, amount, pct, color: tagColor(i), startAngle };
  });

  if (segments.length === 0) return null;

  return (
    <div className="rounded-2xl px-5 py-4 space-y-4"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <p className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
        分類標籤月費佔比
      </p>
      <div className="flex items-center gap-6">
        {/* SVG donut */}
        <div className="flex-shrink-0">
          <svg width="140" height="140" viewBox="0 0 140 140">
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bg-input)" strokeWidth="18" />
            {segments.map(seg => (
              <circle key={seg.tag}
                cx={cx} cy={cy} r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth="18"
                strokeDasharray={`${seg.pct * circ} ${circ}`}
                strokeDashoffset={0}
                style={{
                  transform:       `rotate(${seg.startAngle - 90}deg)`,
                  transformOrigin: `${cx}px ${cy}px`,
                  transition:      "stroke-dasharray 0.4s ease",
                }}
              />
            ))}
            <text x={cx} y={cy - 5} textAnchor="middle" fontSize="10" fill="var(--text-muted)">月費合計</text>
            <text x={cx} y={cy + 10} textAnchor="middle" fontSize="11" fontWeight="bold" fill="var(--text-primary)">
              {fmt(total)}
            </text>
          </svg>
        </div>
        {/* Legend */}
        <div className="flex-1 space-y-2.5">
          {segments.map(seg => (
            <div key={seg.tag} className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: seg.color }} />
                <span className="text-[12px] truncate" style={{ color: "var(--text-sub)" }}>{seg.tag}</span>
                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  ({Math.round(seg.pct * 100)}%)
                </span>
              </div>
              <span className="text-[12px] font-semibold tabular-nums ml-2 flex-shrink-0"
                style={{ color: "var(--text-primary)" }}>
                NT$ {fmt(seg.amount)}
              </span>
            </div>
          ))}
          {items.some(i => i.tags.length > 1) && (
            <p className="text-[10px] pt-1" style={{ color: "var(--text-muted)" }}>
              * 多標籤項目會重複計入各分類
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function TagGroupView({ items }: { items: SubItem[] }) {
  const tagItems = new Map<string, SubItem[]>();
  for (const item of items) {
    const tags = item.tags.length > 0 ? item.tags : ["未分類"];
    for (const tag of tags) {
      if (!tagItems.has(tag)) tagItems.set(tag, []);
      tagItems.get(tag)!.push(item);
    }
  }
  const sorted = Array.from(tagItems.entries())
    .sort((a, b) =>
      b[1].reduce((s, i) => s + i.monthlyAmount, 0) -
      a[1].reduce((s, i) => s + i.monthlyAmount, 0)
    );

  return (
    <div>
      {sorted.map(([tag, tagList], idx) => {
        const color      = tagColor(idx);
        const groupTotal = tagList.reduce((s, i) => s + i.monthlyAmount, 0);
        return (
          <div key={tag}>
            <div className="px-5 py-2 flex items-center justify-between"
              style={{
                background:   "var(--bg-input)",
                borderTop:    "1px solid var(--border-inner)",
                borderBottom: "1px solid var(--border-inner)",
                borderLeft:   `3px solid ${color}`,
              }}>
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-bold" style={{ color }}>🏷 {tag}</span>
                <span className="text-[11px] px-1.5 py-0.5 rounded-md tabular-nums"
                  style={{ background: `${color}18`, color }}>
                  {tagList.length} 項
                </span>
              </div>
              <span className="text-[13px] font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
                NT$ {fmt(groupTotal)}
                <span className="text-[11px] font-normal ml-0.5" style={{ color: "var(--text-muted)" }}>/月</span>
              </span>
            </div>
            {tagList.map(item => <SubRow key={item.id} item={item} group={cycleGroup(item.cycle)} />)}
          </div>
        );
      })}
    </div>
  );
}

interface VerifyItem {
  id:         string;
  name:       string;
  cycle:      string;
  fee:        number;
  status:     "found" | "not_found";
  matchedTx?: { date: string; amount: number; note: string };
}

function VerifyPanel() {
  const [result,  setResult]  = useState<{ items: VerifyItem[]; foundCount: number; month: string } | null>(null);
  const [loading, setLoading] = useState(false);

  function run() {
    setLoading(true);
    fetch("/api/subscriptions/verify")
      .then(r => r.json())
      .then(setResult)
      .finally(() => setLoading(false));
  }

  const notFound = result?.items.filter(i => i.status === "not_found") ?? [];
  const found    = result?.items.filter(i => i.status === "found")     ?? [];

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: result ? "1px solid var(--border-inner)" : undefined }}>
        <div>
          <p className="text-[14px] font-bold" style={{ color: "var(--text-primary)" }}>🔍 本月扣款比對</p>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            {result
              ? `${result.month} · ${result.foundCount} / ${result.items.length} 項找到交易紀錄`
              : "比對 Notion 訂閱清單與本月交易，確認訂閱是否已扣款"}
          </p>
        </div>
        <button onClick={run} disabled={loading}
          className="px-4 py-1.5 rounded-xl text-[13px] font-bold transition-opacity hover:opacity-80 disabled:opacity-50 flex-shrink-0"
          style={{ background: "var(--accent)", color: "#fff" }}>
          {loading ? "比對中…" : result ? "重新比對" : "開始比對"}
        </button>
      </div>

      {result && result.items.length > 0 && (
        <div>
          {/* 未找到 */}
          {notFound.length > 0 && (
            <div>
              <div className="px-5 py-2 flex items-center gap-2"
                style={{ background: "rgba(239,68,68,0.06)", borderBottom: "1px solid var(--border-inner)", borderLeft: "3px solid #EF4444" }}>
                <span className="text-[13px] font-bold" style={{ color: "#EF4444" }}>❓ 未找到交易</span>
                <span className="text-[11px] px-1.5 py-0.5 rounded-md" style={{ background: "#EF444420", color: "#EF4444" }}>
                  {notFound.length} 項
                </span>
                <span className="text-[11px] ml-auto" style={{ color: "var(--text-muted)" }}>可能尚未扣款或備注不符</span>
              </div>
              {notFound.map(item => (
                <div key={item.id} className="px-5 py-3 flex items-center justify-between"
                  style={{ borderBottom: "1px solid var(--border-inner)" }}>
                  <div>
                    <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>{item.name}</p>
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{item.cycle}</p>
                  </div>
                  <span className="text-[12px] tabular-nums" style={{ color: "var(--text-muted)" }}>
                    NT$ {fmt(item.fee)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* 已找到 */}
          {found.length > 0 && (
            <div>
              <div className="px-5 py-2 flex items-center gap-2"
                style={{ background: "rgba(16,185,129,0.06)", borderBottom: "1px solid var(--border-inner)", borderLeft: "3px solid #10B981" }}>
                <span className="text-[13px] font-bold" style={{ color: "#10B981" }}>✅ 已扣款</span>
                <span className="text-[11px] px-1.5 py-0.5 rounded-md" style={{ background: "#10B98120", color: "#10B981" }}>
                  {found.length} 項
                </span>
              </div>
              {found.map(item => (
                <div key={item.id} className="px-5 py-3 flex items-center justify-between"
                  style={{ borderBottom: "1px solid var(--border-inner)" }}>
                  <div>
                    <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>{item.name}</p>
                    {item.matchedTx && (
                      <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {item.matchedTx.date} · {item.matchedTx.note}
                      </p>
                    )}
                  </div>
                  {item.matchedTx && (
                    <span className="text-[12px] font-semibold tabular-nums" style={{ color: "#10B981" }}>
                      NT$ {fmt(item.matchedTx.amount)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {result && result.items.length === 0 && (
        <div className="text-center py-8">
          <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>Notion 訂閱清單為空</p>
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function SubscriptionDetector() {
  const [data,         setData]         = useState<SubscriptionsResponse | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [filterMethod, setFilterMethod] = useState("");
  const [sortKey,      setSortKey]      = useState<SortKey>("monthly");
  const [viewMode,     setViewMode]     = useState<"list" | "tags">("list");

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/subscriptions")
      .then(r => r.json())
      .then((d: SubscriptionsResponse) => setData(d))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const allItems = data?.items ?? [];
  const methods  = Array.from(new Set(allItems.map(i => i.paymentMethod).filter(Boolean)));

  const filtered = allItems
    .filter(item => {
      if (filterMethod && item.paymentMethod !== filterMethod) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          item.tags.some(t => t.toLowerCase().includes(q)) ||
          item.paymentMethod.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (sortKey === "monthly") return b.monthlyAmount - a.monthlyAmount;
      if (sortKey === "total")   return b.totalSpent    - a.totalSpent;
      if (sortKey === "name")    return a.name.localeCompare(b.name, "zh-TW");
      if (sortKey === "start")   return (a.startDate ?? "").localeCompare(b.startDate ?? "");
      return 0;
    });

  // 各分組
  const groups = (["monthly", "yearly", "quarterly", "other"] as const).map(key => ({
    key,
    items: filtered.filter(i => cycleGroup(i.cycle) === key),
  })).filter(g => g.items.length > 0);

  if (loading) return (
    <div className="space-y-4">
      {[88, 130, 260].map(h => (
        <div key={h} className="rounded-2xl animate-pulse"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)", height: h }} />
      ))}
    </div>
  );

  // 月費 / 年費各別小計（for stats）
  const monthlyOnlyTotal  = allItems.filter(i => cycleGroup(i.cycle) === "monthly").reduce((s, i) => s + i.monthlyAmount, 0);
  const yearlyActualTotal = allItems.filter(i => cycleGroup(i.cycle) === "yearly").reduce((s, i) => s + i.fee, 0);

  return (
    <div className="space-y-4">

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon="📋" label="訂閱項目" value={`${allItems.length} 項`}
          sub="已排除已取消項目" />
        <StatCard icon="🔄" label="月費合計" value={`NT$ ${fmt(monthlyOnlyTotal)}`}
          sub="每月訂閱費加總" accent="#60A5FA" />
        <StatCard icon="📅" label="年費合計" value={`NT$ ${fmt(yearlyActualTotal)}`}
          sub="每年訂閱費加總" accent="#C084FC" />
      </div>

      {/* Breakdown — 依 viewMode 切換 */}
      {allItems.length > 0 && (
        viewMode === "tags"
          ? <TagPieChart items={filtered} />
          : <PaymentBreakdown items={allItems} />
      )}

      {/* List card */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>

        {/* Toolbar */}
        <div className="px-5 py-3 space-y-2.5" style={{ borderBottom: "1px solid var(--border-inner)" }}>

          {/* View mode toggle */}
          <div className="flex gap-1.5">
            {(["list", "tags"] as const).map(mode => {
              const active = viewMode === mode;
              const label  = mode === "list" ? "📋 分組列表" : "🏷 by 標籤";
              return (
                <button key={mode} onClick={() => setViewMode(mode)}
                  className="px-3 py-1 rounded-full text-[12px] font-semibold transition-all"
                  style={{
                    background: active ? "var(--accent)" : "var(--bg-input)",
                    color:      active ? "#fff"          : "var(--text-muted)",
                    border:     `1px solid ${active ? "var(--accent)" : "var(--border-inner)"}`,
                  }}>
                  {label}
                </button>
              );
            })}
          </div>

          {/* Payment method chips */}
          {methods.length > 1 && (
            <div className="flex gap-1.5 flex-wrap">
              {[{ key: "", label: `全部 (${allItems.length})`, color: "" }, ...methods.map(m => ({
                key: m, label: `${m} (${allItems.filter(i => i.paymentMethod === m).length})`, color: paymentColor(m),
              }))].map(({ key, label, color }) => {
                const active = filterMethod === key;
                return (
                  <button key={key} onClick={() => setFilterMethod(active && key !== "" ? "" : key)}
                    className="px-3 py-1 rounded-full text-[12px] font-semibold transition-all"
                    style={{
                      background: active ? (key ? `${color}22` : "var(--accent)") : "var(--bg-input)",
                      color:      active ? (key ? color : "#fff")                  : "var(--text-muted)",
                      border:     `1px solid ${active ? (key ? color : "var(--accent)") : "var(--border-inner)"}`,
                    }}>
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Search + sort */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                style={{ color: "var(--text-muted)" }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
              </svg>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="搜尋名稱、標籤、付款方式…"
                className="w-full pl-8 pr-3 py-1.5 rounded-lg text-[13px] outline-none"
                style={{ background: "var(--bg-input)", border: "1px solid var(--border-inner)", color: "var(--text-primary)" }} />
            </div>
            <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)}
              className="px-2.5 py-1.5 rounded-lg text-[13px] outline-none cursor-pointer flex-shrink-0"
              style={{ background: "var(--bg-input)", border: "1px solid var(--border-inner)", color: "var(--text-sub)" }}>
              <option value="monthly">月費 ↓</option>
              <option value="total">累計 ↓</option>
              <option value="name">名稱 A-Z</option>
              <option value="start">開始日 ↑</option>
            </select>
          </div>
        </div>

        {/* Content */}
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-3xl mb-3">📋</p>
            <p className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
              {allItems.length === 0 ? "尚無訂閱資料" : "沒有符合條件的項目"}
            </p>
            <p className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>
              {allItems.length === 0 ? "請確認 NOTION_SUBSCRIPTIONS_DB_ID 已設定" : "調整篩選條件或清除搜尋"}
            </p>
          </div>
        ) : (
          <div>
            {viewMode === "tags"
              ? <TagGroupView items={filtered} />
              : groups.map(g => <GroupSection key={g.key} groupKey={g.key} items={g.items} />)
            }
          </div>
        )}

        {/* Footer */}
        {filtered.length > 0 && (
          <div className="px-5 py-2.5 flex items-center justify-between"
            style={{ borderTop: "1px solid var(--border-inner)" }}>
            <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
              顯示 {filtered.length} / {allItems.length} 項
            </p>
            {(search || filterMethod) && (
              <button onClick={() => { setSearch(""); setFilterMethod(""); }}
                className="text-[12px] font-semibold transition-opacity hover:opacity-70"
                style={{ color: "var(--accent)" }}>
                清除篩選
              </button>
            )}
          </div>
        )}
      </div>

      {/* Verify panel */}
      <VerifyPanel />

    </div>
  );
}
