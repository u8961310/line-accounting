import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { taipeiTodayAsUTC } from "@/lib/time";

export const dynamic = "force-dynamic";

async function getUser() {
  return prisma.user.findFirst({ where: { lineUserId: "dashboard_user" } });
}

function serializeEvent(e: {
  id: string; title: string; startAt: Date; endAt: Date | null;
  location: string; link: string; speakers: string; description: string;
  reminderMinutes: number; reminded: boolean; cronId: string | null;
  googleEventId: string | null; isAllDay: boolean; status: string;
  createdAt: Date; updatedAt: Date;
}) {
  return {
    id:              e.id,
    title:           e.title,
    startAt:         e.startAt.toISOString(),
    endAt:           e.endAt?.toISOString() ?? null,
    location:        e.location,
    link:            e.link,
    speakers:        e.speakers,
    description:     e.description,
    reminderMinutes: e.reminderMinutes,
    reminded:        e.reminded,
    cronId:          e.cronId,
    googleEventId:   e.googleEventId,
    isAllDay:        e.isAllDay,
    status:          e.status,
    createdAt:       e.createdAt.toISOString(),
  };
}

// ── GET /api/events ──────────────────────────────────────────────────────────
// ?scope=upcoming|past|all (default: upcoming)

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json([]);

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope") ?? "upcoming";
    const start = searchParams.get("start"); // ISO date, e.g. 2026-04-12
    const end = searchParams.get("end");     // ISO date, e.g. 2026-04-19

    const now = new Date();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { userId: user.id };

    if (start && end) {
      // 日期區間查詢（kogao-os calendar view 用）
      where.startAt = { gte: new Date(start), lte: new Date(end) };
      where.status = "confirmed";
    } else if (scope === "upcoming") {
      where.startAt = { gte: now };
    } else if (scope === "past") {
      where.startAt = { lt: now };
    }

    const events = await prisma.event.findMany({
      where,
      orderBy: { startAt: (scope === "past" && !start) ? "desc" : "asc" },
      take: start ? 200 : 50,
    });

    return NextResponse.json(events.map(serializeEvent));
  } catch (e) {
    console.error("[GET /api/events]", e);
    return NextResponse.json({ error: "操作失敗" }, { status: 500 });
  }
}

// ── POST /api/events ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as {
      title:           string;
      startAt:         string;   // ISO 8601
      endAt?:          string;
      location?:       string;
      link?:           string;
      speakers?:       string;
      description?:    string;
      reminderMinutes?: number;
      googleEventId?:  string;
      isAllDay?:       boolean;
      status?:         string;   // confirmed | cancelled
    };

    if (!body.title?.trim()) {
      return NextResponse.json({ error: "title 為必填" }, { status: 400 });
    }
    if (!body.startAt) {
      return NextResponse.json({ error: "startAt 為必填" }, { status: 400 });
    }

    const user = await getUser();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // ── 重複偵測：googleEventId 或 同標題+同開始時間 ──
    const startAt = new Date(body.startAt);

    if (body.googleEventId) {
      const byGoogleId = await prisma.event.findFirst({
        where: { userId: user.id, googleEventId: body.googleEventId },
      });
      if (byGoogleId) {
        // Google Calendar 同步：已存在就更新而非報錯
        const updated = await prisma.event.update({
          where: { id: byGoogleId.id },
          data: {
            title:       body.title.trim(),
            startAt,
            endAt:       body.endAt ? new Date(body.endAt) : null,
            location:    body.location ?? byGoogleId.location,
            description: body.description ?? byGoogleId.description,
            isAllDay:    body.isAllDay ?? byGoogleId.isAllDay,
            status:      body.status ?? byGoogleId.status,
          },
        });
        return NextResponse.json(serializeEvent(updated), { status: 200 });
      }
    }

    const existing = await prisma.event.findFirst({
      where: {
        userId:  user.id,
        title:   body.title.trim(),
        startAt,
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: "duplicate", message: "已存在相同的活動", event: serializeEvent(existing) },
        { status: 409 },
      );
    }

    const event = await prisma.event.create({
      data: {
        userId:          user.id,
        title:           body.title.trim(),
        startAt,
        endAt:           body.endAt ? new Date(body.endAt) : null,
        location:        body.location ?? "",
        link:            body.link ?? "",
        speakers:        body.speakers ?? "",
        description:     body.description ?? "",
        reminderMinutes: body.reminderMinutes ?? 60,
        googleEventId:   body.googleEventId ?? null,
        isAllDay:        body.isAllDay ?? false,
        status:          body.status ?? "confirmed",
      },
    });

    return NextResponse.json(serializeEvent(event), { status: 201 });
  } catch (e) {
    console.error("[POST /api/events]", e);
    return NextResponse.json({ error: "操作失敗" }, { status: 500 });
  }
}
