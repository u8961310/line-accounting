import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";
import { Client } from "@notionhq/client";
import { logAudit } from "@/lib/audit";
import { taipeiTodayAsUTC } from "@/lib/time";

export const dynamic = "force-dynamic";

const IMPULSE_CATEGORIES   = new Set(["娛樂", "購物", "餐飲", "飲食", "美容", "旅遊"]);
const ESSENTIAL_CATEGORIES = new Set(["居住", "水電", "通訊", "保險", "醫療", "交通"]);
const fmt = (n: number) => Math.round(n).toLocaleString("zh-TW");

/**
 * POST /api/cron/quarterly-personality-report
 * 每季 1 號（1/4/7/10 月）02:00 TWN 由 Cronicle 觸發
 * 分析上一季 3 個月消費性格並歸檔至 Notion
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 決定上一季範圍（台灣時間）
  const nowTW = taipeiTodayAsUTC();
  const yTW   = nowTW.getUTCFullYear();
  const mTW   = nowTW.getUTCMonth() + 1; // 1-12

  // 目前月份是季首（1/4/7/10），取「上一季」3 個月
  const quarterStartMonth = mTW - 3; // 上一季第一個月（1-based）
  const quarterYear       = quarterStartMonth < 1 ? yTW - 1 : yTW;
  const qm1               = ((quarterStartMonth - 1 + 12) % 12) + 1; // e.g. 10
  const qm3               = qm1 + 2;                                   // e.g. 12

  const start = new Date(Date.UTC(quarterYear, qm1 - 1, 1));
  const end   = new Date(Date.UTC(qm3 > 12 ? quarterYear + 1 : quarterYear, qm3 % 12, 1));

  const quarterLabel = `${quarterYear} Q${Math.ceil(qm1 / 3)}`;

  try {
    const user = await prisma.user.findFirst({ where: { lineUserId: "dashboard_user" } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const txs = await prisma.transaction.findMany({
      where: {
        userId: user.id,
        type:   "支出",
        date:   { gte: start, lt: end },
        NOT:    { category: "轉帳" },
      },
      select: { date: true, amount: true, category: true },
    });

    if (txs.length === 0) {
      return NextResponse.json({ ok: true, quarterLabel, skipped: "no data" });
    }

    // ── 分類統計 ────────────────────────────────────────────────────────────
    const catMap = new Map<string, number>();
    let totalExpense = 0;
    for (const tx of txs) {
      const amt = parseFloat(tx.amount.toString());
      catMap.set(tx.category, (catMap.get(tx.category) ?? 0) + amt);
      totalExpense += amt;
    }
    const topCategories = Array.from(catMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([category, amount]) => ({
        category,
        amount: Math.round(amount),
        pct:    Math.round((amount / totalExpense) * 100),
      }));

    let impulseTotal = 0, essentialTotal = 0;
    for (const [cat, amt] of Array.from(catMap.entries())) {
      if (IMPULSE_CATEGORIES.has(cat))   impulseTotal   += amt;
      if (ESSENTIAL_CATEGORIES.has(cat)) essentialTotal += amt;
    }
    const impulseRatio   = Math.round((impulseTotal   / totalExpense) * 100);
    const essentialRatio = Math.round((essentialTotal / totalExpense) * 100);
    const highRiskCats   = topCategories
      .filter(c => c.pct >= 30 || IMPULSE_CATEGORIES.has(c.category))
      .slice(0, 3)
      .map(c => c.category);

    // ── Claude AI 摘要 ───────────────────────────────────────────────────────
    const topCatText = topCategories.slice(0, 5)
      .map(c => `${c.category} NT$${fmt(c.amount)}（${c.pct}%）`)
      .join("、");

    const prompt = `你是一個直接、有洞察力的理財分析師，分析使用者 ${quarterLabel} 季的消費行為。

數據摘要：
- 季度總支出：NT$ ${fmt(totalExpense)}（共 ${txs.length} 筆）
- 前 5 大消費分類：${topCatText}
- 衝動消費佔比：${impulseRatio}%
- 必要支出佔比：${essentialRatio}%
- 高風險分類：${highRiskCats.join("、") || "無"}

請用繁體中文，生成：
1. 一段 50-70 字的「季度消費性格摘要」，語氣直接有洞察力
2. 3 條具體改善建議，每條 25-40 字，要有數字和具體行動

回覆格式（只回 JSON，不要加 markdown code block）：
{"summary":"摘要...","advice":["建議1...","建議2...","建議3..."]}`;

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    let summary = "";
    let advice: string[] = [];

    try {
      const res  = await client.messages.create({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 600,
        messages:   [{ role: "user", content: prompt }],
      });
      const text   = res.content[0].type === "text" ? res.content[0].text.trim() : "{}";
      const parsed = JSON.parse(text) as { summary?: string; advice?: string[] };
      summary = parsed.summary ?? "";
      advice  = parsed.advice  ?? [];
    } catch { /* AI 失敗不影響歸檔，以空摘要繼續 */ }

    // ── Notion 歸檔 ──────────────────────────────────────────────────────────
    if (!process.env.NOTION_QUARTERLY_REPORT_PAGE_ID || !process.env.NOTION_TOKEN) {
      return NextResponse.json({ ok: true, quarterLabel, skipped: "no Notion config", summary });
    }

    const notion = new Client({ auth: process.env.NOTION_TOKEN });
    const page = await notion.pages.create({
      parent:     { page_id: process.env.NOTION_QUARTERLY_REPORT_PAGE_ID },
      icon:       { type: "emoji", emoji: "🧠" },
      properties: {
        title: { title: [{ text: { content: `${quarterLabel} 消費性格報告` } }] },
      },
      children: [
        {
          object: "block", type: "callout",
          callout: {
            icon:      { type: "emoji", emoji: "📊" },
            color:     impulseRatio >= 40 ? "orange_background" : "green_background",
            rich_text: [{ type: "text", text: { content: `總支出 NT$${fmt(totalExpense)}　衝動消費 ${impulseRatio}%　必要支出 ${essentialRatio}%` } }],
          },
        },
        {
          object: "block", type: "heading_2",
          heading_2: { rich_text: [{ type: "text", text: { content: "🧠 消費性格摘要" } }] },
        },
        {
          object: "block", type: "paragraph",
          paragraph: { rich_text: [{ type: "text", text: { content: summary || "（無 AI 摘要）" } }] },
        },
        { object: "block", type: "divider", divider: {} },
        {
          object: "block", type: "heading_2",
          heading_2: { rich_text: [{ type: "text", text: { content: "🏆 前 5 大消費分類" } }] },
        },
        ...topCategories.slice(0, 5).map((c, i) => ({
          object: "block" as const, type: "bulleted_list_item" as const,
          bulleted_list_item: {
            rich_text: [{ type: "text" as const, text: { content: `${i + 1}. ${c.category}：NT$${fmt(c.amount)}（${c.pct}%）` } }],
          },
        })),
        { object: "block", type: "divider", divider: {} },
        {
          object: "block", type: "heading_2",
          heading_2: { rich_text: [{ type: "text", text: { content: "💡 改善建議" } }] },
        },
        ...advice.map(a => ({
          object: "block" as const, type: "bulleted_list_item" as const,
          bulleted_list_item: {
            rich_text: [{ type: "text" as const, text: { content: a } }],
          },
        })),
      ],
    } as Parameters<typeof notion.pages.create>[0]);

    const url = (page as { url?: string }).url;
    void logAudit({ action: "notion_sync", tool: "cron/quarterly-personality-report", summary: { quarterLabel, url } });

    return NextResponse.json({ ok: true, quarterLabel, url });
  } catch (e) {
    console.error("[cron/quarterly-personality-report]", e);
    void logAudit({
      action: "notion_sync",
      tool: "cron/quarterly-personality-report",
      status: "error",
      errorMsg: e instanceof Error ? e.message : "unknown",
    });
    return NextResponse.json({ error: "Quarterly report cron failed" }, { status: 500 });
  }
}
