import { CsvAdapter, ParsedTransaction } from "../types";

/**
 * 玉山銀行存款 (E.Sun Bank - Deposit) adapter
 * Headers: 日期, 摘要, 支出, 收入, 餘額
 */

function parseDate(dateStr: string): Date {
  const cleaned = dateStr.trim();

  // Format: YYYY/MM/DD or YYYY-MM-DD
  const isoMatch = cleaned.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (isoMatch) {
    return new Date(parseInt(isoMatch[1], 10), parseInt(isoMatch[2], 10) - 1, parseInt(isoMatch[3], 10));
  }

  // Format: MM/DD/YYYY
  const usMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usMatch) {
    return new Date(parseInt(usMatch[3], 10), parseInt(usMatch[1], 10) - 1, parseInt(usMatch[2], 10));
  }

  return new Date(cleaned);
}

function parseAmount(str: string): number {
  const cleaned = str.replace(/,/g, "").trim();
  if (!cleaned || cleaned === "-" || cleaned === "") return 0;
  return parseFloat(cleaned) || 0;
}

export const esunBankAdapter: CsvAdapter = {
  source: "esun_bank",

  parse(rows: Record<string, string>[]): ParsedTransaction[] {
    const results: ParsedTransaction[] = [];

    for (const row of rows) {
      const dateStr = row["日期"] ?? row["交易日期"] ?? "";
      const summary = row["摘要"] ?? row["說明"] ?? "";
      const expenseStr = row["支出"] ?? row["支出金額"] ?? "0";
      const incomeStr = row["收入"] ?? row["收入金額"] ?? "0";

      if (!dateStr.trim()) continue;

      const date = parseDate(dateStr);
      const expense = parseAmount(expenseStr);
      const income = parseAmount(incomeStr);

      if (expense > 0) {
        results.push({
          date,
          amount: expense,
          type: "支出",
          category: "其他",
          note: summary.trim(),
          source: "esun_bank",
        });
      }

      if (income > 0) {
        results.push({
          date,
          amount: income,
          type: "收入",
          category: "其他",
          note: summary.trim(),
          source: "esun_bank",
        });
      }
    }

    return results;
  },

  getLastBalance(rows: Record<string, string>[]): { amount: number; date: Date } | null {
    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i];
      const balanceStr = row["餘額"] ?? row["帳戶餘額"] ?? "";
      const dateStr = row["日期"] ?? row["交易日期"] ?? "";
      const amount = parseAmount(balanceStr);
      if (amount > 0 && dateStr.trim()) {
        return { amount, date: parseDate(dateStr) };
      }
    }
    return null;
  },
};
