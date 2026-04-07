import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSubscriptionsFromNotion } from "@/lib/notion";

export const dynamic = "force-dynamic";

export type NotifSeverity = "danger" | "warn" | "info";
export type NotifType     = "budget" | "bill" | "goal" | "subscription";

export interface AppNotification {
  id:       string;
  type:     NotifType;
  severity: NotifSeverity;
  title:    string;
  body:     string;
}

export interface NotificationsResponse {
  notifications: AppNotification[];
  dangerCount:   number;
  warnCount:     number;
}

export async function GET(): Promise<NextResponse> {
  try {
  const user = await prisma.user.findUnique({ where: { lineUserId: "dashboard_user" } });
  if (!user) return NextResponse.json({ notifications: [], dangerCount: 0, warnCount: 0 });

  const now       = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [budgets, transactions, creditCards, goals, subscriptions] = await Promise.all([
    prisma.budget.findMany({ where: { userId: user.id } }),
    prisma.transaction.findMany({
      where: { userId: user.id, date: { gte: monthStart, lt: monthEnd }, NOT: { category: "轉帳" } },
      select: { category: true, amount: true, type: true },
    }),
    prisma.creditCard.findMany({
      where:   { userId: user.id },
      include: { bills: { where: { status: { not: "paid" } }, orderBy: { dueDate: "asc" } } },
    }),
    prisma.financialGoal.findMany({ where: { userId: user.id } }),
    getSubscriptionsFromNotion(),
  ]);

  const notes: AppNotification[] = [];

  // ── 1. 預算超標 ────────────────────────────────────────────────────────────
  const spentMap = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.type !== "支出") continue;
    spentMap.set(tx.category, (spentMap.get(tx.category) ?? 0) + parseFloat(tx.amount.toString()));
  }

  for (const budget of budgets) {
    const spent      = spentMap.get(budget.category) ?? 0;
    const budgetAmt  = parseFloat(budget.amount.toString());
    const pct        = budgetAmt > 0 ? (spent / budgetAmt) * 100 : 0;
    if (pct > 100) {
      notes.push({
        id:       `budget-danger-${budget.category}`,
        type:     "budget",
        severity: "danger",
        title:    `${budget.category} 已超出預算`,
        body:     `本月已花 NT$ ${Math.round(spent).toLocaleString("zh-TW")}，超出預算 NT$ ${Math.round(spent - budgetAmt).toLocaleString("zh-TW")}`,
      });
    } else if (pct >= 80 && pct < 100) {
      notes.push({
        id:       `budget-warn-${budget.category}`,
        type:     "budget",
        severity: "warn",
        title:    `${budget.category} 已用 ${Math.round(pct)}% 預算`,
        body:     `NT$ ${Math.round(spent).toLocaleString("zh-TW")} / ${Math.round(budgetAmt).toLocaleString("zh-TW")}，剩餘 NT$ ${Math.round(budgetAmt - spent).toLocaleString("zh-TW")}`,
      });
    }
  }

  // ── 2. 帳單到期 ────────────────────────────────────────────────────────────
  for (const card of creditCards) {
    // 找最近一筆未繳帳單，且未達最低應繳視為未繳（達最低應繳則不列警告）
    const bill = card.bills.find(b => {
      const minPay = b.minimumPayment ? parseFloat(b.minimumPayment.toString()) : null;
      const paid   = parseFloat(b.paidAmount.toString());
      if (minPay !== null && paid >= minPay) return false; // 最低已繳 → 略過
      return true;
    });
    if (!bill) continue;

    const due      = new Date(bill.dueDate);
    const daysLeft = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const unpaid   = parseFloat(bill.totalAmount.toString()) - parseFloat(bill.paidAmount.toString());

    if (daysLeft < 0) {
      notes.push({
        id:       `bill-overdue-${card.id}`,
        type:     "bill",
        severity: "danger",
        title:    `${card.name} 帳單已逾期`,
        body:     `${bill.billingMonth} 帳單 NT$ ${Math.round(unpaid).toLocaleString("zh-TW")} 尚未繳清，已逾期 ${Math.abs(daysLeft)} 天`,
      });
    } else if (daysLeft <= 3) {
      notes.push({
        id:       `bill-urgent-${card.id}`,
        type:     "bill",
        severity: "danger",
        title:    `${card.name} 帳單 ${daysLeft} 天後到期`,
        body:     `NT$ ${Math.round(unpaid).toLocaleString("zh-TW")} 待繳，截止日 ${due.toLocaleDateString("zh-TW")}`,
      });
    } else if (daysLeft <= 7) {
      notes.push({
        id:       `bill-warn-${card.id}`,
        type:     "bill",
        severity: "warn",
        title:    `${card.name} 帳單 ${daysLeft} 天後到期`,
        body:     `NT$ ${Math.round(unpaid).toLocaleString("zh-TW")} 待繳，截止日 ${due.toLocaleDateString("zh-TW")}`,
      });
    }
  }

  // ── 3. 儲蓄目標進度 ────────────────────────────────────────────────────────
  for (const goal of goals) {
    const target   = parseFloat(goal.targetAmount.toString());
    const saved    = parseFloat(goal.savedAmount.toString());
    const progress = target > 0 ? (saved / target) * 100 : 0;

    // 即將到達截止日且進度不足
    if (goal.deadline) {
      const daysToDeadline = Math.ceil((new Date(goal.deadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysToDeadline > 0 && daysToDeadline <= 90 && progress < 80) {
        notes.push({
          id:       `goal-deadline-${goal.id}`,
          type:     "goal",
          severity: daysToDeadline <= 30 ? "warn" : "info",
          title:    `${goal.emoji ?? "🎯"} ${goal.name} 距截止剩 ${daysToDeadline} 天`,
          body:     `目前進度 ${Math.round(progress)}%，距目標還差 NT$ ${Math.round(target - saved).toLocaleString("zh-TW")}`,
        });
      }
    }

    // 快達標（95% 以上）— 鼓勵通知
    if (progress >= 95 && progress < 100) {
      notes.push({
        id:       `goal-near-${goal.id}`,
        type:     "goal",
        severity: "info",
        title:    `${goal.emoji ?? "🎯"} ${goal.name} 快達標了！`,
        body:     `已達 ${Math.round(progress)}%，再存 NT$ ${Math.round(target - saved).toLocaleString("zh-TW")} 即可完成`,
      });
    }
  }

  // ── 4. 年繳訂閱即將扣款 ────────────────────────────────────────────────────
  const YEARLY_CYCLES = new Set(["每年", "年繳", "年付", "年"]);
  for (const sub of subscriptions) {
    if (!YEARLY_CYCLES.has(sub.cycle) || !sub.nextBillingDate) continue;

    const billingDate = new Date(sub.nextBillingDate);
    const daysLeft    = Math.ceil((billingDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysLeft < 0 || daysLeft > 14) continue;

    notes.push({
      id:       `sub-yearly-${sub.id}`,
      type:     "subscription",
      severity: daysLeft <= 3 ? "danger" : "warn",
      title:    `${sub.name} 年費 ${daysLeft === 0 ? "今天" : `${daysLeft} 天後`}扣款`,
      body:     `NT$ ${Math.round(sub.fee).toLocaleString("zh-TW")}，扣款日 ${billingDate.toLocaleDateString("zh-TW")}`,
    });
  }

  // Sort: danger → warn → info
  const order: Record<NotifSeverity, number> = { danger: 0, warn: 1, info: 2 };
  notes.sort((a, b) => order[a.severity] - order[b.severity]);

  return NextResponse.json({
    notifications: notes,
    dangerCount:   notes.filter(n => n.severity === "danger").length,
    warnCount:     notes.filter(n => n.severity === "warn").length,
  } satisfies NotificationsResponse);
  } catch (e) {
    console.error("[notifications]", e);
    return NextResponse.json({ notifications: [], dangerCount: 0, warnCount: 0 });
  }
}
