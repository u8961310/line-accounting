import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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

    const newBalance = totalAmount - paidAmount;

    const [updatedBill] = await prisma.$transaction([
      prisma.creditCardBill.update({
        where: { id: params.billId },
        data: {
          paidAmount,
          paidDate: body.paidDate !== undefined
            ? (body.paidDate ? new Date(body.paidDate) : null)
            : bill.paidDate,
          status,
        },
      }),
      prisma.creditCard.update({
        where: { id: params.id },
        data: { currentBalance: newBalance },
      }),
    ]);

    return NextResponse.json(updatedBill);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to update bill" }, { status: 500 });
  }
}
