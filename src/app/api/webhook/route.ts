import { NextRequest, NextResponse } from "next/server";
import { verifySignature, replyMessage, replyRawMessage, getUserProfile } from "@/lib/line";
import { parseExpenseText } from "@/lib/parser";
import { prisma } from "@/lib/db";
import {
  buildRecordedMessage,
  buildSummaryMessage,
  buildRecentMessage,
  buildHelpMessage,
  buildErrorMessage,
} from "@/lib/line-messages";

export const dynamic = "force-dynamic";

interface LineEvent {
  type: string;
  replyToken?: string;
  source: {
    type: string;
    userId?: string;
  };
  message?: {
    type: string;
    text?: string;
  };
}

interface LineWebhookBody {
  destination: string;
  events: LineEvent[];
}

// ── 查詢本月摘要 ───────────────────────────────────────────────────────────────
async function handleSummaryQuery(replyToken: string, _userId: string): Promise<void> {
  const user = await prisma.user.findFirst({ where: { lineUserId: "dashboard_user" } });
  if (!user) {
    await replyMessage(replyToken, "尚無記帳資料");
    return;
  }

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const txs = await prisma.transaction.findMany({
    where: { userId: user.id, date: { gte: start, lt: end }, category: { not: "轉帳" } },
  });

  const income  = txs.filter(t => t.type === "收入").reduce((s, t) => s + Number(t.amount), 0);
  const expense = txs.filter(t => t.type === "支出").reduce((s, t) => s + Number(t.amount), 0);

  // 支出分類彙總
  const catMap = new Map<string, number>();
  for (const t of txs.filter(t => t.type === "支出")) {
    catMap.set(t.category, (catMap.get(t.category) ?? 0) + Number(t.amount));
  }
  const month = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`;
  const cats = Array.from(catMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category, total]) => ({ category, total }));

  await replyRawMessage(replyToken, [buildSummaryMessage({
    month: `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`,
    income,
    expense,
    categories: cats,
  })]);
}

// ── 查詢最近記錄 ───────────────────────────────────────────────────────────────
async function handleRecentQuery(replyToken: string, _userId: string): Promise<void> {
  const user = await prisma.user.findFirst({ where: { lineUserId: "dashboard_user" } });
  if (!user) {
    await replyMessage(replyToken, "尚無記帳資料");
    return;
  }

  const txs = await prisma.transaction.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  if (txs.length === 0) {
    await replyMessage(replyToken, "尚無記帳資料");
    return;
  }

  await replyRawMessage(replyToken, [buildRecentMessage(txs.map(t => ({
    date:     t.date.toISOString().split("T")[0],
    type:     t.type,
    amount:   Number(t.amount),
    category: t.category,
    note:     t.note,
  })))]);
}

// ── 使用說明 ───────────────────────────────────────────────────────────────────
async function handleHelp(replyToken: string): Promise<void> {
  await replyRawMessage(replyToken, [buildHelpMessage()]);
}

// ── 記帳處理 ───────────────────────────────────────────────────────────────────
async function handleTextMessage(event: LineEvent, userId: string, text: string): Promise<void> {
  const replyToken = event.replyToken;
  if (!replyToken) return;

  const trimmed = text.trim();

  // 查詢指令
  if (["摘要", "本月", "統計"].includes(trimmed)) {
    await handleSummaryQuery(replyToken, userId);
    return;
  }
  if (["最近", "記錄", "查詢"].includes(trimmed)) {
    await handleRecentQuery(replyToken, userId);
    return;
  }
  if (["說明", "help", "幫助", "?", "？"].includes(trimmed.toLowerCase())) {
    await handleHelp(replyToken);
    return;
  }

  // AI 解析記帳
  const parsed = await parseExpenseText(text);
  if (!parsed) {
    await replyRawMessage(replyToken, [buildErrorMessage()]);
    return;
  }

  // 更新 LINE 使用者顯示名稱（非必要，背景執行）
  getUserProfile(userId).then(profile => {
    if (profile?.displayName) {
      prisma.user.updateMany({
        where: { lineUserId: userId },
        data: { displayName: profile.displayName },
      }).catch(() => {});
    }
  }).catch(() => {});

  // 統一存入 dashboard_user（讓 Dashboard 可以看到）
  const dashUser = await prisma.user.upsert({
    where: { lineUserId: "dashboard_user" },
    update: {},
    create: { lineUserId: "dashboard_user", displayName: "Dashboard" },
  });

  // 儲存交易（使用 AI 解析的日期，未指定則用今天）
  const txDate = parsed.date ? new Date(parsed.date) : new Date();
  txDate.setHours(0, 0, 0, 0);

  // 用 create + 重複時 upsert fallback，避免同天同金額互蓋
  let transaction;
  try {
    transaction = await prisma.transaction.create({
      data: {
        userId: dashUser.id,
        date: txDate,
        amount: parsed.amount,
        category: parsed.category,
        type: parsed.type,
        note: parsed.note,
        source: "line",
      },
    });
  } catch {
    // unique 衝突（同天同金額）→ upsert 更新備註與分類
    transaction = await prisma.transaction.upsert({
      where: {
        userId_date_amount_source: {
          userId: dashUser.id,
          date: txDate,
          amount: parsed.amount,
          source: "line",
        },
      },
      update: { category: parsed.category, type: parsed.type, note: parsed.note },
      create: {
        userId: dashUser.id,
        date: txDate,
        amount: parsed.amount,
        category: parsed.category,
        type: parsed.type,
        note: parsed.note,
        source: "line",
      },
    });
  }

  // 回覆 Flex Message
  await replyRawMessage(replyToken, [buildRecordedMessage({
    type:     parsed.type,
    amount:   parsed.amount,
    category: parsed.category,
    note:     parsed.note,
    date:     txDate,
  })]);
}

// ── Webhook 主入口 ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body      = await request.text();
    const signature = request.headers.get("x-line-signature") ?? "";

    if (!verifySignature(body, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const webhookBody = JSON.parse(body) as LineWebhookBody;

    for (const event of webhookBody.events ?? []) {
      try {
        if (event.type !== "message" || event.message?.type !== "text") continue;
        const userId = event.source.userId;
        const text   = event.message.text;
        if (!userId || !text) continue;

        await handleTextMessage(event, userId, text);
      } catch (e) {
        console.error("Event error:", e);
        if (event.replyToken) {
          await replyMessage(event.replyToken, "處理時發生錯誤，請稍後再試").catch(() => {});
        }
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json({ status: "error" });
  }
}
