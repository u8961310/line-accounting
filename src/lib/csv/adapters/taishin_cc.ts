import { CsvAdapter, ParsedTransaction } from "../types";

/**
 * 台新信用卡 (Taishin International Bank - Credit Card) adapter
 * Headers: 交易日期, 消費名稱, 臺幣金額, 幣別, 原幣金額
 */

function parseDate(dateStr: string): Date {
  const cleaned = dateStr.trim();

  // Format: YYYY/MM/DD or YYYY-MM-DD
  const isoMatch = cleaned.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (isoMatch) {
    return new Date(parseInt(isoMatch[1], 10), parseInt(isoMatch[2], 10) - 1, parseInt(isoMatch[3], 10));
  }

  return new Date(cleaned);
}

function parseAmount(str: string): number {
  // Handle formats like "1,234" or "1,234.56" or "-500"
  const cleaned = str.replace(/,/g, "").trim();
  if (!cleaned || cleaned === "-" || cleaned === "") return 0;
  return parseFloat(cleaned) || 0;
}

export const taishinCcAdapter: CsvAdapter = {
  source: "taishin_cc",

  parse(rows: Record<string, string>[]): ParsedTransaction[] {
    const results: ParsedTransaction[] = [];

    for (const row of rows) {
      const dateStr = row["交易日期"] ?? row["消費日期"] ?? "";
      const merchant = row["消費名稱"] ?? row["交易說明"] ?? "";
      const amountStr = row["臺幣金額"] ?? row["台幣金額"] ?? row["消費金額"] ?? "0";

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
        note: merchant.trim(),
        source: "taishin_cc",
      });
    }

    return results;
  },
};
