import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { taipeiToday, taipeiTodayAsUTC } from "@/lib/time";

export const dynamic = "force-dynamic";

const DASHBOARD_USER_ID = "dashboard_user";

// GET /api/meal-budgets/today
// 給 kogao 早報使用。middleware 會用 x-api-key 驗證。
// 回傳 { budgets: [{ mealType, amount, spentToday }], date } — 僅 isActive=true
export async function GET(_req: NextRequest) {
  try {
    const user = await prisma.user.findFirst({ where: { lineUserId: DASHBOARD_USER_ID } });
    if (!user) {
      return NextResponse.json({ budgets: [], date: taipeiToday() });
    }

    const todayStart = taipeiTodayAsUTC();
    const todayEnd = new Date(todayStart.getTime() + 24 * 3600 * 1000);

    const [budgets, spending] = await Promise.all([
      prisma.mealBudget.findMany({
        where: { userId: user.id, isActive: true },
        orderBy: { mealType: "asc" },
      }),
      prisma.transaction.groupBy({
        by: ["mealType"],
        where: {
          userId: user.id,
          type: "支出",
          mealType: { in: ["breakfast", "lunch", "dinner"] },
          date: { gte: todayStart, lt: todayEnd },
        },
        _sum: { amount: true },
      }),
    ]);

    const spentMap: Record<string, number> = {};
    for (const s of spending) {
      if (s.mealType) spentMap[s.mealType] = Number(s._sum.amount ?? 0);
    }

    return NextResponse.json({
      budgets: budgets.map(b => ({
        mealType: b.mealType,
        amount: Number(b.amount),
        spentToday: spentMap[b.mealType] ?? 0,
      })),
      date: taipeiToday(),
    });
  } catch (e) {
    console.error("[meal-budgets/today]", e);
    return NextResponse.json({ error: "操作失敗" }, { status: 500 });
  }
}
