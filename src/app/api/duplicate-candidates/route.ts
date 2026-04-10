import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export interface DuplicateTx {
  id:       string;
  date:     string;
  amount:   number;
  type:     string;
  source:   string;
  category: string;
  note:     string;
}

export interface DuplicatePair {
  a: DuplicateTx;
  b: DuplicateTx;
}

export async function GET(): Promise<NextResponse> {
  try {
    const user = await prisma.user.findUnique({ where: { lineUserId: "dashboard_user" } });
    if (!user) return NextResponse.json({ pairs: [] });

    const [txs, dismissals] = await Promise.all([
      prisma.transaction.findMany({
        where:   { userId: user.id },
        select:  { id: true, date: true, amount: true, type: true, source: true, category: true, note: true },
        orderBy: { date: "desc" },
        take:    1000,
      }),
      prisma.duplicateDismissal.findMany({
        select: { transactionAId: true, transactionBId: true },
      }),
    ]);

    // 建立已 dismiss 的 pair set（雙向匹配）
    const dismissedSet = new Set<string>();
    for (const d of dismissals) {
      dismissedSet.add(`${d.transactionAId}|${d.transactionBId}`);
      dismissedSet.add(`${d.transactionBId}|${d.transactionAId}`);
    }

    // 預計算常態消費：非 manual/line 來源，同金額 30 天內出現 ≥4 次 → 視為常態，跳過重複偵測
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const routineKeys = new Set<string>();
    const csvAmtCount = new Map<string, number>();
    for (const t of txs) {
      if (t.source === "manual" || t.source === "line" || t.source === "mcp") continue;
      if (t.date < thirtyDaysAgo) continue;
      const key = `${t.source}|${parseFloat(t.amount.toString()).toFixed(2)}`;
      csvAmtCount.set(key, (csvAmtCount.get(key) ?? 0) + 1);
    }
    Array.from(csvAmtCount.entries()).forEach(([key, count]) => {
      if (count >= 4) routineKeys.add(key);
    });

    const pairs: DuplicatePair[] = [];
    const usedIds = new Set<string>();

    for (let i = 0; i < txs.length; i++) {
      const a = txs[i];
      if (usedIds.has(a.id)) continue;
      const aAmt = parseFloat(a.amount.toString());

      for (let j = i + 1; j < txs.length; j++) {
        const b = txs[j];
        if (usedIds.has(b.id)) continue;
        if (b.type !== a.type) continue;
        if (b.source !== a.source) continue;  // 只偵測同來源重複

        const bAmt = parseFloat(b.amount.toString());
        if (Math.abs(aAmt - bAmt) > 0.01) continue;

        const dayDiff = Math.abs(a.date.getTime() - b.date.getTime()) / (1000 * 60 * 60 * 24);
        if (dayDiff > 2) continue;

        // 跳過常態消費（同來源同金額 30 天內 ≥4 次）
        const aKey = `${a.source}|${aAmt.toFixed(2)}`;
        if (routineKeys.has(aKey)) continue;

        // 跳過已 dismiss 的 pair
        if (dismissedSet.has(`${a.id}|${b.id}`)) continue;

        pairs.push({
          a: { id: a.id, date: a.date.toISOString().split("T")[0], amount: aAmt, type: a.type, source: a.source, category: a.category, note: a.note },
          b: { id: b.id, date: b.date.toISOString().split("T")[0], amount: bAmt, type: b.type, source: b.source, category: b.category, note: b.note },
        });
        usedIds.add(a.id);
        usedIds.add(b.id);
        break;
      }
    }

    return NextResponse.json({ pairs });
    } catch (e) {
    console.error("[duplicate-candidates]", e);
    return NextResponse.json({ error: "操作失敗" }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { transactionAId, transactionBId } = await request.json() as { transactionAId: string; transactionBId: string };
    if (!transactionAId || !transactionBId) {
      return NextResponse.json({ error: "transactionAId and transactionBId required" }, { status: 400 });
    }
    // 排序 ID 確保一致性
    const [aId, bId] = [transactionAId, transactionBId].sort();
    await prisma.duplicateDismissal.upsert({
      where: { transactionAId_transactionBId: { transactionAId: aId, transactionBId: bId } },
      update: {},
      create: { transactionAId: aId, transactionBId: bId },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[duplicate-candidates]", e);
    return NextResponse.json({ error: "操作失敗" }, { status: 500 });
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  try {
    const { id } = await request.json() as { id: string };
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await prisma.transaction.delete({ where: { id } });
    return NextResponse.json({ ok: true });
    } catch (e) {
    console.error("[duplicate-candidates]", e);
    return NextResponse.json({ error: "操作失敗" }, { status: 500 });
  }
}
