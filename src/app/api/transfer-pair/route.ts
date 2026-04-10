import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { txAId, txBId } = await request.json() as { txAId: string; txBId: string };
    if (!txAId || !txBId) {
      return NextResponse.json({ error: "txAId and txBId required" }, { status: 400 });
    }

    // 兩筆互相設 transferPairId，並改分類為「轉帳」
    await prisma.$transaction([
      prisma.transaction.update({
        where: { id: txAId },
        data: { transferPairId: txBId, category: "轉帳" },
      }),
      prisma.transaction.update({
        where: { id: txBId },
        data: { transferPairId: txAId, category: "轉帳" },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[transfer-pair]", e);
    return NextResponse.json({ error: "操作失敗" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const { txAId, txBId } = await request.json() as { txAId: string; txBId: string };
    await prisma.$transaction([
      prisma.transaction.update({ where: { id: txAId }, data: { transferPairId: null } }),
      prisma.transaction.update({ where: { id: txBId }, data: { transferPairId: null } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[transfer-pair DELETE]", e);
    return NextResponse.json({ error: "操作失敗" }, { status: 500 });
  }
}
