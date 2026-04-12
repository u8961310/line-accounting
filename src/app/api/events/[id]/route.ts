import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

async function getUser() {
  return prisma.user.findFirst({ where: { lineUserId: "dashboard_user" } });
}

type Params = { params: Promise<{ id: string }> };

// ── GET /api/events/:id ──────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: Params): Promise<NextResponse> {
  try {
    const { id } = await params;
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const event = await prisma.event.findFirst({ where: { id, userId: user.id } });
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    return NextResponse.json({
      id:              event.id,
      title:           event.title,
      startAt:         event.startAt.toISOString(),
      endAt:           event.endAt?.toISOString() ?? null,
      location:        event.location,
      link:            event.link,
      speakers:        event.speakers,
      description:     event.description,
      reminderMinutes: event.reminderMinutes,
      reminded:        event.reminded,
      cronId:          event.cronId,
      googleEventId:   event.googleEventId,
      isAllDay:        event.isAllDay,
      status:          event.status,
      createdAt:       event.createdAt.toISOString(),
    });
  } catch (e) {
    console.error("[GET /api/events/:id]", e);
    return NextResponse.json({ error: "操作失敗" }, { status: 500 });
  }
}

// ── PUT /api/events/:id ──────────────────────────────────────────────────────

export async function PUT(req: NextRequest, { params }: Params): Promise<NextResponse> {
  try {
    const { id } = await params;
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const existing = await prisma.event.findFirst({ where: { id, userId: user.id } });
    if (!existing) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    const body = await req.json() as Record<string, unknown>;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    if (body.title !== undefined)           data.title           = (body.title as string).trim();
    if (body.startAt !== undefined)         data.startAt         = new Date(body.startAt as string);
    if (body.endAt !== undefined)           data.endAt           = body.endAt ? new Date(body.endAt as string) : null;
    if (body.location !== undefined)        data.location        = body.location;
    if (body.link !== undefined)            data.link            = body.link;
    if (body.speakers !== undefined)        data.speakers        = body.speakers;
    if (body.description !== undefined)     data.description     = body.description;
    if (body.reminderMinutes !== undefined) data.reminderMinutes = body.reminderMinutes;
    if (body.reminded !== undefined)        data.reminded        = body.reminded;
    if (body.cronId !== undefined)          data.cronId          = body.cronId;
    if (body.googleEventId !== undefined)   data.googleEventId   = body.googleEventId;
    if (body.isAllDay !== undefined)        data.isAllDay        = body.isAllDay;
    if (body.status !== undefined)          data.status          = body.status;

    const updated = await prisma.event.update({ where: { id }, data });

    return NextResponse.json({
      id:              updated.id,
      title:           updated.title,
      startAt:         updated.startAt.toISOString(),
      endAt:           updated.endAt?.toISOString() ?? null,
      location:        updated.location,
      link:            updated.link,
      speakers:        updated.speakers,
      description:     updated.description,
      reminderMinutes: updated.reminderMinutes,
      reminded:        updated.reminded,
      cronId:          updated.cronId,
      googleEventId:   updated.googleEventId,
      isAllDay:        updated.isAllDay,
      status:          updated.status,
      createdAt:       updated.createdAt.toISOString(),
    });
  } catch (e) {
    console.error("[PUT /api/events/:id]", e);
    return NextResponse.json({ error: "操作失敗" }, { status: 500 });
  }
}

// ── DELETE /api/events/:id ───────────────────────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: Params): Promise<NextResponse> {
  try {
    const { id } = await params;
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const existing = await prisma.event.findFirst({ where: { id, userId: user.id } });
    if (!existing) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    await prisma.event.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[DELETE /api/events/:id]", e);
    return NextResponse.json({ error: "操作失敗" }, { status: 500 });
  }
}
