import { NextResponse } from "next/server";
import { listLifeItems } from "@/lib/notion-items";

export const dynamic = "force-dynamic";

/**
 * GET /api/items
 * 取得生活物品清單（來自 Notion），按剩餘天數升冪排序。
 * 驗證：middleware INTERNAL_API_KEY
 */
export async function GET(): Promise<NextResponse> {
  if (!process.env.NOTION_TOKEN || !process.env.NOTION_ITEMS_DB_ID) {
    return NextResponse.json({ items: [], error: "notion-not-configured" });
  }
  try {
    const items = await listLifeItems();
    return NextResponse.json({ items });
  } catch (e) {
    console.error("[GET /api/items]", e);
    return NextResponse.json(
      { items: [], error: (e as Error).message },
      { status: 500 }
    );
  }
}
