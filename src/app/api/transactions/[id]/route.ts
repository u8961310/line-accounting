import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.transaction.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json() as { category?: string; type?: string; mood?: string | null; note?: string; amount?: number };
    const data: { category?: string; type?: string; mood?: string | null; note?: string; amount?: number } = {};
    if (body.category !== undefined) data.category = body.category;
    if (body.type     !== undefined) data.type     = body.type;
    if (body.mood     !== undefined) data.mood     = body.mood;
    if (body.note     !== undefined) data.note     = body.note;
    if (body.amount   !== undefined && body.amount > 0) data.amount = body.amount;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const tx = await prisma.transaction.update({
      where: { id: params.id },
      data,
      select: { id: true, category: true, type: true, mood: true, note: true, amount: true },
    });

    return NextResponse.json(tx);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
