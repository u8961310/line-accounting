import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const PAGE_SIZE = 50;

export async function GET(request: NextRequest) {
  const page   = parseInt(request.nextUrl.searchParams.get("page") ?? "1");
  const action = request.nextUrl.searchParams.get("action") ?? undefined;
  const skip   = (page - 1) * PAGE_SIZE;

  const where = action ? { action } : {};

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return NextResponse.json({ logs, total, page, pages: Math.ceil(total / PAGE_SIZE) });
}
