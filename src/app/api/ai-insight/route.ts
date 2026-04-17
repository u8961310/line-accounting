import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";
import { buildInsightData, WARM_INSIGHT_SYSTEM_PROMPT, buildWarmInsightUserPrompt } from "@/lib/ai-insight";
import { taipeiMonth } from "@/lib/time";

export const dynamic = "force-dynamic";

type InsightPayload = {
  insight:  string;
  month:    string;
  charts:   { donut: string | null; bar: string | null };
  meta:     { totalIncome: number; totalExpense: number; savingRate: string; overBudgetCount: number };
  cached:   boolean;
  source:   string;
};

// ── GET /api/ai-insight?month=YYYY-MM ────────────────────────────────────────
export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get("month");
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "請提供 month 參數（格式：YYYY-MM）" }, { status: 400 });
  }

  const user = await prisma.user.findFirst({ where: { lineUserId: "dashboard_user" } });
  if (!user) return NextResponse.json({ error: "找不到使用者" }, { status: 404 });

  // 1. 先查 DB 快照
  const snap = await prisma.aiInsight.findUnique({
    where: { userId_month: { userId: user.id, month } },
  });
  if (snap) {
    const payload: InsightPayload = {
      insight: snap.insight,
      month,
      charts:  (snap.chartUrls as { donut: string | null; bar: string | null } | null) ?? { donut: null, bar: null },
      meta:    snap.meta as InsightPayload["meta"],
      cached:  true,
      source:  snap.source,
    };
    return NextResponse.json(payload);
  }

  // 2. 只有「當月」可即時生成並存入；歷史月份沒快照就回 null
  const currentMonth = taipeiMonth();
  if (month !== currentMonth) {
    return NextResponse.json({
      insight: null,
      month,
      charts:  { donut: null, bar: null },
      meta:    null,
      cached:  false,
      source:  null,
      message: "這個月份還沒有洞察。每月 1 號 10:00 會自動產生當月洞察。",
    });
  }

  // 3. 即時生成當月
  const d = await buildInsightData(user.id, month);
  if (!d) return NextResponse.json({ error: "無法取得資料" }, { status: 500 });

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 600,
      system:     WARM_INSIGHT_SYSTEM_PROMPT,
      messages:   [{ role: "user", content: buildWarmInsightUserPrompt(month, d.dataContext) }],
    });
    const insight = msg.content[0].type === "text" ? msg.content[0].text : "";

    const meta = {
      totalIncome:     Math.round(d.totalIncome),
      totalExpense:    Math.round(d.totalExpense),
      savingRate:      d.savingRate,
      overBudgetCount: d.overBudget.length,
    };

    await prisma.aiInsight.upsert({
      where:  { userId_month: { userId: user.id, month } },
      create: { userId: user.id, month, insight, meta, chartUrls: d.charts, source: "ondemand" },
      update: { insight, meta, chartUrls: d.charts, source: "ondemand" },
    });

    const payload: InsightPayload = {
      insight,
      month,
      charts: d.charts,
      meta,
      cached: false,
      source: "ondemand",
    };
    return NextResponse.json(payload);
  } catch (e) {
    console.error("AI insight error:", e);
    return NextResponse.json({ error: "AI 分析暫時不可用" }, { status: 500 });
  }
}
