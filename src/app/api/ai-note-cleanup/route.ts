import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

// 偵測「原始銀行備注」：含英文字母或特殊字元組合，排除純中文
function looksLikeRaw(note: string): boolean {
  if (!note || note.trim().length === 0) return false;
  // 含英文字母（至少 2 個）或含常見銀行格式字元（* / 大寫連續）
  const hasEnglish = (note.match(/[A-Za-z]/g) ?? []).length >= 2;
  const hasBankPattern = /[A-Z]{3,}|[*\/\\]|\d{6,}/.test(note);
  return hasEnglish || hasBankPattern;
}

export interface NoteCandidate {
  id:          string;
  note:        string;
  category:    string;
  amount:      number;
  date:        string;
  suggested:   string;
}

// GET: 撈出候選交易並送 AI 批次建議
export async function GET(): Promise<NextResponse> {
  const user = await prisma.user.findUnique({ where: { lineUserId: "dashboard_user" } });
  if (!user) return NextResponse.json({ candidates: [] });

  const txs = await prisma.transaction.findMany({
    where: {
      userId: user.id,
      note:   { not: "" },
    },
    select: { id: true, note: true, category: true, amount: true, date: true },
    orderBy: { date: "desc" },
    take: 500,
  });

  const candidates = txs.filter(tx => looksLikeRaw(tx.note ?? ""));

  if (candidates.length === 0) return NextResponse.json({ candidates: [] });

  // 最多取 40 筆送 AI（避免 token 過多）
  const batch = candidates.slice(0, 40);

  const prompt = `以下是銀行交易備注（英文/機器碼），請幫我翻譯成簡短中文可讀備注（5-12 字），只描述消費內容，不加解釋。

格式：輸入一個 JSON 陣列，回傳相同長度的中文備注陣列（只回 JSON array，不加其他文字）

輸入：
${JSON.stringify(batch.map(t => ({ id: t.id, note: t.note, category: t.category })))}

範例對應：
- "PAYPAL *ADOBE" → "Adobe 訂閱"
- "SPOTIFY AB" → "Spotify 音樂"
- "7-ELEVEN 統一超商" → "7-11 超商"
- "UBER* TRIP" → "Uber 車資"
- "NETFLIX.COM" → "Netflix 訂閱"

回傳 JSON array，每個元素為 { "id": "...", "suggested": "中文備注" }`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let results: { id: string; suggested: string }[] = [];

  try {
    const res = await client.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      messages:   [{ role: "user", content: prompt }],
    });
    const text = res.content[0].type === "text" ? res.content[0].text.trim() : "[]";
    results = JSON.parse(text) as { id: string; suggested: string }[];
  } catch {
    // 回傳候選清單但無建議
  }

  const suggestMap = new Map(results.map(r => [r.id, r.suggested]));

  const output: NoteCandidate[] = batch.map(tx => ({
    id:        tx.id,
    note:      tx.note ?? "",
    category:  tx.category,
    amount:    parseFloat(tx.amount.toString()),
    date:      tx.date.toISOString().split("T")[0],
    suggested: suggestMap.get(tx.id) ?? "",
  }));

  return NextResponse.json({ candidates: output });
}

// POST: 套用指定備注更新
export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.json() as { updates: { id: string; note: string }[] };
  if (!Array.isArray(body.updates) || body.updates.length === 0) {
    return NextResponse.json({ error: "請提供 updates 陣列" }, { status: 400 });
  }

  const results = await Promise.allSettled(
    body.updates.map(({ id, note }) =>
      prisma.transaction.update({ where: { id }, data: { note } })
    )
  );

  const updated = results.filter(r => r.status === "fulfilled").length;
  return NextResponse.json({ updated });
}
