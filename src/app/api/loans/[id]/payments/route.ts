import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const payments = await prisma.loanPayment.findMany({
      where: { loanId: params.id },
      orderBy: { paymentDate: "desc" },
    });
    return NextResponse.json(payments);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch payments" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json() as {
      paymentDate: string;
      totalPaid: number;
      interestPaid: number;
      note?: string;
    };

    const loan = await prisma.loan.findUniqueOrThrow({ where: { id: params.id } });

    const principalPaid = body.totalPaid - body.interestPaid;
    const currentRemaining = parseFloat(loan.remainingPrincipal.toString());
    const newRemaining = Math.max(0, currentRemaining - principalPaid);
    const newStatus = newRemaining <= 0 ? "paid_off" : loan.status;

    const [payment] = await prisma.$transaction([
      prisma.loanPayment.create({
        data: {
          loanId: params.id,
          paymentDate: new Date(body.paymentDate),
          principalPaid: principalPaid,
          interestPaid: body.interestPaid,
          totalPaid: body.totalPaid,
          remainingPrincipal: newRemaining,
          note: body.note ?? "",
        },
      }),
      prisma.loan.update({
        where: { id: params.id },
        data: {
          remainingPrincipal: newRemaining,
          status: newStatus,
        },
      }),
    ]);

    return NextResponse.json(payment, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to record payment" }, { status: 500 });
  }
}
