import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";
import { taipeiTodayAsUTC } from "@/lib/time";
import { pushMessage } from "@/lib/line";

export const dynamic = "force-dynamic";

function getISOWeek(date: Date): { year: number; week: number } {
  // 以週四為基準計算 ISO 週年和週號
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // 調整到本週四（ISO 8601：週一=1...週日=7，週四=4）
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

/**
 * POST /api/cron/weekly-review
 * 每週一由 Cronicle 觸發，生成上週回顧：
 *   1. 計算上週日期範圍（台灣時間，週一到週日）
 *   2. 拉取上週交易與已完成任務
 *   3. 用 Claude 生成 markdown 週回顧摘要
 *   4. Upsert WeeklyReview 快照
 *   5. 推 LINE 通知
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. 驗證
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 2. 計算上週日期範圍（台灣時間）
    const nowTW = taipeiTodayAsUTC(); // 台灣今天的 UTC midnight
    const dow = nowTW.getUTCDay(); // 0=Sunday, 1=Monday...
    const daysToLastMonday = dow === 0 ? 6 : dow + 6; // 距離上週一的天數
    const lastMonday = new Date(
      Date.UTC(
        nowTW.getUTCFullYear(),
        nowTW.getUTCMonth(),
        nowTW.getUTCDate() - daysToLastMonday,
      ),
    );
    const lastSunday = new Date(
      Date.UTC(
        lastMonday.getUTCFullYear(),
        lastMonday.getUTCMonth(),
        lastMonday.getUTCDate() + 7,
      ),
    );

    // ISO week number（正確處理跨年邊界）
    const { year, week: weekNum } = getISOWeek(lastMonday);
    const week = `${year}-W${String(weekNum).padStart(2, "0")}`;

    // 3. 找 user
    const user = await prisma.user.findFirst({
      where: { lineUserId: "dashboard_user" },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 4. 拉取資料
    const [transactions, incomeAgg, doneTasks, allTasksCount] =
      await Promise.all([
        // 上週支出（依分類加總）
        prisma.transaction.groupBy({
          by: ["category"],
          where: {
            userId: user.id,
            type: "支出",
            date: { gte: lastMonday, lt: lastSunday },
          },
          _sum: { amount: true },
          orderBy: { _sum: { amount: "desc" } },
        }),
        // 上週收入
        prisma.transaction.aggregate({
          where: {
            userId: user.id,
            type: "收入",
            date: { gte: lastMonday, lt: lastSunday },
          },
          _sum: { amount: true },
        }),
        // 上週完成任務
        prisma.task.findMany({
          where: {
            userId: user.id,
            status: "done",
            updatedAt: { gte: lastMonday, lt: lastSunday },
          },
        }),
        // 截至上週末的總任務數
        prisma.task.count({
          where: {
            userId: user.id,
            createdAt: { lt: lastSunday },
          },
        }),
      ]);

    const totalExpense = transactions.reduce(
      (s, t) => s + Number(t._sum.amount ?? 0),
      0,
    );
    const totalIncome = Number(incomeAgg._sum.amount ?? 0);

    // 5. Claude 生成週回顧摘要
    let summary = "";
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const msg = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 800,
          system:
            "你是蛋糕的個人 AI 助理，請用繁體中文、輕鬆友善的語氣，生成一份週回顧摘要。",
          messages: [
            {
              role: "user",
              content: `本週財務：總支出 NT$${Math.round(totalExpense).toLocaleString()}，總收入 NT$${Math.round(totalIncome).toLocaleString()}。
各類別支出：${
                transactions
                  .map(
                    (t) =>
                      `${t.category} NT$${Math.round(Number(t._sum.amount ?? 0)).toLocaleString()}`,
                  )
                  .join("、") || "無記錄"
              }。
任務完成：${doneTasks.length} 件。
請生成 3-5 句的週回顧摘要，包含財務亮點、任務進度、一個鼓勵或建議。`,
            },
          ],
        });
        summary =
          msg.content[0].type === "text" ? msg.content[0].text : "";
      } catch (e) {
        console.error("[cron/weekly-review] Claude error:", e);
      }
    }

    // 6. Upsert WeeklyReview
    await prisma.weeklyReview.upsert({
      where: { userId_week: { userId: user.id, week } },
      update: {
        summary,
        meta: {
          totalExpense,
          totalIncome,
          tasksCompleted: doneTasks.length,
          tasksTotal: allTasksCount,
        },
      },
      create: {
        userId: user.id,
        week,
        summary,
        meta: {
          totalExpense,
          totalIncome,
          tasksCompleted: doneTasks.length,
          tasksTotal: allTasksCount,
        },
      },
    });

    // 7. LINE push（若有 LINE_USER_ID）
    const lineUserId = process.env.LINE_USER_ID;
    if (lineUserId) {
      const lineText = `📊 ${week} 週回顧已生成！\n支出 NT$${Math.round(totalExpense).toLocaleString()} / 收入 NT$${Math.round(totalIncome).toLocaleString()}\n任務完成 ${doneTasks.length} 件\n\n${summary}`;
      try {
        await pushMessage(lineUserId, lineText);
      } catch (e) {
        console.error("[cron/weekly-review] LINE push error:", e);
      }
    }

    // 8. 回傳
    return NextResponse.json({
      ok: true,
      week,
      totalExpense: Math.round(totalExpense),
      totalIncome: Math.round(totalIncome),
      tasksCompleted: doneTasks.length,
    });
  } catch (e) {
    console.error("[cron/weekly-review]", e);
    return NextResponse.json(
      { error: "Weekly review cron failed" },
      { status: 500 },
    );
  }
}
