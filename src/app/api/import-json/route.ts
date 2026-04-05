import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

interface BackupRow {
  date:     string;
  type:     string;
  category: string;
  amount:   number;
  note:     string;
  source:   string;
  mood?:    string | null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as { rows: BackupRow[] };
    const { rows } = body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "JSON 格式錯誤或沒有資料" }, { status: 400 });
    }

    const user = await prisma.user.findFirst({ where: { lineUserId: "dashboard_user" } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    let imported = 0;
    let skipped  = 0;

    for (const row of rows) {
      if (!row.date || !row.type || !row.category || row.amount == null) { skipped++; continue; }
      const date   = new Date(row.date);
      if (isNaN(date.getTime())) { skipped++; continue; }
      const amount = parseFloat(String(row.amount));
      if (isNaN(amount) || amount <= 0) { skipped++; continue; }
      const source = row.source || "manual";

      try {
        await prisma.transaction.create({
          data: {
            userId:   user.id,
            date,
            type:     row.type,
            category: row.category,
            amount,
            note:     row.note ?? "",
            source,
            ...(row.mood ? { mood: row.mood } : {}),
          },
        });
        imported++;
      } catch {
        // unique constraint violation = duplicate, skip
        skipped++;
      }
    }

    void logAudit({
      action:  "json_restore",
      tool:    "import-json",
      params:  { totalRows: rows.length },
      summary: { imported, skipped },
    });

    return NextResponse.json({ ok: true, imported, skipped });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
