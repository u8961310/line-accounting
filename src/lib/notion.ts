import { Client } from "@notionhq/client";

function getNotionClient(): Client {
  return new Client({ auth: process.env.NOTION_TOKEN });
}

export interface TransactionRecord {
  id: string;
  date: Date;
  amount: number;
  category: string;
  type: string;
  note: string;
  source: string;
}

/**
 * 將單筆交易同步至 Notion 資料庫
 */
export async function syncTransactionToNotion(tx: TransactionRecord): Promise<void> {
  if (!process.env.NOTION_TOKEN || !process.env.NOTION_TRANSACTIONS_DB_ID) return;

  const notion = getNotionClient();
  const databaseId = process.env.NOTION_TRANSACTIONS_DB_ID;

  try {
    const name = tx.note || tx.category;
    await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        名稱: { title: [{ text: { content: name } }] },
        金額: { number: tx.amount },
        類型: { select: { name: tx.type } },
        分類: { select: { name: tx.category } },
        日期: { date: { start: tx.date.toISOString().split("T")[0] } },
        來源: { select: { name: tx.source } },
      },
    } as Parameters<typeof notion.pages.create>[0]);
  } catch (e) {
    console.error("[notion] syncTransactionToNotion error:", e);
  }
}

export interface WorthSnapshot {
  totalAssets: number;
  totalDebt: number;
  netWorth: number;
}

/**
 * 將資產/負債/儲蓄金快照寫入 Notion 資料庫（一天一筆）
 */
export async function syncWorthToNotion(snapshot: WorthSnapshot): Promise<void> {
  if (!process.env.NOTION_TOKEN || !process.env.NOTION_NET_WORTH_DB_ID) return;

  const notion = getNotionClient();
  const databaseId = process.env.NOTION_NET_WORTH_DB_ID;
  const today = new Date().toISOString().split("T")[0];

  // 若今天已有紀錄則更新，否則新增
  const existing = await notion.databases.query({
    database_id: databaseId,
    filter: { property: "日期", date: { equals: today } },
  });

  const properties = {
    日期:  { title: [{ text: { content: today } }] },
    資產:  { number: Math.round(snapshot.totalAssets) },
    負債:  { number: Math.round(snapshot.totalDebt) },
    儲蓄金: { number: Math.round(snapshot.netWorth) },
  };

  if (existing.results.length > 0) {
    await notion.pages.update({ page_id: existing.results[0].id, properties } as Parameters<typeof notion.pages.update>[0]);
  } else {
    await notion.pages.create({ parent: { database_id: databaseId }, properties } as Parameters<typeof notion.pages.create>[0]);
  }
}
