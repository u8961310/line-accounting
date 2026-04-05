"use client";

import { useEffect, useState, useCallback } from "react";
import { DEMO_LOANS_RAW, DEMO_CREDIT_CARDS_RAW, DEMO_FIXED_EXPENSES } from "@/lib/demo-data";

// ── Types ──────────────────────────────────────────────────────────────────

type EventType = "bill-due" | "statement" | "loan" | "fixed" | "subscription";

interface CalEvent {
  day: number;
  type: EventType;
  label: string;
  amount?: number;
  urgent?: boolean; // unpaid & due soon
}

// ── Constants ──────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<EventType, { color: string; bg: string; icon: string; title: string }> = {
  "bill-due":     { color: "#EF4444", bg: "rgba(239,68,68,0.12)",    icon: "💳", title: "信用卡繳款日" },
  "statement":    { color: "#F59E0B", bg: "rgba(245,158,11,0.12)",   icon: "📋", title: "信用卡結帳日" },
  "loan":         { color: "#3B82F6", bg: "rgba(59,130,246,0.12)",   icon: "🏦", title: "貸款還款日"   },
  "fixed":        { color: "#8B5CF6", bg: "rgba(139,92,246,0.12)",   icon: "📌", title: "固定支出"     },
  "subscription": { color: "#06B6D4", bg: "rgba(6,182,212,0.12)",    icon: "🔁", title: "訂閱扣款日"   },
};

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("zh-TW");
}

// ── Sub-components ───────────────────────────────────────────────────────────

function Legend() {
  return (
    <div className="flex flex-wrap gap-3">
      {(Object.entries(TYPE_CONFIG) as [EventType, typeof TYPE_CONFIG[EventType]][]).map(([, cfg]) => (
        <div key={cfg.title} className="flex items-center gap-1.5 text-[14px]" style={{ color: "var(--text-muted)" }}>
          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: cfg.color }} />
          {cfg.icon} {cfg.title}
        </div>
      ))}
    </div>
  );
}

