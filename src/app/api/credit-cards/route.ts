import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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
    const cards = await prisma.creditCard.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      include: {
        bills: {
          orderBy: { billingMonth: "desc" },
          take: 3,
        },
      },
    });
    return NextResponse.json(cards);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch credit cards" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getDashboardUser();
    const body = await request.json() as {
      name: string;
      bank: string;
      creditLimit?: number;
      statementDay?: number;
      dueDay?: number;
    };

    const card = await prisma.creditCard.create({
      data: {
        userId: user.id,
        name: body.name,
        bank: body.bank,
        creditLimit: body.creditLimit ?? null,
        statementDay: body.statementDay ?? null,
        dueDay: body.dueDay ?? null,
      },
      include: { bills: true },
    });

    return NextResponse.json(card, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create credit card" }, { status: 500 });
  }
}
