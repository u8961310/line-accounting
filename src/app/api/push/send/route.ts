import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendExpoPush, ExpoPushMessage } from "@/lib/expo-push";

export const dynamic = "force-dynamic";

/**
 * POST /api/push/send
 * 內部用：Cronicle / kogao webhook / 其他服務呼叫這支發通知。
 * 驗證：Authorization: Bearer <CRON_SECRET>
 *
 * Body:
 * {
 *   title: string,
 *   body: string,
 *   data?: object,
 *   categoryId?: "ledger_confirm" | "budget_alert" | ...
 *   channelId?: string,
 *   tokens?: string[]   // 指定 tokens，不給則發給所有 active 訂閱
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    title,
    body: messageBody,
    data,
    categoryId,
    channelId,
    tokens: specifiedTokens,
  } = body as {
    title?: string;
    body?: string;
    data?: Record<string, unknown>;
    categoryId?: string;
    channelId?: string;
    tokens?: string[];
  };

  if (!title && !messageBody) {
    return NextResponse.json(
      { error: "title or body is required" },
      { status: 400 }
    );
  }

  const subs = specifiedTokens
    ? await prisma.pushSubscription.findMany({
        where: { token: { in: specifiedTokens }, active: true },
      })
    : await prisma.pushSubscription.findMany({ where: { active: true } });

  if (subs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, note: "無可用訂閱" });
  }

  const messages: ExpoPushMessage[] = subs.map((s) => ({
    to: s.token,
    title,
    body: messageBody,
    data,
    categoryId,
    channelId: channelId ?? "default",
    sound: "default",
    priority: "high",
  }));

  const tickets = await sendExpoPush(messages);

  const errors = tickets.filter((t) => t.status === "error");

  for (let i = 0; i < tickets.length; i++) {
    const ticket = tickets[i];
    if (ticket.status === "error") {
      const errType = ticket.details?.error;
      if (errType === "DeviceNotRegistered") {
        await prisma.pushSubscription
          .update({
            where: { token: subs[i].token },
            data: { active: false },
          })
          .catch(() => null);
      }
    } else {
      await prisma.pushSubscription
        .update({
          where: { token: subs[i].token },
          data: { lastUsedAt: new Date() },
        })
        .catch(() => null);
    }
  }

  return NextResponse.json({
    ok: true,
    sent: tickets.length - errors.length,
    failed: errors.length,
    errors: errors.map((e) => e.message),
  });
}
