import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const user = await prisma.user.findFirst({ where: { lineUserId: "dashboard_user" } });
  if (!user) return NextResponse.json([]);

  const goals = await prisma.financialGoal.findMany({
    where:   { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(goals.map(g => ({
    id:           g.id,
    name:         g.name,
    emoji:        g.emoji,
    targetAmount: parseFloat(g.targetAmount.toString()),
    savedAmount:  parseFloat(g.savedAmount.toString()),
    linkedSource: g.linkedSource ?? null,
    deadline:     g.deadline ? g.deadline.toISOString().split("T")[0] : null,
    note:         g.note,
  })));
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as {
      name: string; targetAmount: number; savedAmount?: number;
      deadline?: string; emoji?: string; note?: string; linkedSource?: string | null;
    };
    const user = await prisma.user.findFirst({ where: { lineUserId: "dashboard_user" } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const goal = await prisma.financialGoal.create({
      data: {
        userId:       user.id,
        name:         body.name,
        targetAmount: body.targetAmount,
        savedAmount:  body.savedAmount ?? 0,
        linkedSource: body.linkedSource ?? null,
        deadline:     body.deadline ? new Date(body.deadline) : null,
        emoji:        body.emoji ?? "🎯",
        note:         body.note ?? "",
      },
    });
    return NextResponse.json({ id: goal.id });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
