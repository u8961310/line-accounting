import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";

export const dynamic = "force-dynamic";

/**
 * GET /api/journal?date=YYYY-MM-DD
 * 從 Notion DB 讀取該日的蛋小糕日記。
 * 驗證：middleware INTERNAL_API_KEY
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = process.env.NOTION_TOKEN;
  const dbId = process.env.NOTION_DIARY_DB_ID;

  if (!token || !dbId) {
    return NextResponse.json(
      { error: "NOTION_TOKEN 或 NOTION_DIARY_DB_ID 未設定" },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "需要 date 參數（YYYY-MM-DD）" }, { status: 400 });
  }

  try {
    const notion = new Client({ auth: token });

    // 先找 DB 的 Date property 名稱
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await notion.databases.retrieve({ database_id: dbId })) as any;
    const props = db.properties as Record<string, { type: string; id: string }>;
    let dateProp: string | null = null;
    let titleProp: string | null = null;
    for (const [name, def] of Object.entries(props)) {
      if (def.type === "date" && !dateProp) dateProp = name;
      if (def.type === "title" && !titleProp) titleProp = name;
    }

    // 優先用 Date property 查，如無則用 title 包含日期
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: any = dateProp
      ? { property: dateProp, date: { equals: date } }
      : titleProp
      ? { property: titleProp, title: { contains: date } }
      : null;

    if (!filter) {
      return NextResponse.json({ date, content: null, notionUrl: null });
    }

    const query = await notion.databases.query({
      database_id: dbId,
      filter,
      page_size: 1,
    });

    const page = query.results[0];
    if (!page) {
      return NextResponse.json({ date, content: null, notionUrl: null });
    }

    // 讀取 page blocks
    const blocks = await notion.blocks.children.list({
      block_id: page.id,
      page_size: 100,
    });

    const paragraphs: string[] = [];
    for (const block of blocks.results) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const b = block as any;
      if (b.type === "paragraph") {
        const text = (b.paragraph.rich_text as { plain_text: string }[])
          .map((t) => t.plain_text)
          .join("");
        if (text.trim()) paragraphs.push(text);
      }
    }

    return NextResponse.json({
      date,
      content: paragraphs.join("\n\n"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      notionUrl: (page as any).url ?? null,
    });
  } catch (e) {
    console.error("[GET /api/journal]", e);
    return NextResponse.json(
      { error: (e as Error).message ?? "讀取失敗" },
      { status: 500 }
    );
  }
}
