import { CsvAdapter, ParsedTransaction } from "../types";

/**
 * 國泰世華信用卡 (Cathay United Bank - Credit Card) adapter
 * Headers: 消費日期, 消費說明, 消費金額, 幣別
 * Credit card transactions are expenses by default;
 * negative amounts may indicate refunds (收入)
 */

function parseDate(dateStr: string): Date {
  const cleaned = dateStr.trim();

  // Format: YYYY/MM/DD
  const match = cleaned.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (match) {
    return new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
  }

  return new Date(cleaned);
}

function parseAmount(str: string): number {
  const cleaned = str.replace(/,/g, "").trim();
  if (!cleaned || cleaned === "-") return 0;
  return parseFloat(cleaned) || 0;
}

export const cathayCcAdapter: CsvAdapter = {
  source: "cathay_cc",

  parse(rows: Record<string, string>[]): ParsedTransaction[] {
    const results: ParsedTransaction[] = [];

    for (const row of rows) {
      const dateStr = row["消費日期"] ?? row["交易日期"] ?? "";
      const description = row["消費說明"] ?? row["交易說明"] ?? "";
      const amountStr = row["消費金額"] ?? row["交易金額"] ?? "0";

      if (!dateStr.trim()) continue;

      const date = parseDate(dateStr);
      const rawAmount = parseAmount(amountStr);

      if (rawAmount === 0) continue;

      const amount = Math.abs(rawAmount);
      // Negative = refund (收入), positive = expense (支出)
      const type: "收入" | "支出" = rawAmount < 0 ? "收入" : "支出";

      results.push({
        date,
        amount,
        type,
        category: "其他",
        note: description.trim(),
        source: "cathay_cc",
      });
    }

    return results;
  },
};