interface DayEventsProps { events: CalEvent[] }
function DayEvents({ events }: DayEventsProps) {
  if (events.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-0.5 mt-0.5 justify-center">
      {events.slice(0, 3).map((e, i) => (
        <span key={i} className="w-1.5 h-1.5 rounded-full"
          style={{ background: TYPE_CONFIG[e.type].color }} />
      ))}
      {events.length > 3 && (
        <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>+{events.length - 3}</span>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export default function BillCalendar({ isDemo }: { isDemo: boolean }) {
  const [events,   setEvents]   = useState<CalEvent[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selected, setSelected] = useState<number | null>(null);

  const build = useCallback((
    loans:         { name: string; paymentDay: number | null; status: string; remainingPrincipal: string | number }[],
    cards:         { name: string; bank: string; statementDay?: number | null; dueDay?: number | null; bills?: { status: string; totalAmount: string | number; dueDate: string; billingMonth?: string }[] }[],
    fixedExpenses: { name: string; amount: number; dayOfMonth?: number | null }[],
    subscriptions: { name: string; cycle: string; fee: number; monthlyAmount: number; nextBillingDate: string | null; startDate: string | null }[],
    year: number,
    month: number, // 0-indexed
  ): CalEvent[] => {
    const result: CalEvent[] = [];
    const today = new Date();

    // Loans
    for (const loan of loans) {
      if (loan.status === "paid_off" || !loan.paymentDay) continue;
      result.push({
        day:    loan.paymentDay,
        type:   "loan",
        label:  `${loan.name} 還款`,
        amount: parseFloat(String(loan.remainingPrincipal)),
      });
    }

    // Credit cards
    for (const card of cards) {
      if (card.statementDay) {
        result.push({ day: card.statementDay, type: "statement", label: `${card.name} 結帳日` });
      }
      if (card.dueDay) {
        const ym = `${year}-${String(month + 1).padStart(2, "0")}`;
        const unpaidBill = card.bills?.find(b =>
          b.billingMonth === ym && b.status !== "paid"
        ) ?? card.bills?.find(b => b.status !== "paid");
        const amount = unpaidBill ? parseFloat(String(unpaidBill.totalAmount)) : undefined;
        const billDate = new Date(year, month, card.dueDay);
        const daysUntil = Math.ceil((billDate.getTime() - today.getTime()) / 86400000);
        result.push({
          day:    card.dueDay,
          type:   "bill-due",
          label:  `${card.name} 繳款`,
          amount,
          urgent: !!unpaidBill && daysUntil >= 0 && daysUntil <= 7,
        });
      }
    }

    // Fixed expenses
    for (const fe of fixedExpenses) {
      if (!fe.dayOfMonth) continue;
      result.push({ day: fe.dayOfMonth, type: "fixed", label: fe.name, amount: fe.amount });
    }

    // Subscriptions — 月繳每月都顯示，年繳只在扣款當月顯示
    const MONTHLY = new Set(["每月", "月繳", "月付", "月"]);
    const YEARLY  = new Set(["每年", "年繳", "年付", "年"]);
    for (const sub of subscriptions) {
      if (!sub.startDate) continue;
      const start = new Date(sub.startDate);

      if (MONTHLY.has(sub.cycle)) {
        // 每月在 startDate 的同一天扣款
        const billingDay = start.getDate();
        if (billingDay >= 1 && billingDay <= new Date(year, month + 1, 0).getDate()) {
          result.push({
            day:    billingDay,
            type:   "subscription",
            label:  sub.name,
            amount: sub.monthlyAmount,
          });
        }
      } else if (YEARLY.has(sub.cycle)) {
        // 只在週年月份顯示
        if (start.getMonth() === month) {
          result.push({
            day:    start.getDate(),
            type:   "subscription",
            label:  `${sub.name}（年繳）`,
            amount: sub.fee,
          });
        }
      }
    }

    return result;
  }, []);

  useEffect(() => {
    const y = viewDate.getFullYear();
    const m = viewDate.getMonth();

    if (isDemo) {
      setEvents(build(DEMO_LOANS_RAW, DEMO_CREDIT_CARDS_RAW, DEMO_FIXED_EXPENSES.fixedExpenses, [], y, m));
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.all([
      fetch("/api/loans").then(r => r.json()),
      fetch("/api/credit-cards").then(r => r.json()),
      fetch("/api/fixed-expenses").then(r => r.json()),
      fetch("/api/subscriptions").then(r => r.json()),
    ]).then(([loansData, cardsData, feData, subData]) => {
      setEvents(build(
        (loansData.loans ?? loansData) as Parameters<typeof build>[0],
        Array.isArray(cardsData) ? cardsData : [],
        ((feData as { fixedExpenses: { name: string; amount: number; dayOfMonth?: number | null }[] }).fixedExpenses ?? []),
        ((subData as { items: { name: string; cycle: string; fee: number; monthlyAmount: number; nextBillingDate: string | null; startDate: string | null }[] }).items ?? []),
        y, m,
      ));
    }).finally(() => setLoading(false));
  }, [isDemo, viewDate, build]);

  const year       = viewDate.getFullYear();
  const month      = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWday  = new Date(year, month, 1).getDay();
  const today      = new Date();
  const isToday    = (d: number) => today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;

  const eventsByDay = new Map<number, CalEvent[]>();
  for (const e of events) {
    if (!eventsByDay.has(e.day)) eventsByDay.set(e.day, []);
    eventsByDay.get(e.day)!.push(e);
  }

  const urgentEvents = events.filter(e => e.urgent);
  const selectedEvents = selected ? (eventsByDay.get(selected) ?? []) : [];

  // Upcoming events in the current month, sorted by day
  const upcomingDay = today.getMonth() === month && today.getFullYear() === year ? today.getDate() : 1;
  const upcoming = [...events]
    .filter(e => e.day >= upcomingDay)
    .sort((a, b) => a.day - b.day);

  function prevMonth() {
    setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    setSelected(null);
  }
  function nextMonth() {
    setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
    setSelected(null);
  }

  if (loading) return (
    <div className="rounded-2xl border flex justify-center py-12"
      style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
      <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
    </div>
  );

  return (
    <div className="space-y-4">

      {/* Urgent banner */}
      {urgentEvents.length > 0 && (
        <div className="rounded-xl px-4 py-3 flex items-center gap-3"
          style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.35)" }}>
          <span className="text-lg">🚨</span>
          <div>
            <p className="text-[14px] font-bold" style={{ color: "#EF4444" }}>7 天內帳單即將到期</p>
            <p className="text-[14px] mt-0.5" style={{ color: "#FCA5A5" }}>
              {urgentEvents.map(e => `${e.label}（NT$ ${fmt(e.amount ?? 0)}）`).join("、")}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">

        {/* ── Calendar ── */}
        <div className="rounded-2xl border overflow-hidden"
          style={{ background: "var(--bg-card)", borderColor: "var(--border)", boxShadow: "var(--card-shadow)" }}>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b"
            style={{ borderColor: "var(--border-inner)" }}>
            <button onClick={prevMonth}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:opacity-80 transition-opacity"
              style={{ background: "var(--bg-input)", color: "var(--text-sub)" }}>‹</button>
            <div className="text-center">
              <p className="font-bold text-[16px]" style={{ color: "var(--text-primary)" }}>
                {year} 年 {month + 1} 月
              </p>
              <p className="text-[14px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                {events.length} 個事件
              </p>
            </div>
            <button onClick={nextMonth}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:opacity-80 transition-opacity"
              style={{ background: "var(--bg-input)", color: "var(--text-sub)" }}>›</button>
          </div>

          {/* Legend */}
          <div className="px-5 pt-3 pb-2">
            <Legend />
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 px-3 pb-1">
            {WEEKDAYS.map(w => (
              <div key={w} className="text-center text-[14px] font-semibold py-1"
                style={{ color: "var(--text-muted)" }}>{w}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1 px-3 pb-4">
            {/* Empty cells before first day */}
            {Array.from({ length: firstWday }).map((_, i) => <div key={`e${i}`} />)}

            {Array.from({ length: daysInMonth }, (_, i) => {
              const day     = i + 1;
              const dayEvts = eventsByDay.get(day) ?? [];
              const isTd    = isToday(day);
              const isSel   = selected === day;
              const hasUrgent = dayEvts.some(e => e.urgent);

              return (
                <button key={day} onClick={() => setSelected(isSel ? null : day)}
                  className="rounded-xl py-1.5 flex flex-col items-center transition-all hover:opacity-90"
                  style={{
                    background: isSel    ? "var(--accent)"
                      : isTd   ? "var(--bg-input)"
                      : dayEvts.length > 0 ? "var(--bg-input)"
                      : "transparent",
                    border: isTd ? "1px solid var(--accent)"
                      : hasUrgent ? "1px solid rgba(239,68,68,0.5)"
                      : "1px solid transparent",
                    minHeight: 52,
                  }}>
                  <span className="text-[14px] font-bold"
                    style={{ color: isSel ? "#fff" : isTd ? "var(--accent)" : "var(--text-primary)" }}>
                    {day}
                  </span>
                  <DayEvents events={dayEvts} />
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Right panel: selected day or upcoming ── */}
        <div className="rounded-2xl border overflow-hidden"
          style={{ background: "var(--bg-card)", borderColor: "var(--border)", boxShadow: "var(--card-shadow)" }}>
          <div className="px-4 py-3.5 border-b" style={{ borderColor: "var(--border-inner)" }}>
            <p className="font-bold text-[14px]" style={{ color: "var(--text-primary)" }}>
              {selected ? `${month + 1}/${selected} 事件` : "本月即將到期"}
            </p>
          </div>
          <div className="px-4 py-3 space-y-2 overflow-y-auto" style={{ maxHeight: 380 }}>
            {(selected ? selectedEvents : upcoming).map((e, i) => {
              const cfg = TYPE_CONFIG[e.type];
              return (
                <div key={i} className="rounded-xl px-3 py-2.5"
                  style={{ background: cfg.bg, border: `1px solid ${cfg.color}30` }}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span>{cfg.icon}</span>
                      <div>
                        <p className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
                          {e.label}
                          {!selected && <span className="ml-1.5 text-[14px] font-normal" style={{ color: "var(--text-muted)" }}>{month + 1}/{e.day}</span>}
                        </p>
                        <p className="text-[14px]" style={{ color: cfg.color }}>{cfg.title}</p>
                      </div>
                    </div>
                    {e.amount !== undefined && (
                      <span className="text-[14px] font-bold tabular-nums flex-shrink-0"
                        style={{ color: cfg.color }}>
                        NT$ {fmt(e.amount)}
                      </span>
                    )}
                  </div>
                  {e.urgent && (
                    <p className="text-[14px] mt-1 font-semibold" style={{ color: "#EF4444" }}>⚠ 7 天內到期，請盡快繳清</p>
                  )}
                </div>
              );
            })}
            {(selected ? selectedEvents : upcoming).length === 0 && (
              <p className="text-[14px] text-center py-8" style={{ color: "var(--text-muted)" }}>
                {selected ? "這天沒有事件" : "本月無待繳事件 ✅"}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
