import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

interface SplitPart {
  category: string;
  amount: number;
  note: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json() as { parts: SplitPart[] };
    const { parts } = body;

    if (!parts || parts.length < 2) {
      return NextResponse.json({ error: "至少需要 2 個分割項目" }, { status: 400 });
    }
    if (parts.some(p => !p.category || isNaN(p.amount) || p.amount <= 0)) {
      return NextResponse.json({ error: "每個項目須有分類與正數金額" }, { status: 400 });
    }

    const user = await prisma.user.findFirst({ where: { lineUserId: "dashboard_user" } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const original = await prisma.transaction.findUnique({ where: { id: params.id } });
    if (!original || original.userId !== user.id) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    const originalAmount = parseFloat(original.amount.toString());
    const partsSum = parts.reduce((s, p) => s + p.amount, 0);
    if (Math.abs(partsSum - originalAmount) > 0.5) {
      return NextResponse.json(
        { error: `各分割金額合計 ${partsSum} 必須等於原始金額 ${originalAmount}` },
        { status: 400 }
      );
    }

    await prisma.$transaction([
      prisma.transaction.delete({ where: { id: params.id } }),
      ...parts.map(p =>
        prisma.transaction.create({
          data: {
            userId: user.id,
            date: original.date,
            type: original.type,
            amount: p.amount,
            category: p.category,
            note: p.note || "",
            source: "manual",
          },
        })
      ),
    ]);

    return NextResponse.json({ ok: true, count: parts.length });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
