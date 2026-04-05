import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";
import { logAudit } from "@/lib/audit";

const DASHBOARD_USER = "dashboard_user";
const BATCH_SIZE = 50; // max per Claude call

// Valid expense categories (excluding 其他, 現金, 轉帳)
const VALID_CATEGORIES = [
  "飲食", "交通", "娛樂", "購物", "醫療", "居住",
  "教育", "通訊", "保險", "水電", "美容", "運動",
  "旅遊", "訂閱", "寵物",
];

export interface CleanSuggestion {
  id:        string;
  note:      string;
  amount:    number;
  type:      string;
  date:      string;
  suggested: string;
}

// ── GET — fetch 其他 transactions + ask Claude for suggestions ─────────────────
export async function GET(): Promise<NextResponse> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "未設定 ANTHROPIC_API_KEY" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { lineUserId: DASHBOARD_USER } });
  if (!user) return NextResponse.json({ suggestions: [], total: 0 });

  const txs = await prisma.transaction.findMany({
    where: { userId: user.id, category: "其他" },
    select: { id: true, note: true, amount: true, type: true, date: true },
    orderBy: { date: "desc" },
    take: BATCH_SIZE,
  });

  const totalCount = await prisma.transaction.count({
    where: { userId: user.id, category: "其他" },
  });

  if (txs.length === 0) {
    return NextResponse.json({ suggestions: [], total: 0 });
  }

  // Build prompt
  // Map index → id for Claude (shorter prompt, avoid cuid in response)
  const idxToId = txs.map(tx => tx.id);
  const lines = txs.map((tx, i) =>
    `${i + 1}. idx=${i} type=${tx.type} amount=${tx.amount} note="${tx.note ?? ""}"`
  ).join("\n");

  const prompt = `你是記帳分類助理。以下是使用者目前分類為「其他」的交易，請根據備註（note）和類型（type）推測正確分類。

可用分類清單（只能從這裡選）：
${VALID_CATEGORIES.join("、")}

若真的無法判斷，才回答「其他」。

交易列表：
${lines}

請以 JSON 陣列回傳，格式如下（只輸出 JSON，不加說明，idx 對應上方編號-1）：
[{"idx":0,"category":"飲食"},{"idx":1,"category":"交通"}]`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let raw: string;
  try {
    const msg = await client.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages:   [{ role: "user", content: prompt }],
    });
    raw = msg.content[0].type === "text" ? msg.content[0].text : "";
  } catch (err) {
    console.error("[clean-other-category] Claude error:", err);
    return NextResponse.json({ error: "AI 分析失敗，請稍後再試" }, { status: 500 });
  }

  // Parse Claude response
  let parsed: { idx: number; category: string }[] = [];
  try {
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]) as { idx: number; category: string }[];
  } catch (err) {
    console.error("[clean-other-category] parse error:", err, raw);
    return NextResponse.json({ error: "AI 回傳格式錯誤" }, { status: 500 });
  }

  // Build suggestion map: idx → category
  const catMap = new Map<number, string>(parsed.map(p => [p.idx, p.category]));

  // Only include suggestions where Claude suggested a non-其他 valid category
  const suggestions: CleanSuggestion[] = txs
    .map((tx, i) => ({
      id:        idxToId[i],
      note:      tx.note ?? "",
      amount:    parseFloat(tx.amount.toString()),
      type:      tx.type,
      date:      tx.date.toISOString().slice(0, 10),
      suggested: catMap.get(i) ?? "其他",
    }))
    .filter(s => s.suggested !== "其他" && VALID_CATEGORIES.includes(s.suggested));

  return NextResponse.json({ suggestions, total: totalCount, analyzed: txs.length });
}

// ── POST — apply selected updates ─────────────────────────────────────────────
export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json()) as { updates: { id: string; category: string }[] };

  if (!Array.isArray(body.updates) || body.updates.length === 0) {
    return NextResponse.json({ error: "缺少 updates" }, { status: 400 });
  }

  // Validate categories
  const validUpdates = body.updates.filter(u =>
    VALID_CATEGORIES.includes(u.category) && typeof u.id === "string"
  );

  await Promise.all(
    validUpdates.map(u =>
      prisma.transaction.update({ where: { id: u.id }, data: { category: u.category } })
    )
  );

  // 寫入稽核記錄
  const categoryBreakdown = validUpdates.reduce<Record<string, number>>((acc, u) => {
    acc[u.category] = (acc[u.category] ?? 0) + 1;
    return acc;
  }, {});
  const breakdownStr = Object.entries(categoryBreakdown)
    .map(([cat, n]) => `${cat}×${n}`)
    .join("、");

  void logAudit({
    action:  "ai_recategorize",
    tool:    "clean-other-category",
    summary: {
      "套用筆數": validUpdates.length,
      "分類明細": breakdownStr || "—",
    },
  });

  return NextResponse.json({ applied: validUpdates.length });
}
