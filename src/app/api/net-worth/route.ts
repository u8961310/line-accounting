import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await prisma.user.findFirst({
      where: { lineUserId: "dashboard_user" },
    });

    if (!user) {
      return NextResponse.json({
        totalAssets: 0,
        totalLoanDebt: 0,
        totalCreditDebt: 0,
        totalDebt: 0,
        netWorth: 0,
        monthlyInterest: 0,
        totalInterestPaid: 0,
      });
    }

    const [bankBalances, allLoans, creditCards, interestTx, cashOut, cashIn] = await Promise.all([
      prisma.bankBalance.findMany({ where: { userId: user.id, NOT: { source: "cash" } } }),
      prisma.loan.findMany({
        where: { userId: user.id },
        include: { payments: true },
      }),
      prisma.creditCard.findMany({ where: { userId: user.id } }),
      prisma.transaction.findMany({
        where: { userId: user.id, note: { contains: "利息" } },
      }),
      prisma.transaction.aggregate({
        where: { userId: user.id, category: "現金", type: "支出" },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { userId: user.id, category: "現金", type: "收入" },
        _sum: { amount: true },
      }),
    ]);

    const activeLoans = allLoans.filter(l => l.status === "active");

    const cashBalance = Number(cashOut._sum.amount ?? 0) - Number(cashIn._sum.amount ?? 0);
    const totalAssets = bankBalances.reduce<number>(
      (sum, b) => sum + parseFloat(b.balance.toString()),
      0
    ) + cashBalance;

    const totalLoanDebt = activeLoans.reduce<number>(
      (sum, l) => sum + parseFloat(l.remainingPrincipal.toString()),
      0
    );

    // currentBalance 已含分期未清償餘額（由帳單新增/繳款/PDF 匯入共同維護）
    const totalCreditDebt = creditCards.reduce<number>(
      (sum, c) => sum + parseFloat(c.currentBalance.toString()),
      0
    );

    const totalDebt = totalLoanDebt + totalCreditDebt;
    const netWorth = totalAssets - totalDebt;

    const monthlyInterest = activeLoans.reduce<number>((sum, l) => {
      const remaining = parseFloat(l.remainingPrincipal.toString());
      const rate = parseFloat(l.interestRate.toString());
      return sum + remaining * rate / 100 / 12;
    }, 0);

    const loanInterestPaid = allLoans.flatMap(l => l.payments)
      .reduce<number>((sum, p) => sum + parseFloat(p.interestPaid.toString()), 0);
    const ccInterestPaid = interestTx
      .reduce<number>((sum, t) => sum + parseFloat(t.amount.toString()), 0);
    const totalInterestPaid = loanInterestPaid + ccInterestPaid;

    return NextResponse.json({
      totalAssets,
      totalLoanDebt,
      totalCreditDebt,
      totalDebt,
      netWorth,
      monthlyInterest,
      totalInterestPaid,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch net worth" }, { status: 500 });
  }
}
