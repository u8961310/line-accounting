import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as { password?: string };
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    if (!body.password || body.password !== adminPassword) {
      return NextResponse.json({ error: "密碼錯誤" }, { status: 401 });
    }

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
