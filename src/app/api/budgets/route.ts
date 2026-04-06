import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const DASHBOARD_USER_ID = "dashboard_user";

async function getDashboardUser() {
  return prisma.user.upsert({
    where: { lineUserId: DASHBOARD_USER_ID },
    update: {},
    create: { lineUserId: DASHBOARD_USER_ID, displayName: "Dashboard" },
  });
}

// GET /api/budgets?month=2026-03（省略則預設本月）
// 回傳所有分類的預算設定 + 該月實際支出
export async function GET(req: NextRequest) {
  try {
    const raw   = req.nextUrl.searchParams.get("month");
    const now   = new Date();
    const month = (raw && /^\d{4}-\d{2}$/.test(raw))
      ? raw
      : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  
    const user = await getDashboardUser();
  
    // 該月起訖
    const [year, mon] = month.split("-").map(Number);
    const start     = new Date(year, mon - 1, 1);
    const end       = new Date(year, mon,     1);
    const prevStart = new Date(year, mon - 2, 1);
    const prevEnd   = new Date(year, mon - 1, 1);
  
    const [budgets, spending, prevSpending] = await Promise.all([
      prisma.budget.findMany({ where: { userId: user.id } }),
      prisma.transaction.groupBy({
        by: ["category"],
        where: { userId: user.id, type: "支出", date: { gte: start, lt: end } },
        _sum: { amount: true },
      }),
      prisma.transaction.groupBy({
        by: ["category"],
        where: { userId: user.id, type: "支出", date: { gte: prevStart, lt: prevEnd } },
        _sum: { amount: true },
      }),
    ]);
  
    // 建立 category → 實際支出 map
    const spendMap: Record<string, number> = {};
    for (const s of spending) spendMap[s.category] = Number(s._sum.amount ?? 0);
  
    const prevSpendMap: Record<string, number> = {};
    for (const s of prevSpending) prevSpendMap[s.category] = Number(s._sum.amount ?? 0);
  
    const result = budgets.map((b) => {
      const base        = Number(b.amount);
      const pct         = b.carryoverPct ?? 0;
      const prevSpent   = prevSpendMap[b.category] ?? 0;
      const prevLeft    = Math.max(0, base - prevSpent);
      const carryover   = pct > 0 ? Math.round(prevLeft * pct / 100) : 0;
      return {
        id:           b.id,
        category:     b.category,
        amount:       base,
        carryoverPct: pct,
        carryover,
        effectiveAmount: base + carryover,
        spent:        spendMap[b.category] ?? 0,
      };
    });
  
    return NextResponse.json({ budgets: result, month });
    } catch (e) {
    console.error("[budgets]", e);
    return NextResponse.json({ error: "操作失敗" }, { status: 500 });
  }
}

// PUT /api/budgets
// body: { category: string, amount: number, carryoverPct?: number }
// 新增或更新某分類的預算
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json() as { category?: string; amount?: number; carryoverPct?: number };
    if (!body.category || body.amount == null || body.amount < 0) {
      return NextResponse.json({ error: "請提供 category 與 amount" }, { status: 400 });
    }
  
    const carryoverPct = Math.max(0, Math.min(100, Math.round(body.carryoverPct ?? 0)));
    const user = await getDashboardUser();
  
    const budget = await prisma.budget.upsert({
      where:  { userId_category: { userId: user.id, category: body.category } },
      update: { amount: body.amount, carryoverPct },
      create: { userId: user.id, category: body.category, amount: body.amount, carryoverPct },
    });
  
    return NextResponse.json({
      success: true,
      budget:  { id: budget.id, category: budget.category, amount: Number(budget.amount), carryoverPct: budget.carryoverPct },
    });
    } catch (e) {
    console.error("[budgets]", e);
    return NextResponse.json({ error: "操作失敗" }, { status: 500 });
  }
}

// DELETE /api/budgets?category=飲食
export async function DELETE(req: NextRequest) {
  try {
    const category = req.nextUrl.searchParams.get("category");
    if (!category) {
      return NextResponse.json({ error: "請提供 category 參數" }, { status: 400 });
    }
  
    const user = await getDashboardUser();
    await prisma.budget.deleteMany({ where: { userId: user.id, category } });
    return NextResponse.json({ success: true });
    } catch (e) {
    console.error("[budgets]", e);
    return NextResponse.json({ error: "操作失敗" }, { status: 500 });
  }
}
