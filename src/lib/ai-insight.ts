import { prisma } from "@/lib/db";

const CHART_COLORS = [
  "#4299E1", "#48BB78", "#F6AD55", "#FC8181", "#B794F4",
  "#76E4F7", "#F687B3", "#68D391", "#FBD38D", "#90CDF4",
];

export const WARM_INSIGHT_SYSTEM_PROMPT = `你是一個像智者一樣的理財朋友，角色設定：
- 有洞見也有情感：你不只是看數字，你看到數字背後的人
- 溫柔而誠懇：錢的流向其實也反映了這個月在意什麼，你從這個角度切入
- 肯定做對的地方：不是客套的誇獎，是真的看到什麼值得被看見
- 提醒但不說教：觀察到失衡會溫柔指出，給出具體但不嚴厲的建議
- 說話像一個活過一些事的朋友：不急、不慌、偶爾一點人生感
- 繁體中文台灣用語，語氣溫暖但不過度甜膩
- 拒絕：反話、損人、廢話開場、客套結尾、空洞鼓勵`;

export function buildWarmInsightUserPrompt(month: string, dataContext: string): string {
  return `陪我看看 ${month} 這個月的財務流向：

${dataContext}

輸出格式（純文字，不要 ## 或 ** 這種 markdown 符號，每段用空行分隔）：

第一段：用 1-2 句話讀出這個月的財務節奏（例：「這個月看得出你在把自己照顧好」「這個月有幾筆是衝動，但你也留下了餘裕」）。要從數字讀出故事，不是念數字。

第二段：挑 1-2 個值得被看見的地方，具體說出你觀察到什麼（可能是儲蓄率穩住、某類支出控制得當、或某個目標推進了）。

第三段：溫柔指出 1-2 個可以留意的地方，附上具體數字，給一個可行的小行動（不是指令，是建議）。

第四段：一句收尾話，不要「加油」「繼續努力」這種客套；可以是一個小觀察、一個提醒、或一句像朋友說的話。

總長 200-260 字。每個字都要有溫度。`;
}

function buildDonutUrl(labels: string[], values: number[]): string {
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

function buildBarUrl(labels: string[], curValues: number[], prevValues: number[], curLabel: string, prevLabel: string): string {
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
      plugins: { legend: { labels: { color: "#E2E8F0" } } },
      scales: {
        x: { ticks: { color: "#94A3B8" }, grid: { color: "#2A3650" } },
        y: { ticks: { color: "#94A3B8" }, grid: { color: "#2A3650" } },
      },
    },
  };
  return `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(cfg))}&width=560&height=280&backgroundColor=%231C2333`;
}

export interface InsightData {
  month:           string;
  prevMonth:       string;
  totalIncome:     number;
  totalExpense:    number;
  savingRate:      string;
  sortedSpending:  [string, number][];
  overBudget:      { category: string; spent: number; budget: number }[];
  bigIncreases:    { category: string; current: number; previous: number; diff: number }[];
  goalsSummary:    { name: string; target: number; saved: number; pct: number; dueDate: string | null }[];
  budgetMap:       Map<string, number>;
  prevMap:         Map<string, number>;
  charts:          { donut: string | null; bar: string | null };
  dataContext:     string;
}

export async function buildInsightData(userId: string, month: string): Promise<InsightData | null> {
  const [y, m] = month.split("-").map(Number);
  const curStart = new Date(y, m - 1, 1);
  const curEnd   = new Date(y, m, 1);
  const prevDate = new Date(y, m - 2, 1);
  const prevEnd  = new Date(y, m - 1, 1);

  const [currentSpending, budgets, goals, prevSpending, incomeRows] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["category"],
      where: { userId, type: "支出", category: { not: "轉帳" }, date: { gte: curStart, lt: curEnd } },
      _sum: { amount: true },
    }),
    prisma.budget.findMany({ where: { userId } }),
    prisma.financialGoal.findMany({ where: { userId } }),
    prisma.transaction.groupBy({
      by: ["category"],
      where: { userId, type: "支出", category: { not: "轉帳" }, date: { gte: prevDate, lt: prevEnd } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { userId, type: "收入", date: { gte: curStart, lt: curEnd } },
      _sum: { amount: true },
    }),
  ]);

  const totalIncome  = Number(incomeRows._sum.amount ?? 0);
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

  const donutLabels = sortedSpending.map(([cat]) => cat);
  const donutValues = sortedSpending.map(([, amt]) => amt);
  const barLabels   = Array.from(new Set(donutLabels.concat(Array.from(prevMap.keys())))).slice(0, 8);
  const prevMonth   = `${new Date(y, m - 2, 1).getFullYear()}-${String(new Date(y, m - 2, 1).getMonth() + 1).padStart(2, "0")}`;

  const charts = {
    donut: donutLabels.length > 0 ? buildDonutUrl(donutLabels, donutValues) : null,
    bar:   barLabels.length > 0 ? buildBarUrl(
      barLabels,
      barLabels.map(l => spendingMap.get(l) ?? 0),
      barLabels.map(l => prevMap.get(l)     ?? 0),
      month, prevMonth,
    ) : null,
  };

  const dataContext = buildDataContext({
    month, totalIncome, totalExpense, savingRate,
    sortedSpending, overBudget, bigIncreases, goalsSummary,
    budgetMap, prevMap,
  });

  return {
    month, prevMonth, totalIncome, totalExpense, savingRate,
    sortedSpending, overBudget, bigIncreases, goalsSummary,
    budgetMap, prevMap, charts, dataContext,
  };
}

function buildDataContext(d: {
  month: string; totalIncome: number; totalExpense: number; savingRate: string;
  sortedSpending: [string, number][];
  overBudget: { category: string; spent: number; budget: number }[];
  bigIncreases: { category: string; current: number; previous: number; diff: number }[];
  goalsSummary: { name: string; target: number; saved: number; pct: number; dueDate: string | null }[];
  budgetMap: Map<string, number>;
  prevMap: Map<string, number>;
}): string {
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
  ? `環比增加較多：${d.bigIncreases.map(x => `${x.category} +NT$${x.diff.toLocaleString()}`).join("、")}` : ""}

財務目標：
${d.goalsSummary.length > 0
  ? d.goalsSummary.map(g => `  • ${g.name}：${g.pct}% (NT$${Math.round(g.saved).toLocaleString()} / NT$${Math.round(g.target).toLocaleString()})${g.dueDate ? ` 截止 ${g.dueDate}` : ""}`).join("\n")
  : "  （尚未設定）"}
`.trim();
}
