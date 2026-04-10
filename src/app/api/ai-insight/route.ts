import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

// ── 圖表 URL 產生器（QuickChart.io，免費無須金鑰） ────────────────────────────
const CHART_COLORS = [
  "#4299E1", "#48BB78", "#F6AD55", "#FC8181", "#B794F4",
  "#76E4F7", "#F687B3", "#68D391", "#FBD38D", "#90CDF4",
];

function buildDonutUrl(
  labels: string[],
  values: number[],
): string {
  const cfg = {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: CHART_COLORS.slice(0, labels.length),
        borderWidth: 2,
        borderColor: "#1C2333",
      }],
    },
    options: {
      plugins: {
        legend: { position: "right", labels: { color: "#E2E8F0", font: { size: 13 } } },
        datalabels: { color: "#fff", font: { weight: "bold" },
          formatter: (v: number, ctx: { chart: { data: { datasets: { data: number[] }[] } } }) => {
            const total = (ctx.chart.data.datasets[0].data as number[]).reduce((a, b) => a + b, 0);
            return total > 0 ? `${Math.round(v / total * 100)}%` : "";
          },
        },
      },
    },
  };
  return `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(cfg))}&width=520&height=280&backgroundColor=%231C2333`;
}

function buildBarUrl(
  labels: string[],
  curValues: number[],
  prevValues: number[],
  curLabel: string,
  prevLabel: string,
): string {
  const cfg = {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: curLabel,  data: curValues,  backgroundColor: "#4299E1" },
        { label: prevLabel, data: prevValues, backgroundColor: "#2A3650" },
      ],
    },
    options: {
      plugins: {
        legend: { labels: { color: "#E2E8F0" } },
      },
      scales: {
        x: { ticks: { color: "#94A3B8" }, grid: { color: "#2A3650" } },
        y: { ticks: { color: "#94A3B8" }, grid: { color: "#2A3650" } },
      },
    },
  };
  return `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(cfg))}&width=560&height=280&backgroundColor=%231C2333`;
}

// ── 共用資料拉取 ──────────────────────────────────────────────────────────────
async function gatherData(month: string) {
  const user = await prisma.user.findFirst({ where: { lineUserId: "dashboard_user" } });
  if (!user) return null;

  const [y, m] = month.split("-").map(Number);
  const curStart = new Date(y, m - 1, 1);
  const curEnd   = new Date(y, m, 1);
  const prevDate = new Date(y, m - 2, 1);
  const prevEnd  = new Date(y, m - 1, 1);

  const [currentSpending, budgets, goals, prevSpending, incomeRows] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["category"],
      where: { userId: user.id, type: "支出", category: { not: "轉帳" }, date: { gte: curStart, lt: curEnd } },
      _sum: { amount: true },
    }),
    prisma.budget.findMany({ where: { userId: user.id } }),
    prisma.financialGoal.findMany({ where: { userId: user.id } }),
    prisma.transaction.groupBy({
      by: ["category"],
      where: { userId: user.id, type: "支出", category: { not: "轉帳" }, date: { gte: prevDate, lt: prevEnd } },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ["type"],
      where: { userId: user.id, type: "收入", date: { gte: curStart, lt: curEnd } },
      _sum: { amount: true },
    }),
  ]);

  const totalIncome  = Number(incomeRows[0]?._sum.amount ?? 0);
  const totalExpense = currentSpending.reduce((s, r) => s + Number(r._sum.amount ?? 0), 0);
  const savingRate   = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome * 100).toFixed(1) : "N/A";

  const spendingMap = new Map(currentSpending.map(r => [r.category, Math.round(Number(r._sum.amount ?? 0))]));
  const prevMap     = new Map(prevSpending.map(r => [r.category, Math.round(Number(r._sum.amount ?? 0))]));
  const budgetMap   = new Map(budgets.map(b => [b.category, Math.round(Number(b.amount))]));

  const sortedSpending = Array.from(spendingMap.entries()).sort((a, b) => b[1] - a[1]);

  const overBudget = sortedSpending
    .filter(([cat, amt]) => budgetMap.has(cat) && amt > budgetMap.get(cat)!)
    .map(([cat, amt]) => ({ category: cat, spent: amt, budget: budgetMap.get(cat)! }));

  const bigIncreases = sortedSpending
    .map(([cat, cur]) => ({ category: cat, current: cur, previous: prevMap.get(cat) ?? 0, diff: cur - (prevMap.get(cat) ?? 0) }))
    .filter(x => x.diff > 500)
    .sort((a, b) => b.diff - a.diff)
    .slice(0, 3);

  const goalsSummary = goals.map(g => ({
    name:    g.name,
    target:  Number(g.targetAmount),
    saved:   Number(g.savedAmount),
    pct:     Math.round(Number(g.savedAmount) / Number(g.targetAmount) * 100),
    dueDate: g.deadline ? g.deadline.toISOString().slice(0, 10) : null,
  }));

  // 圖表 URL
  const donutLabels = sortedSpending.map(([cat]) => cat);
  const donutValues = sortedSpending.map(([, amt]) => amt);
  const barLabels   = Array.from(new Set(donutLabels.concat(Array.from(prevMap.keys())))).slice(0, 8);

  const prevMonth = `${new Date(y, m - 2, 1).getFullYear()}-${String(new Date(y, m - 2, 1).getMonth() + 1).padStart(2, "0")}`;

  const charts = {
    donut: donutLabels.length > 0 ? buildDonutUrl(donutLabels, donutValues) : null,
    bar:   barLabels.length > 0   ? buildBarUrl(
      barLabels,
      barLabels.map(l => spendingMap.get(l) ?? 0),
      barLabels.map(l => prevMap.get(l)     ?? 0),
      month, prevMonth,
    ) : null,
  };

  return {
    month, prevMonth, totalIncome, totalExpense, savingRate,
    sortedSpending, overBudget, bigIncreases, goalsSummary,
    budgetMap, prevMap, charts,
  };
}

