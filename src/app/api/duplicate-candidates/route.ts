import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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
  const user = await prisma.user.findUnique({ where: { lineUserId: "dashboard_user" } });
  if (!user) return NextResponse.json({ pairs: [] });

  const txs = await prisma.transaction.findMany({
    where:   { userId: user.id },
    select:  { id: true, date: true, amount: true, type: true, source: true, category: true, note: true },
    orderBy: { date: "desc" },
    take:    1000,
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
      if (b.type !== a.type) continue;                   // must be same type
      if (b.source === a.source) continue;               // same source = not a duplicate

      const bAmt = parseFloat(b.amount.toString());
      if (Math.abs(aAmt - bAmt) > 0.01) continue;

      const dayDiff = Math.abs(a.date.getTime() - b.date.getTime()) / (1000 * 60 * 60 * 24);
      if (dayDiff > 1) continue;

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
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const { id } = await request.json() as { id: string };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.transaction.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
