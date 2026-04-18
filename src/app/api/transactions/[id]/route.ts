import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { extractKeyword } from "@/lib/category-rules";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tx = await prisma.transaction.findUnique({
      where: { id: params.id },
      select: { date: true, type: true, amount: true, category: true, note: true },
    });
    await prisma.transaction.delete({ where: { id: params.id } });
    void logAudit({
      action:  "transaction_delete",
      summary: { id: params.id, ...tx },
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json() as { category?: string; type?: string; mood?: string | null; note?: string; amount?: number; date?: string };
    const data: { category?: string; type?: string; mood?: string | null; note?: string; amount?: number; date?: Date } = {};
    if (body.category !== undefined) data.category = body.category;
    if (body.type     !== undefined) data.type     = body.type;
    if (body.mood     !== undefined) data.mood     = body.mood;
    if (body.note     !== undefined) data.note     = body.note;
    if (body.amount   !== undefined && body.amount > 0) data.amount = body.amount;
    if (body.date     !== undefined) {
      const d = new Date(body.date);
      if (isNaN(d.getTime())) {
        return NextResponse.json({ error: "Invalid date" }, { status: 400 });
      }
      data.date = d;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const tx = await prisma.transaction.update({
      where: { id: params.id },
      data,
      select: { id: true, category: true, type: true, mood: true, note: true, amount: true, source: true },
    });

    // 若使用者手動改了 category，且 note 有內容 → 自動寫入分類規則
    if (body.category && tx.note.trim()) {
      const user = await prisma.user.findFirst({ where: { lineUserId: "dashboard_user" } });
      if (user) {
        const keyword = extractKeyword(tx.note);
        if (keyword) {
          void prisma.categoryRule.upsert({
            where: { userId_keyword: { userId: user.id, keyword } },
            update: { category: tx.category },
            create: { userId: user.id, keyword, category: tx.category, source: null },
          }).catch(console.error);
        }
      }
    }

    return NextResponse.json(tx);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
