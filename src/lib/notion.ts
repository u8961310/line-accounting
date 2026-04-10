import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

function getNotionClient(): Client {
  return new Client({ auth: process.env.NOTION_TOKEN });
}

// ── Subscriptions ────────────────────────────────────────────────────────────

export interface SubItem {
  id:              string;
  name:            string;
  startDate:       string | null;
  nextBillingDate: string | null;
  paymentMethod:   string;
  tags:            string[];
  cycle:           string;
  fee:             number;
  monthlyAmount:   number;
  totalSpent:      number;
}

const _MONTHLY_CYCLES = new Set(["每月", "月繳", "月付", "月"]);
const _YEARLY_CYCLES  = new Set(["每年", "年繳", "年付", "年"]);

function calcNextBillingDate(startDate: string | null, cycle: string): string | null {
  if (!startDate) return null;
  const start = new Date(startDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (_MONTHLY_CYCLES.has(cycle)) {
    const day = start.getDate();
    let next = new Date(today.getFullYear(), today.getMonth(), day);
    if (next <= today) next = new Date(today.getFullYear(), today.getMonth() + 1, day);
    return next.toISOString().split("T")[0];
  }

  if (_YEARLY_CYCLES.has(cycle)) {
    let next = new Date(today.getFullYear(), start.getMonth(), start.getDate());
    if (next <= today) next = new Date(today.getFullYear() + 1, start.getMonth(), start.getDate());
    return next.toISOString().split("T")[0];
  }

  return null;
}

function extractNumber(prop: unknown): number {
  if (!prop || typeof prop !== "object") return 0;
  const p = prop as Record<string, unknown>;
  if (p.type === "number")  return (p.number  as number) ?? 0;
  if (p.type === "formula") {
    const f = p.formula as Record<string, unknown>;
    if (f.type === "number") return (f.number as number) ?? 0;
  }
  return 0;
}

export async function getSubscriptionsFromNotion(): Promise<SubItem[]> {
  if (!process.env.NOTION_TOKEN || !process.env.NOTION_SUBSCRIPTIONS_DB_ID) return [];

  const notion = getNotionClient();
  const databaseId = process.env.NOTION_SUBSCRIPTIONS_DB_ID;
  const results: SubItem[] = [];
  let cursor: string | undefined;

  do {
    const response = await notion.databases.query({
      database_id: databaseId,
      start_cursor: cursor,
      page_size: 100,
    });

    for (const page of response.results) {
      if (page.object !== "page") continue;
      const p = (page as PageObjectResponse).properties;

      const titleProp = p["產品"];
      const name = titleProp?.type === "title"
        ? titleProp.title.map(t => t.plain_text).join("")
        : "";

      const dateProp = p["訂閱開始日"];
      const startDate = dateProp?.type === "date" ? (dateProp.date?.start ?? null) : null;

      const paymentProp = p["付款方式"];
      const paymentMethod = paymentProp?.type === "select" ? (paymentProp.select?.name ?? "") : "";

      const tagsProp = p["分類標籤"];
      const tags = tagsProp?.type === "multi_select" ? tagsProp.multi_select.map(t => t.name) : [];

      const cycleProp = p["訂閱週期"];
      const cycle = cycleProp?.type === "select" ? (cycleProp.select?.name ?? "") : "";

      // 已取消訂閱 → 跳過
      const cancelledProp = p["取消訂閱"];
      const cancelled = cancelledProp?.type === "checkbox" ? cancelledProp.checkbox : false;
      if (cancelled) continue;

      results.push({
        id:              page.id,
        name,
        startDate,
        nextBillingDate: calcNextBillingDate(startDate, cycle),
        paymentMethod,
        tags,
        cycle,
        fee:           extractNumber(p["訂閱費"]),
        monthlyAmount: extractNumber(p["每月金額"]),
        totalSpent:    extractNumber(p["總計花費"]),
      });
    }

    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return results.sort((a, b) => b.monthlyAmount - a.monthlyAmount);
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

// ── 異常支出警示 ──────────────────────────────────────────────────────────────

export async function appendAnomalyAlert(
  month: string,
  anomalies: { category: string; current: number; mean: number; zscore: number }[],
): Promise<void> {
  if (!process.env.NOTION_TOKEN || !process.env.NOTION_ANOMALY_PAGE_ID || anomalies.length === 0) return;
  const notion = getNotionClient();
  const fmt = (n: number) => `NT$${Math.round(n).toLocaleString("zh-TW")}`;
  try {
    await (notion.blocks.children.append as (args: unknown) => Promise<unknown>)({
      block_id: process.env.NOTION_ANOMALY_PAGE_ID,
      children: [
        {
          object: "block", type: "heading_3",
          heading_3: { rich_text: [{ type: "text", text: { content: `⚠️ ${month} 異常支出` } }] },
        },
        ...anomalies.map(a => ({
          object: "block", type: "bulleted_list_item",
          bulleted_list_item: {
            rich_text: [{
              type: "text",
              text: { content: `${a.category}：${fmt(a.current)}（平均 ${fmt(a.mean)}，z-score ${a.zscore.toFixed(1)}）` },
            }],
          },
        })),
        { object: "block", type: "paragraph", paragraph: { rich_text: [] } },
      ],
    });
  } catch (e) {
    console.error("[notion] appendAnomalyAlert error:", e);
  }
}

// ── 目標達成里程碑歸檔 ────────────────────────────────────────────────────────

export async function archiveGoalMilestone(data: {
  name:          string;
  emoji:         string;
  targetAmount:  number;
  savedAmount:   number;
  monthsToReach: number;
  note:          string;
}): Promise<void> {
  if (!process.env.NOTION_TOKEN || !process.env.NOTION_MILESTONES_PAGE_ID) return;
  const notion = getNotionClient();
  const fmt = (n: number) => `NT$${Math.round(n).toLocaleString("zh-TW")}`;
  const today = new Date().toISOString().slice(0, 10);
  try {
    await notion.pages.create({
      parent: { page_id: process.env.NOTION_MILESTONES_PAGE_ID },
      icon:   { type: "emoji", emoji: data.emoji as never },
      properties: {
        title: { title: [{ text: { content: `🎉 達成：${data.name}` } }] },
      },
      children: [
        {
          object: "block", type: "callout",
          callout: {
            icon: { type: "emoji", emoji: "🎯" },
            color: "green_background",
            rich_text: [{
              type: "text",
              text: { content: `目標金額 ${fmt(data.targetAmount)}　達成日期 ${today}　耗時 ${data.monthsToReach} 個月` },
            }],
          },
        },
        ...(data.note ? [{
          object: "block" as const, type: "paragraph" as const,
          paragraph: { rich_text: [{ type: "text" as const, text: { content: data.note } }] },
        }] : []),
      ],
    } as Parameters<typeof notion.pages.create>[0]);
  } catch (e) {
    console.error("[notion] archiveGoalMilestone error:", e);
  }
}

// ── 訂閱漲價標註 ──────────────────────────────────────────────────────────────

export async function appendSubscriptionPriceChange(
  subPageId: string,
  month:     string,
  oldFee:    number,
  newAmount: number,
): Promise<void> {
  if (!process.env.NOTION_TOKEN) return;
  const notion = getNotionClient();
  const diff = Math.round(newAmount - oldFee);
  const sign = diff > 0 ? "+" : "";
  try {
    await (notion.blocks.children.append as (args: unknown) => Promise<unknown>)({
      block_id: subPageId,
      children: [{
        object: "block", type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: [{
            type: "text",
            text: { content: `${month} 漲價 NT$${sign}${diff}（原 NT$${Math.round(oldFee)}，實扣 NT$${Math.round(newAmount)}）` },
            annotations: { color: "red" },
          }],
        },
      }],
    });
  } catch (e) {
    console.error("[notion] appendSubscriptionPriceChange error:", e);
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
