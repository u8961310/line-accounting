import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// ── PATCH /api/tasks/:id ──────────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const body = await request.json() as {
      title?:    string;
      dueDate?:  string | null;  // YYYY-MM-DD or null to clear
      priority?: string;
      status?:   string;
      category?: string;
      note?:     string;
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    if (body.title    !== undefined) data.title    = body.title.trim();
    if (body.priority !== undefined) data.priority = body.priority;
    if (body.status   !== undefined) data.status   = body.status;
    if (body.category !== undefined) data.category = body.category;
    if (body.note     !== undefined) data.note     = body.note;
    if (body.dueDate  !== undefined) {
      data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "無可更新欄位" }, { status: 400 });
    }

    const task = await prisma.task.update({
      where: { id: params.id },
      data,
    });

    return NextResponse.json({
      id:       task.id,
      title:    task.title,
      dueDate:  task.dueDate ? task.dueDate.toISOString().split("T")[0] : null,
      priority: task.priority,
      status:   task.status,
      category: task.category,
      note:     task.note,
    });
  } catch (e) {
    console.error("[PATCH /api/tasks/:id]", e);
    return NextResponse.json({ error: "操作失敗" }, { status: 500 });
  }
}

// ── DELETE /api/tasks/:id ─────────────────────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    await prisma.task.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[DELETE /api/tasks/:id]", e);
    return NextResponse.json({ error: "操作失敗" }, { status: 500 });
  }
}
