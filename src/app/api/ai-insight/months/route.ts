import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { taipeiMonth } from "@/lib/time";

export const dynamic = "force-dynamic";

// GET /api/ai-insight/months → 列出有快照的月份（降冪）+ 當月（即使沒快照也要能被選）
export async function GET() {
  const user = await prisma.user.findFirst({ where: { lineUserId: "dashboard_user" } });
  if (!user) return NextResponse.json({ months: [] });

  const snaps = await prisma.aiInsight.findMany({
    where:   { userId: user.id },
    select:  { month: true },
    orderBy: { month: "desc" },
  });

  const months = new Set(snaps.map(s => s.month));
  months.add(taipeiMonth()); // 當月永遠可選（即時生成）

  const sorted = Array.from(months).sort((a, b) => b.localeCompare(a));
  return NextResponse.json({ months: sorted, current: taipeiMonth() });
}
