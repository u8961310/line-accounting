import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isValidExpoPushToken } from "@/lib/expo-push";

export const dynamic = "force-dynamic";

/**
 * POST /api/push/subscribe
 * 由 kogao-app 呼叫，註冊或更新 Expo Push Token。
 * 驗證：middleware 的 x-api-key: INTERNAL_API_KEY
 * Body: { token, platform, deviceInfo? }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { token, platform, deviceInfo } = body as {
    token?: string;
    platform?: string;
    deviceInfo?: Record<string, unknown>;
  };

  if (!token || !isValidExpoPushToken(token)) {
    return NextResponse.json({ error: "Invalid Expo push token" }, { status: 400 });
  }

  if (platform !== "ios" && platform !== "android") {
    return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
  }

  const sub = await prisma.pushSubscription.upsert({
    where: { token },
    create: {
      token,
      platform,
      deviceInfo: deviceInfo ?? undefined,
      active: true,
    },
    update: {
      platform,
      deviceInfo: deviceInfo ?? undefined,
      active: true,
      lastUsedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, id: sub.id });
}
