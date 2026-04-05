import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; paymentId: string } }
) {
  try {
    const payment = await prisma.loanPayment.findUniqueOrThrow({
      where: { id: params.paymentId },
    });

    // 刪除還款紀錄並還原貸款剩餘本金
    await prisma.$transaction([
      prisma.loanPayment.delete({ where: { id: params.paymentId } }),
      prisma.loan.update({
        where: { id: params.id },
        data: {
          remainingPrincipal: {
            increment: parseFloat(payment.principalPaid.toString()),
          },
          status: "active",
        },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to delete payment" }, { status: 500 });
  }
}
