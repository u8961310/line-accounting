import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import crypto from "crypto";

export const dynamic = "force-dynamic";

// ── In-memory rate limiter ────────────────────────────────────────────────────
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 10;
const WINDOW_MS    = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(ip: string): boolean {
  const now   = Date.now();
  const entry = loginAttempts.get(ip);

  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false; // not limited
  }

  entry.count++;
  return entry.count > MAX_ATTEMPTS;
}

function resetRateLimit(ip: string): void {
  loginAttempts.delete(ip);
}

// ── Route handlers ────────────────────────────────────────────────────────────
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

    if (checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "嘗試次數過多，請 15 分鐘後再試" },
        { status: 429 },
      );
    }

    const body = await request.json() as { password?: string };
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    if (!body.password) {
      return NextResponse.json({ error: "密碼錯誤" }, { status: 401 });
    }

    // Timing-safe comparison — prevents timing-based password oracle attacks
    const inputBuf = Buffer.from(body.password);
    const adminBuf = Buffer.from(adminPassword);
    const match =
      inputBuf.length === adminBuf.length &&
      crypto.timingSafeEqual(inputBuf, adminBuf);

    if (!match) {
      return NextResponse.json({ error: "密碼錯誤" }, { status: 401 });
    }

    resetRateLimit(ip);

    const session = await getSession();
    session.isLoggedIn = true;
    await session.save();

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "登入失敗" }, { status: 500 });
  }
}

export async function DELETE(): Promise<NextResponse> {
  const session = await getSession();
  session.destroy();
  return NextResponse.json({ ok: true });
}
