#!/usr/bin/env node
/**
 * LINE 記帳系統 MCP Server
 * 讓 Claude Code 可以直接查詢記帳資料
 *
 * 啟動：npx tsx src/mcp/server.ts
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const server = new Server(
  { name: "line-accounting", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// ── 工具清單 ───────────────────────────────────────────────────────────────────
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_summary",
      description: "查詢收支摘要，包含月份收入、支出、結餘，以及各分類金額",
      inputSchema: {
        type: "object",
        properties: {
          month: { type: "string", description: "月份，格式 YYYY-MM，不填則為本月" },
        },
      },
    },
    {
      name: "get_transactions",
      description: "查詢交易記錄列表",
      inputSchema: {
        type: "object",
        properties: {
          limit:    { type: "number", description: "筆數，預設 20" },
          category: { type: "string", description: "篩選分類，如「飲食」「交通」" },
          type:     { type: "string", description: "收入 或 支出" },
          month:    { type: "string", description: "月份 YYYY-MM，不填則全部" },
        },
      },
    },
    {
      name: "get_balances",
      description: "查詢所有銀行帳戶餘額與現金餘額",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_budgets",
      description: "查詢本月各分類預算與實際支出對比",
      inputSchema: {
        type: "object",
        properties: {
          month: { type: "string", description: "月份 YYYY-MM，不填則為本月" },
        },
      },
    },
    {
      name: "get_net_worth",
      description: "查詢淨資產、總資產、貸款負債、信用卡未繳金額",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_loans",
      description: "查詢所有貸款明細，包含剩餘本金、利率、每月利息、距下次繳款天數",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_income_breakdown",
      description: "分析收入來源結構，區分 salary/freelance/bonus/transfer，計算穩定 vs 一次性收入比例",
      inputSchema: {
        type: "object",
        properties: {
          month: { type: "string", description: "月份 YYYY-MM，不填則為本月" },
        },
      },
    },
    {
      name: "get_weekly_report",
      description: "產生本週財務週報：本週收支、本月預算進度、本週到期貸款、支出分類排行、待處理事項",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_spending_trend",
      description: "查詢最近 N 個月各分類支出趨勢，用於跨月比較消費習慣",
      inputSchema: {
        type: "object",
        properties: {
          months:   { type: "number", description: "回溯月數，預設 3" },
          category: { type: "string", description: "限定單一分類，不填則回傳所有分類" },
        },
      },
    },
    {
      name: "get_loan_summary",
      description: "查詢貸款總覽：各貸款剩餘本金、每月應繳利息、預計還清日，以及合計每月還款負擔",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "bulk_set_category",
      description: "批量修改多筆交易的分類，適合整批重新歸類",
      inputSchema: {
        type: "object",
        required: ["ids", "category"],
        properties: {
          ids:      { type: "array", items: { type: "string" }, description: "交易 id 陣列" },
          category: { type: "string", description: "新分類名稱" },
          type:     { type: "string", description: "同時修改收支類型（收入 / 支出），選填" },
        },
      },
    },
    {
      name: "get_cashflow_forecast",
      description: "預測本月底結餘：依目前消費速率推算月底支出，加計未繳貸款，估算帳戶剩餘金額",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "set_income_source",
      description: "設定收入交易的來源類型。source 可為 salary（薪資）/ freelance（接案）/ bonus（獎金）/ transfer（定期匯款），填 null 清除標記。可用 get_transactions 先查詢交易 id。",
      inputSchema: {
        type: "object",
        required: ["id", "source"],
        properties: {
          id:     { type: "string", description: "交易 id" },
          source: {
            description: "salary / freelance / bonus / transfer，或 null 清除",
            enum: ["salary", "freelance", "bonus", "transfer", null],
          },
        },
      },
    },
    {
      name: "get_today_spending",
      description: "查詢今天的支出：總金額、筆數、各筆明細（分類、備註、金額）",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_category_trend",
      description: "查詢指定分類近 N 個月的月度支出趨勢，並計算月均值、最高/最低月、與前月相比的變化幅度",
      inputSchema: {
        type: "object",
        required: ["category"],
        properties: {
          category: { type: "string", description: "分類名稱，如「飲食」「交通」「購物」" },
          months:   { type: "number", description: "回溯月數，預設 6" },
        },
      },
    },
    {
      name: "get_goals",
      description: "列出所有財務目標，包含進度百分比、距目標差額、預計達標日（依目前月均儲蓄推算）",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_grad_school_plan",
      description: "查詢研究所入學（2028/09）儲蓄規劃：距入學月數、目標金額、目前存款、每月需存金額、預計達標情況",
      inputSchema: {
        type: "object",
        properties: {
          tuition:  { type: "number", description: "學費總計（預設 300000）" },
          living:   { type: "number", description: "每月生活費（預設 25000）" },
          duration: { type: "number", description: "就讀月數（預設 24）" },
        },
      },
    },
    {
      name: "get_budget_alert",
      description: "查詢本月預算警示：已超標或已使用超過 80% 的分類，以及剩餘可用預算",
      inputSchema: {
        type: "object",
        properties: {
          month: { type: "string", description: "月份 YYYY-MM，不填則為本月" },
        },
      },
    },
    {
      name: "get_fixed_expenses",
      description: "查詢固定支出清單：每筆名稱、金額、分類、扣款日，以及月度合計",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_credit_cards",
      description: "查詢信用卡清單：信用額度、未繳帳單金額、帳單截止日、繳費截止日、距截止幾天",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_health_score",
      description: "計算當前財務健康評分（0–100）：儲蓄率、負債比、預算達成率三維度，並給出具體改善建議",
      inputSchema: {
        type: "object",
        properties: {
          month: { type: "string", description: "計算基準月份 YYYY-MM，不填則為本月" },
        },
      },
    },
    {
      name: "get_fire_progress",
      description: "查詢 FIRE（財務自由提前退休）進度：目標金額、目前資產、缺口、預計達標年數",
      inputSchema: {
        type: "object",
        properties: {
          monthlyExpense:  { type: "number", description: "每月生活費（不填則用近 3 個月平均）" },
          annualReturnPct: { type: "number", description: "年化投資報酬率 %（預設 5）" },
          safeWithdrawPct: { type: "number", description: "安全提領率 %（預設 4，即 25x 法則）" },
        },
      },
    },
    {
      name: "get_subscription_summary",
      description: "查詢已確認的訂閱清單：名稱、月費、年費合計，以及本月訂閱總支出",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_notifications",
      description: "取得所有財務警示通知：預算超標、信用卡帳單到期、貸款繳款日、目標逾期",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_annual_report",
      description: "指定年度完整財報摘要：年度收支、各月趨勢、分類排行、儲蓄率、最高/最低消費月",
      inputSchema: {
        type: "object",
        properties: {
          year: { type: "number", description: "年份，不填則為今年" },
        },
      },
    },
  ],
}));

// ── 工具實作 ───────────────────────────────────────────────────────────────────
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  const a = (args ?? {}) as Record<string, unknown>;

  async function getDashUser() {
    return prisma.user.findFirst({ where: { lineUserId: "dashboard_user" } });
  }

  // 稽核日誌：每次 MCP 工具呼叫都記錄，不 await 以免影響回應速度
  prisma.auditLog.create({
    data: { action: "mcp_call", tool: name, params: a as never, status: "success" },
  }).catch((e: unknown) => console.error("[audit] mcp_call 記錄失敗:", e));

  try {
    // ── get_summary ──────────────────────────────────────────────────────────
    if (name === "get_summary") {
      const now   = new Date();
      const month = (a.month as string) ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const [y, m] = month.split("-").map(Number);
      const start  = new Date(y, m - 1, 1);
      const end    = new Date(y, m, 1);

      const txs = await prisma.transaction.findMany({
        where: { date: { gte: start, lt: end }, category: { not: "轉帳" } },
      });

      const income  = txs.filter(t => t.type === "收入").reduce((s, t) => s + Number(t.amount), 0);
      const expense = txs.filter(t => t.type === "支出").reduce((s, t) => s + Number(t.amount), 0);

      const catMap = new Map<string, number>();
      for (const t of txs.filter(t => t.type === "支出")) {
        catMap.set(t.category, (catMap.get(t.category) ?? 0) + Number(t.amount));
      }
      const categories = Array.from(catMap.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([category, total]) => ({ category, total }));

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ month, income, expense, net: income - expense, categories }, null, 2),
        }],
      };
    }

    // ── get_transactions ─────────────────────────────────────────────────────
    if (name === "get_transactions") {
      const limit  = Number(a.limit ?? 20);
      const where: Record<string, unknown> = {};
      if (a.category) where.category = a.category;
      if (a.type)     where.type     = a.type;
      if (a.month) {
        const [y, m] = (a.month as string).split("-").map(Number);
        where.date = { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) };
      }

      const txs = await prisma.transaction.findMany({ where, orderBy: { date: "desc" }, take: limit });

      return {
        content: [{
          type: "text",
          text: JSON.stringify(txs.map(t => {
            return {
              id:           t.id,
              date:         t.date.toISOString().split("T")[0],
              type:         t.type,
              amount:       Number(t.amount),
              category:     t.category,
              note:         t.note,
              source:       t.source,
              incomeSource: t.incomeSource ?? undefined,
            };
          }), null, 2),
        }],
      };
    }

    // ── get_balances ─────────────────────────────────────────────────────────
    if (name === "get_balances") {
      const user     = await getDashUser();
      const balances = await prisma.bankBalance.findMany({
        where: user ? { userId: user.id, source: { not: "cash" } } : {},
      });

      // 現金動態計算
      const [wd, dep, lineExp, lineInc] = await Promise.all([
        prisma.transaction.aggregate({ where: { category: "現金", type: "支出" }, _sum: { amount: true } }),
        prisma.transaction.aggregate({ where: { category: "現金", type: "收入" }, _sum: { amount: true } }),
        prisma.transaction.aggregate({ where: { source: "line", type: "支出", category: { not: "現金" } }, _sum: { amount: true } }),
        prisma.transaction.aggregate({ where: { source: "line", type: "收入", category: { not: "現金" } }, _sum: { amount: true } }),
      ]);

      const cashBalance =
        Number(wd._sum.amount ?? 0) - Number(dep._sum.amount ?? 0) -
        Number(lineExp._sum.amount ?? 0) + Number(lineInc._sum.amount ?? 0);

      const result = [
        ...balances.map(b => ({
          source:  b.source,
          balance: Number(b.balance),
          asOfDate: b.asOfDate.toISOString().split("T")[0],
        })),
        { source: "cash", balance: cashBalance, asOfDate: new Date().toISOString().split("T")[0] },
      ];

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }

    // ── get_budgets ──────────────────────────────────────────────────────────
    if (name === "get_budgets") {
      const user  = await getDashUser();
      const now   = new Date();
      const month = (a.month as string) ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const [y, m] = month.split("-").map(Number);
      const start  = new Date(y, m - 1, 1);
      const end    = new Date(y, m, 1);

      const [budgets, spending] = await Promise.all([
        prisma.budget.findMany({ where: user ? { userId: user.id } : {} }),
        prisma.transaction.groupBy({
          by: ["category"],
          where: { date: { gte: start, lt: end }, type: "支出" },
          _sum: { amount: true },
        }),
      ]);

      const spendMap = Object.fromEntries(spending.map(s => [s.category, Number(s._sum.amount ?? 0)]));
      const result   = budgets.map(b => ({
        category: b.category,
        budget:   Number(b.amount),
        spent:    spendMap[b.category] ?? 0,
        remaining: Number(b.amount) - (spendMap[b.category] ?? 0),
        pct:      Math.round(((spendMap[b.category] ?? 0) / Number(b.amount)) * 100),
      }));

      return { content: [{ type: "text", text: JSON.stringify({ month, budgets: result }, null, 2) }] };
    }

    // ── get_net_worth ────────────────────────────────────────────────────────
    if (name === "get_net_worth") {
      const [balances, loans, ccBills] = await Promise.all([
        prisma.bankBalance.findMany({ where: { source: { not: "cash" } } }),
        prisma.loan.findMany({ where: { status: "active" } }),
        prisma.creditCardBill.findMany({ where: { status: { in: ["unpaid", "partial"] } } }),
      ]);

      const totalAssets     = balances.reduce((s, b) => s + Number(b.balance), 0);
      const totalLoanDebt   = loans.reduce((s, l) => s + Number(l.remainingPrincipal), 0);
      const totalCreditDebt = ccBills.reduce((s, b) => s + (Number(b.totalAmount) - Number(b.paidAmount)), 0);
      const monthlyInterest = loans.reduce((s, l) => s + (Number(l.remainingPrincipal) * Number(l.interestRate) / 100 / 12), 0);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            totalAssets,
            totalLoanDebt,
            totalCreditDebt,
            totalDebt:    totalLoanDebt + totalCreditDebt,
            netWorth:     totalAssets - totalLoanDebt - totalCreditDebt,
            monthlyInterest: Math.round(monthlyInterest),
          }, null, 2),
        }],
      };
    }

    // ── get_loans ────────────────────────────────────────────────────────────
    if (name === "get_loans") {
      const loans = await prisma.loan.findMany({
        where: { status: "active" },
        include: { payments: { orderBy: { paymentDate: "desc" }, take: 1 } },
      });

      const today    = new Date();
      const todayDay = today.getDate();

      const nextPayment = (paymentDay: number | null): { daysUntilPayment: number; nextPaymentDate: string } | null => {
        if (paymentDay === null) return null;
        const d = todayDay <= paymentDay
          ? new Date(today.getFullYear(), today.getMonth(), paymentDay)
          : new Date(today.getFullYear(), today.getMonth() + 1, paymentDay);
        const days = Math.round((d.getTime() - new Date(today.getFullYear(), today.getMonth(), todayDay).getTime()) / 86400000);
        return { daysUntilPayment: days, nextPaymentDate: d.toISOString().split("T")[0] };
      };

      return {
        content: [{
          type: "text",
          text: JSON.stringify(loans.map(l => ({
            name:               l.name,
            lender:             l.lender,
            type:               l.type,
            remainingPrincipal: Number(l.remainingPrincipal),
            interestRate:       Number(l.interestRate),
            monthlyInterest:    Math.round(Number(l.remainingPrincipal) * Number(l.interestRate) / 100 / 12),
            paymentDay:         l.paymentDay,
            ...nextPayment(l.paymentDay),
            endDate:            l.endDate?.toISOString().split("T")[0],
          })), null, 2),
        }],
      };
    }

    // ── get_income_breakdown ─────────────────────────────────────────────────
    if (name === "get_income_breakdown") {
      const now   = new Date();
      const month = (a.month as string) ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const [y, m] = month.split("-").map(Number);
      const start  = new Date(y, m - 1, 1);
      const end    = new Date(y, m, 1);

      const txs = await prisma.transaction.findMany({
        where: { type: "收入", date: { gte: start, lt: end } },
        select: { amount: true, incomeSource: true, note: true, category: true },
      });

      const groups: Record<string, number> = {
        salary: 0, freelance: 0, bonus: 0, transfer: 0, untagged: 0,
      };
      for (const t of txs) {
        const key = t.incomeSource ?? "untagged";
        groups[key] = (groups[key] ?? 0) + Number(t.amount);
      }

      const total      = Object.values(groups).reduce((s, v) => s + v, 0);
      const recurring  = groups.salary + groups.transfer;
      const oneTime    = groups.freelance + groups.bonus;

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            month,
            total,
            breakdown: groups,
            recurringTotal:  recurring,
            oneTimeTotal:    oneTime,
            recurringPct:    total ? Math.round(recurring / total * 100) : 0,
            oneTimePct:      total ? Math.round(oneTime   / total * 100) : 0,
            untaggedCount:   txs.filter(t => !t.incomeSource).length,
          }, null, 2),
        }],
      };
    }

    // ── get_weekly_report ────────────────────────────────────────────────────
    if (name === "get_weekly_report") {
      const now      = new Date();
      const todayDay = now.getDate();

      // 本週起訖（週一 ~ 今天）
      const dayOfWeek  = now.getDay() === 0 ? 6 : now.getDay() - 1; // 0=週一
      const weekStart  = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
      const weekEnd    = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

      // 本月起訖
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

      const [weekTxs, monthTxs, loans, budgets, monthSpending] = await Promise.all([
        prisma.transaction.findMany({
          where: { date: { gte: weekStart, lt: weekEnd }, category: { not: "轉帳" } },
        }),
        prisma.transaction.findMany({
          where: { date: { gte: monthStart, lt: monthEnd }, category: { not: "轉帳" } },
        }),
        prisma.loan.findMany({ where: { status: "active" } }),
        prisma.budget.findMany(),
        prisma.transaction.groupBy({
          by: ["category"],
          where: { date: { gte: monthStart, lt: monthEnd }, type: "支出" },
          _sum: { amount: true },
        }),
      ]);

      // 本週收支
      const weekIncome  = weekTxs.filter(t => t.type === "收入").reduce((s, t) => s + Number(t.amount), 0);
      const weekExpense = weekTxs.filter(t => t.type === "支出").reduce((s, t) => s + Number(t.amount), 0);

      // 本週支出分類排行
      const weekCatMap = new Map<string, number>();
      for (const t of weekTxs.filter(t => t.type === "支出")) {
        weekCatMap.set(t.category, (weekCatMap.get(t.category) ?? 0) + Number(t.amount));
      }
      const weekTopCats = Array.from(weekCatMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([category, total]) => ({ category, total }));

      // 本月預算進度
      const spendMap = Object.fromEntries(monthSpending.map(s => [s.category, Number(s._sum.amount ?? 0)]));
      const budgetProgress = budgets.map(b => ({
        category:  b.category,
        budget:    Number(b.amount),
        spent:     spendMap[b.category] ?? 0,
        pct:       Math.round(((spendMap[b.category] ?? 0) / Number(b.amount)) * 100),
        overBudget: (spendMap[b.category] ?? 0) > Number(b.amount),
      }));

      // 本週到期貸款（7 天內）
      const dueSoon = loans
        .filter(l => l.paymentDay !== null)
        .map(l => {
          const pd   = l.paymentDay!;
          const days = todayDay <= pd
            ? pd - todayDay
            : new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - todayDay + pd;
          const date = todayDay <= pd
            ? new Date(now.getFullYear(), now.getMonth(), pd)
            : new Date(now.getFullYear(), now.getMonth() + 1, pd);
          return { name: l.lender, paymentDay: pd, daysUntil: days, date: date.toISOString().split("T")[0] };
        })
        .filter(l => l.daysUntil <= 7)
        .sort((a, b) => a.daysUntil - b.daysUntil);

      // 待處理事項
      const todos: string[] = [];
      const otherCount = monthTxs.filter(t => t.category === "其他").length;
      if (otherCount > 0) todos.push(`${otherCount} 筆交易分類為「其他」，建議重新分類`);
      budgetProgress.filter(b => b.overBudget).forEach(b => todos.push(`「${b.category}」預算已超支 ${b.pct - 100}%`));
      budgetProgress.filter(b => b.pct >= 80 && !b.overBudget).forEach(b => todos.push(`「${b.category}」預算已用 ${b.pct}%，接近上限`));
      dueSoon.filter(l => l.daysUntil <= 3).forEach(l => todos.push(`${l.name} 貸款 ${l.daysUntil === 0 ? "今天" : `${l.daysUntil} 天後`}到期`));

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            reportDate:  now.toISOString().split("T")[0],
            weekRange:   { from: weekStart.toISOString().split("T")[0], to: now.toISOString().split("T")[0] },
            week: {
              income:  weekIncome,
              expense: weekExpense,
              net:     weekIncome - weekExpense,
              topCategories: weekTopCats,
            },
            month: {
              month: currentMonth,
              income:  monthTxs.filter(t => t.type === "收入").reduce((s, t) => s + Number(t.amount), 0),
              expense: monthTxs.filter(t => t.type === "支出").reduce((s, t) => s + Number(t.amount), 0),
              budgetProgress,
            },
            dueSoon,
            todos,
          }, null, 2),
        }],
      };
    }

    // ── set_income_source ────────────────────────────────────────────────────
    if (name === "set_income_source") {
      const valid = ["salary", "freelance", "bonus", "transfer", null];
      if (!valid.includes(a.source as string | null)) {
        return { content: [{ type: "text", text: "source 必須為 salary / freelance / bonus / transfer / null" }], isError: true };
      }
      const tx = await prisma.transaction.update({
        where: { id: a.id as string },
        data:  { incomeSource: (a.source as string | null) ?? null },
        select: { id: true, note: true, amount: true, incomeSource: true },
      });
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ ok: true, id: tx.id, note: tx.note, amount: Number(tx.amount), incomeSource: tx.incomeSource }),
        }],
      };
    }

    // ── get_spending_trend ───────────────────────────────────────────────────
    if (name === "get_spending_trend") {
      const monthCount = Number(a.months ?? 3);
      const now        = new Date();
      const results: { month: string; income: number; expense: number; net: number; categories: Record<string, number> }[] = [];

      for (let i = monthCount - 1; i >= 0; i--) {
        const d     = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const start = new Date(d.getFullYear(), d.getMonth(), 1);
        const end   = new Date(d.getFullYear(), d.getMonth() + 1, 1);
        const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

        const where: Record<string, unknown> = {
          date:     { gte: start, lt: end },
          category: { not: "轉帳" },
        };
        if (a.category) where.category = a.category;

        const txs = await prisma.transaction.findMany({ where });

        const income  = txs.filter(t => t.type === "收入").reduce((s, t) => s + Number(t.amount), 0);
        const expense = txs.filter(t => t.type === "支出").reduce((s, t) => s + Number(t.amount), 0);

        const catMap = new Map<string, number>();
        for (const t of txs.filter(t => t.type === "支出")) {
          catMap.set(t.category, (catMap.get(t.category) ?? 0) + Number(t.amount));
        }

        results.push({
          month,
          income,
          expense,
          net:        income - expense,
          categories: Object.fromEntries(
            Array.from(catMap.entries()).sort((a, b) => b[1] - a[1])
          ),
        });
      }

      // 計算各分類跨月變化（最後一月 vs 第一月）
      const allCats = Array.from(
        new Set(results.flatMap(r => Object.keys(r.categories)))
      );
      const trends = allCats.map(cat => {
        const values   = results.map(r => (r.categories as Record<string, number>)[cat] ?? 0);
        const first    = values[0];
        const last     = values[values.length - 1];
        const changePct = first === 0 ? null : Math.round((last - first) / first * 100);
        return { category: cat, values, changePct };
      }).sort((a, b) => (b.values[b.values.length - 1] ?? 0) - (a.values[a.values.length - 1] ?? 0));

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ months: results, trends }, null, 2),
        }],
      };
    }

    // ── get_loan_summary ─────────────────────────────────────────────────────
    if (name === "get_loan_summary") {
      const loans = await prisma.loan.findMany({
        where:   { status: "active" },
        include: { payments: { orderBy: { paymentDate: "desc" }, take: 1 } },
      });

      const today = new Date();
      const items = loans.map(l => {
        const principal      = Number(l.remainingPrincipal);
        const annualRate     = Number(l.interestRate);
        const monthlyInterest = Math.round(principal * annualRate / 100 / 12);

        // 預計還清日（依最近一次還款中的本金攤還推算）
        const lastPayment    = l.payments[0];
        const monthlyPrincipal = lastPayment ? Number(lastPayment.principalPaid) : 0;
        const monthsLeft     = monthlyPrincipal > 0 ? Math.ceil(principal / monthlyPrincipal) : null;
        const payoffDate     = monthsLeft !== null
          ? new Date(today.getFullYear(), today.getMonth() + monthsLeft, 1).toISOString().split("T")[0]
          : null;

        return {
          name:              l.name,
          lender:            l.lender,
          type:              l.type,
          interestRate:      annualRate,
          remainingPrincipal: principal,
          monthlyInterest,
          monthlyPrincipal,
          estimatedMonthlyPayment: monthlyInterest + monthlyPrincipal,
          paymentDay:        l.paymentDay,
          payoffDate,
          monthsLeft,
        };
      });

      const totalRemaining       = items.reduce((s, l) => s + l.remainingPrincipal, 0);
      const totalMonthlyInterest = items.reduce((s, l) => s + l.monthlyInterest, 0);
      const totalMonthlyPayment  = items.reduce((s, l) => s + l.estimatedMonthlyPayment, 0);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            loans: items,
            totals: { totalRemaining, totalMonthlyInterest, totalMonthlyPayment, loanCount: items.length },
          }, null, 2),
        }],
      };
    }

    // ── bulk_set_category ────────────────────────────────────────────────────
    if (name === "bulk_set_category") {
      const ids      = a.ids as string[];
      const category = a.category as string;
      if (!Array.isArray(ids) || ids.length === 0) {
        return { content: [{ type: "text", text: "ids 必須為非空陣列" }], isError: true };
      }

      const data: Record<string, string> = { category };
      if (a.type) data.type = a.type as string;

      const result = await prisma.transaction.updateMany({
        where: { id: { in: ids } },
        data,
      });

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ ok: true, updated: result.count, category, type: a.type ?? "(未修改)" }),
        }],
      };
    }

    // ── get_cashflow_forecast ────────────────────────────────────────────────
    if (name === "get_cashflow_forecast") {
      const now        = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const totalDays  = Math.round((monthEnd.getTime() - monthStart.getTime()) / 86400000);
      const daysElapsed = now.getDate();
      const daysRemaining = totalDays - daysElapsed;

      const [txs, balances, loans] = await Promise.all([
        prisma.transaction.findMany({
          where: { date: { gte: monthStart, lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) }, category: { not: "轉帳" } },
        }),
        prisma.bankBalance.findMany({ where: { source: { not: "cash" } } }),
        prisma.loan.findMany({ where: { status: "active" } }),
      ]);

      const currentIncome  = txs.filter(t => t.type === "收入").reduce((s, t) => s + Number(t.amount), 0);
      const currentExpense = txs.filter(t => t.type === "支出").reduce((s, t) => s + Number(t.amount), 0);
      const dailyAvgExpense = daysElapsed > 0 ? currentExpense / daysElapsed : 0;
      const projectedExpense = Math.round(currentExpense + dailyAvgExpense * daysRemaining);

      // 本月尚未到期的貸款繳款日
      const upcomingPayments = loans
        .filter(l => l.paymentDay !== null && l.paymentDay > now.getDate())
        .map(l => ({
          name:        l.name,
          paymentDay:  l.paymentDay,
          daysUntil:   l.paymentDay! - now.getDate(),
          monthlyInterest: Math.round(Number(l.remainingPrincipal) * Number(l.interestRate) / 100 / 12),
        }));

      const totalBankBalance = balances.reduce((s, b) => s + Number(b.balance), 0);
      const projectedNet     = currentIncome - projectedExpense;
      const projectedEndBalance = Math.round(totalBankBalance + projectedNet);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            month:            `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
            today:            now.toISOString().split("T")[0],
            daysElapsed,
            daysRemaining,
            currentIncome,
            currentExpense,
            dailyAvgExpense:  Math.round(dailyAvgExpense),
            projectedExpense,
            projectedIncome:  currentIncome,
            projectedNet,
            upcomingLoanPayments: upcomingPayments,
            totalBankBalance: Math.round(totalBankBalance),
            projectedEndBalance,
          }, null, 2),
        }],
      };
    }

    // ── get_today_spending ───────────────────────────────────────────────────
    if (name === "get_today_spending") {
      const user = await getDashUser();
      if (!user) return { content: [{ type: "text", text: "找不到用戶" }], isError: true };

      const now   = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

      const txs = await prisma.transaction.findMany({
        where: {
          userId:   user.id,
          date:     { gte: start, lt: end },
          type:     "支出",
          category: { not: "轉帳" },
        },
        orderBy: { date: "desc" },
        select: { id: true, date: true, amount: true, category: true, note: true, source: true },
      });

      const total = txs.reduce((s, t) => s + Number(t.amount), 0);

      const byCategory: Record<string, number> = {};
      for (const t of txs) {
        byCategory[t.category] = (byCategory[t.category] ?? 0) + Number(t.amount);
      }
      const topCategories = Object.entries(byCategory)
        .sort((a, b) => b[1] - a[1])
        .map(([category, amount]) => ({ category, amount }));

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            date:          now.toISOString().split("T")[0],
            totalExpense:  Math.round(total),
            count:         txs.length,
            topCategories,
            transactions:  txs.map(t => ({
              id:       t.id,
              amount:   Number(t.amount),
              category: t.category,
              note:     t.note,
              source:   t.source,
              time:     t.date.toISOString(),
            })),
          }, null, 2),
        }],
      };
    }

    // ── get_category_trend ───────────────────────────────────────────────────
    if (name === "get_category_trend") {
      const user = await getDashUser();
      if (!user) return { content: [{ type: "text", text: "找不到用戶" }], isError: true };

      const category   = a.category as string;
      const monthCount = Number(a.months ?? 6);
      const now        = new Date();
      const monthly: { month: string; amount: number; count: number }[] = [];

      for (let i = monthCount - 1; i >= 0; i--) {
        const d     = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const start = new Date(d.getFullYear(), d.getMonth(), 1);
        const end   = new Date(d.getFullYear(), d.getMonth() + 1, 1);
        const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

        const txs = await prisma.transaction.findMany({
          where: {
            userId:   user.id,
            date:     { gte: start, lt: end },
            type:     "支出",
            category,
          },
          select: { amount: true, note: true },
        });

        monthly.push({
          month,
          amount: Math.round(txs.reduce((s, t) => s + Number(t.amount), 0)),
          count:  txs.length,
        });
      }

      const amounts  = monthly.map(m => m.amount);
      const nonZero  = amounts.filter(v => v > 0);
      const avg      = nonZero.length > 0 ? Math.round(nonZero.reduce((s, v) => s + v, 0) / nonZero.length) : 0;
      const maxMonth = monthly.reduce((a, b) => b.amount > a.amount ? b : a, monthly[0]);
      const minMonth = monthly.filter(m => m.amount > 0).reduce((a, b) => b.amount < a.amount ? b : a, monthly.find(m => m.amount > 0) ?? monthly[0]);

      const last  = monthly[monthly.length - 1].amount;
      const prev  = monthly[monthly.length - 2]?.amount ?? 0;
      const momChange = prev > 0 ? Math.round((last - prev) / prev * 100) : null;

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            category,
            months:      monthCount,
            monthly,
            stats: {
              avg,
              maxMonth: { month: maxMonth.month, amount: maxMonth.amount },
              minMonth: { month: minMonth.month, amount: minMonth.amount },
              latestAmount:   last,
              prevMonthAmount: prev,
              momChangePct:   momChange,
              trend: momChange === null ? "無資料" : momChange > 10 ? "上升" : momChange < -10 ? "下降" : "持平",
            },
          }, null, 2),
        }],
      };
    }

    // ── get_goals ────────────────────────────────────────────────────────────
    if (name === "get_goals") {
      const user = await getDashUser();
      if (!user) return { content: [{ type: "text", text: "尚無資料" }] };

      const goals = await prisma.financialGoal.findMany({
        where:   { userId: user.id },
        orderBy: { createdAt: "asc" },
      });

      // 計算近 6 個月月均淨儲蓄（用於推算達標日）
      const now = new Date();
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
      const recentTxs = await prisma.transaction.findMany({
        where: {
          userId:   user.id,
          date:     { gte: sixMonthsAgo },
          category: { not: "轉帳" },
        },
        select: { type: true, amount: true },
      });
      const totalIncome  = recentTxs.filter(t => t.type === "收入").reduce((s, t) => s + Number(t.amount), 0);
      const totalExpense = recentTxs.filter(t => t.type === "支出").reduce((s, t) => s + Number(t.amount), 0);
      const monthlyNetSaving = (totalIncome - totalExpense) / 6;

      const result = goals.map(g => {
        const target  = Number(g.targetAmount);
        const saved   = Number(g.savedAmount);
        const gap     = Math.max(0, target - saved);
        const pct     = target > 0 ? Math.round((saved / target) * 100) : 0;

        // 預計達標日：優先用 deadline，否則依月均儲蓄推算
        let estimatedDate: string | null = null;
        if (g.deadline) {
          estimatedDate = g.deadline.toISOString().split("T")[0];
        } else if (monthlyNetSaving > 0 && gap > 0) {
          const monthsNeeded = Math.ceil(gap / monthlyNetSaving);
          const est = new Date(now.getFullYear(), now.getMonth() + monthsNeeded, 1);
          estimatedDate = est.toISOString().split("T")[0];
        }

        return {
          id:            g.id,
          name:          g.name,
          emoji:         g.emoji ?? "🎯",
          targetAmount:  target,
          savedAmount:   saved,
          gap,
          progressPct:   pct,
          linkedSource:  g.linkedSource ?? null,
          deadline:      g.deadline ? g.deadline.toISOString().split("T")[0] : null,
          estimatedDate,
          note:          g.note ?? "",
          status:        pct >= 100 ? "已達標" : g.deadline && new Date(g.deadline) < now ? "已逾期" : "進行中",
        };
      });

      const achieved = result.filter(g => g.status === "已達標").length;
      const overdue  = result.filter(g => g.status === "已逾期").length;

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            total: result.length,
            achieved,
            overdue,
            inProgress: result.length - achieved - overdue,
            monthlyNetSaving: Math.round(monthlyNetSaving),
            goals: result,
          }, null, 2),
        }],
      };
    }

    // ── get_grad_school_plan ─────────────────────────────────────────────────
    if (name === "get_grad_school_plan") {
      const tuition  = (a.tuition  as number | undefined) ?? 300000;
      const living   = (a.living   as number | undefined) ?? 25000;
      const duration = (a.duration as number | undefined) ?? 24;
      const totalTarget = tuition + living * duration;

      const enrollmentDate = new Date(2028, 8, 1); // 2028-09-01
      const now = new Date();
      const monthsLeft = Math.max(0,
        (enrollmentDate.getFullYear() - now.getFullYear()) * 12
        + (enrollmentDate.getMonth() - now.getMonth())
      );
      const daysLeft = Math.max(0, Math.floor((enrollmentDate.getTime() - now.getTime()) / 86400000));

      const user = await getDashUser();
      let currentSavings = 0;
      let monthlyNet = 0;

      if (user) {
        const balances = await prisma.bankBalance.findMany({ where: { userId: user.id } });
        currentSavings = balances.reduce((s, b) => s + Number(b.balance), 0);

        // 近 3 個月月均淨儲蓄
        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        const recentTxs = await prisma.transaction.findMany({
          where: { userId: user.id, date: { gte: threeMonthsAgo }, category: { not: "轉帳" } },
          select: { type: true, amount: true },
        });
        const income  = recentTxs.filter(t => t.type === "收入").reduce((s, t) => s + Number(t.amount), 0);
        const expense = recentTxs.filter(t => t.type === "支出").reduce((s, t) => s + Number(t.amount), 0);
        monthlyNet = (income - expense) / 3;
      }

      const gap           = Math.max(0, totalTarget - currentSavings);
      const monthlyNeed   = monthsLeft > 0 ? gap / monthsLeft : gap;
      const projSavings   = currentSavings + monthlyNet * monthsLeft;
      const projGap       = totalTarget - projSavings;
      const onTrack       = projSavings >= totalTarget;
      const surplusNeeded = Math.max(0, monthlyNeed - monthlyNet);
      const progressPct   = totalTarget > 0 ? Math.round((currentSavings / totalTarget) * 100) : 0;

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            enrollment:       "2028-09-01",
            monthsLeft,
            daysLeft,
            plan: { tuition, living, duration, totalTarget },
            savings: {
              current:      Math.round(currentSavings),
              gap:          Math.round(gap),
              progressPct,
            },
            monthly: {
              need:           Math.round(monthlyNeed),
              currentNet:     Math.round(monthlyNet),
              surplusNeeded:  Math.round(surplusNeeded),
            },
            projection: {
              projectedSavings: Math.round(projSavings),
              projectedGap:     Math.round(projGap),
              onTrack,
            },
            advice: onTrack
              ? `✅ 依目前月均儲蓄 NT$${Math.round(monthlyNet).toLocaleString()} 可於入學前達標，預計超額 NT$${Math.round(-projGap).toLocaleString()}`
              : `⚠ 每月需多存 NT$${Math.round(surplusNeeded).toLocaleString()}，建議增加收入或降低支出`,
          }, null, 2),
        }],
      };
    }

    // ── get_budget_alert ─────────────────────────────────────────────────────
    if (name === "get_budget_alert") {
      const now   = new Date();
      const month = (a.month as string) ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const [y, m] = month.split("-").map(Number);
      const start  = new Date(y, m - 1, 1);
      const end    = new Date(y, m, 1);

      const [budgets, spending] = await Promise.all([
        prisma.budget.findMany(),
        prisma.transaction.groupBy({
          by: ["category"],
          where: { date: { gte: start, lt: end }, type: "支出" },
          _sum: { amount: true },
        }),
      ]);

      const spendMap = Object.fromEntries(spending.map(s => [s.category, Number(s._sum.amount ?? 0)]));
      const alerts = budgets
        .map(b => {
          const budget  = Number(b.amount);
          const spent   = spendMap[b.category] ?? 0;
          const pct     = budget > 0 ? Math.round((spent / budget) * 100) : 0;
          const overBudget = spent > budget;
          const nearLimit  = !overBudget && pct >= 80;
          return { category: b.category, budget, spent, remaining: budget - spent, pct, overBudget, nearLimit };
        })
        .filter(b => b.overBudget || b.nearLimit)
        .sort((a, b) => b.pct - a.pct);

      const overCount  = alerts.filter(a => a.overBudget).length;
      const nearCount  = alerts.filter(a => a.nearLimit).length;
      const totalOver  = alerts.filter(a => a.overBudget).reduce((s, a) => s + (a.spent - a.budget), 0);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            month,
            summary: { overBudgetCount: overCount, nearLimitCount: nearCount, totalOverspend: Math.round(totalOver) },
            alerts,
            message: overCount > 0
              ? `⚠ ${overCount} 個分類超標，總超支 NT$${Math.round(totalOver).toLocaleString()}`
              : nearCount > 0
                ? `📊 ${nearCount} 個分類接近上限（≥80%）`
                : "✅ 本月所有分類預算正常",
          }, null, 2),
        }],
      };
    }

    // ── get_fixed_expenses ───────────────────────────────────────────────────
    if (name === "get_fixed_expenses") {
      const user = await getDashUser();
      if (!user) return { content: [{ type: "text", text: "找不到用戶" }], isError: true };

      const fixed = await prisma.fixedExpense.findMany({
        where:   { userId: user.id },
        orderBy: { amount: "desc" },
      });

      const total = fixed.reduce((s, f) => s + Number(f.amount), 0);
      const byCategory: Record<string, number> = {};
      for (const f of fixed) {
        byCategory[f.category] = (byCategory[f.category] ?? 0) + Number(f.amount);
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            monthlyTotal: Math.round(total),
            annualTotal:  Math.round(total * 12),
            count:        fixed.length,
            byCategory:   Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([category, amount]) => ({ category, amount: Math.round(amount) })),
            items: fixed.map(f => ({
              id:        f.id,
              name:      f.name,
              amount:    Number(f.amount),
              category:  f.category,
              dayOfMonth: f.dayOfMonth,
              note:      f.note,
            })),
          }, null, 2),
        }],
      };
    }

    // ── get_credit_cards ─────────────────────────────────────────────────────
    if (name === "get_credit_cards") {
      const user = await getDashUser();
      if (!user) return { content: [{ type: "text", text: "找不到用戶" }], isError: true };

      const cards = await prisma.creditCard.findMany({
        where:   { userId: user.id },
        include: { bills: { orderBy: { dueDate: "desc" }, take: 3 } },
      });

      const today = new Date();
      const result = cards.map(c => {
        const unpaidBills = c.bills.filter(b => b.status !== "paid");
        const totalUnpaid = unpaidBills.reduce((s, b) => s + (Number(b.totalAmount) - Number(b.paidAmount)), 0);

        const nextBill = unpaidBills.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0];
        const daysUntilDue = nextBill
          ? Math.ceil((nextBill.dueDate.getTime() - today.getTime()) / 86400000)
          : null;

        return {
          id:           c.id,
          name:         c.name,
          bank:         c.bank,
          creditLimit:  c.creditLimit ? Number(c.creditLimit) : null,
          statementDay: c.statementDay,
          dueDay:       c.dueDay,
          totalUnpaid:  Math.round(totalUnpaid),
          nextDueDate:  nextBill ? nextBill.dueDate.toISOString().split("T")[0] : null,
          nextDueAmount: nextBill ? Math.round(Number(nextBill.totalAmount) - Number(nextBill.paidAmount)) : null,
          daysUntilDue,
          urgency: daysUntilDue === null ? "無待繳"
            : daysUntilDue < 0 ? "已逾期"
            : daysUntilDue <= 3 ? "緊急"
            : daysUntilDue <= 7 ? "本週到期"
            : "正常",
          recentBills: c.bills.map(b => ({
            billingMonth: b.billingMonth,
            totalAmount:  Number(b.totalAmount),
            paidAmount:   Number(b.paidAmount),
            status:       b.status,
            dueDate:      b.dueDate.toISOString().split("T")[0],
          })),
        };
      });

      const totalUnpaidAll = result.reduce((s, c) => s + c.totalUnpaid, 0);
      const urgentCards = result.filter(c => c.urgency === "緊急" || c.urgency === "已逾期");

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            cardCount:     result.length,
            totalUnpaid:   Math.round(totalUnpaidAll),
            urgentCount:   urgentCards.length,
            cards: result,
            alert: urgentCards.length > 0
              ? `🚨 ${urgentCards.length} 張信用卡帳單即將到期或已逾期：${urgentCards.map(c => c.name).join("、")}`
              : null,
          }, null, 2),
        }],
      };
    }

    // ── get_health_score ─────────────────────────────────────────────────────
    if (name === "get_health_score") {
      const now   = new Date();
      const month = (a.month as string) ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const [y, m] = month.split("-").map(Number);
      const start  = new Date(y, m - 1, 1);
      const end    = new Date(y, m, 1);

      const [txs, budgets, spending, loans, balances] = await Promise.all([
        prisma.transaction.findMany({ where: { date: { gte: start, lt: end }, category: { not: "轉帳" } }, select: { type: true, amount: true } }),
        prisma.budget.findMany(),
        prisma.transaction.groupBy({ by: ["category"], where: { date: { gte: start, lt: end }, type: "支出" }, _sum: { amount: true } }),
        prisma.loan.findMany({ where: { status: "active" }, select: { remainingPrincipal: true } }),
        prisma.bankBalance.findMany({ where: { source: { not: "cash" } }, select: { balance: true } }),
      ]);

      const income  = txs.filter(t => t.type === "收入").reduce((s, t) => s + Number(t.amount), 0);
      const expense = txs.filter(t => t.type === "支出").reduce((s, t) => s + Number(t.amount), 0);
      const savingsRate = income > 0 ? (income - expense) / income * 100 : 0;

      const totalAssets  = balances.reduce((s, b) => s + Number(b.balance), 0);
      const totalLoanDebt = loans.reduce((s, l) => s + Number(l.remainingPrincipal), 0);
      const debtRatio    = totalAssets > 0 ? totalLoanDebt / totalAssets * 100 : 0;

      const spendMap = Object.fromEntries(spending.map(s => [s.category, Number(s._sum.amount ?? 0)]));
      const budgetsWithAmount = budgets.filter(b => Number(b.amount) > 0);
      const budgetAdherence  = budgetsWithAmount.length > 0
        ? budgetsWithAmount.filter(b => (spendMap[b.category] ?? 0) <= Number(b.amount)).length / budgetsWithAmount.length * 100
        : 100;

      // 評分
      const savingsScore  = savingsRate >= 30 ? 100 : savingsRate >= 20 ? 75 : savingsRate >= 10 ? 50 : savingsRate > 0 ? 25 : 0;
      const debtScore     = debtRatio   <= 20 ? 100 : debtRatio   <= 40 ? 75 : debtRatio   <= 60 ? 50 : 25;
      const budgetScore   = budgetAdherence >= 100 ? 100 : budgetAdherence >= 80 ? 75 : budgetAdherence >= 60 ? 50 : 25;
      const total         = Math.round(savingsScore * 0.4 + debtScore * 0.3 + budgetScore * 0.3);
      const grade         = total >= 80 ? "優良" : total >= 60 ? "普通" : total >= 40 ? "待改善" : "需注意";

      // 改善建議
      const suggestions: string[] = [];
      if (savingsRate < 10)  suggestions.push(`儲蓄率偏低（${savingsRate.toFixed(0)}%），建議目標 ≥20%，可先削減非必要支出`);
      if (savingsRate >= 10 && savingsRate < 20) suggestions.push(`儲蓄率 ${savingsRate.toFixed(0)}%，距健康水位（≥30%）仍有空間`);
      if (debtRatio > 60)    suggestions.push(`負債比過高（${debtRatio.toFixed(0)}%），建議優先還清高利率貸款`);
      if (debtRatio > 40 && debtRatio <= 60) suggestions.push(`負債比偏高（${debtRatio.toFixed(0)}%），持續降低負債`);
      if (budgetAdherence < 80) suggestions.push(`預算達成率 ${budgetAdherence.toFixed(0)}%，有 ${budgetsWithAmount.filter(b => (spendMap[b.category] ?? 0) > Number(b.amount)).length} 個分類超支`);
      if (suggestions.length === 0) suggestions.push("財務狀況良好，持續保持！");

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            month,
            score: total,
            grade,
            dimensions: {
              savingsRate:     { value: Math.round(savingsRate), score: savingsScore, weight: "40%", status: savingsRate >= 20 ? "良好" : "偏低" },
              debtRatio:       { value: Math.round(debtRatio),  score: debtScore,    weight: "30%", status: debtRatio <= 40 ? "良好" : "偏高" },
              budgetAdherence: { value: Math.round(budgetAdherence), score: budgetScore, weight: "30%", status: budgetAdherence >= 80 ? "良好" : "待改善" },
            },
            rawData: { income: Math.round(income), expense: Math.round(expense), totalAssets: Math.round(totalAssets), totalLoanDebt: Math.round(totalLoanDebt) },
            suggestions,
          }, null, 2),
        }],
      };
    }

    // ── get_fire_progress ────────────────────────────────────────────────────
    if (name === "get_fire_progress") {
      const annualReturnPct = (a.annualReturnPct as number | undefined) ?? 5;
      const safeWithdrawPct = (a.safeWithdrawPct as number | undefined) ?? 4;
      const user = await getDashUser();

      // 計算每月支出（優先用傳入值，否則取近 3 個月均值）
      let monthlyExpense = a.monthlyExpense as number | undefined;
      let currentAssets  = 0;

      if (user) {
        const now = new Date();
        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);

        const [balances, loans, ccBills, recentTxs] = await Promise.all([
          prisma.bankBalance.findMany({ where: { userId: user.id, source: { not: "cash" } } }),
          prisma.loan.findMany({ where: { status: "active" }, select: { remainingPrincipal: true } }),
          prisma.creditCardBill.findMany({ where: { status: { in: ["unpaid", "partial"] } }, select: { totalAmount: true, paidAmount: true } }),
          prisma.transaction.findMany({ where: { userId: user.id, date: { gte: threeMonthsAgo }, type: "支出", category: { not: "轉帳" } }, select: { amount: true } }),
        ]);

        const totalBankAssets = balances.reduce((s, b) => s + Number(b.balance), 0);
        const totalLoanDebt   = loans.reduce((s, l) => s + Number(l.remainingPrincipal), 0);
        const totalCCDebt     = ccBills.reduce((s, b) => s + (Number(b.totalAmount) - Number(b.paidAmount)), 0);
        currentAssets = totalBankAssets - totalLoanDebt - totalCCDebt;

        if (!monthlyExpense) {
          const totalExpense = recentTxs.reduce((s, t) => s + Number(t.amount), 0);
          monthlyExpense = Math.round(totalExpense / 3);
        }
      }

      monthlyExpense = monthlyExpense ?? 40000;
      const annualExpense = monthlyExpense * 12;
      const fireTarget    = Math.round(annualExpense / (safeWithdrawPct / 100));
      const gap           = Math.max(0, fireTarget - currentAssets);
      const progressPct   = fireTarget > 0 ? Math.min(100, Math.round((currentAssets / fireTarget) * 100)) : 0;

      // 估算年數（複利成長 + 月存款）
      // 取近 3 個月月均淨儲蓄作為每月儲蓄
      let monthlySaving = 0;
      if (user) {
        const now = new Date();
        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        const txs = await prisma.transaction.findMany({
          where: { userId: user.id, date: { gte: threeMonthsAgo }, category: { not: "轉帳" } },
          select: { type: true, amount: true },
        });
        const inc = txs.filter(t => t.type === "收入").reduce((s, t) => s + Number(t.amount), 0);
        const exp = txs.filter(t => t.type === "支出").reduce((s, t) => s + Number(t.amount), 0);
        monthlySaving = Math.max(0, (inc - exp) / 3);
      }

      // FV 迭代計算達到 fireTarget 需要的年數
      let yearsToFire: number | null = null;
      if (monthlySaving > 0 || currentAssets > 0) {
        const monthlyReturn = annualReturnPct / 100 / 12;
        let balance = currentAssets;
        let months  = 0;
        const maxMonths = 600; // 最多推算 50 年
        while (balance < fireTarget && months < maxMonths) {
          balance = balance * (1 + monthlyReturn) + monthlySaving;
          months++;
        }
        yearsToFire = months < maxMonths ? Math.round(months / 12 * 10) / 10 : null;
      }

      const now = new Date();
      const fireYear = yearsToFire !== null ? now.getFullYear() + Math.ceil(yearsToFire) : null;

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            assumptions: { monthlyExpense, annualExpense, safeWithdrawPct, annualReturnPct },
            fireTarget: Math.round(fireTarget),
            currentNetAssets: Math.round(currentAssets),
            gap:          Math.round(gap),
            progressPct,
            monthlySaving: Math.round(monthlySaving),
            yearsToFire,
            estimatedFireYear: fireYear,
            status: progressPct >= 100 ? "🎉 已達 FIRE！"
              : progressPct >= 75 ? "🔥 衝刺階段"
              : progressPct >= 50 ? "📈 過半程"
              : progressPct >= 25 ? "🚀 起步中"
              : "🌱 剛起步",
            advice: gap === 0
              ? "恭喜！你的資產已達 FIRE 目標"
              : `還差 NT$${Math.round(gap).toLocaleString()}，以目前月儲蓄 NT$${Math.round(monthlySaving).toLocaleString()} + ${annualReturnPct}% 年報酬，約需 ${yearsToFire ?? "無法估算"} 年`,
          }, null, 2),
        }],
      };
    }

    // ── get_subscription_summary ─────────────────────────────────────────────
    if (name === "get_subscription_summary") {
      const user = await getDashUser();
      if (!user) return { content: [{ type: "text", text: "找不到用戶" }], isError: true };

      const now   = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end   = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      const [marks, monthTxs] = await Promise.all([
        prisma.subscriptionMark.findMany({ where: { userId: user.id, confirmed: true, dismissed: false } }),
        prisma.transaction.findMany({
          where: { userId: user.id, date: { gte: start, lt: end }, type: "支出" },
          select: { note: true, amount: true, category: true },
        }),
      ]);

      // 從 patternKey 解析 note||amount
      const subscriptions = marks.map(mk => {
        const [note, amtStr] = mk.patternKey.split("||");
        const amount = Number(amtStr) || 0;
        return {
          id:       mk.id,
          name:     mk.label || note,
          note,
          amount,
          label:    mk.label,
          remark:   mk.note,
        };
      });

      const monthlyTotal = subscriptions.reduce((s, sub) => s + sub.amount, 0);
      const annualTotal  = monthlyTotal * 12;

      // 本月實際訂閱支出（比對 note 包含訂閱 pattern）
      let actualMonthSpend = 0;
      for (const sub of subscriptions) {
        const match = monthTxs.find(t => t.note.includes(sub.note));
        if (match) actualMonthSpend += Number(match.amount);
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            confirmedCount: subscriptions.length,
            estimatedMonthlyTotal: Math.round(monthlyTotal),
            estimatedAnnualTotal:  Math.round(annualTotal),
            actualMonthSpend:      Math.round(actualMonthSpend),
            subscriptions,
          }, null, 2),
        }],
      };
    }

    // ── get_notifications ────────────────────────────────────────────────────
    if (name === "get_notifications") {
      const user = await getDashUser();
      if (!user) return { content: [{ type: "text", text: "找不到用戶" }], isError: true };

      const now   = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

      const [budgets, spending, cards, loans, goals] = await Promise.all([
        prisma.budget.findMany({ where: { userId: user.id } }),
        prisma.transaction.groupBy({ by: ["category"], where: { date: { gte: monthStart, lt: monthEnd }, type: "支出" }, _sum: { amount: true } }),
        prisma.creditCard.findMany({ where: { userId: user.id }, include: { bills: { where: { status: { not: "paid" } }, orderBy: { dueDate: "asc" }, take: 1 } } }),
        prisma.loan.findMany({ where: { status: "active" } }),
        prisma.financialGoal.findMany({ where: { userId: user.id } }),
      ]);

      const notifications: { type: string; level: string; title: string; detail: string }[] = [];

      // 預算警示
      const spendMap = Object.fromEntries(spending.map(s => [s.category, Number(s._sum.amount ?? 0)]));
      for (const b of budgets.filter(b => Number(b.amount) > 0)) {
        const spent = spendMap[b.category] ?? 0;
        const pct   = Math.round((spent / Number(b.amount)) * 100);
        if (spent > Number(b.amount)) {
          notifications.push({ type: "budget", level: "danger", title: `${b.category} 預算超標`, detail: `已花 NT$${Math.round(spent).toLocaleString()}，超出 NT$${Math.round(spent - Number(b.amount)).toLocaleString()}（${pct}%）` });
        } else if (pct >= 80) {
          notifications.push({ type: "budget", level: "warning", title: `${b.category} 接近上限`, detail: `已使用 ${pct}%，剩餘 NT$${Math.round(Number(b.amount) - spent).toLocaleString()}` });
        }
      }

      // 信用卡帳單警示
      for (const c of cards) {
        const bill = c.bills[0];
        if (!bill) continue;
        const daysUntilDue = Math.ceil((bill.dueDate.getTime() - now.getTime()) / 86400000);
        const unpaid = Number(bill.totalAmount) - Number(bill.paidAmount);
        if (daysUntilDue < 0) {
          notifications.push({ type: "creditcard", level: "danger", title: `${c.name} 帳單已逾期`, detail: `未繳 NT$${Math.round(unpaid).toLocaleString()}，逾期 ${Math.abs(daysUntilDue)} 天` });
        } else if (daysUntilDue <= 5) {
          notifications.push({ type: "creditcard", level: "warning", title: `${c.name} 帳單即將到期`, detail: `NT$${Math.round(unpaid).toLocaleString()}，${daysUntilDue} 天後到期（${bill.dueDate.toISOString().split("T")[0]}）` });
        }
      }

      // 貸款繳款日警示（7 天內）
      for (const l of loans.filter(l => l.paymentDay !== null)) {
        const pd   = l.paymentDay!;
        const todayDate = now.getDate();
        const daysUntil = todayDate <= pd ? pd - todayDate : new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - todayDate + pd;
        if (daysUntil <= 7) {
          const interest = Math.round(Number(l.remainingPrincipal) * Number(l.interestRate) / 100 / 12);
          notifications.push({ type: "loan", level: daysUntil <= 2 ? "danger" : "warning", title: `${l.name} 貸款繳款日`, detail: `${daysUntil === 0 ? "今天" : `${daysUntil} 天後`}到期，每月利息約 NT$${interest.toLocaleString()}` });
        }
      }

      // 財務目標逾期警示
      for (const g of goals) {
        if (!g.deadline) continue;
        const daysOverdue = Math.ceil((now.getTime() - new Date(g.deadline).getTime()) / 86400000);
        const saved  = Number(g.savedAmount);
        const target = Number(g.targetAmount);
        if (daysOverdue > 0 && saved < target) {
          notifications.push({ type: "goal", level: "warning", title: `目標「${g.name}」已逾期`, detail: `截止 ${g.deadline.toISOString().split("T")[0]}，已存 NT$${Math.round(saved).toLocaleString()} / NT$${Math.round(target).toLocaleString()}（${Math.round(saved/target*100)}%）` });
        }
      }

      notifications.sort((a, b) => {
        const order = { danger: 0, warning: 1, info: 2 };
        return (order[a.level as keyof typeof order] ?? 2) - (order[b.level as keyof typeof order] ?? 2);
      });

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            date:   now.toISOString().split("T")[0],
            month:  currentMonth,
            total:  notifications.length,
            danger: notifications.filter(n => n.level === "danger").length,
            warning:notifications.filter(n => n.level === "warning").length,
            notifications,
            summary: notifications.length === 0 ? "✅ 目前無待處理警示" : `共 ${notifications.length} 則警示，請優先處理 ${notifications.filter(n => n.level === "danger").length} 則緊急事項`,
          }, null, 2),
        }],
      };
    }

    // ── get_annual_report ────────────────────────────────────────────────────
    if (name === "get_annual_report") {
      const now  = new Date();
      const year = (a.year as number | undefined) ?? now.getFullYear();
      const yearStart = new Date(year, 0, 1);
      const yearEnd   = new Date(year + 1, 0, 1);

      const txs = await prisma.transaction.findMany({
        where: { date: { gte: yearStart, lt: yearEnd }, category: { not: "轉帳" } },
        select: { date: true, type: true, amount: true, category: true, note: true },
        orderBy: { date: "asc" },
      });

      const totalIncome  = txs.filter(t => t.type === "收入").reduce((s, t) => s + Number(t.amount), 0);
      const totalExpense = txs.filter(t => t.type === "支出").reduce((s, t) => s + Number(t.amount), 0);
      const totalNet     = totalIncome - totalExpense;

      // 月度趨勢
      const monthlyMap = new Map<string, { income: number; expense: number }>();
      for (let mo = 1; mo <= 12; mo++) {
        const m = `${year}-${String(mo).padStart(2, "0")}`;
        monthlyMap.set(m, { income: 0, expense: 0 });
      }
      for (const t of txs) {
        const m = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, "0")}`;
        const entry = monthlyMap.get(m);
        if (entry) {
          if (t.type === "收入") entry.income  += Number(t.amount);
          else                   entry.expense += Number(t.amount);
        }
      }
      const monthly = Array.from(monthlyMap.entries()).map(([month, v]) => ({
        month,
        income:  Math.round(v.income),
        expense: Math.round(v.expense),
        net:     Math.round(v.income - v.expense),
        savingsRate: v.income > 0 ? Math.round((v.income - v.expense) / v.income * 100) : 0,
      }));

      // 分類排行（支出）
      const catMap = new Map<string, number>();
      for (const t of txs.filter(t => t.type === "支出")) {
        catMap.set(t.category, (catMap.get(t.category) ?? 0) + Number(t.amount));
      }
      const topExpenseCategories = Array.from(catMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([category, amount]) => ({
          category,
          amount: Math.round(amount),
          pct: Math.round(amount / totalExpense * 100),
        }));

      // 最高/最低消費月
      const monthsWithExpense = monthly.filter(m => m.expense > 0);
      const maxExpenseMonth   = monthsWithExpense.reduce((a, b) => b.expense > a.expense ? b : a, monthsWithExpense[0]);
      const minExpenseMonth   = monthsWithExpense.reduce((a, b) => b.expense < a.expense ? b : a, monthsWithExpense[0]);

      // 收入分類
      const incCatMap = new Map<string, number>();
      for (const t of txs.filter(t => t.type === "收入")) {
        incCatMap.set(t.category, (incCatMap.get(t.category) ?? 0) + Number(t.amount));
      }
      const incomeByCategory = Array.from(incCatMap.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([category, amount]) => ({ category, amount: Math.round(amount) }));

      const avgMonthlySavings = Math.round(totalNet / 12);
      const annualSavingsRate = totalIncome > 0 ? Math.round(totalNet / totalIncome * 100) : 0;

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            year,
            summary: {
              totalIncome:       Math.round(totalIncome),
              totalExpense:      Math.round(totalExpense),
              totalNet:          Math.round(totalNet),
              avgMonthlyIncome:  Math.round(totalIncome / 12),
              avgMonthlyExpense: Math.round(totalExpense / 12),
              avgMonthlySavings,
              annualSavingsRate,
              transactionCount:  txs.length,
            },
            monthly,
            topExpenseCategories,
            incomeByCategory,
            highlights: {
              maxExpenseMonth:   maxExpenseMonth ? { month: maxExpenseMonth.month, amount: maxExpenseMonth.expense } : null,
              minExpenseMonth:   minExpenseMonth ? { month: minExpenseMonth.month, amount: minExpenseMonth.expense } : null,
              bestSavingsMonth:  monthly.reduce((a, b) => b.net > a.net ? b : a, monthly[0]),
              worstSavingsMonth: monthly.reduce((a, b) => b.net < a.net ? b : a, monthly[0]),
            },
          }, null, 2),
        }],
      };
    }

    return { content: [{ type: "text", text: `未知工具：${name}` }], isError: true };
  } catch (e) {
    return {
      content: [{ type: "text", text: `錯誤：${e instanceof Error ? e.message : String(e)}` }],
      isError: true,
    };
  }
});

// ── 啟動 ──────────────────────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("LINE 記帳 MCP Server 啟動中...");
}

main().catch(console.error);
