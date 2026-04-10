import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Client } from "@notionhq/client";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * POST /api/cron/annual-report
 * 每年 1/1 由 Cronicle 觸發，將上一年度年報歸檔至 Notion。
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const year = new Date().getFullYear() - 1;

  try {
    const user = await prisma.user.findFirst({ where: { lineUserId: "dashboard_user" } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const startDate = new Date(year, 0, 1);
    const endDate   = new Date(year + 1, 0, 1);

    const transactions = await prisma.transaction.findMany({
      where: { userId: user.id, date: { gte: startDate, lt: endDate }, NOT: { category: "轉帳" } },
      orderBy: { date: "asc" },
    });

    const fmt = (n: number) => `NT$${Math.round(n).toLocaleString()}`;

    // ── 月度摘要 ──
    const monthlyMap = new Map<string, { income: number; expense: number }>();
    for (let mo = 1; mo <= 12; mo++) {
      monthlyMap.set(`${year}-${String(mo).padStart(2, "0")}`, { income: 0, expense: 0 });
    }
    for (const tx of transactions) {
      const key   = tx.date.toISOString().slice(0, 7);
      const entry = monthlyMap.get(key) ?? { income: 0, expense: 0 };
      const amt   = parseFloat(tx.amount.toString());
      if (tx.type === "收入") entry.income  += amt;
      else                    entry.expense += amt;
      monthlyMap.set(key, entry);
    }
    const monthly = Array.from(monthlyMap.entries()).sort(([a], [b]) => a.localeCompare(b));

    // ── 年度總計 ──
    const totalIncome  = transactions.filter(t => t.type === "收入").reduce((s, t) => s + parseFloat(t.amount.toString()), 0);
    const totalExpense = transactions.filter(t => t.type === "支出").reduce((s, t) => s + parseFloat(t.amount.toString()), 0);
    const savingsRate  = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome * 100).toFixed(1) : "N/A";

    // ── Top 5 支出分類 ──
    const catMap = new Map<string, number>();
    for (const tx of transactions.filter(t => t.type === "支出")) {
      catMap.set(tx.category, (catMap.get(tx.category) ?? 0) + parseFloat(tx.amount.toString()));
    }
    const topExpenses = Array.from(catMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

    // ── 最佳/最差月份 ──
    const activeMths = monthly.filter(([, d]) => d.income > 0 || d.expense > 0);
    const peakExpense   = activeMths.length ? activeMths.reduce((a, b) => b[1].expense > a[1].expense ? b : a) : null;
    const bestSavings   = activeMths.filter(([, d]) => d.income > 0)
      .reduce<[string, { income: number; expense: number }] | null>((a, b) => {
        const rA = a ? (a[1].income - a[1].expense) / a[1].income : -Infinity;
        const rB = (b[1].income - b[1].expense) / b[1].income;
        return rB > rA ? b : a;
      }, null);

    if (!process.env.NOTION_ANNUAL_REPORT_PAGE_ID || !process.env.NOTION_TOKEN) {
      return NextResponse.json({ ok: true, year, skipped: "no Notion config" });
    }

    const notion = new Client({ auth: process.env.NOTION_TOKEN });

    const page = await notion.pages.create({
      parent: { page_id: process.env.NOTION_ANNUAL_REPORT_PAGE_ID },
      icon:   { type: "emoji", emoji: "📅" },
      properties: {
        title: { title: [{ text: { content: `${year} 年度財報` } }] },
      },
      children: [
        {
          object: "block", type: "callout",
          callout: {
            icon: { type: "emoji", emoji: "📊" },
            color: parseFloat(savingsRate) >= 20 ? "green_background" : "orange_background",
            rich_text: [{ type: "text", text: { content: `${year} 年　收入 ${fmt(totalIncome)}　支出 ${fmt(totalExpense)}　儲蓄率 ${savingsRate}%` } }],
          },
        },
        { object: "block", type: "divider", divider: {} },
        {
          object: "block", type: "heading_2",
          heading_2: { rich_text: [{ type: "text", text: { content: "📅 月度趨勢" } }] },
        },
        ...monthly.map(([mo, d]) => ({
          object: "block" as const, type: "bulleted_list_item" as const,
          bulleted_list_item: {
            rich_text: [{
              type: "text" as const,
              text: { content: `${mo}　收 ${fmt(d.income)}　支 ${fmt(d.expense)}　淨 ${fmt(d.income - d.expense)}` },
            }],
          },
        })),
        { object: "block", type: "divider", divider: {} },
        {
          object: "block", type: "heading_2",
          heading_2: { rich_text: [{ type: "text", text: { content: "🏆 支出前 5 大分類" } }] },
        },
        ...topExpenses.map(([cat, amt], i) => ({
          object: "block" as const, type: "bulleted_list_item" as const,
          bulleted_list_item: {
            rich_text: [{ type: "text" as const, text: { content: `${i + 1}. ${cat}：${fmt(amt)}` } }],
          },
        })),
        { object: "block", type: "divider", divider: {} },
        {
          object: "block", type: "heading_2",
          heading_2: { rich_text: [{ type: "text", text: { content: "🔍 年度亮點" } }] },
        },
        ...[
          peakExpense  ? `支出最高月：${peakExpense[0]}（${fmt(peakExpense[1].expense)}）` : null,
          bestSavings  ? `最佳儲蓄月：${bestSavings[0]}（${((bestSavings[1].income - bestSavings[1].expense) / bestSavings[1].income * 100).toFixed(1)}%）` : null,
          `全年交易筆數：${transactions.length} 筆`,
        ].filter(Boolean).map(text => ({
          object: "block" as const, type: "bulleted_list_item" as const,
          bulleted_list_item: {
            rich_text: [{ type: "text" as const, text: { content: text! } }],
          },
        })),
      ],
    } as Parameters<typeof notion.pages.create>[0]);

    const url = (page as { url?: string }).url;
    void logAudit({ action: "notion_sync", tool: "cron/annual-report", summary: { year, url } });

    return NextResponse.json({ ok: true, year, url });
  } catch (e) {
    console.error("[cron/annual-report]", e);
    void logAudit({ action: "notion_sync", tool: "cron/annual-report", status: "error", errorMsg: e instanceof Error ? e.message : "unknown" });
    return NextResponse.json({ error: "Annual report cron failed" }, { status: 500 });
  }
}
