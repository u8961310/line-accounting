import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncWorthToNotion } from "@/lib/notion";
import { logAudit } from "@/lib/audit";

export async function POST(): Promise<NextResponse> {
  if (!process.env.NOTION_TOKEN || !process.env.NOTION_NET_WORTH_DB_ID) {
    return NextResponse.json({ error: "未設定 NOTION_TOKEN 或 NOTION_NET_WORTH_DB_ID" }, { status: 400 });
  }

  try {
    const user = await prisma.user.findFirst({ where: { lineUserId: "dashboard_user" } });
    if (!user) return NextResponse.json({ error: "找不到使用者" }, { status: 404 });

    // 計算資產
    const savingsSource = process.env.NOTION_SAVINGS_SOURCE ?? "";

    const [bankBalances, cashOut, cashIn, activeLoans, creditCards] = await Promise.all([
      prisma.bankBalance.findMany({ where: { userId: user.id, NOT: { source: "cash" } } }),
      prisma.transaction.aggregate({ where: { userId: user.id, category: "現金", type: "支出" }, _sum: { amount: true } }),
      prisma.transaction.aggregate({ where: { userId: user.id, category: "現金", type: "收入" }, _sum: { amount: true } }),
      prisma.loan.findMany({ where: { userId: user.id, status: "active" } }),
      prisma.creditCard.findMany({ where: { userId: user.id } }),
    ]);

    const bankAssets  = bankBalances.reduce((s, b) => s + parseFloat(b.balance.toString()), 0);
    const cashBalance = Number(cashOut._sum.amount ?? 0) - Number(cashIn._sum.amount ?? 0);
    const totalAssets = bankAssets + cashBalance;
    const totalLoanDebt   = activeLoans.reduce((s, l) => s + parseFloat(l.remainingPrincipal.toString()), 0);
    const totalCreditDebt = creditCards.reduce((s, c) => s + parseFloat(c.currentBalance.toString()), 0);
    const totalDebt   = totalLoanDebt + totalCreditDebt;
    const netWorth    = totalAssets - totalDebt;

    // 儲蓄金：指定銀行餘額，若未設定則用淨資產
    const savingsEntry = savingsSource
      ? bankBalances.find(b => b.source === savingsSource)
      : null;
    const savings = savingsEntry
      ? parseFloat(savingsEntry.balance.toString())
      : netWorth;

    await syncWorthToNotion({ totalAssets, totalDebt, netWorth: savings });

    const savingsLabel = savingsEntry ? `${savingsSource} 餘額` : "淨資產";
    void logAudit({
      action:  "notion_sync",
      tool:    "worth_snapshot",
      summary: {
        totalAssets:  Math.round(totalAssets),
        totalDebt:    Math.round(totalDebt),
        savings:      Math.round(savings),
        savingsLabel,
      },
    });

    return NextResponse.json({
      message: `已同步：資產 ${Math.round(totalAssets).toLocaleString()} ／ 負債 ${Math.round(totalDebt).toLocaleString()} ／ 儲蓄金(${savingsLabel}) ${Math.round(savings).toLocaleString()}`,
    });
  } catch (e) {
    console.error(e);
    void logAudit({ action: "notion_sync", status: "error", errorMsg: e instanceof Error ? e.message : "同步失敗" });
    return NextResponse.json({ error: "同步失敗" }, { status: 500 });
  }
}
