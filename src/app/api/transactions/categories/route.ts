import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await prisma.user.findFirst({ where: { lineUserId: "dashboard_user" } });
    if (!user) return NextResponse.json([]);

    const rows = await prisma.transaction.findMany({
      where: { userId: user.id },
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    });

    return NextResponse.json(rows.map(r => r.category));
  } catch (e) {
    console.error(e);
    return NextResponse.json([]);
  }
}
