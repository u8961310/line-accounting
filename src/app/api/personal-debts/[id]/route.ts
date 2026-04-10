import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json() as {
      counterparty?: string;
      amount?: number;
      note?: string;
      dueDate?: string | null;
      settle?: boolean;     // true = 標記結清
      unsettle?: boolean;   // true = 取消結清
    };

    const data: Record<string, unknown> = {};
    if (body.counterparty !== undefined) data.counterparty = body.counterparty.trim();
    if (body.amount       !== undefined) data.amount       = body.amount;
    if (body.note         !== undefined) data.note         = body.note;
    if (body.dueDate      !== undefined) data.dueDate      = body.dueDate ? new Date(body.dueDate) : null;
    if (body.settle)   data.settledAt = new Date();
    if (body.unsettle) data.settledAt = null;

    const debt = await prisma.personalDebt.update({
      where: { id: params.id },
      data,
    });
    return NextResponse.json(debt);
  } catch (e) {
    console.error("[personal-debts PATCH]", e);
    return NextResponse.json({ error: "操作失敗" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.personalDebt.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[personal-debts DELETE]", e);
    return NextResponse.json({ error: "操作失敗" }, { status: 500 });
  }
}
