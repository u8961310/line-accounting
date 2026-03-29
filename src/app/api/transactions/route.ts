import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page   = Math.max(1, parseInt(searchParams.get("page")  ?? "1",  10));
  const limit  = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "30", 10)));
  const skip   = (page - 1) * limit;

  try {
    const user = await prisma.user.findFirst({ where: { lineUserId: "dashboard_user" } });
    if (!user) return NextResponse.json({ items: [], total: 0, page, limit });

    const where = { userId: user.id };

    const [total, items] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({
        where,
        orderBy: { date: "desc" },
        skip,
        take: limit,
        select: { id: true, date: true, amount: true, category: true, type: true, note: true, source: true },
      }),
    ]);

    return NextResponse.json({
      items: items.map(tx => ({
        id: tx.id,
        date: tx.date.toISOString().split("T")[0],
        amount: parseFloat(tx.amount.toString()),
        category: tx.category,
        type: tx.type,
        note: tx.note,
        source: tx.source,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      date: string; type: string; amount: number; category: string; note?: string;
    };
    const user = await prisma.user.findFirst({ where: { lineUserId: "dashboard_user" } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const tx = await prisma.transaction.create({
      data: {
        userId: user.id,
        date: new Date(body.date),
        type: body.type,
        amount: body.amount,
        category: body.category,
        note: body.note ?? "",
        source: "manual",
      },
    });
    return NextResponse.json({ id: tx.id });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
