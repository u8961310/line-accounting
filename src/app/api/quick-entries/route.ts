import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export interface QuickEntry {
  type: string;
  category: string;
  amount: number;
  label: string;
  count: number;
}

export async function GET(): Promise<NextResponse> {
  try {
    const user = await prisma.user.findUnique({ where: { lineUserId: "dashboard_user" } });
    if (!user) return NextResponse.json({ suggestions: [] });

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const txs = await prisma.transaction.findMany({
      where: {
        userId: user.id,
        date: { gte: since },
        category: { not: "轉帳" },
      },
      select: { type: true, category: true, amount: true },
    });

    // 分組：type + category + 四捨五入到整數（容忍 ±10%）
    // 先把金額量化到「基準」：取最常出現的金額作代表
    const buckets = new Map<string, { type: string; category: string; amounts: number[] }>();

    for (const tx of txs) {
      const amt = parseFloat(tx.amount.toString());
      let matched: string | null = null;
      const entries = Array.from(buckets.entries());
      for (const [key, bucket] of entries) {
        if (bucket.type !== tx.type || bucket.category !== tx.category) continue;
        const avg = bucket.amounts.reduce((s: number, a: number) => s + a, 0) / bucket.amounts.length;
        if (Math.abs(amt - avg) / avg <= 0.1) { matched = key; break; }
      }
      if (matched) {
        buckets.get(matched)!.amounts.push(amt);
      } else {
        buckets.set(`${tx.type}|${tx.category}|${amt}`, { type: tx.type, category: tx.category, amounts: [amt] });
      }
    }

    const suggestions: QuickEntry[] = [];
    Array.from(buckets.values()).forEach(bucket => {
      if (bucket.amounts.length < 3) return;
      const freqMap = new Map<number, number>();
      bucket.amounts.forEach(a => {
        const r = Math.round(a);
        freqMap.set(r, (freqMap.get(r) ?? 0) + 1);
      });
      const repAmount = Array.from(freqMap.entries()).sort((a, b) => b[1] - a[1])[0][0];
      suggestions.push({
        type: bucket.type, category: bucket.category, amount: repAmount,
        label: `${bucket.category} $${repAmount}`, count: bucket.amounts.length,
      });
    });

    // 依出現次數排序，最多回傳 10 個
    suggestions.sort((a, b) => b.count - a.count);
    return NextResponse.json({ suggestions: suggestions.slice(0, 10) });
  } catch (e) {
    console.error("[quick-entries]", e);
    return NextResponse.json({ error: "操作失敗" }, { status: 500 });
  }
}
