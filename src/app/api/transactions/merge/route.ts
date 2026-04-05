import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      ids: string[];
      category: string;
      note: string;
    };
    const { ids, category, note } = body;

    if (!ids || ids.length < 2) {
      return NextResponse.json({ error: "至少需要 2 筆才能合併" }, { status: 400 });
    }
    if (!category) {
      return NextResponse.json({ error: "請選擇合併後的分類" }, { status: 400 });
    }

    const user = await prisma.user.findFirst({ where: { lineUserId: "dashboard_user" } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const txs = await prisma.transaction.findMany({
      where: { id: { in: ids }, userId: user.id },
    });
    if (txs.length !== ids.length) {
      return NextResponse.json({ error: "部分交易不存在" }, { status: 404 });
    }

    // 使用最早的日期，type 取第一筆
    const sorted = [...txs].sort((a, b) => a.date.getTime() - b.date.getTime());
    const mergedDate = sorted[0].date;
    const mergedType = sorted[0].type;
    const mergedAmount = txs.reduce((s, t) => s + parseFloat(t.amount.toString()), 0);

    await prisma.$transaction([
      prisma.transaction.deleteMany({ where: { id: { in: ids } } }),
      prisma.transaction.create({
        data: {
          userId: user.id,
          date: mergedDate,
          type: mergedType,
          amount: mergedAmount,
          category,
          note: note || "",
          source: "manual",
        },
      }),
    ]);

    return NextResponse.json({ ok: true, mergedAmount });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
