import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export interface AnnualReportResponse {
  year: number;
  monthly: {
    month:       string;   // YYYY-MM
    income:      number;
    expense:     number;
    net:         number;
    savingsRate: number;   // 0–100, -1 if income = 0
  }[];
  byCategory: {
    category: string;
    type:     "收入" | "支出";
    total:    number;
  }[];
  totals: {
    income:      number;
    expense:     number;
    net:         number;
    savingsRate: number;
    txCount:     number;
  };
  highlights: {
    peakIncomeMonth:    string | null;   // YYYY-MM
    peakExpenseMonth:   string | null;
    lowestExpenseMonth: string | null;
    bestSavingsMonth:   string | null;
  };
  availableYears: number[];
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get("year");

  // --- resolve dashboard_user ---
  const user = await prisma.user.findUnique({ where: { lineUserId: "dashboard_user" } });
  if (!user) return NextResponse.json({ error: "No user" }, { status: 404 });

  // --- available years from transactions ---
  const oldest = await prisma.transaction.findFirst({
    where: { userId: user.id },
    orderBy: { date: "asc" },
    select: { date: true },
  });
  const now         = new Date();
  const currentYear = now.getFullYear();
  const firstYear   = oldest ? oldest.date.getFullYear() : currentYear;
  const availableYears: number[] = [];
  for (let y = firstYear; y <= currentYear; y++) availableYears.push(y);

  const year = yearParam ? parseInt(yearParam, 10) : currentYear;

  // --- date range: full calendar year ---
  const startDate = new Date(year, 0, 1);           // Jan 1
  const endDate   = new Date(year + 1, 0, 1);       // Jan 1 next year (exclusive)

  const transactions = await prisma.transaction.findMany({
    where: {
      userId: user.id,
      date:   { gte: startDate, lt: endDate },
      NOT:    { category: "轉帳" },
    },
    orderBy: { date: "asc" },
  });

  // --- monthly breakdown ---
  const monthlyMap = new Map<string, { income: number; expense: number }>();
  // seed all 12 months
  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, "0")}`;
    monthlyMap.set(key, { income: 0, expense: 0 });
  }

  for (const tx of transactions) {
    const key     = tx.date.toISOString().slice(0, 7);
    const entry   = monthlyMap.get(key) ?? { income: 0, expense: 0 };
    const amount  = parseFloat(tx.amount.toString());
    if (tx.type === "收入") entry.income  += amount;
    else                    entry.expense += amount;
    monthlyMap.set(key, entry);
  }

  const monthly = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, d]) => {
      const net         = d.income - d.expense;
      const savingsRate = d.income > 0 ? Math.round((net / d.income) * 100) : -1;
      return {
        month,
        income:      Math.round(d.income),
        expense:     Math.round(d.expense),
        net:         Math.round(net),
        savingsRate,
      };
    });

  // --- by-category ---
  const catMap = new Map<string, { income: number; expense: number }>();
  for (const tx of transactions) {
    const existing = catMap.get(tx.category) ?? { income: 0, expense: 0 };
    const amount   = parseFloat(tx.amount.toString());
    if (tx.type === "收入") existing.income  += amount;
    else                    existing.expense += amount;
    catMap.set(tx.category, existing);
  }
  const byCategory: AnnualReportResponse["byCategory"] = [];
  for (const [category, d] of Array.from(catMap.entries())) {
    if (d.income  > 0) byCategory.push({ category, type: "收入", total: Math.round(d.income) });
    if (d.expense > 0) byCategory.push({ category, type: "支出", total: Math.round(d.expense) });
  }
  byCategory.sort((a, b) => b.total - a.total);

  // --- totals ---
  const totalIncome  = transactions.filter(t => t.type === "收入").reduce((s, t) => s + parseFloat(t.amount.toString()), 0);
  const totalExpense = transactions.filter(t => t.type === "支出").reduce((s, t) => s + parseFloat(t.amount.toString()), 0);
  const totalNet     = totalIncome - totalExpense;

  // --- highlights ---
  const activeMths = monthly.filter(m => m.income > 0 || m.expense > 0);

  const peakIncomeMonth    = activeMths.length ? activeMths.reduce((a, b) => b.income  > a.income  ? b : a).month : null;
  const peakExpenseMonth   = activeMths.length ? activeMths.reduce((a, b) => b.expense > a.expense ? b : a).month : null;
  const lowestExpenseMonth = activeMths.length
    ? activeMths.filter(m => m.expense > 0).reduce((a, b) => b.expense < a.expense ? b : a, activeMths.filter(m => m.expense > 0)[0])?.month ?? null
    : null;
  const bestSavingsMonth   = activeMths.filter(m => m.savingsRate >= 0).length
    ? activeMths.filter(m => m.savingsRate >= 0).reduce((a, b) => b.savingsRate > a.savingsRate ? b : a).month
    : null;

  const response: AnnualReportResponse = {
    year,
    monthly,
    byCategory,
    totals: {
      income:      Math.round(totalIncome),
      expense:     Math.round(totalExpense),
      net:         Math.round(totalNet),
      savingsRate: totalIncome > 0 ? Math.round((totalNet / totalIncome) * 100) : -1,
      txCount:     transactions.length,
    },
    highlights: { peakIncomeMonth, peakExpenseMonth, lowestExpenseMonth, bestSavingsMonth },
    availableYears,
  };

  return NextResponse.json(response);
}
