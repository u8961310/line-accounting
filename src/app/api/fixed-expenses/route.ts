import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const USER_ID = "dashboard_user";

async function getUser() {
  return prisma.user.findFirst({ where: { lineUserId: USER_ID } });
}

export async function GET(): Promise<NextResponse> {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ fixedExpenses: [] });

    const fixedExpenses = await prisma.fixedExpense.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    });

    // 本月範圍
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // 取本月所有支出交易，用於比對
    const monthTx = await prisma.transaction.findMany({
      where: {
        userId: user.id,
        type: "支出",
        date: { gte: monthStart, lt: monthEnd },
      },
      select: { id: true, amount: true, category: true, note: true },
    });

    const result = fixedExpenses.map((f) => {
      const amount = parseFloat(f.amount.toString());
      // 比對邏輯：名稱出現在備註中 OR (同分類 + 金額誤差 ≤ 10%)
      const match = monthTx.find((tx) => {
        const txAmt = parseFloat(tx.amount.toString());
        const nameMatch = tx.note.includes(f.name);
        const amtClose = Math.abs(txAmt - amount) <= amount * 0.1;
        const categoryMatch = tx.category === f.category;
        return nameMatch || (categoryMatch && amtClose);
      });

      return {
        id:                   f.id,
        name:                 f.name,
        amount,
        category:             f.category,
        dayOfMonth:           f.dayOfMonth,
        note:                 f.note,
        matched:              !!match,
        matchedTransactionId: match?.id ?? null,
      };
    });

    return NextResponse.json({ fixedExpenses: result });
    } catch (e) {
    console.error("[fixed-expenses]", e);
    return NextResponse.json({ error: "操作失敗" }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "找不到使用者" }, { status: 404 });
  
    const body = await request.json() as {
      name: string; amount: number; category?: string; dayOfMonth?: number | null; note?: string;
    };
  
    if (!body.name?.trim() || !body.amount || body.amount <= 0) {
      return NextResponse.json({ error: "名稱與金額為必填" }, { status: 400 });
    }
  
    const fe = await prisma.fixedExpense.create({
      data: {
        userId:     user.id,
        name:       body.name.trim(),
        amount:     body.amount,
        category:   body.category ?? "居住",
        dayOfMonth: body.dayOfMonth ?? null,
        note:       body.note ?? "",
      },
    });
  
    return NextResponse.json({
      id: fe.id, name: fe.name, amount: parseFloat(fe.amount.toString()),
      category: fe.category, dayOfMonth: fe.dayOfMonth, note: fe.note,
    });
    } catch (e) {
    console.error("[fixed-expenses]", e);
    return NextResponse.json({ error: "操作失敗" }, { status: 500 });
  }
}
