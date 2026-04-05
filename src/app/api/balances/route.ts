import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export interface BankBalanceItem {
  source:      string;
  balance:     number;
  asOfDate:    string;
  alias:       string | null;
  savingsGoal: number | null;
}

// PATCH /api/balances — 更新餘額、別名或儲蓄目標
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as {
      source: string;
      balance?: number;
      alias?: string | null;
      savingsGoal?: number | null;
    };
    const user = await prisma.user.findFirst({ where: { lineUserId: "dashboard_user" } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    await prisma.bankBalance.upsert({
      where:  { userId_source: { userId: user.id, source: body.source } },
      update: {
        ...(body.balance     !== undefined && { balance: body.balance, asOfDate: new Date() }),
        ...(body.alias       !== undefined && { alias: body.alias }),
        ...(body.savingsGoal !== undefined && { savingsGoal: body.savingsGoal }),
      },
      create: {
        userId:      user.id,
        source:      body.source,
        balance:     body.balance ?? 0,
        asOfDate:    new Date(),
        alias:       body.alias ?? null,
        savingsGoal: body.savingsGoal ?? null,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// GET /api/balances
export async function GET(_request: NextRequest): Promise<NextResponse> {
  const user = await prisma.user.findFirst({ where: { lineUserId: "dashboard_user" } });
  if (!user) return NextResponse.json([]);

  const bankBalances = await prisma.bankBalance.findMany({
    where:   { userId: user.id, source: { not: "cash" } },
    orderBy: { asOfDate: "desc" },
  });

  const result: BankBalanceItem[] = bankBalances.map((b) => ({
    source:      b.source,
    balance:     parseFloat(b.balance.toString()),
    asOfDate:    b.asOfDate.toISOString().split("T")[0],
    alias:       b.alias ?? null,
    savingsGoal: b.savingsGoal ? parseFloat(b.savingsGoal.toString()) : null,
  }));

  // ── 現金餘額 ──────────────────────────────────────────────────────────────────
  const storedCash = await prisma.bankBalance.findUnique({
    where: { userId_source: { userId: user.id, source: "cash" } },
  });

  const cashBase     = storedCash ? Number(storedCash.balance) : 0;
  const cashBaseDate = storedCash?.asOfDate ?? null;
  const afterBase    = cashBaseDate ? { gt: cashBaseDate } : undefined;

  const [withdrawal, deposit, lineExpense, lineIncome] = await Promise.all([
    prisma.transaction.aggregate({
      where: { category: "現金", type: "支出", ...(afterBase ? { createdAt: afterBase } : {}) },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { category: "現金", type: "收入", ...(afterBase ? { createdAt: afterBase } : {}) },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { source: "line", type: "支出", category: { not: "現金" }, ...(afterBase ? { createdAt: afterBase } : {}) },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { source: "line", type: "收入", category: { not: "現金" }, ...(afterBase ? { createdAt: afterBase } : {}) },
      _sum: { amount: true },
    }),
  ]);

  const cashBalance =
    cashBase +
    Number(withdrawal._sum.amount  ?? 0) -
    Number(deposit._sum.amount     ?? 0) -
    Number(lineExpense._sum.amount ?? 0) +
    Number(lineIncome._sum.amount  ?? 0);

  result.push({
    source:      "cash",
    balance:     cashBalance,
    asOfDate:    storedCash?.asOfDate.toISOString().split("T")[0] ?? new Date().toISOString().split("T")[0],
    alias:       storedCash?.alias ?? null,
    savingsGoal: storedCash?.savingsGoal ? parseFloat(storedCash.savingsGoal.toString()) : null,
  });

  return NextResponse.json(result);
}
