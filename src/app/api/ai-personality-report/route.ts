import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

function fmt(n: number) { return Math.round(n).toLocaleString("zh-TW"); }

// 衝動分類（主觀性高、非必要）
const IMPULSE_CATEGORIES = new Set(["娛樂", "購物", "餐飲", "飲食", "美容", "旅遊"]);
// 必要分類
const ESSENTIAL_CATEGORIES = new Set(["居住", "水電", "通訊", "保險", "醫療", "交通"]);

export interface PersonalityReport {
  generatedAt:     string;
  totalExpense:    number;
  topCategories:   { category: string; amount: number; pct: number }[];
  dowStats:        { dow: string; amount: number; pct: number }[];
  impulseRatio:    number;
  essentialRatio:  number;
  highRiskCats:    string[];
  advice:          string[];
  summary:         string;
}

export async function GET(): Promise<NextResponse> {
  const user = await prisma.user.findUnique({ where: { lineUserId: "dashboard_user" } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const now   = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 2, 1); // 3 months
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const txs = await prisma.transaction.findMany({
    where: {
      userId:   user.id,
      type:     "支出",
      date:     { gte: start, lt: end },
      NOT:      { category: "轉帳" },
    },
    select: { date: true, amount: true, category: true, note: true },
  });

  if (txs.length === 0) {
    return NextResponse.json({ error: "近 3 個月無支出資料" }, { status: 400 });
  }

  // ── 分類統計 ──────────────────────────────────────────────────────────────
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

  // ── 星期幾分佈 ────────────────────────────────────────────────────────────
  const DOWS = ["日", "一", "二", "三", "四", "五", "六"];
  const dowMap = new Map<number, number>();
  for (const tx of txs) {
    const d = new Date(tx.date).getDay();
    dowMap.set(d, (dowMap.get(d) ?? 0) + parseFloat(tx.amount.toString()));
  }
  const dowTotal = Array.from(dowMap.values()).reduce((s, v) => s + v, 0);
  const dowStats = Array.from(dowMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([d, amount]) => ({
      dow:    `週${DOWS[d]}`,
      amount: Math.round(amount),
      pct:    Math.round((amount / dowTotal) * 100),
    }));

  // ── 衝動 vs 必要比例 ────────────────────────────────────────────────────
  let impulseTotal = 0, essentialTotal = 0;
  for (const [cat, amt] of Array.from(catMap.entries())) {
    if (IMPULSE_CATEGORIES.has(cat))  impulseTotal  += amt;
    if (ESSENTIAL_CATEGORIES.has(cat)) essentialTotal += amt;
  }
  const impulseRatio   = Math.round((impulseTotal   / totalExpense) * 100);
  const essentialRatio = Math.round((essentialTotal / totalExpense) * 100);

  // ── 高風險分類（佔比 > 30% 或近 3 月持續成長）────────────────────────────
  const highRiskCats = topCategories
    .filter(c => c.pct >= 30 || IMPULSE_CATEGORIES.has(c.category))
    .slice(0, 3)
    .map(c => c.category);

  // ── Claude 生成建議 ──────────────────────────────────────────────────────
  const topCatText = topCategories.slice(0, 5)
    .map(c => `${c.category} NT$${fmt(c.amount)}（${c.pct}%）`)
    .join("、");
  const highDow = dowStats.sort((a, b) => b.amount - a.amount)[0];

  const prompt = `你是一個直接、有洞察力的理財分析師，分析使用者近 3 個月的消費行為。

數據摘要：
- 3 個月總支出：NT$ ${fmt(totalExpense)}
- 前 5 大消費分類：${topCatText}
- 消費最集中星期：${highDow?.dow ?? "—"}（${highDow?.pct ?? 0}%）
- 衝動消費佔比：${impulseRatio}%
- 必要支出佔比：${essentialRatio}%
- 高風險分類：${highRiskCats.join("、") || "無"}

請用繁體中文，生成：
1. 一段 40-60 字的「消費性格摘要」，直接說明這個人的消費特徵，語氣不要太溫和
2. 3 條具體的行為建議，每條 25-40 字，要有數字和具體行動

回覆格式（只回 JSON，不要加 markdown code block）：
{
  "summary": "消費性格摘要...",
  "advice": ["建議1...", "建議2...", "建議3..."]
}`;

  const client  = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let summary = "";
  let advice:  string[] = [];

  try {
    const res = await client.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages:   [{ role: "user", content: prompt }],
    });
    const text = res.content[0].type === "text" ? res.content[0].text.trim() : "{}";
    const parsed = JSON.parse(text) as { summary?: string; advice?: string[] };
    summary = parsed.summary ?? "";
    advice  = parsed.advice  ?? [];
  } catch {
    summary = "無法生成 AI 摘要，請稍後再試";
    advice  = [];
  }

  // 還原 dowStats 排序（依星期幾順序）
  dowStats.sort((a, b) => {
    const order = ["週日","週一","週二","週三","週四","週五","週六"];
    return order.indexOf(a.dow) - order.indexOf(b.dow);
  });

  return NextResponse.json({
    generatedAt:    new Date().toISOString(),
    totalExpense:   Math.round(totalExpense),
    topCategories,
    dowStats,
    impulseRatio,
    essentialRatio,
    highRiskCats,
    advice,
    summary,
  } satisfies PersonalityReport);
}
