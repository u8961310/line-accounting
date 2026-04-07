import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// POST /api/loans/:id/topup — 增貸：增加既有貸款的本金
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json() as {
      additionalPrincipal: number;
      interestRate?: number;
      endDate?: string | null;
      note?: string;
    };

    if (!body.additionalPrincipal || body.additionalPrincipal <= 0) {
      return NextResponse.json({ error: "增貸金額必須大於 0" }, { status: 400 });
    }

    const loan = await prisma.loan.findUnique({ where: { id: params.id } });
    if (!loan) {
      return NextResponse.json({ error: "找不到貸款" }, { status: 404 });
    }

    const currentOriginal  = parseFloat(loan.originalPrincipal.toString());
    const currentRemaining = parseFloat(loan.remainingPrincipal.toString());

    const updateData: Record<string, unknown> = {
      originalPrincipal:  currentOriginal  + body.additionalPrincipal,
      remainingPrincipal: currentRemaining + body.additionalPrincipal,
    };
    if (body.interestRate !== undefined) updateData.interestRate = body.interestRate;
    if (body.endDate !== undefined)      updateData.endDate = body.endDate ? new Date(body.endDate) : null;
    if (body.note !== undefined && body.note.trim()) {
      updateData.note = body.note.trim();
    }

    const updated = await prisma.loan.update({
      where: { id: params.id },
      data: updateData,
      include: { payments: { orderBy: { paymentDate: "desc" }, take: 5 } },
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "增貸失敗" }, { status: 500 });
  }
}
