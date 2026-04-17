import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";
import { Client } from "@notionhq/client";
import {
  appendAnomalyAlert,
  appendSubscriptionPriceChange,
  getSubscriptionsFromNotion,
} from "@/lib/notion";
import { logAudit } from "@/lib/audit";
import { taipeiTodayAsUTC } from "@/lib/time";
import { WARM_INSIGHT_SYSTEM_PROMPT, buildWarmInsightUserPrompt } from "@/lib/ai-insight";

export const dynamic = "force-dynamic";

/**
 * POST /api/cron/monthly-report
 * 每月 1 號由 Cronicle 觸發，執行三項自動整合：
 *   1. AI 月報歸檔 → Notion 財務月報
 *   2. 異常支出 → Notion 財務警示
 *   3. 訂閱漲價偵測 → Notion 訂閱 DB 標註
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 取「上個月」以台灣時區為準
  const nowTW = taipeiTodayAsUTC();
  const prevD = new Date(Date.UTC(nowTW.getUTCFullYear(), nowTW.getUTCMonth() - 1, 1));
  const month = `${prevD.getUTCFullYear()}-${String(prevD.getUTCMonth() + 1).padStart(2, "0")}`;

  const result: Record<string, unknown> = { month };

  try {
    const user = await prisma.user.findFirst({ where: { lineUserId: "dashboard_user" } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const [y, m] = month.split("-").map(Number);
    const curStart = new Date(y, m - 1, 1);
    const curEnd   = new Date(y, m, 1);
    const prevStart = new Date(y, m - 2, 1);
    const prevEnd   = new Date(y, m - 1, 1);

    // ── 1. 財務資料 ──────────────────────────────────────────────────────────
    const [currentSpending, incomeRows, budgets, goals, prevSpending] = await Promise.all([
      prisma.transaction.groupBy({
        by: ["category"],
        where: { userId: user.id, type: "支出", category: { not: "轉帳" }, date: { gte: curStart, lt: curEnd } },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { userId: user.id, type: "收入", date: { gte: curStart, lt: curEnd } },
        _sum: { amount: true },
      }),
      prisma.budget.findMany({ where: { userId: user.id } }),
      prisma.financialGoal.findMany({ where: { userId: user.id } }),
      prisma.transaction.groupBy({
        by: ["category"],
        where: { userId: user.id, type: "支出", category: { not: "轉帳" }, date: { gte: prevStart, lt: prevEnd } },
        _sum: { amount: true },
      }),
    ]);

    const totalIncome  = Number(incomeRows._sum.amount ?? 0);
    const totalExpense = currentSpending.reduce((s, r) => s + Number(r._sum.amount ?? 0), 0);
    const savingRate   = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome * 100).toFixed(1) : "N/A";

    const spendingMap = new Map(currentSpending.map(r => [r.category, Math.round(Number(r._sum.amount ?? 0))]));
    const prevMap     = new Map(prevSpending.map(r => [r.category, Math.round(Number(r._sum.amount ?? 0))]));
    const budgetMap   = new Map(budgets.map(b => [b.category, Math.round(Number(b.amount))]));

    const sortedSpending = Array.from(spendingMap.entries()).sort((a, b) => b[1] - a[1]);
    const overBudget = sortedSpending.filter(([cat, amt]) => budgetMap.has(cat) && amt > budgetMap.get(cat)!);

    const goalsSummary = goals.map(g => ({
      name: g.name, emoji: g.emoji,
      pct: Math.round(Number(g.savedAmount) / Number(g.targetAmount) * 100),
    }));

    // ── 2. Claude AI 洞察 ────────────────────────────────────────────────────
    const fmt = (n: number) => `NT$${Math.round(n).toLocaleString()}`;
    const dataContext = `月份：${month}
本月收入：${fmt(totalIncome)}
本月支出：${fmt(totalExpense)}
儲蓄率：${savingRate}%

各分類支出（由高到低）：
${sortedSpending.slice(0, 8).map(([cat, amt]) => {
  const budget = budgetMap.get(cat);
  const prev   = prevMap.get(cat);
  return `  • ${cat}：${fmt(amt)}${budget ? ` / 預算 ${fmt(budget)} (${Math.round(amt / budget * 100)}%)` : ""}${prev ? ` [上月 ${fmt(prev)}]` : ""}`;
}).join("\n")}

${overBudget.length > 0 ? `超標：${overBudget.map(([cat, amt]) => `${cat}（超 ${fmt(amt - budgetMap.get(cat)!)}）`).join("、")}` : "無超標"}

財務目標：
${goalsSummary.map(g => `  • ${g.emoji} ${g.name}：${g.pct}%`).join("\n") || "  （尚未設定）"}`;

    let insight = "";
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const msg = await client.messages.create({
          model:      "claude-haiku-4-5-20251001",
          max_tokens: 600,
          system:     WARM_INSIGHT_SYSTEM_PROMPT,
          messages:   [{ role: "user", content: buildWarmInsightUserPrompt(month, dataContext) }],
        });
        insight = msg.content[0].type === "text" ? msg.content[0].text : "";
      } catch (e) {
        console.error("[cron/monthly-report] Claude error:", e);
        insight = dataContext;
      }
    }

    // 寫入 DB 快照（Dashboard 會讀這張表）
    if (insight) {
      try {
        await prisma.aiInsight.upsert({
          where:  { userId_month: { userId: user.id, month } },
          create: {
            userId: user.id, month, insight, source: "cron",
            meta: {
              totalIncome:     Math.round(totalIncome),
              totalExpense:    Math.round(totalExpense),
              savingRate,
              overBudgetCount: overBudget.length,
            },
          },
          update: {
            insight, source: "cron",
            meta: {
              totalIncome:     Math.round(totalIncome),
              totalExpense:    Math.round(totalExpense),
              savingRate,
              overBudgetCount: overBudget.length,
            },
          },
        });
      } catch (e) {
        console.error("[cron/monthly-report] aiInsight upsert failed:", e);
      }
    }

    // ── 3. 寫入 Notion 月報頁 ────────────────────────────────────────────────
    const pageId = process.env.NOTION_MONTHLY_REPORT_PAGE_ID;
    if (pageId && process.env.NOTION_TOKEN) {
      const notion = new Client({ auth: process.env.NOTION_TOKEN });
      const page = await notion.pages.create({
        parent: { page_id: pageId },
        icon:   { type: "emoji", emoji: "📊" },
        properties: {
          title: { title: [{ text: { content: `財務月報 ${month}` } }] },
        },
        children: [
          {
            object: "block", type: "callout",
            callout: {
              icon: { type: "emoji", emoji: "📈" },
              color: parseFloat(savingRate) >= 20 ? "green_background" : "orange_background",
              rich_text: [{ type: "text", text: { content: `收入 ${fmt(totalIncome)}　支出 ${fmt(totalExpense)}　儲蓄率 ${savingRate}%` } }],
            },
          },
          { object: "block", type: "divider", divider: {} },
          {
            object: "block", type: "heading_2",
            heading_2: { rich_text: [{ type: "text", text: { content: "✨ AI 洞察" } }] },
          },
          ...insight.split(/\n\n+/).filter(Boolean).map(para => ({
            object: "block" as const, type: "paragraph" as const,
            paragraph: { rich_text: [{ type: "text" as const, text: { content: para.trim() } }] },
          })),
          { object: "block", type: "divider", divider: {} },
          {
            object: "block", type: "heading_2",
            heading_2: { rich_text: [{ type: "text", text: { content: "📊 支出分類" } }] },
          },
          ...sortedSpending.slice(0, 10).map(([cat, amt]) => ({
            object: "block" as const, type: "bulleted_list_item" as const,
            bulleted_list_item: {
              rich_text: [{
                type: "text" as const,
                text: { content: `${cat}：${fmt(amt)}${budgetMap.has(cat) ? ` / 預算 ${fmt(budgetMap.get(cat)!)}` : ""}` },
                annotations: overBudget.some(([c]) => c === cat) ? { color: "red" as const } : {},
              }],
            },
          })),
        ],
      } as Parameters<typeof notion.pages.create>[0]);

      result.notionUrl = (page as { url?: string }).url;
      void logAudit({ action: "notion_sync", tool: "cron/monthly-report", summary: { month, url: result.notionUrl } });
    }

    // ── 4. 異常支出偵測 → 財務警示 ──────────────────────────────────────────
    if (process.env.NOTION_ANOMALY_PAGE_ID) {
      const lookback = 4;
      const anomalies: { category: string; current: number; mean: number; zscore: number }[] = [];

      for (const [cat, cur] of sortedSpending) {
        const hist: number[] = [];
        for (let i = 1; i <= lookback; i++) {
          const s = new Date(y, m - 1 - i, 1);
          const e = new Date(y, m - i, 1);
          const r = await prisma.transaction.aggregate({
            where: { userId: user.id, type: "支出", category: cat, date: { gte: s, lt: e } },
            _sum: { amount: true },
          });
          const v = Number(r._sum.amount ?? 0);
          if (v > 0) hist.push(v);
        }
        if (hist.length < 2) continue;
        const mean    = hist.reduce((a, b) => a + b, 0) / hist.length;
        const stddev  = Math.sqrt(hist.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / hist.length);
        if (stddev < 100) continue;
        const zscore = (cur - mean) / stddev;
        if (zscore >= 1.5) {
          anomalies.push({ category: cat, current: cur, mean: Math.round(mean), zscore: Math.round(zscore * 10) / 10 });
        }
      }

      if (anomalies.length > 0) {
        await appendAnomalyAlert(month, anomalies);
        result.anomalyCount = anomalies.length;
      }
    }

    // ── 5. 訂閱漲價偵測 ──────────────────────────────────────────────────────
    if (process.env.NOTION_SUBSCRIPTIONS_DB_ID) {
      const subs = await getSubscriptionsFromNotion();
      let priceChanges = 0;

      for (const sub of subs) {
        if (!sub.fee || sub.fee <= 0) continue;

        // 找本月含訂閱名稱的交易
        const txs = await prisma.transaction.findMany({
          where: {
            userId: user.id,
            type:   "支出",
            note:   { contains: sub.name.slice(0, 6) },
            date:   { gte: curStart, lt: curEnd },
          },
          orderBy: { date: "desc" },
          take: 1,
        });

        if (txs.length === 0) continue;
        const actualAmount = Number(txs[0].amount);
        const diff = Math.abs(actualAmount - sub.fee) / sub.fee;
        if (diff > 0.05) {
          await appendSubscriptionPriceChange(sub.id, month, sub.fee, actualAmount);
          priceChanges++;
        }
      }

      if (priceChanges > 0) result.priceChanges = priceChanges;
    }

    result.ok = true;
    return NextResponse.json(result);
  } catch (e) {
    console.error("[cron/monthly-report]", e);
    void logAudit({ action: "notion_sync", tool: "cron/monthly-report", status: "error", errorMsg: e instanceof Error ? e.message : "unknown" });
    return NextResponse.json({ error: "Monthly report cron failed" }, { status: 500 });
  }
}
