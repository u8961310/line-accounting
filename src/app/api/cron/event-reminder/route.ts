import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/event-reminder
 * 查詢即將開始且尚未提醒的活動。
 * 由 kogao 的 cron 呼叫，取得待提醒清單後由 kogao 推播 LINE。
 * 驗證：Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();

    // 找出所有尚未提醒、且「現在 + reminderMinutes >= startAt」的活動
    // 即：startAt - reminderMinutes <= now < startAt
    const events = await prisma.event.findMany({
      where: {
        reminded: false,
        startAt:  { gt: now }, // 活動尚未開始
      },
      orderBy: { startAt: "asc" },
    });

    // 篩選：now >= startAt - reminderMinutes
    const pending = events.filter(e => {
      const reminderAt = new Date(e.startAt.getTime() - e.reminderMinutes * 60 * 1000);
      return now >= reminderAt;
    });

    return NextResponse.json({
      events: pending.map(e => ({
        id:              e.id,
        title:           e.title,
        startAt:         e.startAt.toISOString(),
        endAt:           e.endAt?.toISOString() ?? null,
        location:        e.location,
        link:            e.link,
        speakers:        e.speakers,
        description:     e.description,
        reminderMinutes: e.reminderMinutes,
      })),
    });
  } catch (e) {
    console.error("[GET /api/cron/event-reminder]", e);
    return NextResponse.json({ error: "操作失敗" }, { status: 500 });
  }
}

/**
 * POST /api/cron/event-reminder
 * 標記活動已提醒（由 kogao 推播後呼叫）。
 * Body: { eventIds: string[] }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { eventIds } = await request.json() as { eventIds: string[] };
    if (!eventIds?.length) {
      return NextResponse.json({ error: "eventIds 為必填" }, { status: 400 });
    }

    await prisma.event.updateMany({
      where: { id: { in: eventIds } },
      data:  { reminded: true },
    });

    return NextResponse.json({ ok: true, updated: eventIds.length });
  } catch (e) {
    console.error("[POST /api/cron/event-reminder]", e);
    return NextResponse.json({ error: "操作失敗" }, { status: 500 });
  }
}
