import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export interface HealthSnapshot {
  month:           string;
  score:           number;
  savingsScore:    number;
  debtScore:       number;
  budgetScore:     number;
  savingsRate:     number;
  debtRatio:       number;
  budgetAdherence: number;
}

export async function GET(): Promise<NextResponse> {
  const user = await prisma.user.findFirst({ where: { lineUserId: "dashboard_user" } });
  if (!user) return NextResponse.json([]);

  const rows = await prisma.healthScoreSnapshot.findMany({
    where:   { userId: user.id },
    orderBy: { month: "asc" },
  });

  return NextResponse.json(rows.map(r => ({
    month:           r.month,
    score:           r.score,
    savingsScore:    r.savingsScore,
    debtScore:       r.debtScore,
    budgetScore:     r.budgetScore,
    savingsRate:     r.savingsRate,
    debtRatio:       r.debtRatio,
    budgetAdherence: r.budgetAdherence,
  }) satisfies HealthSnapshot));
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json() as HealthSnapshot;
  const user = await prisma.user.findFirst({ where: { lineUserId: "dashboard_user" } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  await prisma.healthScoreSnapshot.upsert({
    where:  { userId_month: { userId: user.id, month: body.month } },
    update: {
      score: body.score, savingsScore: body.savingsScore, debtScore: body.debtScore,
      budgetScore: body.budgetScore, savingsRate: body.savingsRate,
      debtRatio: body.debtRatio, budgetAdherence: body.budgetAdherence,
    },
    create: { userId: user.id, ...body },
  });

  return NextResponse.json({ ok: true });
}
