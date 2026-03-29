import { CsvAdapter, ParsedTransaction } from "../types";

/**
 * 台灣銀行 (Taiwan Bank) adapter
 * - Uses ROC (Republic of China) year format
 * - CSV may be encoded in Big5
 * - Headers: 交易日期, 摘要, 提款金額, 存款金額, 餘額, 幣別
 */

function rocYearToDate(rocDateStr: string): Date {
  // ROC date format: 1130328 or 113/03/28 or 113-03-28
  const cleaned = rocDateStr.trim().replace(/[/\-]/g, "");

  let year: number;
  let month: number;
  let day: number;

  if (cleaned.length === 7) {
    // Format: 1130328 → year=113, month=03, day=28
    year = parseInt(cleaned.slice(0, 3), 10) + 1911;
    month = parseInt(cleaned.slice(3, 5), 10);
    day = parseInt(cleaned.slice(5, 7), 10);
  } else if (cleaned.length === 6) {
    // Format: 130328 → year=13? — likely 2-digit ROC year, less common
    year = parseInt(cleaned.slice(0, 2), 10) + 1911;
    month = parseInt(cleaned.slice(2, 4), 10);
    day = parseInt(cleaned.slice(4, 6), 10);
  } else {
    return new Date(rocDateStr);
  }

  return new Date(year, month - 1, day);
}

function parseAmount(str: string): number {
  const cleaned = str.replace(/,/g, "").trim();
  if (!cleaned || cleaned === "-") return 0;
  return parseFloat(cleaned) || 0;
}

export const tbankAdapter: CsvAdapter = {
  source: "tbank",

  parse(rows: Record<string, string>[]): ParsedTransaction[] {
    const results: ParsedTransaction[] = [];

    for (const row of rows) {
      const dateStr = row["交易日期"] ?? row["日期"] ?? "";
      const summary = row["摘要"] ?? row["說明"] ?? "";
      const withdrawStr = row["提款金額"] ?? row["支出"] ?? "0";
      const depositStr = row["存款金額"] ?? row["收入"] ?? "0";

      if (!dateStr.trim()) continue;

      const date = rocYearToDate(dateStr);
      const withdraw = parseAmount(withdrawStr);
      const deposit = parseAmount(depositStr);

      if (withdraw > 0) {
        results.push({
          date,
          amount: withdraw,
          type: "支出",
          category: "其他",
          note: summary.trim(),
          source: "tbank",
        });
      }

      if (deposit > 0) {
        results.push({
          date,
          amount: deposit,
          type: "收入",
          category: "其他",
          note: summary.trim(),
          source: "tbank",
        });
      }
    }

    return results;
  },

  getLastBalance(rows: Record<string, string>[]): { amount: number; date: Date } | null {
    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i];
      const balanceStr = row["餘額"] ?? "";
      const dateStr = row["交易日期"] ?? row["日期"] ?? "";
      const amount = parseAmount(balanceStr);
      if (!isNaN(amount) && dateStr.trim()) {
        return { amount, date: rocYearToDate(dateStr) };
      }
    }
    return null;
  },
};
