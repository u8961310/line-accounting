import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as { ids?: unknown };
    const ids  = body.ids;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "請提供至少一個交易 ID" }, { status: 400 });
    }

    // Validate all IDs are strings
    if (!ids.every((id): id is string => typeof id === "string")) {
      return NextResponse.json({ error: "ID 格式錯誤" }, { status: 400 });
    }

    const { count } = await prisma.transaction.deleteMany({
      where: { id: { in: ids } },
    });

    void logAudit({
      action:  "transaction_delete",
      tool:    "batch",
      summary: { ids, count },
    });

    return NextResponse.json({ success: true, deleted: count });
  } catch (e) {
    console.error("[batch-delete]", e);
    return NextResponse.json({ error: "批量刪除失敗" }, { status: 500 });
  }
}
