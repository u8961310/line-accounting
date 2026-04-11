import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const user = await prisma.user.findFirst({ where: { lineUserId: "dashboard_user" } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const streak = await prisma.userStreak.findUnique({ where: { userId: user.id } });

    return NextResponse.json({
      currentStreak:  streak?.currentStreak  ?? 0,
      longestStreak:  streak?.longestStreak  ?? 0,
      lastRecordDate: streak?.lastRecordDate ?? null,
    });
  } catch (e) {
    console.error("[streak]", e);
    return NextResponse.json({ error: "操作失敗" }, { status: 500 });
  }
}
