import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/budgets/suggest?months=3
// 根據過去 N 個月的實際支出，計算各分類平均值並建議預算上限（平均 × 1.1）
export async function GET(req: NextRequest) {
  try {
    const months = Math.min(6, Math.max(1, parseInt(req.nextUrl.searchParams.get("months") ?? "3", 10)));
  
    const user = await prisma.user.findFirst({ where: { lineUserId: "dashboard_user" } });
    if (!user) return NextResponse.json({ suggestions: [] });
  
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - months, 1);
  
    const spending = await prisma.transaction.groupBy({
      by: ["category"],
      where: {
        userId: user.id,
        type: "支出",
        category: { not: "轉帳" },
        date: { gte: start },
      },
      _sum: { amount: true },
      _count: true,
    });
  
    // 計算實際涵蓋的月份數（取 start 到現在）
    const actualMonths = Math.max(1, months);
  
    const suggestions = spending
      .filter(s => Number(s._sum.amount ?? 0) > 0)
      .map(s => {
        const total  = Number(s._sum.amount ?? 0);
        const avg    = Math.round(total / actualMonths);
        const suggested = Math.round(avg * 1.1 / 100) * 100; // 10% buffer, 無條件進位到百元
        return { category: s.category, avg, suggested, monthsOfData: actualMonths };
      })
      .sort((a, b) => b.avg - a.avg);
  
    return NextResponse.json({ suggestions, months: actualMonths });
    } catch (e) {
    console.error("[budgets/suggest]", e);
    return NextResponse.json({ error: "操作失敗" }, { status: 500 });
  }
}
