import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json() as {
      name?: string;
      remainingPrincipal?: number;
      interestRate?: number;
      status?: string;
      note?: string;
      paymentDay?: number | null;
      endDate?: string | null;
    };

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.remainingPrincipal !== undefined) updateData.remainingPrincipal = body.remainingPrincipal;
    if (body.interestRate !== undefined) updateData.interestRate = body.interestRate;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.note !== undefined) updateData.note = body.note;
    if (body.paymentDay !== undefined) updateData.paymentDay = body.paymentDay;
    if (body.endDate !== undefined) updateData.endDate = body.endDate ? new Date(body.endDate) : null;

    const loan = await prisma.loan.update({
      where: { id: params.id },
      data: updateData,
      include: { payments: { orderBy: { paymentDate: "desc" }, take: 5 } },
    });

    return NextResponse.json(loan);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to update loan" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.loan.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to delete loan" }, { status: 500 });
  }
}
