import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendExpoPush } from "@/lib/expo-push";
import { broadcastWebPush } from "@/lib/web-push";
import { deleteCronicleEvent } from "@/lib/cronicle";

export const dynamic = "force-dynamic";

/**
 * POST /api/cron/push-task-reminder
 * Cronicle 在任務精準時間觸發，發 Expo Push 到所有訂閱裝置。
 * 觸發後自動刪除該 Cronicle 事件（一次性提醒）。
 *
 * 驗證：Authorization: Bearer CRON_SECRET
 * Body: { taskId: string, cronId?: string }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { taskId, cronId } = body as { taskId?: string; cronId?: string };
  if (!taskId) {
    return NextResponse.json({ error: "taskId is required" }, { status: 400 });
  }

  try {
    const task = await prisma.task.findUnique({ where: { id: taskId } });

    // 任務不存在或已完成 → 不發提醒，但還是嘗試清 Cronicle
    if (!task || task.status === "done") {
      if (cronId) await deleteCronicleEvent(cronId).catch(() => null);
      return NextResponse.json({ ok: true, skipped: true, reason: !task ? "任務不存在" : "任務已完成" });
    }

    // 已提醒過 → 避免重複
    if (task.reminded) {
      if (cronId) await deleteCronicleEvent(cronId).catch(() => null);
      return NextResponse.json({ ok: true, skipped: true, reason: "已提醒過" });
    }

    const subs = await prisma.pushSubscription.findMany({ where: { active: true } });

    const title = `⏰ ${task.title}`;
    const bodyText = task.dueTime
      ? `${task.dueTime} 提醒：${task.title}`
      : `任務時間到：${task.title}`;

    // 平行送 Expo (APP) + Web Push (瀏覽器)
    const [tickets, webResult] = await Promise.all([
      subs.length === 0
        ? Promise.resolve([])
        : sendExpoPush(
            subs.map((s) => ({
              to: s.token,
              title,
              body: bodyText,
              data: { kind: "task", taskId: task.id },
              categoryId: "budget_alert",
              channelId: "default",
              sound: "default",
              priority: "high",
            }))
          ),
      broadcastWebPush({
        title,
        body: bodyText,
        data: { kind: "task", taskId: task.id },
        url: "/tasks",
      }).catch((e) => {
        console.error("[push-task-reminder] web push failed:", e);
        return { sent: 0, failed: 0, expired: 0 };
      }),
    ]);

    const errors = tickets.filter((t) => t.status === "error");

    await prisma.task.update({
      where: { id: task.id },
      data: { reminded: true, cronId: null },
    }).catch(console.error);

    // 一次性提醒 → 清 Cronicle
    if (cronId) await deleteCronicleEvent(cronId).catch(() => null);

    return NextResponse.json({
      ok: true,
      expoSent: tickets.length - errors.length,
      expoFailed: errors.length,
      web: webResult,
    });
  } catch (e) {
    console.error("[push-task-reminder]", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
