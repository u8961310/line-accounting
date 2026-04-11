import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { taipeiToday, taipeiTodayAsUTC } from "@/lib/time";

export const dynamic = "force-dynamic";

const DASHBOARD_USER_ID = "dashboard_user";
const VALID_MEAL_TYPES = ["breakfast", "lunch", "dinner"] as const;
type MealType = typeof VALID_MEAL_TYPES[number];

function isValidMealType(v: unknown): v is MealType {
  return typeof v === "string" && (VALID_MEAL_TYPES as readonly string[]).includes(v);
}

async function getDashboardUser() {
  return prisma.user.upsert({
    where: { lineUserId: DASHBOARD_USER_ID },
    update: {},
    create: { lineUserId: DASHBOARD_USER_ID, displayName: "Dashboard" },
  });
}

// GET /api/meal-budgets — 列出三餐日預算 + 今日已花
export async function GET(_req: NextRequest) {
  try {
    const user = await getDashboardUser();
    const todayStart = taipeiTodayAsUTC();
    const todayEnd = new Date(todayStart.getTime() + 24 * 3600 * 1000);

    const [budgets, spending] = await Promise.all([
      prisma.mealBudget.findMany({ where: { userId: user.id } }),
      prisma.transaction.groupBy({
        by: ["mealType"],
        where: {
          userId: user.id,
          type: "支出",
          mealType: { in: [...VALID_MEAL_TYPES] },
          date: { gte: todayStart, lt: todayEnd },
        },
        _sum: { amount: true },
      }),
    ]);

    const spentMap: Record<string, number> = {};
    for (const s of spending) {
      if (s.mealType) spentMap[s.mealType] = Number(s._sum.amount ?? 0);
    }

    const result = budgets.map((b) => ({
      id: b.id,
      mealType: b.mealType,
      amount: Number(b.amount),
      isActive: b.isActive,
      spentToday: spentMap[b.mealType] ?? 0,
    }));

    return NextResponse.json({ budgets: result, date: taipeiToday() });
  } catch (e) {
    console.error("[meal-budgets GET]", e);
    return NextResponse.json({ error: "操作失敗" }, { status: 500 });
  }
}

// PUT /api/meal-budgets — upsert 單餐預算
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json() as { mealType?: unknown; amount?: unknown; isActive?: unknown };

    if (!isValidMealType(body.mealType)) {
      return NextResponse.json({ error: "mealType 必須是 breakfast / lunch / dinner" }, { status: 400 });
    }
    const amount = Number(body.amount);
    if (!isFinite(amount) || amount < 0) {
      return NextResponse.json({ error: "amount 必須是 ≥ 0 的數字" }, { status: 400 });
    }
    const isActive = typeof body.isActive === "boolean" ? body.isActive : true;

    const user = await getDashboardUser();
    const budget = await prisma.mealBudget.upsert({
      where: { userId_mealType: { userId: user.id, mealType: body.mealType } },
      update: { amount, isActive },
      create: { userId: user.id, mealType: body.mealType, amount, isActive },
    });

    return NextResponse.json({
      success: true,
      budget: {
        id: budget.id,
        mealType: budget.mealType,
        amount: Number(budget.amount),
        isActive: budget.isActive,
      },
    });
  } catch (e) {
    console.error("[meal-budgets PUT]", e);
    return NextResponse.json({ error: "操作失敗" }, { status: 500 });
  }
}

// DELETE /api/meal-budgets?mealType=breakfast
export async function DELETE(req: NextRequest) {
  try {
    const mealType = req.nextUrl.searchParams.get("mealType");
    if (!isValidMealType(mealType)) {
      return NextResponse.json({ error: "請提供合法 mealType 參數" }, { status: 400 });
    }

    const user = await getDashboardUser();
    await prisma.mealBudget.deleteMany({ where: { userId: user.id, mealType } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[meal-budgets DELETE]", e);
    return NextResponse.json({ error: "操作失敗" }, { status: 500 });
  }
}
