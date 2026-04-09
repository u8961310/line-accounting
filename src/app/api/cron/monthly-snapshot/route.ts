import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/cron/monthly-snapshot
 * 每月自動計算淨資產 + 財務健康分數，upsert 到快照表。
 * 驗證：Authorization: Bearer <CRON_SECRET>
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findFirst({ where: { lineUserId: "dashboard_user" } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // ── 決定快照月份（上個月） ──
    const now = new Date();
    const snapshotDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const month = `${snapshotDate.getFullYear()}-${String(snapshotDate.getMonth() + 1).padStart(2, "0")}`;
    const monthStart = snapshotDate;
    const monthEnd = new Date(now.getFullYear(), now.getMonth(), 1);

    // ── 淨資產計算 ──
    const [bankBalances, activeLoans, creditCards, cashOut, cashIn] = await Promise.all([
      prisma.bankBalance.findMany({ where: { userId: user.id, NOT: { source: "cash" } } }),
      prisma.loan.findMany({ where: { userId: user.id, status: "active" } }),
      prisma.creditCard.findMany({ where: { userId: user.id } }),
      prisma.transaction.aggregate({
        where: { userId: user.id, category: "現金", type: "支出" },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { userId: user.id, category: "現金", type: "收入" },
        _sum: { amount: true },
      }),
    ]);

    const cashBalance = Number(cashOut._sum.amount ?? 0) - Number(cashIn._sum.amount ?? 0);
    const totalAssets = bankBalances.reduce((s, b) => s + Number(b.balance), 0) + cashBalance;
    const totalLoanDebt = activeLoans.reduce((s, l) => s + Number(l.remainingPrincipal), 0);
    const totalCreditDebt = creditCards.reduce((s, c) => s + Number(c.currentBalance), 0);
    const totalDebt = totalLoanDebt + totalCreditDebt;
    const netWorth = totalAssets - totalDebt;

    await prisma.netWorthSnapshot.upsert({
      where: { userId_month: { userId: user.id, month } },
      update: { netWorth, assets: totalAssets, debt: totalDebt },
      create: { userId: user.id, month, netWorth, assets: totalAssets, debt: totalDebt },
    });

    // ── 健康分數計算 ──
    // 1. 儲蓄率：該月收入 vs 支出
    const [incomeAgg, expenseAgg] = await Promise.all([
      prisma.transaction.aggregate({
        where: { userId: user.id, type: "收入", date: { gte: monthStart, lt: monthEnd } },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { userId: user.id, type: "支出", date: { gte: monthStart, lt: monthEnd } },
        _sum: { amount: true },
      }),
    ]);
    const income = Number(incomeAgg._sum.amount ?? 0);
    const expense = Number(expenseAgg._sum.amount ?? 0);
    const savingsRate = income > 0 ? ((income - expense) / income) * 100 : 0;

    // 2. 負債比
    const debtRatio = totalAssets > 0 ? (totalDebt / totalAssets) * 100 : 0;

    // 3. 預算遵守度
    const budgets = await prisma.budget.findMany({ where: { userId: user.id } });
    const activeBudgets = budgets.filter(b => Number(b.amount) > 0);

    let budgetAdherence = 100;
    if (activeBudgets.length > 0) {
      const categorySpending = await Promise.all(
        activeBudgets.map(b =>
          prisma.transaction.aggregate({
            where: {
              userId: user.id,
              type: "支出",
              category: b.category,
              date: { gte: monthStart, lt: monthEnd },
            },
            _sum: { amount: true },
          }).then(r => ({ category: b.category, budget: Number(b.amount), spent: Number(r._sum.amount ?? 0) }))
        )
      );
      const withinBudget = categorySpending.filter(c => c.spent <= c.budget).length;
      budgetAdherence = (withinBudget / activeBudgets.length) * 100;
    }

    // 4. 評分
    const savingsScore = savingsRate >= 30 ? 100 : savingsRate >= 20 ? 75 : savingsRate >= 10 ? 50 : savingsRate > 0 ? 25 : 0;
    const debtScore = debtRatio <= 20 ? 100 : debtRatio <= 40 ? 75 : debtRatio <= 60 ? 50 : 25;
    const budgetScore = budgetAdherence >= 100 ? 100 : budgetAdherence >= 80 ? 75 : budgetAdherence >= 60 ? 50 : 25;
    const score = Math.round(savingsScore * 0.4 + debtScore * 0.3 + budgetScore * 0.3);

    await prisma.healthScoreSnapshot.upsert({
      where: { userId_month: { userId: user.id, month } },
      update: { score, savingsScore, debtScore, budgetScore, savingsRate, debtRatio, budgetAdherence },
      create: { userId: user.id, month, score, savingsScore, debtScore, budgetScore, savingsRate, debtRatio, budgetAdherence },
    });

    return NextResponse.json({
      ok: true,
      month,
      netWorth: { assets: totalAssets, debt: totalDebt, netWorth },
      healthScore: { score, savingsScore, debtScore, budgetScore, savingsRate, debtRatio, budgetAdherence },
    });
  } catch (e) {
    console.error("[cron/monthly-snapshot]", e);
    return NextResponse.json({ error: "Snapshot failed" }, { status: 500 });
  }
}
