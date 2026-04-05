import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const USER_ID = "dashboard_user";

async function getUser() {
  return prisma.user.findFirst({ where: { lineUserId: USER_ID } });
}

export async function GET(): Promise<NextResponse> {
  const user = await getUser();
  if (!user) return NextResponse.json({ fixedExpenses: [] });

  const fixedExpenses = await prisma.fixedExpense.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    fixedExpenses: fixedExpenses.map((f) => ({
      id:         f.id,
      name:       f.name,
      amount:     parseFloat(f.amount.toString()),
      category:   f.category,
      dayOfMonth: f.dayOfMonth,
      note:       f.note,
    })),
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
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
}
