import { CsvAdapter, ParsedTransaction } from "../types";

/**
 * 中信信用卡 (CTBC Bank - Credit Card) adapter
 * - CSV may be encoded in Big5
 * - Headers: 交易日期, 交易說明, 交易金額, 幣別
 * - Positive amount = expense, negative = refund
 */

function parseDate(dateStr: string): Date {
  const cleaned = dateStr.trim();

  // Format: YYYY/MM/DD
  const match = cleaned.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (match) {
    return new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
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

export const ctbcCcAdapter: CsvAdapter = {
  source: "ctbc_cc",

  parse(rows: Record<string, string>[]): ParsedTransaction[] {
    const results: ParsedTransaction[] = [];

    for (const row of rows) {
      const dateStr = row["交易日期"] ?? row["消費日期"] ?? "";
      const description = row["交易說明"] ?? row["消費說明"] ?? "";
      const amountStr = row["交易金額"] ?? row["消費金額"] ?? "0";

      if (!dateStr.trim()) continue;

      const date = parseDate(dateStr);
      const rawAmount = parseAmount(amountStr);

      if (rawAmount === 0) continue;

      const amount = Math.abs(rawAmount);
      const type: "收入" | "支出" = rawAmount < 0 ? "收入" : "支出";

      results.push({
        date,
        amount,
        type,
        category: "其他",
        note: description.trim(),
        source: "ctbc_cc",
      });
    }

    return results;
  },
};
