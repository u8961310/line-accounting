import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const user = await prisma.user.findUnique({ where: { lineUserId: "dashboard_user" } });
    if (!user) return NextResponse.json({ rules: [] });

    const rules = await prisma.categoryRule.findMany({
      where: { userId: user.id },
      orderBy: [{ hitCount: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ rules });
  } catch (e) {
    console.error("[category-rules GET]", e);
    return NextResponse.json({ error: "操作失敗" }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { keyword, category, source } = await request.json() as {
      keyword: string; category: string; source?: string;
    };
    if (!keyword?.trim() || !category?.trim()) {
      return NextResponse.json({ error: "keyword 與 category 必填" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { lineUserId: "dashboard_user" } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const rule = await prisma.categoryRule.upsert({
      where: { userId_keyword: { userId: user.id, keyword: keyword.trim() } },
      update: { category: category.trim(), source: source ?? null },
      create: { userId: user.id, keyword: keyword.trim(), category: category.trim(), source: source ?? null },
    });

    return NextResponse.json({ rule });
  } catch (e) {
    console.error("[category-rules POST]", e);
    return NextResponse.json({ error: "操作失敗" }, { status: 500 });
  }
}
