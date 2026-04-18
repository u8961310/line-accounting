import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await prisma.user.findFirst({
      where: { lineUserId: "dashboard_user" },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const weekParam = request.nextUrl.searchParams.get("week");

    const review = await prisma.weeklyReview.findFirst({
      where: weekParam
        ? { userId: user.id, week: weekParam }
        : { userId: user.id },
      orderBy: { week: "desc" },
    });

    if (!review) {
      return NextResponse.json({ week: null });
    }

    return NextResponse.json({
      week: review.week,
      summary: review.summary,
      meta: review.meta,
      createdAt: review.createdAt.toISOString(),
    });
  } catch (e) {
    console.error("[GET /api/weekly-review]", e);
    return NextResponse.json({ error: "操作失敗" }, { status: 500 });
  }
}
