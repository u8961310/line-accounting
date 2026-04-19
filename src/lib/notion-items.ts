/**
 * 生活物品管理：Notion 資料來源（kogao-app / kogao-os 共用）
 *
 * 從 kogao-os/lib/notion-items.ts 複製過來。
 * 狀態（overdue/soon/normal）在 lib 內計算，不依賴 Notion Formula。
 */

import { Client } from "@notionhq/client";
import { taipeiToday } from "./time";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

function getDbId(): string {
  const id = process.env.NOTION_ITEMS_DB_ID;
  if (!id) throw new Error("NOTION_ITEMS_DB_ID 未設定");
  return id;
}

export type ItemStatus = "overdue" | "soon" | "normal";

export interface LifeItem {
  id:                  string;
  name:                string;
  category:            string;
  location:            string;
  lastRefillDate:      string;
  refillQuantity:      number;
  daysPerUnit:         number;
  cycleDays:           number;
  estimatedRunoutDate: string;
  daysLeft:            number;
  estimatedRemaining:  number;
  status:              ItemStatus;
  buyUrl:              string | null;
  unitPrice:           number | null;
  note:                string | null;
}

function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

function daysBetween(fromYmd: string, toYmd: string): number {
  const a = new Date(`${fromYmd}T00:00:00Z`).getTime();
  const b = new Date(`${toYmd}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function pickTitle(prop: any): string {
  return prop?.title?.map((t: any) => t.plain_text).join("") ?? "";
}
function pickRichText(prop: any): string {
  return prop?.rich_text?.map((t: any) => t.plain_text).join("") ?? "";
}
function pickSelect(prop: any): string {
  return prop?.select?.name ?? "";
}
function pickNumber(prop: any): number {
  return typeof prop?.number === "number" ? prop.number : 0;
}
function pickDate(prop: any): string {
  return prop?.date?.start ?? "";
}
function pickUrl(prop: any): string | null {
  return prop?.url ?? null;
}

function computeStatus(item: Omit<LifeItem, "status">): ItemStatus {
  if (item.daysLeft < 0) return "overdue";
  if (item.daysLeft < 14) return "soon";
  return "normal";
}

function buildItem(page: any): LifeItem {
  const props = page.properties;
  const name = pickTitle(props["名稱"]);
  const category = pickSelect(props["分類"]);
  const location = pickSelect(props["位置"]);
  const lastRefillDate = pickDate(props["上次補貨日"]);
  const refillQuantity = pickNumber(props["補貨數量"]) || 1;
  const daysPerUnit = pickNumber(props["每份可用天數"]) || 1;
  const cycleDays = refillQuantity * daysPerUnit;
  const today = taipeiToday();

  const estimatedRunoutDate = lastRefillDate ? addDays(lastRefillDate, cycleDays) : today;
  const daysLeft = lastRefillDate ? daysBetween(today, estimatedRunoutDate) : 0;
  const usedUnits = lastRefillDate ? Math.floor(daysBetween(lastRefillDate, today) / daysPerUnit) : 0;
  const estimatedRemaining = Math.max(0, refillQuantity - usedUnits);

  const partial = {
    id: page.id,
    name,
    category,
    location,
    lastRefillDate,
    refillQuantity,
    daysPerUnit,
    cycleDays,
    estimatedRunoutDate,
    daysLeft,
    estimatedRemaining,
    buyUrl: pickUrl(props["購買連結"]),
    unitPrice: typeof props["單價"]?.number === "number" ? props["單價"].number : null,
    note: pickRichText(props["備註"]) || null,
  };

  return { ...partial, status: computeStatus(partial) };
}

export async function listLifeItems(): Promise<LifeItem[]> {
  const res = await notion.databases.query({
    database_id: getDbId(),
    page_size: 100,
  });
  const items = res.results.map(buildItem);
  items.sort((a, b) => a.daysLeft - b.daysLeft);
  return items;
}

export async function refillLifeItem(id: string, refillQuantity?: number): Promise<void> {
  const properties: Record<string, any> = {
    "上次補貨日": { date: { start: taipeiToday() } },
  };
  if (typeof refillQuantity === "number" && refillQuantity > 0) {
    properties["補貨數量"] = { number: refillQuantity };
  }
  await notion.pages.update({ page_id: id, properties });
}
