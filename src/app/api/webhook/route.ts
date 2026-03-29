import { NextRequest, NextResponse } from "next/server";
import { verifySignature, replyMessage, getUserProfile } from "@/lib/line";
import { parseExpenseText } from "@/lib/parser";
import { prisma } from "@/lib/db";
import { syncTransactionToNotion } from "@/lib/notion";

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

async function handleTextMessage(
  event: LineEvent,
  userId: string,
  text: string
): Promise<void> {
  const replyToken = event.replyToken;
  if (!replyToken) return;

  // Parse expense text with AI
  const parsed = await parseExpenseText(text);

  if (!parsed) {
    await replyMessage(
      replyToken,
      "無法解析記帳資訊，請試著這樣輸入：\n「午餐 120」\n「計程車 250」\n「薪水 50000」"
    );
    return;
  }

  // Upsert user
  let profile = await getUserProfile(userId);
  const displayName = profile?.displayName ?? userId;

  const user = await prisma.user.upsert({
    where: { lineUserId: userId },
    update: { displayName },
    create: {
      lineUserId: userId,
      displayName,
    },
  });

  // Save transaction
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const transaction = await prisma.transaction.upsert({
    where: {
      userId_date_amount_source: {
        userId: user.id,
        date: today,
        amount: parsed.amount,
        source: "line",
      },
    },
    update: {
      category: parsed.category,
      type: parsed.type,
      note: parsed.note,
    },
    create: {
      userId: user.id,
      date: today,
      amount: parsed.amount,
      category: parsed.category,
      type: parsed.type,
      note: parsed.note,
      source: "line",
    },
  });

  // Reply to user
  const typeEmoji = parsed.type === "收入" ? "💰" : "💸";
  const replyText = `${typeEmoji} 已記錄${parsed.type}\n金額：${parsed.amount.toLocaleString()} 元\n分類：${parsed.category}\n備註：${parsed.note || "（無）"}`;

  await replyMessage(replyToken, replyText);

  // Background Notion sync (never await)
  syncTransactionToNotion(transaction);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.text();
    const signature = request.headers.get("x-line-signature") ?? "";

    // Verify LINE signature
    if (!verifySignature(body, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const webhookBody = JSON.parse(body) as LineWebhookBody;
    const events = webhookBody.events ?? [];

    for (const event of events) {
      try {
        if (event.type !== "message") continue;
        if (event.message?.type !== "text") continue;

        const userId = event.source.userId;
        if (!userId) continue;

        const text = event.message.text;
        if (!text) continue;

        await handleTextMessage(event, userId, text);
      } catch (eventError) {
        console.error("Event processing error:", eventError);

        // Try to reply with error message
        if (event.replyToken) {
          try {
            await replyMessage(event.replyToken, "處理時發生錯誤，請稍後再試");
          } catch (replyError) {
            console.error("Failed to send error reply:", replyError);
          }
        }
      }
    }

    // Always return 200 to LINE
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Webhook handler error:", error);
    // Still return 200 to prevent LINE from retrying
    return NextResponse.json({ status: "error", message: "Internal error" });
  }
}
