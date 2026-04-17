import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";
import { buildInsightData, WARM_INSIGHT_SYSTEM_PROMPT, buildWarmInsightUserPrompt } from "@/lib/ai-insight";
import { taipeiTodayAsUTC } from "@/lib/time";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/ai-insight/backfill?months=3
// Header: Authorization: Bearer $CRON_SECRET
// 補產過去 N 個月（不含當月）的 AI 洞察快照，已存在的月份跳過
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const monthsParam = Number(req.nextUrl.searchParams.get("months") ?? "3");
  const n = Number.isFinite(monthsParam) && monthsParam > 0 && monthsParam <= 24 ? Math.floor(monthsParam) : 3;

  const user = await prisma.user.findFirst({ where: { lineUserId: "dashboard_user" } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const nowTW = taipeiTodayAsUTC();
  const results: { month: string; status: "created" | "skipped" | "failed"; error?: string }[] = [];

  for (let i = 1; i <= n; i++) {
    const d = new Date(Date.UTC(nowTW.getUTCFullYear(), nowTW.getUTCMonth() - i, 1));
    const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

    const existing = await prisma.aiInsight.findUnique({
      where: { userId_month: { userId: user.id, month } },
    });
    if (existing) {
      results.push({ month, status: "skipped" });
      continue;
    }

    try {
      const data = await buildInsightData(user.id, month);
      if (!data) { results.push({ month, status: "failed", error: "no data" }); continue; }

      // 完全沒資料的月份也產洞察不太有意義 — 若收支皆 0 就跳過
      if (data.totalIncome === 0 && data.totalExpense === 0) {
        results.push({ month, status: "skipped", error: "no transactions" });
        continue;
      }

      const msg = await client.messages.create({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 600,
        system:     WARM_INSIGHT_SYSTEM_PROMPT,
        messages:   [{ role: "user", content: buildWarmInsightUserPrompt(month, data.dataContext) }],
      });
      const insight = msg.content[0].type === "text" ? msg.content[0].text : "";

      await prisma.aiInsight.create({
        data: {
          userId: user.id, month, insight, source: "backfill",
          meta: {
            totalIncome:     Math.round(data.totalIncome),
            totalExpense:    Math.round(data.totalExpense),
            savingRate:      data.savingRate,
            overBudgetCount: data.overBudget.length,
          },
          chartUrls: data.charts,
        },
      });
      results.push({ month, status: "created" });
    } catch (e) {
      results.push({ month, status: "failed", error: e instanceof Error ? e.message : "unknown" });
    }
  }

  return NextResponse.json({ ok: true, results });
}
