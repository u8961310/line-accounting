import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const bills = await prisma.creditCardBill.findMany({
      where: { creditCardId: params.id },
      orderBy: { billingMonth: "desc" },
    });
    return NextResponse.json(bills);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch bills" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json() as {
      billingMonth: string;
      totalAmount: number;
      minimumPayment?: number;
      dueDate: string;
      paidAmount?: number;
      paidDate?: string;
    };

    const paidAmount = body.paidAmount ?? 0;
    let status = "unpaid";
    if (paidAmount >= body.totalAmount) status = "paid";
    else if (paidAmount > 0) status = "partial";

    const newBalance = body.totalAmount - paidAmount;

    const [bill] = await prisma.$transaction([
      prisma.creditCardBill.create({
        data: {
          creditCardId: params.id,
          billingMonth: body.billingMonth,
          totalAmount: body.totalAmount,
          minimumPayment: body.minimumPayment ?? null,
          dueDate: new Date(body.dueDate),
          paidAmount: paidAmount,
          paidDate: body.paidDate ? new Date(body.paidDate) : null,
          status,
        },
      }),
      prisma.creditCard.update({
        where: { id: params.id },
        data: { currentBalance: newBalance },
      }),
    ]);

    return NextResponse.json(bill, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create bill" }, { status: 500 });
  }
}
