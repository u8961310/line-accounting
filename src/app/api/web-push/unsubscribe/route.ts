import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/web-push/unsubscribe
 * 瀏覽器主動取消訂閱時呼叫，將對應 endpoint 標記為 inactive（不刪）。
 * 驗證：middleware 的 x-api-key: INTERNAL_API_KEY
 * Body: { endpoint }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { endpoint } = body as { endpoint?: string };
  if (!endpoint) {
    return NextResponse.json({ error: "endpoint is required" }, { status: 400 });
  }

  await prisma.webPushSubscription
    .update({
      where: { endpoint },
      data: { active: false },
    })
    .catch(() => null);

  return NextResponse.json({ ok: true });
}
