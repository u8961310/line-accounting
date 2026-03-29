import { CsvAdapter, ParsedTransaction } from "../types";

/**
 * 中國信託存款 (CTBC Bank - Deposit) adapter
 * - Uses ROC year format like 1130328 (year 113 = 2024 AD)
 * - CSV may be encoded in Big5
 * - Headers: 交易日期, 交易說明, 提出, 存入, 餘額, 備註
 */

function rocYearToDate(rocDateStr: string): Date {
  const cleaned = rocDateStr.trim().replace(/[/\-]/g, "");

  if (cleaned.length === 7) {
    // 1130328 → year=113+1911=2024, month=03, day=28
    const year = parseInt(cleaned.slice(0, 3), 10) + 1911;
    const month = parseInt(cleaned.slice(3, 5), 10);
    const day = parseInt(cleaned.slice(5, 7), 10);
    return new Date(year, month - 1, day);
  }

  if (cleaned.length === 6) {
    // Older 2-digit year format
    const year = parseInt(cleaned.slice(0, 2), 10) + 1911;
    const month = parseInt(cleaned.slice(2, 4), 10);
    const day = parseInt(cleaned.slice(4, 6), 10);
    return new Date(year, month - 1, day);
  }

  // Try AD format as fallback
  const isoMatch = cleaned.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (isoMatch) {
    return new Date(parseInt(isoMatch[1], 10), parseInt(isoMatch[2], 10) - 1, parseInt(isoMatch[3], 10));
  }

  return new Date(rocDateStr);
}

function parseAmount(str: string): number {
  const cleaned = str.replace(/,/g, "").trim();
  if (!cleaned || cleaned === "-" || cleaned === "") return 0;
  return parseFloat(cleaned) || 0;
}

export const ctbcBankAdapter: CsvAdapter = {
  source: "ctbc_bank",

  parse(rows: Record<string, string>[]): ParsedTransaction[] {
    const results: ParsedTransaction[] = [];

    for (const row of rows) {
      const dateStr = row["交易日期"] ?? row["日期"] ?? "";
      const description = row["交易說明"] ?? row["摘要"] ?? "";
      const withdrawStr = row["提出"] ?? row["提款金額"] ?? "0";
      const depositStr = row["存入"] ?? row["存款金額"] ?? "0";
      const remark = row["備註"] ?? "";

      if (!dateStr.trim()) continue;

      const date = rocYearToDate(dateStr);
      const withdraw = parseAmount(withdrawStr);
      const deposit = parseAmount(depositStr);
      const note = remark.trim() || description.trim();

      if (withdraw > 0) {
        results.push({
          date,
          amount: withdraw,
          type: "支出",
          category: "其他",
          note,
          source: "ctbc_bank",
        });
      }

      if (deposit > 0) {
        results.push({
          date,
          amount: deposit,
          type: "收入",
          category: "其他",
          note,
          source: "ctbc_bank",
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
