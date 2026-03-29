import { CsvAdapter, ParsedTransaction } from "../types";

/**
 * 國泰世華銀行存款 (Cathay United Bank - Deposit) adapter
 * Headers: 交易日期, 交易說明, 交易金額, 幣別, 帳戶餘額
 * Amount is positive for deposits, negative for withdrawals
 */

function parseDate(dateStr: string): Date {
  const cleaned = dateStr.trim();

  // Format: YYYY/MM/DD or YYYY-MM-DD
  const match = cleaned.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    return new Date(year, month - 1, day);
  }

  return new Date(cleaned);
}

function parseAmount(str: string): number {
  const cleaned = str.replace(/,/g, "").trim();
  if (!cleaned || cleaned === "-") return 0;
  return parseFloat(cleaned) || 0;
}

export const cathayBankAdapter: CsvAdapter = {
  source: "cathay_bank",

  parse(rows: Record<string, string>[]): ParsedTransaction[] {
    const results: ParsedTransaction[] = [];

    for (const row of rows) {
      const dateStr = row["交易日期"] ?? "";
      const description = row["交易說明"] ?? "";
      const amountStr = row["交易金額"] ?? "0";

      if (!dateStr.trim()) continue;

      const date = parseDate(dateStr);
      const rawAmount = parseAmount(amountStr);

      if (rawAmount === 0) continue;

      const amount = Math.abs(rawAmount);
      const type: "收入" | "支出" = rawAmount > 0 ? "收入" : "支出";

      results.push({
        date,
        amount,
        type,
        category: "其他",
        note: description.trim(),
        source: "cathay_bank",
      });
    }

    return results;
  },

  getLastBalance(rows: Record<string, string>[]): { amount: number; date: Date } | null {
    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i];
      const balanceStr = row["帳戶餘額"] ?? "";
      const dateStr = row["交易日期"] ?? "";
      const amount = parseAmount(balanceStr);
      if (amount > 0 && dateStr.trim()) {
        return { amount, date: parseDate(dateStr) };
      }
    }
    return null;
  },
};
