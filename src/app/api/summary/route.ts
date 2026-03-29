import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface MonthlySummary {
  month: string; // YYYY-MM
  income: number;
  expense: number;
}

interface CategorySummary {
  category: string;
  type: "收入" | "支出";
  total: number;
}

interface RecentTransaction {
  id: string;
  date: string;
  amount: number;
  category: string;
  type: string;
  note: string;
  source: string;
}

interface SummaryResponse {
  monthly: MonthlySummary[];
  byCategory: CategorySummary[];
  recent: RecentTransaction[];
  totals: {
    income: number;
    expense: number;
    net: number;
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const months = parseInt(searchParams.get("months") ?? "6", 10);
  const userId = searchParams.get("userId");

  // Calculate date range
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);
  startDate.setDate(1);
  startDate.setHours(0, 0, 0, 0);

  const whereClause = {
    date: {
      gte: startDate,
      lte: endDate,
    },
    ...(userId ? { user: { lineUserId: userId } } : {}),
  };

  // Fetch all transactions in range
  const transactions = await prisma.transaction.findMany({
    where: whereClause,
    orderBy: { date: "desc" },
  });

  // Build monthly summary
  const monthlyMap = new Map<string, { income: number; expense: number }>();

  for (const tx of transactions) {
    const month = tx.date.toISOString().slice(0, 7); // YYYY-MM
    const existing = monthlyMap.get(month) ?? { income: 0, expense: 0 };
    const amount = parseFloat(tx.amount.toString());

    if (tx.type === "收入") {
      existing.income += amount;
    } else {
      existing.expense += amount;
    }

    monthlyMap.set(month, existing);
  }

  const monthly: MonthlySummary[] = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month,
      income: Math.round(data.income * 100) / 100,
      expense: Math.round(data.expense * 100) / 100,
    }));

  // Build category summary
  const categoryMap = new Map<string, { income: number; expense: number }>();

  for (const tx of transactions) {
    const key = tx.category;
    const existing = categoryMap.get(key) ?? { income: 0, expense: 0 };
    const amount = parseFloat(tx.amount.toString());

    if (tx.type === "收入") {
      existing.income += amount;
    } else {
      existing.expense += amount;
    }

    categoryMap.set(key, existing);
  }

  const byCategory: CategorySummary[] = [];
  for (const [category, data] of categoryMap.entries()) {
    if (data.income > 0) {
      byCategory.push({ category, type: "收入", total: Math.round(data.income * 100) / 100 });
    }
    if (data.expense > 0) {
      byCategory.push({ category, type: "支出", total: Math.round(data.expense * 100) / 100 });
    }
  }

  byCategory.sort((a, b) => b.total - a.total);

  // Recent transactions (last 20)
  const recent: RecentTransaction[] = transactions.slice(0, 20).map((tx) => ({
    id: tx.id,
    date: tx.date.toISOString().split("T")[0],
    amount: parseFloat(tx.amount.toString()),
    category: tx.category,
    type: tx.type,
    note: tx.note,
    source: tx.source,
  }));

  // Totals — current month only
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const thisMonthTxs = transactions.filter(
    (tx) => tx.date.toISOString().slice(0, 7) === currentMonth,
  );

  const totalIncome = thisMonthTxs
    .filter((tx) => tx.type === "收入")
    .reduce((sum, tx) => sum + parseFloat(tx.amount.toString()), 0);

  const totalExpense = thisMonthTxs
    .filter((tx) => tx.type === "支出")
    .reduce((sum, tx) => sum + parseFloat(tx.amount.toString()), 0);

  const response: SummaryResponse = {
    monthly,
    byCategory,
    recent,
    totals: {
      income: Math.round(totalIncome * 100) / 100,
      expense: Math.round(totalExpense * 100) / 100,
      net: Math.round((totalIncome - totalExpense) * 100) / 100,
    },
  };

  return NextResponse.json(response);
}
