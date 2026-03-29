import { CsvAdapter, ParsedTransaction } from "../types";

/**
 * 玉山信用卡 (E.Sun Bank - Credit Card) adapter
 * Headers: 消費日期, 特店名稱, 台幣消費金額, 幣別, 原幣金額
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
  const cleaned = str.replace(/,/g, "").trim();
  if (!cleaned || cleaned === "-" || cleaned === "") return 0;
  return parseFloat(cleaned) || 0;
}

export const esunCcAdapter: CsvAdapter = {
  source: "esun_cc",

  parse(rows: Record<string, string>[]): ParsedTransaction[] {
    const results: ParsedTransaction[] = [];

    for (const row of rows) {
      const dateStr = row["消費日期"] ?? row["交易日期"] ?? "";
      const merchant = row["特店名稱"] ?? row["消費說明"] ?? "";
      const amountStr = row["台幣消費金額"] ?? row["消費金額"] ?? row["交易金額"] ?? "0";

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
        source: "esun_cc",
      });
    }

    return results;
  },
};
