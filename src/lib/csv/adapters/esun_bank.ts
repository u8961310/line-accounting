import { CsvAdapter, ParsedTransaction } from "../types";
import { detectCategory } from "../transfer";

/**
 * 玉山銀行存款 adapter
 *
 * CSV 格式欄位：日期, 摘要, 支出, 收入, 餘額
 * XLS 格式欄位：交易日期, 交易時間, 摘要, 提(支出), 存(收入), 帳戶餘額, 存摺備註, 對方銀行代碼/帳號
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
      // CSV: 日期/交易日期; XLS: 交易日期
      const dateStr = row["日期"] ?? row["交易日期"] ?? "";
      // CSV: 摘要; XLS: 摘要 + 存摺備註
      const summary = (row["摘要"] ?? row["說明"] ?? "").trim();
      const memo    = (row["存摺備註"] ?? "").trim();
      const note    = [summary, memo].filter(Boolean).join(" ");
      // CSV: 支出/支出金額; XLS: 提
      const expenseStr = row["支出"] ?? row["支出金額"] ?? row["提"] ?? "0";
      // CSV: 收入/收入金額; XLS: 存
      const incomeStr  = row["收入"] ?? row["收入金額"] ?? row["存"] ?? "0";

      if (!dateStr.trim()) continue;

      const date    = parseDate(dateStr);
      const expense = parseAmount(expenseStr);
      const income  = parseAmount(incomeStr);

      if (expense > 0) {
        results.push({ date, amount: expense, type: "支出", category: detectCategory(note), note, source: "esun_bank" });
      }
      if (income > 0) {
        results.push({ date, amount: income,  type: "收入", category: detectCategory(note), note, source: "esun_bank" });
      }
    }

    return results;
  },

  getLastBalance(rows: Record<string, string>[]): { amount: number; date: Date } | null {
    let best: { amount: number; date: Date } | null = null;

    for (const row of rows) {
      const balanceStr = row["餘額"] ?? row["帳戶餘額"] ?? row["帳面餘額"] ?? "";
      const dateStr    = row["日期"] ?? row["交易日期"] ?? "";
      const amount     = parseAmount(balanceStr);
      if (isNaN(amount) || !dateStr.trim()) continue;

      const date = parseDate(dateStr);
      if (!best || date > best.date) {
        best = { amount, date };
      }
    }

    return best;
  },
};
