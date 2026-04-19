/**
 * Web Push wrapper
 *
 * 依賴 web-push 套件；依 VAPID keypair 對瀏覽器 push endpoint 發通知。
 * 瀏覽器取消訂閱 / endpoint 失效時，web-push 會丟 statusCode 410 或 404，
 * 呼叫端應據此把 WebPushSubscription.active 設為 false（見 /api/push/send）。
 */
import webpush from "web-push";
import { prisma } from "@/lib/db";

let configured = false;

function ensureConfigured(): void {
  if (configured) return;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subj = process.env.VAPID_SUBJECT;
  if (!pub || !priv || !subj) {
    throw new Error(
      "Missing VAPID env vars (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT)"
    );
  }
  webpush.setVapidDetails(subj, pub, priv);
  configured = true;
}

export type WebPushPayload = {
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  url?: string;
};

export type WebPushResult = {
  id: string;
  endpoint: string;
  ok: boolean;
  statusCode?: number;
  expired?: boolean;
  error?: string;
};

type SubShape = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export async function sendWebPushToSubscriptions(
  subs: SubShape[],
  payload: WebPushPayload
): Promise<WebPushResult[]> {
  if (subs.length === 0) return [];
  ensureConfigured();

  const serialized = JSON.stringify(payload);

  return Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          serialized,
          { TTL: 60 * 60 * 24 }
        );
        return { id: s.id, endpoint: s.endpoint, ok: true };
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        const expired = e.statusCode === 404 || e.statusCode === 410;
        return {
          id: s.id,
          endpoint: s.endpoint,
          ok: false,
          statusCode: e.statusCode,
          expired,
          error: e.message ?? String(err),
        };
      }
    })
  );
}

/**
 * 廣播給所有 active 的 WebPushSubscription，並依結果更新 DB
 * （410/404 → active=false；成功 → lastUsedAt=now）。
 */
export async function broadcastWebPush(
  payload: WebPushPayload
): Promise<{ sent: number; failed: number; expired: number }> {
  const subs = await prisma.webPushSubscription.findMany({
    where: { active: true },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });

  const results = await sendWebPushToSubscriptions(subs, payload);

  let sent = 0;
  let failed = 0;
  let expired = 0;

  for (const r of results) {
    if (r.ok) {
      sent++;
      await prisma.webPushSubscription
        .update({ where: { id: r.id }, data: { lastUsedAt: new Date() } })
        .catch(() => null);
    } else {
      failed++;
      if (r.expired) {
        expired++;
        await prisma.webPushSubscription
          .update({ where: { id: r.id }, data: { active: false } })
          .catch(() => null);
      }
    }
  }

  return { sent, failed, expired };
}
