import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();
  let intervalId: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      let lastCheck = new Date();

      // 初始連線確認
      controller.enqueue(encoder.encode(": connected\n\n"));

      // 每 2 秒查一次資料庫，有新紀錄就推送事件
      intervalId = setInterval(async () => {
        const now = new Date();
        try {
          const count = await prisma.auditLog.count({
            where: { createdAt: { gt: lastCheck } },
          });
          lastCheck = now;
          if (count > 0) {
            controller.enqueue(encoder.encode("data: update\n\n"));
          }
        } catch {
          if (intervalId) clearInterval(intervalId);
        }
      }, 2000);
    },
    cancel() {
      if (intervalId) clearInterval(intervalId);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection":    "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
