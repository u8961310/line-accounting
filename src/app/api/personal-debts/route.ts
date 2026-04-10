import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

async function getDashboardUser() {
  return prisma.user.upsert({
    where: { lineUserId: "dashboard_user" },
    update: {},
    create: { lineUserId: "dashboard_user", displayName: "Dashboard" },
  });
}

export async function GET() {
  try {
    const user = await getDashboardUser();
    const debts = await prisma.personalDebt.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(debts);
  } catch (e) {
    console.error("[personal-debts GET]", e);
    return NextResponse.json({ error: "操作失敗" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getDashboardUser();
    const body = await request.json() as {
      counterparty: string;
      direction: "owed_to_me" | "i_owe";
      amount: number;
      note?: string;
      dueDate?: string;
    };

    if (!body.counterparty?.trim() || !body.amount || !body.direction) {
      return NextResponse.json({ error: "缺少必要欄位" }, { status: 400 });
    }

    const debt = await prisma.personalDebt.create({
      data: {
        userId:       user.id,
        counterparty: body.counterparty.trim(),
        direction:    body.direction,
        amount:       body.amount,
        note:         body.note ?? "",
        dueDate:      body.dueDate ? new Date(body.dueDate) : null,
      },
    });
    return NextResponse.json(debt, { status: 201 });
  } catch (e) {
    console.error("[personal-debts POST]", e);
    return NextResponse.json({ error: "操作失敗" }, { status: 500 });
  }
}
