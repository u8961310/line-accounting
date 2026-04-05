import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSubscriptionsFromNotion } from "@/lib/notion";

export const dynamic = "force-dynamic";

function normalize(s: string) {
  return s.toLowerCase().replace(/[\s\-_.,·・\(\)（）【】「」『』]/g, "");
}

function fuzzyMatch(subName: string, txText: string): boolean {
  const n1 = normalize(subName);
  const n2 = normalize(txText);
  if (n1.length < 2) return false;
  return n2.includes(n1) || n1.includes(n2);
}

export interface VerifyItem {
  id:         string;
  name:       string;
  cycle:      string;
  fee:        number;
  status:     "found" | "not_found";
  matchedTx?: { date: string; amount: number; note: string };
}

export interface VerifyResponse {
  items:      VerifyItem[];
  foundCount: number;
  month:      string;
}

export async function GET(): Promise<NextResponse> {
  const user = await prisma.user.findUnique({ where: { lineUserId: "dashboard_user" } });
  if (!user) return NextResponse.json({ items: [], foundCount: 0, month: "" });

  const now        = new Date();
  const month      = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [subs, txs] = await Promise.all([
    getSubscriptionsFromNotion(),
    prisma.transaction.findMany({
      where: {
        userId: user.id,
        date:   { gte: monthStart, lt: monthEnd },
        type:   "支出",
      },
      select: { date: true, amount: true, note: true, category: true },
      orderBy: { date: "asc" },
    }),
  ]);

  const items: VerifyItem[] = subs.map(sub => {
    const match = txs.find(tx =>
      fuzzyMatch(sub.name, tx.note ?? "") ||
      fuzzyMatch(sub.name, tx.category ?? "")
    );

    if (match) {
      return {
        id:     sub.id,
        name:   sub.name,
        cycle:  sub.cycle,
        fee:    sub.fee,
        status: "found",
        matchedTx: {
          date:   match.date.toISOString().split("T")[0],
          amount: parseFloat(match.amount.toString()),
          note:   match.note || match.category,
        },
      };
    }

    return { id: sub.id, name: sub.name, cycle: sub.cycle, fee: sub.fee, status: "not_found" };
  });

  return NextResponse.json({
    items,
    foundCount: items.filter(i => i.status === "found").length,
    month,
  } satisfies VerifyResponse);
}
