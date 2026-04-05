import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export interface AccountMonthly {
  month:   string;
  income:  number;
  expense: number;
}

export interface AccountEntry {
  source:        string;
  alias:         string | null;
  monthly:       AccountMonthly[];
  totalIncome:   number;
  totalExpense:  number;
}

export interface AccountFlowResponse {
  months:   string[];
  accounts: AccountEntry[];
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const numMonths = Math.min(parseInt(searchParams.get("months") ?? "6", 10), 24);

  const user = await prisma.user.findUnique({ where: { lineUserId: "dashboard_user" } });
  if (!user) return NextResponse.json({ error: "No user" }, { status: 404 });

  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - numMonths + 1);
  startDate.setDate(1);
  startDate.setHours(0, 0, 0, 0);

  const [transactions, balances] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId: user.id, date: { gte: startDate }, NOT: { category: "轉帳" } },
      select: { source: true, date: true, amount: true, type: true },
    }),
    prisma.bankBalance.findMany({
      where: { userId: user.id },
      select: { source: true, alias: true },
    }),
  ]);

  const aliasMap = new Map(balances.map(b => [b.source, b.alias]));

  // Build ordered month list
  const monthList: string[] = [];
  for (let i = numMonths - 1; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    monthList.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  // Group by source → month
  const sourceMap = new Map<string, Map<string, { income: number; expense: number }>>();
  for (const tx of transactions) {
    if (!sourceMap.has(tx.source)) sourceMap.set(tx.source, new Map());
    const mmap  = sourceMap.get(tx.source)!;
    const month = tx.date.toISOString().slice(0, 7);
    const entry = mmap.get(month) ?? { income: 0, expense: 0 };
    const amt   = parseFloat(tx.amount.toString());
    if (tx.type === "收入") entry.income  += amt;
    else                    entry.expense += amt;
    mmap.set(month, entry);
  }

  const accounts: AccountEntry[] = Array.from(sourceMap.entries()).map(([source, mmap]) => {
    const monthly = monthList.map(m => ({
      month:   m,
      income:  Math.round(mmap.get(m)?.income  ?? 0),
      expense: Math.round(mmap.get(m)?.expense ?? 0),
    }));
    return {
      source,
      alias:        aliasMap.get(source) ?? null,
      monthly,
      totalIncome:  monthly.reduce((s, m) => s + m.income,  0),
      totalExpense: monthly.reduce((s, m) => s + m.expense, 0),
    };
  });

  // Sort by total transaction volume desc
  accounts.sort((a, b) => (b.totalIncome + b.totalExpense) - (a.totalIncome + a.totalExpense));

  return NextResponse.json({ months: monthList, accounts } satisfies AccountFlowResponse);
}
