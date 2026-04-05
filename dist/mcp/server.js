#!/usr/bin/env node
"use strict";
/**
 * LINE 記帳系統 MCP Server
 * 讓 Claude Code 可以直接查詢記帳資料
 *
 * 啟動：npx tsx src/mcp/server.ts
 */
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const server = new index_js_1.Server({ name: "line-accounting", version: "1.0.0" }, { capabilities: { tools: {} } });
// ── 工具清單 ───────────────────────────────────────────────────────────────────
server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => ({
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
                    limit: { type: "number", description: "筆數，預設 20" },
                    category: { type: "string", description: "篩選分類，如「飲食」「交通」" },
                    type: { type: "string", description: "收入 或 支出" },
                    month: { type: "string", description: "月份 YYYY-MM，不填則全部" },
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
            name: "get_payees",
            description: "查詢所有轉帳帳號對照表（pattern → label）",
            inputSchema: { type: "object", properties: {} },
        },
        {
            name: "add_payee",
            description: "新增轉帳帳號對照，讓特定帳號自動標記為可讀名稱",
            inputSchema: {
                type: "object",
                required: ["pattern", "label"],
                properties: {
                    pattern: { type: "string", description: "比對 note 的子字串，如 \"807-001360\"" },
                    label: { type: "string", description: "顯示名稱，如 \"房租\"" },
                    category: { type: "string", description: "選填：覆蓋分類" },
                },
            },
        },
        {
            name: "update_payee",
            description: "更新轉帳帳號對照",
            inputSchema: {
                type: "object",
                required: ["id"],
                properties: {
                    id: { type: "string" },
                    pattern: { type: "string" },
                    label: { type: "string" },
                    category: { type: "string" },
                },
            },
        },
        {
            name: "delete_payee",
            description: "刪除轉帳帳號對照",
            inputSchema: {
                type: "object",
                required: ["id"],
                properties: {
                    id: { type: "string" },
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
                    months: { type: "number", description: "回溯月數，預設 3" },
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
                    ids: { type: "array", items: { type: "string" }, description: "交易 id 陣列" },
                    category: { type: "string", description: "新分類名稱" },
                    type: { type: "string", description: "同時修改收支類型（收入 / 支出），選填" },
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
                    id: { type: "string", description: "交易 id" },
                    source: {
                        description: "salary / freelance / bonus / transfer，或 null 清除",
                        enum: ["salary", "freelance", "bonus", "transfer", null],
                    },
                },
            },
        },
    ],
}));
// ── 工具實作 ───────────────────────────────────────────────────────────────────
server.setRequestHandler(types_js_1.CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    const a = (args ?? {});
    async function getDashUser() {
        return prisma.user.findFirst({ where: { lineUserId: "dashboard_user" } });
    }
    // 稽核日誌：每次 MCP 工具呼叫都記錄，不 await 以免影響回應速度
    prisma.auditLog.create({
        data: { action: "mcp_call", tool: name, params: a, status: "success" },
    }).catch((e) => console.error("[audit] mcp_call 記錄失敗:", e));
    try {
        // ── get_summary ──────────────────────────────────────────────────────────
        if (name === "get_summary") {
            const now = new Date();
            const month = a.month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
            const [y, m] = month.split("-").map(Number);
            const start = new Date(y, m - 1, 1);
            const end = new Date(y, m, 1);
            const txs = await prisma.transaction.findMany({
                where: { date: { gte: start, lt: end }, category: { not: "轉帳" } },
            });
            const income = txs.filter(t => t.type === "收入").reduce((s, t) => s + Number(t.amount), 0);
            const expense = txs.filter(t => t.type === "支出").reduce((s, t) => s + Number(t.amount), 0);
            const catMap = new Map();
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
            const limit = Number(a.limit ?? 20);
            const where = {};
            if (a.category)
                where.category = a.category;
            if (a.type)
                where.type = a.type;
            if (a.month) {
                const [y, m] = a.month.split("-").map(Number);
                where.date = { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) };
            }
            const [txs, payees] = await Promise.all([
                prisma.transaction.findMany({ where, orderBy: { date: "desc" }, take: limit }),
                prisma.payeeMapping.findMany(),
            ]);
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify(txs.map(t => {
                            const match = payees.find(p => t.note.includes(p.pattern));
                            return {
                                id: t.id,
                                date: t.date.toISOString().split("T")[0],
                                type: t.type,
                                amount: Number(t.amount),
                                category: match?.category || t.category,
                                note: match ? `${match.label}（${t.note}）` : t.note,
                                source: t.source,
                                incomeSource: t.incomeSource ?? undefined,
                            };
                        }), null, 2),
                    }],
            };
        }
        // ── get_balances ─────────────────────────────────────────────────────────
        if (name === "get_balances") {
            const user = await getDashUser();
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
            const cashBalance = Number(wd._sum.amount ?? 0) - Number(dep._sum.amount ?? 0) -
                Number(lineExp._sum.amount ?? 0) + Number(lineInc._sum.amount ?? 0);
            const result = [
                ...balances.map(b => ({
                    source: b.source,
                    balance: Number(b.balance),
                    asOfDate: b.asOfDate.toISOString().split("T")[0],
                })),
                { source: "cash", balance: cashBalance, asOfDate: new Date().toISOString().split("T")[0] },
            ];
            return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        // ── get_budgets ──────────────────────────────────────────────────────────
        if (name === "get_budgets") {
            const user = await getDashUser();
            const now = new Date();
            const month = a.month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
            const [y, m] = month.split("-").map(Number);
            const start = new Date(y, m - 1, 1);
            const end = new Date(y, m, 1);
            const [budgets, spending] = await Promise.all([
                prisma.budget.findMany({ where: user ? { userId: user.id } : {} }),
                prisma.transaction.groupBy({
                    by: ["category"],
                    where: { date: { gte: start, lt: end }, type: "支出" },
                    _sum: { amount: true },
                }),
            ]);
            const spendMap = Object.fromEntries(spending.map(s => [s.category, Number(s._sum.amount ?? 0)]));
            const result = budgets.map(b => ({
                category: b.category,
                budget: Number(b.amount),
                spent: spendMap[b.category] ?? 0,
                remaining: Number(b.amount) - (spendMap[b.category] ?? 0),
                pct: Math.round(((spendMap[b.category] ?? 0) / Number(b.amount)) * 100),
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
            const totalAssets = balances.reduce((s, b) => s + Number(b.balance), 0);
            const totalLoanDebt = loans.reduce((s, l) => s + Number(l.remainingPrincipal), 0);
            const totalCreditDebt = ccBills.reduce((s, b) => s + (Number(b.totalAmount) - Number(b.paidAmount)), 0);
            const monthlyInterest = loans.reduce((s, l) => s + (Number(l.remainingPrincipal) * Number(l.interestRate) / 100 / 12), 0);
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify({
                            totalAssets,
                            totalLoanDebt,
                            totalCreditDebt,
                            totalDebt: totalLoanDebt + totalCreditDebt,
                            netWorth: totalAssets - totalLoanDebt - totalCreditDebt,
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
            const today = new Date();
            const todayDay = today.getDate();
            const nextPayment = (paymentDay) => {
                if (paymentDay === null)
                    return null;
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
                            name: l.name,
                            lender: l.lender,
                            type: l.type,
                            remainingPrincipal: Number(l.remainingPrincipal),
                            interestRate: Number(l.interestRate),
                            monthlyInterest: Math.round(Number(l.remainingPrincipal) * Number(l.interestRate) / 100 / 12),
                            paymentDay: l.paymentDay,
                            ...nextPayment(l.paymentDay),
                            endDate: l.endDate?.toISOString().split("T")[0],
                        })), null, 2),
                    }],
            };
        }
        // ── get_income_breakdown ─────────────────────────────────────────────────
        if (name === "get_income_breakdown") {
            const now = new Date();
            const month = a.month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
            const [y, m] = month.split("-").map(Number);
            const start = new Date(y, m - 1, 1);
            const end = new Date(y, m, 1);
            const txs = await prisma.transaction.findMany({
                where: { type: "收入", date: { gte: start, lt: end } },
                select: { amount: true, incomeSource: true, note: true, category: true },
            });
            const groups = {
                salary: 0, freelance: 0, bonus: 0, transfer: 0, untagged: 0,
            };
            for (const t of txs) {
                const key = t.incomeSource ?? "untagged";
                groups[key] = (groups[key] ?? 0) + Number(t.amount);
            }
            const total = Object.values(groups).reduce((s, v) => s + v, 0);
            const recurring = groups.salary + groups.transfer;
            const oneTime = groups.freelance + groups.bonus;
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify({
                            month,
                            total,
                            breakdown: groups,
                            recurringTotal: recurring,
                            oneTimeTotal: oneTime,
                            recurringPct: total ? Math.round(recurring / total * 100) : 0,
                            oneTimePct: total ? Math.round(oneTime / total * 100) : 0,
                            untaggedCount: txs.filter(t => !t.incomeSource).length,
                        }, null, 2),
                    }],
            };
        }
        // ── get_weekly_report ────────────────────────────────────────────────────
        if (name === "get_weekly_report") {
            const now = new Date();
            const todayDay = now.getDate();
            // 本週起訖（週一 ~ 今天）
            const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1; // 0=週一
            const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
            const weekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
            // 本月起訖
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
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
            const weekIncome = weekTxs.filter(t => t.type === "收入").reduce((s, t) => s + Number(t.amount), 0);
            const weekExpense = weekTxs.filter(t => t.type === "支出").reduce((s, t) => s + Number(t.amount), 0);
            // 本週支出分類排行
            const weekCatMap = new Map();
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
                category: b.category,
                budget: Number(b.amount),
                spent: spendMap[b.category] ?? 0,
                pct: Math.round(((spendMap[b.category] ?? 0) / Number(b.amount)) * 100),
                overBudget: (spendMap[b.category] ?? 0) > Number(b.amount),
            }));
            // 本週到期貸款（7 天內）
            const dueSoon = loans
                .filter(l => l.paymentDay !== null)
                .map(l => {
                const pd = l.paymentDay;
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
            const todos = [];
            const otherCount = monthTxs.filter(t => t.category === "其他").length;
            if (otherCount > 0)
                todos.push(`${otherCount} 筆交易分類為「其他」，建議重新分類`);
            budgetProgress.filter(b => b.overBudget).forEach(b => todos.push(`「${b.category}」預算已超支 ${b.pct - 100}%`));
            budgetProgress.filter(b => b.pct >= 80 && !b.overBudget).forEach(b => todos.push(`「${b.category}」預算已用 ${b.pct}%，接近上限`));
            dueSoon.filter(l => l.daysUntil <= 3).forEach(l => todos.push(`${l.name} 貸款 ${l.daysUntil === 0 ? "今天" : `${l.daysUntil} 天後`}到期`));
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify({
                            reportDate: now.toISOString().split("T")[0],
                            weekRange: { from: weekStart.toISOString().split("T")[0], to: now.toISOString().split("T")[0] },
                            week: {
                                income: weekIncome,
                                expense: weekExpense,
                                net: weekIncome - weekExpense,
                                topCategories: weekTopCats,
                            },
                            month: {
                                month: currentMonth,
                                income: monthTxs.filter(t => t.type === "收入").reduce((s, t) => s + Number(t.amount), 0),
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
            if (!valid.includes(a.source)) {
                return { content: [{ type: "text", text: "source 必須為 salary / freelance / bonus / transfer / null" }], isError: true };
            }
            const tx = await prisma.transaction.update({
                where: { id: a.id },
                data: { incomeSource: a.source ?? null },
                select: { id: true, note: true, amount: true, incomeSource: true },
            });
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify({ ok: true, id: tx.id, note: tx.note, amount: Number(tx.amount), incomeSource: tx.incomeSource }),
                    }],
            };
        }
        // ── get_payees ───────────────────────────────────────────────────────────
        if (name === "get_payees") {
            const payees = await prisma.payeeMapping.findMany({ orderBy: { createdAt: "asc" } });
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify(payees.map(p => ({
                            id: p.id,
                            pattern: p.pattern,
                            label: p.label,
                            category: p.category,
                        })), null, 2),
                    }],
            };
        }
        // ── add_payee ────────────────────────────────────────────────────────────
        if (name === "add_payee") {
            const payee = await prisma.payeeMapping.create({
                data: {
                    pattern: a.pattern,
                    label: a.label,
                    category: a.category ?? "",
                },
            });
            return { content: [{ type: "text", text: JSON.stringify({ ok: true, id: payee.id }) }] };
        }
        // ── update_payee ─────────────────────────────────────────────────────────
        if (name === "update_payee") {
            const data = {};
            if (a.pattern)
                data.pattern = a.pattern;
            if (a.label)
                data.label = a.label;
            if (a.category !== undefined)
                data.category = a.category;
            await prisma.payeeMapping.update({ where: { id: a.id }, data });
            return { content: [{ type: "text", text: JSON.stringify({ ok: true }) }] };
        }
        // ── delete_payee ─────────────────────────────────────────────────────────
        if (name === "delete_payee") {
            await prisma.payeeMapping.delete({ where: { id: a.id } });
            return { content: [{ type: "text", text: JSON.stringify({ ok: true }) }] };
        }
        // ── get_spending_trend ───────────────────────────────────────────────────
        if (name === "get_spending_trend") {
            const monthCount = Number(a.months ?? 3);
            const now = new Date();
            const results = [];
            for (let i = monthCount - 1; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const start = new Date(d.getFullYear(), d.getMonth(), 1);
                const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
                const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                const where = {
                    date: { gte: start, lt: end },
                    category: { not: "轉帳" },
                };
                if (a.category)
                    where.category = a.category;
                const txs = await prisma.transaction.findMany({ where });
                const income = txs.filter(t => t.type === "收入").reduce((s, t) => s + Number(t.amount), 0);
                const expense = txs.filter(t => t.type === "支出").reduce((s, t) => s + Number(t.amount), 0);
                const catMap = new Map();
                for (const t of txs.filter(t => t.type === "支出")) {
                    catMap.set(t.category, (catMap.get(t.category) ?? 0) + Number(t.amount));
                }
                results.push({
                    month,
                    income,
                    expense,
                    net: income - expense,
                    categories: Object.fromEntries(Array.from(catMap.entries()).sort((a, b) => b[1] - a[1])),
                });
            }
            // 計算各分類跨月變化（最後一月 vs 第一月）
            const allCats = Array.from(new Set(results.flatMap(r => Object.keys(r.categories))));
            const trends = allCats.map(cat => {
                const values = results.map(r => r.categories[cat] ?? 0);
                const first = values[0];
                const last = values[values.length - 1];
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
                where: { status: "active" },
                include: { payments: { orderBy: { paymentDate: "desc" }, take: 1 } },
            });
            const today = new Date();
            const items = loans.map(l => {
                const principal = Number(l.remainingPrincipal);
                const annualRate = Number(l.interestRate);
                const monthlyInterest = Math.round(principal * annualRate / 100 / 12);
                // 預計還清日（依最近一次還款中的本金攤還推算）
                const lastPayment = l.payments[0];
                const monthlyPrincipal = lastPayment ? Number(lastPayment.principalPaid) : 0;
                const monthsLeft = monthlyPrincipal > 0 ? Math.ceil(principal / monthlyPrincipal) : null;
                const payoffDate = monthsLeft !== null
                    ? new Date(today.getFullYear(), today.getMonth() + monthsLeft, 1).toISOString().split("T")[0]
                    : null;
                return {
                    name: l.name,
                    lender: l.lender,
                    type: l.type,
                    interestRate: annualRate,
                    remainingPrincipal: principal,
                    monthlyInterest,
                    monthlyPrincipal,
                    estimatedMonthlyPayment: monthlyInterest + monthlyPrincipal,
                    paymentDay: l.paymentDay,
                    payoffDate,
                    monthsLeft,
                };
            });
            const totalRemaining = items.reduce((s, l) => s + l.remainingPrincipal, 0);
            const totalMonthlyInterest = items.reduce((s, l) => s + l.monthlyInterest, 0);
            const totalMonthlyPayment = items.reduce((s, l) => s + l.estimatedMonthlyPayment, 0);
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
            const ids = a.ids;
            const category = a.category;
            if (!Array.isArray(ids) || ids.length === 0) {
                return { content: [{ type: "text", text: "ids 必須為非空陣列" }], isError: true };
            }
            const data = { category };
            if (a.type)
                data.type = a.type;
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
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            const totalDays = Math.round((monthEnd.getTime() - monthStart.getTime()) / 86400000);
            const daysElapsed = now.getDate();
            const daysRemaining = totalDays - daysElapsed;
            const [txs, balances, loans] = await Promise.all([
                prisma.transaction.findMany({
                    where: { date: { gte: monthStart, lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) }, category: { not: "轉帳" } },
                }),
                prisma.bankBalance.findMany({ where: { source: { not: "cash" } } }),
                prisma.loan.findMany({ where: { status: "active" } }),
            ]);
            const currentIncome = txs.filter(t => t.type === "收入").reduce((s, t) => s + Number(t.amount), 0);
            const currentExpense = txs.filter(t => t.type === "支出").reduce((s, t) => s + Number(t.amount), 0);
            const dailyAvgExpense = daysElapsed > 0 ? currentExpense / daysElapsed : 0;
            const projectedExpense = Math.round(currentExpense + dailyAvgExpense * daysRemaining);
            // 本月尚未到期的貸款繳款日
            const upcomingPayments = loans
                .filter(l => l.paymentDay !== null && l.paymentDay > now.getDate())
                .map(l => ({
                name: l.name,
                paymentDay: l.paymentDay,
                daysUntil: l.paymentDay - now.getDate(),
                monthlyInterest: Math.round(Number(l.remainingPrincipal) * Number(l.interestRate) / 100 / 12),
            }));
            const totalBankBalance = balances.reduce((s, b) => s + Number(b.balance), 0);
            const projectedNet = currentIncome - projectedExpense;
            const projectedEndBalance = Math.round(totalBankBalance + projectedNet);
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify({
                            month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
                            today: now.toISOString().split("T")[0],
                            daysElapsed,
                            daysRemaining,
                            currentIncome,
                            currentExpense,
                            dailyAvgExpense: Math.round(dailyAvgExpense),
                            projectedExpense,
                            projectedIncome: currentIncome,
                            projectedNet,
                            upcomingLoanPayments: upcomingPayments,
                            totalBankBalance: Math.round(totalBankBalance),
                            projectedEndBalance,
                        }, null, 2),
                    }],
            };
        }
        return { content: [{ type: "text", text: `未知工具：${name}` }], isError: true };
    }
    catch (e) {
        return {
            content: [{ type: "text", text: `錯誤：${e instanceof Error ? e.message : String(e)}` }],
            isError: true,
        };
    }
});
// ── 啟動 ──────────────────────────────────────────────────────────────────────
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.error("LINE 記帳 MCP Server 啟動中...");
}
main().catch(console.error);
