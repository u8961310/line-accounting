import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { archiveGoalMilestone } from "@/lib/notion";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const body = await request.json() as {
      name?: string; targetAmount?: number; savedAmount?: number;
      deadline?: string | null; emoji?: string; note?: string; linkedSource?: string | null;
    };
    // 更新前先讀取舊資料（用於判斷是否剛達成目標）
    const before = await prisma.financialGoal.findUnique({ where: { id: params.id } });

    const updated = await prisma.financialGoal.update({
      where: { id: params.id },
      data: {
        ...(body.name         !== undefined && { name: body.name }),
        ...(body.targetAmount !== undefined && { targetAmount: body.targetAmount }),
        ...(body.savedAmount  !== undefined && { savedAmount: body.savedAmount }),
        ...(body.emoji        !== undefined && { emoji: body.emoji }),
        ...(body.note         !== undefined && { note: body.note }),
        ...(body.deadline     !== undefined && { deadline: body.deadline ? new Date(body.deadline) : null }),
        ...(body.linkedSource !== undefined && { linkedSource: body.linkedSource }),
      },
    });

    // 里程碑偵測：savedAmount 剛剛越過 targetAmount
    if (before) {
      const wasComplete = Number(before.savedAmount) >= Number(before.targetAmount);
      const isComplete  = Number(updated.savedAmount) >= Number(updated.targetAmount);
      if (!wasComplete && isComplete) {
        const createdAt   = before.createdAt;
        const now         = new Date();
        const monthsToReach = Math.max(1, Math.round(
          (now.getFullYear() - createdAt.getFullYear()) * 12 +
          (now.getMonth() - createdAt.getMonth())
        ));
        void archiveGoalMilestone({
          name:          updated.name,
          emoji:         updated.emoji,
          targetAmount:  Number(updated.targetAmount),
          savedAmount:   Number(updated.savedAmount),
          monthsToReach,
          note:          updated.note ?? "",
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    await prisma.financialGoal.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
