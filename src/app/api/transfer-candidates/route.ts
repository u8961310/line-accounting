import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export interface TransferPair {
  expense: { id: string; date: string; amount: number; source: string; note: string };
  income:  { id: string; date: string; amount: number; source: string; note: string };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const lineUserId = request.nextUrl.searchParams.get("lineUserId");
  if (!lineUserId) return NextResponse.json({ pairs: [] });

  const user = await prisma.user.findUnique({ where: { lineUserId } });
  if (!user) return NextResponse.json({ pairs: [] });

  // Fetch all non-transfer transactions
  const txs = await prisma.transaction.findMany({
    where: { userId: user.id, category: { not: "轉帳" } },
    select: { id: true, date: true, amount: true, type: true, source: true, note: true },
    orderBy: { date: "desc" },
  });

  const expenses = txs.filter((t) => t.type === "支出");
  const incomes  = txs.filter((t) => t.type === "收入");

  const pairs: TransferPair[] = [];
  const usedIds = new Set<string>();

  for (const exp of expenses) {
    if (usedIds.has(exp.id)) continue;
    const expAmt = parseFloat(exp.amount.toString());

    for (const inc of incomes) {
      if (usedIds.has(inc.id)) continue;
      if (inc.source === exp.source) continue; // same account = not a transfer

      const incAmt = parseFloat(inc.amount.toString());
      if (Math.abs(expAmt - incAmt) > 0.01) continue;

      const dayDiff =
        Math.abs(exp.date.getTime() - inc.date.getTime()) / (1000 * 60 * 60 * 24);
      if (dayDiff > 1) continue;

      pairs.push({
        expense: { id: exp.id, date: exp.date.toISOString().split("T")[0], amount: expAmt, source: exp.source, note: exp.note },
        income:  { id: inc.id, date: inc.date.toISOString().split("T")[0], amount: incAmt, source: inc.source, note: inc.note },
      });
      usedIds.add(exp.id);
      usedIds.add(inc.id);
      break;
    }
  }

  return NextResponse.json({ pairs });
}
