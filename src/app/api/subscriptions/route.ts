import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export interface SubCandidate {
  patternKey:   string;
  detectedName: string;  // raw note used as fingerprint
  label:        string;  // user override (empty = not set)
  remark:       string;  // user's personal note
  amount:       number;
  category:     string;  // most common category
  source:       string;  // most common source
  monthCount:   number;  // distinct calendar months seen
  lastDate:     string;
  confirmed:    boolean;
  dismissed:    boolean;
}

export interface SubscriptionsResponse {
  candidates:   SubCandidate[];
  monthlyTotal: number;           // sum of confirmed + unconfirmed (non-dismissed)
}

export async function GET(): Promise<NextResponse> {
  const user = await prisma.user.findUnique({ where: { lineUserId: "dashboard_user" } });
  if (!user) return NextResponse.json({ candidates: [], monthlyTotal: 0 });

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const [txs, marks] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        userId:   user.id,
        date:     { gte: sixMonthsAgo },
        type:     "支出",
        NOT:      { category: "轉帳" },
      },
      select: { note: true, amount: true, category: true, source: true, date: true },
    }),
    prisma.subscriptionMark.findMany({ where: { userId: user.id } }),
  ]);

  // Group transactions by (note + rounded_amount) key
  type TxGroup = {
    note: string;
    amount: number;
    months: Set<string>;
    categories: Map<string, number>;
    sources:    Map<string, number>;
    lastDate:   Date;
  };

  const groups = new Map<string, TxGroup>();

  for (const tx of txs) {
    const note = tx.note.trim();
    if (!note) continue;  // skip empty-note transactions

    const amount = parseFloat(tx.amount.toString());
    if (amount <= 0) continue;

    // ±5% 容忍：找同備註且金額相近的現有群組，否則以此金額建新群組
    const noteKey = note.toLowerCase();
    let key = `${noteKey}||${Math.round(amount)}`;
    for (const existingKey of Array.from(groups.keys())) {
      if (!existingKey.startsWith(noteKey + "||")) continue;
      const existingAmt = groups.get(existingKey)!.amount;
      if (Math.abs(amount - existingAmt) / Math.max(amount, existingAmt) <= 0.05) {
        key = existingKey;
        break;
      }
    }
    const month = `${tx.date.getFullYear()}-${String(tx.date.getMonth() + 1).padStart(2, "0")}`;

    if (!groups.has(key)) {
      groups.set(key, { note, amount, months: new Set(), categories: new Map(), sources: new Map(), lastDate: tx.date });
    }
    const g = groups.get(key)!;
    g.months.add(month);
    g.categories.set(tx.category, (g.categories.get(tx.category) ?? 0) + 1);
    g.sources.set(tx.source, (g.sources.get(tx.source) ?? 0) + 1);
    if (tx.date > g.lastDate) g.lastDate = tx.date;
  }

  const markMap = new Map(marks.map(m => [m.patternKey, m]));

  const candidates: SubCandidate[] = [];

  for (const [key, g] of Array.from(groups.entries())) {
    if (g.months.size < 2) continue;  // must appear in ≥ 2 distinct months

    const topCategory = Array.from(g.categories.entries()).sort((a, b) => b[1] - a[1])[0][0];
    const topSource   = Array.from(g.sources.entries()).sort((a, b) => b[1] - a[1])[0][0];
    const mark = markMap.get(key);

    candidates.push({
      patternKey:   key,
      detectedName: g.note,
      label:        mark?.label    ?? "",
      remark:       mark?.note     ?? "",
      amount:       g.amount,
      category:     topCategory,
      source:       topSource,
      monthCount:   g.months.size,
      lastDate:     g.lastDate.toISOString().split("T")[0],
      confirmed:    mark?.confirmed ?? false,
      dismissed:    mark?.dismissed ?? false,
    });
  }

  // Sort: confirmed first, then by monthCount desc, then amount desc
  candidates.sort((a, b) => {
    if (a.dismissed !== b.dismissed) return a.dismissed ? 1 : -1;
    if (a.confirmed !== b.confirmed) return a.confirmed ? -1 : 1;
    if (b.monthCount !== a.monthCount) return b.monthCount - a.monthCount;
    return b.amount - a.amount;
  });

  const monthlyTotal = candidates
    .filter(c => !c.dismissed)
    .reduce((sum, c) => sum + c.amount, 0);

  return NextResponse.json({ candidates, monthlyTotal } satisfies SubscriptionsResponse);
}

export async function PUT(request: Request): Promise<NextResponse> {
  const body = await request.json() as {
    patternKey: string;
    label?:     string;
    note?:      string;
    confirmed?: boolean;
    dismissed?: boolean;
  };

  const user = await prisma.user.findUnique({ where: { lineUserId: "dashboard_user" } });
  if (!user) return NextResponse.json({ error: "user not found" }, { status: 404 });

  const mark = await prisma.subscriptionMark.upsert({
    where:  { userId_patternKey: { userId: user.id, patternKey: body.patternKey } },
    create: {
      userId:     user.id,
      patternKey: body.patternKey,
      label:      body.label     ?? "",
      note:       body.note      ?? "",
      confirmed:  body.confirmed ?? false,
      dismissed:  body.dismissed ?? false,
    },
    update: (() => {
      const patch: { label?: string; note?: string; confirmed?: boolean; dismissed?: boolean } = {};
      if (body.label     !== undefined) patch.label     = body.label;
      if (body.note      !== undefined) patch.note      = body.note;
      if (body.confirmed !== undefined) patch.confirmed = body.confirmed;
      if (body.dismissed !== undefined) patch.dismissed = body.dismissed;
      return patch;
    })(),
  });

  return NextResponse.json(mark);
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const { patternKey } = await request.json() as { patternKey: string };

  const user = await prisma.user.findUnique({ where: { lineUserId: "dashboard_user" } });
  if (!user) return NextResponse.json({ ok: true });

  await prisma.subscriptionMark.deleteMany({
    where: { userId: user.id, patternKey },
  });

  return NextResponse.json({ ok: true });
}
