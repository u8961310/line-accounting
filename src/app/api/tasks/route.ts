import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

async function getUser() {
  return prisma.user.findFirst({ where: { lineUserId: "dashboard_user" } });
}

// ── GET /api/tasks ────────────────────────────────────────────────────────────
// Query params:
//   ?status=open|done|all   (default: all)
//   ?date=today|upcoming|overdue    (today = due today, upcoming = due within 7 days, overdue = past due)
//   ?category=工作|生活|財務|其他

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json([]);

    const { searchParams } = new URL(request.url);
    const status   = searchParams.get("status");
    const date     = searchParams.get("date");
    const category = searchParams.get("category");

    const now   = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1);
    const in7Days  = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { userId: user.id };

    if (status && status !== "all") where.status = status;
    if (category) where.category = category;

    if (date === "today") {
      where.dueDate = { gte: today, lte: todayEnd };
    } else if (date === "upcoming") {
      where.dueDate = { gte: today, lte: in7Days };
    } else if (date === "overdue") {
      where.dueDate = { lt: today };
      if (!status || status === "all") where.status = "open"; // 逾期預設只看未完成
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy: [
        { dueDate: "asc" },
        { priority: "asc" },
        { createdAt: "desc" },
      ],
    });

    return NextResponse.json(tasks.map(t => ({
      id:        t.id,
      title:     t.title,
      dueDate:   t.dueDate ? t.dueDate.toISOString().split("T")[0] : null,
      dueTime:   t.dueTime,
      priority:  t.priority,
      status:    t.status,
      category:  t.category,
      note:      t.note,
      createdAt: t.createdAt.toISOString(),
    })));
  } catch (e) {
    console.error("[GET /api/tasks]", e);
    return NextResponse.json({ error: "操作失敗" }, { status: 500 });
  }
}

// ── POST /api/tasks ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as {
      title:     string;
      dueDate?:  string;  // YYYY-MM-DD
      dueTime?:  string;  // HH:MM 台灣時間
      priority?: string;  // high | mid | low
      category?: string;
      note?:     string;
    };

    if (!body.title?.trim()) {
      return NextResponse.json({ error: "title 為必填" }, { status: 400 });
    }

    const user = await getUser();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const task = await prisma.task.create({
      data: {
        userId:   user.id,
        title:    body.title.trim(),
        dueDate:  body.dueDate ? new Date(body.dueDate) : null,
        dueTime:  body.dueTime ?? "",
        priority: body.priority ?? "mid",
        category: body.category ?? "其他",
        note:     body.note ?? "",
      },
    });

    // 有 dueDate + dueTime 時建立 Cronicle 精準排程（失敗不影響主流程）
    if (body.dueDate && body.dueTime) {
      const { createTaskReminder } = await import("@/lib/cronicle");
      const cronId = await createTaskReminder({
        id: task.id,
        title: task.title,
        dueDate: body.dueDate,
        dueTime: body.dueTime,
      });
      if (cronId) {
        await prisma.task.update({
          where: { id: task.id },
          data: { cronId },
        }).catch((e) => console.error("[tasks] save cronId failed:", e));
      }
    }

    return NextResponse.json({
      id:       task.id,
      title:    task.title,
      dueDate:  task.dueDate ? task.dueDate.toISOString().split("T")[0] : null,
      dueTime:  task.dueTime,
      priority: task.priority,
      status:   task.status,
      category: task.category,
      note:     task.note,
    }, { status: 201 });
  } catch (e) {
    console.error("[POST /api/tasks]", e);
    return NextResponse.json({ error: "操作失敗" }, { status: 500 });
  }
}
