import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const body = await request.json() as {
      name?: string; amount?: number; category?: string; dayOfMonth?: number | null; note?: string;
    };
  
    const fe = await prisma.fixedExpense.update({
      where: { id: params.id },
      data: {
        ...(body.name      !== undefined && { name:       body.name.trim() }),
        ...(body.amount    !== undefined && { amount:     body.amount }),
        ...(body.category  !== undefined && { category:   body.category }),
        ...(body.dayOfMonth !== undefined && { dayOfMonth: body.dayOfMonth }),
        ...(body.note      !== undefined && { note:       body.note }),
      },
    });
  
    return NextResponse.json({
      id: fe.id, name: fe.name, amount: parseFloat(fe.amount.toString()),
      category: fe.category, dayOfMonth: fe.dayOfMonth, note: fe.note,
    });
    } catch (e) {
    console.error("[fixed-expenses/[id]]", e);
    return NextResponse.json({ error: "操作失敗" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    await prisma.fixedExpense.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
    } catch (e) {
    console.error("[fixed-expenses/[id]]", e);
    return NextResponse.json({ error: "操作失敗" }, { status: 500 });
  }
}
