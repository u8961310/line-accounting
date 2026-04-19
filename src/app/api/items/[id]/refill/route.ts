import { NextRequest, NextResponse } from "next/server";
import { refillLifeItem } from "@/lib/notion-items";

export const dynamic = "force-dynamic";

/**
 * POST /api/items/[id]/refill
 * 把物品的「上次補貨日」更新為今天，選填更新補貨數量。
 * 驗證：middleware INTERNAL_API_KEY
 * Body: { refillQuantity?: number }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  if (!process.env.NOTION_TOKEN || !process.env.NOTION_ITEMS_DB_ID) {
    return NextResponse.json({ error: "notion-not-configured" }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const refillQuantity = typeof body?.refillQuantity === "number" ? body.refillQuantity : undefined;

  try {
    await refillLifeItem(params.id, refillQuantity);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[POST /api/items/:id/refill]", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
