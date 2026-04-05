import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/net-worth/snapshots — 取得所有歷史快照
export async function GET(): Promise<NextResponse> {
  const user = await prisma.user.findFirst({ where: { lineUserId: "dashboard_user" } });
  if (!user) return NextResponse.json([]);

  const snapshots = await prisma.netWorthSnapshot.findMany({
    where:   { userId: user.id },
    orderBy: { month: "asc" },
  });

  return NextResponse.json(
    snapshots.map(s => ({
      month:    s.month,
      netWorth: parseFloat(s.netWorth.toString()),
      assets:   parseFloat(s.assets.toString()),
      debt:     parseFloat(s.debt.toString()),
    }))
  );
}

// POST /api/net-worth/snapshots — 記錄當月快照（upsert）
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as { month: string; netWorth: number; assets: number; debt: number };
    const user = await prisma.user.findFirst({ where: { lineUserId: "dashboard_user" } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    await prisma.netWorthSnapshot.upsert({
      where:  { userId_month: { userId: user.id, month: body.month } },
      update: { netWorth: body.netWorth, assets: body.assets, debt: body.debt },
      create: { userId: user.id, month: body.month, netWorth: body.netWorth, assets: body.assets, debt: body.debt },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
