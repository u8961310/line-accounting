import * as crypto from "crypto";

export interface LineProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
}

export function verifySignature(body: string, signature: string): boolean {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  const hmac = crypto.createHmac("sha256", channelSecret!);
  const digest = hmac.update(body).digest("base64");
  return digest === signature;
}

export async function replyMessage(replyToken: string, text: string): Promise<void> {
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [
        {
          type: "text",
          text,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("LINE replyMessage error:", response.status, errorText);
  }
}

export async function getUserProfile(userId: string): Promise<LineProfile | null> {
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  const response = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    console.error("LINE getUserProfile error:", response.status);
    return null;
  }

  const data = (await response.json()) as {
    userId: string;
    displayName: string;
    pictureUrl?: string;
  };

  return {
    userId: data.userId,
    displayName: data.displayName,
    pictureUrl: data.pictureUrl,
  };
}
