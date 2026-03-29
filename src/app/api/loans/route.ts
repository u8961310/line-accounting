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
    const loans = await prisma.loan.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      include: {
        payments: {
          orderBy: { paymentDate: "desc" },
          take: 5,
        },
      },
    });
    return NextResponse.json(loans);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch loans" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getDashboardUser();
    const body = await request.json() as {
      name: string;
      lender: string;
      type: string;
      originalPrincipal: number;
      remainingPrincipal: number;
      interestRate: number;
      paymentDay?: number;
      endDate?: string;
      note?: string;
    };

    const loan = await prisma.loan.create({
      data: {
        userId: user.id,
        name: body.name,
        lender: body.lender,
        type: body.type,
        originalPrincipal: body.originalPrincipal,
        remainingPrincipal: body.remainingPrincipal,
        interestRate: body.interestRate,
        paymentDay: body.paymentDay ?? null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        note: body.note ?? "",
      },
      include: { payments: true },
    });

    return NextResponse.json(loan, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create loan" }, { status: 500 });
  }
}
