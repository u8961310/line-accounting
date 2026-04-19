import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/web-push/subscribe
 * 由 kogao-os proxy 呼叫，註冊瀏覽器 push subscription。
 * 驗證：middleware 的 x-api-key: INTERNAL_API_KEY
 * Body: { endpoint, keys: { p256dh, auth }, userAgent? }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { endpoint, keys, userAgent } = body as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
    userAgent?: string;
  };

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json(
      { error: "endpoint and keys.{p256dh,auth} are required" },
      { status: 400 }
    );
  }

  const sub = await prisma.webPushSubscription.upsert({
    where: { endpoint },
    create: {
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: userAgent ?? null,
      active: true,
    },
    update: {
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: userAgent ?? null,
      active: true,
      lastUsedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, id: sub.id });
}