// ── GET /api/ai-insight?month=YYYY-MM ────────────────────────────────────────
export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get("month");
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "請提供 month 參數（格式：YYYY-MM）" }, { status: 400 });
  }

  const d = await gatherData(month);
  if (!d) return NextResponse.json({ error: "找不到使用者" }, { status: 404 });

  const dataContext = buildDataContext(d);

  const systemPrompt = `你是一個毒舌但精準的個人財務健檢師，角色設定：
- 嗆但有料：每句話都帶刺，但每個刺都是數據支撐的
- 不給台階：花太多就說「花太多」，儲蓄率爛就說「這儲蓄率拿去銀行他們都不好意思收」
- 沒有廢話開場、沒有鼓勵結尾、沒有「繼續加油」
- 好的地方也承認，但語氣是「這次沒搞砸，難得」
- 具體到可以當成今天行動清單的建議
- 說話像一個比你還清楚你財務狀況的損友
- 繁體中文，偶爾一兩個台灣用語`;

  const userPrompt = `幫我健檢 ${month} 的財務，不要給面子：

${dataContext}

輸出格式（純文字，不要 ## 或 ** 這種符號，每段空行分隔）：
第一行：一句評語（要夠嗆，把這個月的財務表現定性）
• 接著列 2-3 個最需要面對的問題，每條都要有具體數字
• 最後 1-2 個馬上可以做的行動，說清楚做什麼、省多少

200 字以內，每個字都要有意義。`;

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system:     systemPrompt,
      messages:   [{ role: "user", content: userPrompt }],
    });

    const insight = msg.content[0].type === "text" ? msg.content[0].text : "";
    return NextResponse.json({
      insight,
      month,
      charts: d.charts,
      meta: {
        totalIncome:     Math.round(d.totalIncome),
        totalExpense:    Math.round(d.totalExpense),
        savingRate:      d.savingRate,
        overBudgetCount: d.overBudget.length,
      },
    });
  } catch (e) {
    console.error("AI insight error:", e);
    return NextResponse.json({ error: "AI 分析暫時不可用" }, { status: 500 });
  }
}

// ── 輔助：組裝 dataContext ────────────────────────────────────────────────────
function buildDataContext(d: Awaited<ReturnType<typeof gatherData>> & object) {
  if (!d) return "";
  return `
月份：${d.month}
本月收入：NT$${Math.round(d.totalIncome).toLocaleString()}
本月支出：NT$${Math.round(d.totalExpense).toLocaleString()}
儲蓄率：${d.savingRate}%

各分類支出（由高到低）：
${d.sortedSpending.map(([cat, amt]) => {
  const budget  = d.budgetMap.get(cat);
  const prev    = d.prevMap.get(cat);
  const budgStr = budget ? ` / 預算 NT$${budget.toLocaleString()} (${Math.round(amt / budget * 100)}%)` : "";
  const prevStr = prev   ? ` [上月 NT$${prev.toLocaleString()}]` : "";
  return `  • ${cat}：NT$${amt.toLocaleString()}${budgStr}${prevStr}`;
}).join("\n")}

${d.overBudget.length > 0
  ? `超標：${d.overBudget.map(x => `${x.category}（花了 NT$${x.spent.toLocaleString()}，超出 NT$${(x.spent - x.budget).toLocaleString()}）`).join("、")}` : "無超標"}
${d.bigIncreases.length > 0
  ? `環比暴增：${d.bigIncreases.map(x => `${x.category} +NT$${x.diff.toLocaleString()}`).join("、")}` : ""}

財務目標：
${d.goalsSummary.length > 0
  ? d.goalsSummary.map(g => `  • ${g.name}：${g.pct}% (NT$${Math.round(g.saved).toLocaleString()} / NT$${Math.round(g.target).toLocaleString()})${g.dueDate ? ` 截止 ${g.dueDate}` : ""}`).join("\n")
  : "  （尚未設定）"}
`.trim();
}

