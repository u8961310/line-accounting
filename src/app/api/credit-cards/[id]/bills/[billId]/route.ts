import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; billId: string } }
) {
  try {
    const body = await request.json() as {
      paidAmount?: number;
      paidDate?: string | null;
    };

    const bill = await prisma.creditCardBill.findUniqueOrThrow({
      where: { id: params.billId },
    });

    const paidAmount = body.paidAmount ?? parseFloat(bill.paidAmount.toString());
    const totalAmount = parseFloat(bill.totalAmount.toString());

    let status = "unpaid";
    if (paidAmount >= totalAmount) status = "paid";
    else if (paidAmount > 0) status = "partial";

    // 更新帳單後，依最新一筆帳單的截止日重算 currentBalance
    const updatedBill = await prisma.creditCardBill.update({
      where: { id: params.billId },
      data: {
        paidAmount,
        paidDate: body.paidDate !== undefined
          ? (body.paidDate ? new Date(body.paidDate) : null)
          : bill.paidDate,
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

    return NextResponse.json(updatedBill);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to update bill" }, { status: 500 });
  }
}
