import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const body = await request.json() as {
      name?: string; targetAmount?: number; savedAmount?: number;
      deadline?: string | null; emoji?: string; note?: string; linkedSource?: string | null;
    };
    await prisma.financialGoal.update({
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
