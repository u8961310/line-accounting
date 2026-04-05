import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export interface AnomalyItem {
  category:    string;
  current:     number;   // 當月支出
  mean:        number;   // 過去 N 個月平均
  stddev:      number;
  zscore:      number;   // (current - mean) / stddev
  prevMonths:  number[]; // 過去各月金額（由近到遠）
}

// GET /api/anomaly-detection?month=YYYY-MM&lookback=4
// 以 z-score 偵測當月各分類支出是否異常偏高
export async function GET(req: NextRequest) {
  const month    = req.nextUrl.searchParams.get("month");
  const lookback = Math.min(6, Math.max(2, parseInt(req.nextUrl.searchParams.get("lookback") ?? "4", 10)));

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "請提供 month 參數（格式：YYYY-MM）" }, { status: 400 });
  }

  const user = await prisma.user.findFirst({ where: { lineUserId: "dashboard_user" } });
  if (!user) return NextResponse.json({ anomalies: [] });

  const [y, m] = month.split("-").map(Number);
  const curStart = new Date(y, m - 1, 1);
  const curEnd   = new Date(y, m, 1);

  // 當月各分類支出
  const current = await prisma.transaction.groupBy({
    by: ["category"],
    where: { userId: user.id, type: "支出", category: { not: "轉帳" }, date: { gte: curStart, lt: curEnd } },
    _sum: { amount: true },
  });

  if (current.length === 0) return NextResponse.json({ anomalies: [] });

  // 過去 N 個月各分類支出（逐月）
  const monthlyData: Map<string, number[]> = new Map();
  for (let i = 1; i <= lookback; i++) {
    const s = new Date(y, m - 1 - i, 1);
    const e = new Date(y, m - i, 1);
    const rows = await prisma.transaction.groupBy({
      by: ["category"],
      where: { userId: user.id, type: "支出", category: { not: "轉帳" }, date: { gte: s, lt: e } },
      _sum: { amount: true },
    });
    for (const r of rows) {
      if (!monthlyData.has(r.category)) monthlyData.set(r.category, []);
      monthlyData.get(r.category)!.push(Number(r._sum.amount ?? 0));
    }
  }

  const anomalies: AnomalyItem[] = [];
  for (const c of current) {
    const cat  = c.category;
    const cur  = Number(c._sum.amount ?? 0);
    const hist = monthlyData.get(cat) ?? [];

    if (hist.length < 2) continue; // 歷史資料不足，無法計算

    const mean   = hist.reduce((a, b) => a + b, 0) / hist.length;
    const variance = hist.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / hist.length;
    const stddev = Math.sqrt(variance);

    if (stddev < 100) continue; // 標準差太小（幾乎不波動），不值得偵測

    const zscore = (cur - mean) / stddev;
    if (zscore < 1.5) continue; // 未達異常閾值

    anomalies.push({
      category:   cat,
      current:    Math.round(cur),
      mean:       Math.round(mean),
      stddev:     Math.round(stddev),
      zscore:     Math.round(zscore * 10) / 10,
      prevMonths: hist.map(v => Math.round(v)),
    });
  }

  anomalies.sort((a, b) => b.zscore - a.zscore);
  return NextResponse.json({ anomalies, month, lookback });
}
