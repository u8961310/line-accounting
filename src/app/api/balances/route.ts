import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const { source, balance } = await request.json() as { source: string; balance: number };
    const user = await prisma.user.findFirst({ where: { lineUserId: "dashboard_user" } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    await prisma.bankBalance.upsert({
      where: { userId_source: { userId: user.id, source } },
      update: { balance, asOfDate: new Date() },
      create: { userId: user.id, source, balance, asOfDate: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export interface BankBalanceItem {
  source: string;
  balance: number;
  asOfDate: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  const where = userId ? { user: { lineUserId: userId } } : {};

  const [balances, user] = await Promise.all([
    prisma.bankBalance.findMany({ where, orderBy: { asOfDate: "desc" } }),
    prisma.user.findFirst({ where: { lineUserId: userId ?? "dashboard_user" } }),
  ]);

  const result: BankBalanceItem[] = balances
    .filter(b => b.source !== "cash")
    .map((b) => ({
      source: b.source,
      balance: parseFloat(b.balance.toString()),
      asOfDate: b.asOfDate.toISOString().split("T")[0],
    }));

  // Compute cash balance from transactions with category="現金"
  if (user) {
    const [cashOut, cashIn] = await Promise.all([
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
    result.push({
      source: "cash",
      balance: cashBalance,
      asOfDate: new Date().toISOString().split("T")[0],
    });
  }

  return NextResponse.json(result);
}
