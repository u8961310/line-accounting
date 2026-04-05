import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

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

    const newDueDate = new Date(body.dueDate);

    // 建立帳單後，依最新一筆帳單的截止日重算 currentBalance
    const bill = await prisma.creditCardBill.create({
      data: {
        creditCardId: params.id,
        billingMonth: body.billingMonth,
        totalAmount: body.totalAmount,
        minimumPayment: body.minimumPayment ?? null,
        dueDate: newDueDate,
        paidAmount: paidAmount,
        paidDate: body.paidDate ? new Date(body.paidDate) : null,
        status,
      },
    });

    const [latestBill, card] = await Promise.all([
      prisma.creditCardBill.findFirst({
        where: { creditCardId: params.id },
        orderBy: { dueDate: "desc" },
        select: { totalAmount: true, paidAmount: true },
      }),
      prisma.creditCard.findUnique({
        where: { id: params.id },
        select: { installmentOutstanding: true },
      }),
    ]);
    if (latestBill) {
      const installment = parseFloat((card?.installmentOutstanding ?? 0).toString());
      await prisma.creditCard.update({
        where: { id: params.id },
        data: { currentBalance: parseFloat(latestBill.totalAmount.toString()) - parseFloat(latestBill.paidAmount.toString()) + installment },
      });
    }

    return NextResponse.json(bill, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create bill" }, { status: 500 });
  }
}
