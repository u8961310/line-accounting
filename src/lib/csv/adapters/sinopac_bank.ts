import { CsvAdapter, ParsedTransaction } from "../types";
import { detectCategory } from "../transfer";

/**
 * 永豐銀行存款 (Sinopac Bank - Deposit) adapter
 *
 * CSV 原始格式前幾行為 metadata，由 parseCsv() 中的 stripSinopacMetaRows()
 * 預先剝除，傳入 adapter 時 rows 已是標準欄位：
 * 交易日, 計息日, 摘要, 支出, 存入, 餘額, 匯率, 備註/資金用途
 */

function parseDate(raw: string): Date | null {
  // Format: "2026/03/04 10:30" or "2026/03/04"
  const m = raw.trim().match(/^(\d{4})\/(\d{2})\/(\d{2})/);
  if (!m) return null;
  return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
}

function parseAmount(raw: string | undefined): number {
  const n = parseFloat((raw ?? "").replace(/,/g, "").trim());
  return isNaN(n) ? 0 : n;
}

export const sinopacBankAdapter: CsvAdapter = {
  source: "sinopac_bank",

  parse(rows) {
    const results: ParsedTransaction[] = [];
    console.log("[sinopac_bank] parse called, rows:", rows.length);
    if (rows.length > 0) {
      console.log("[sinopac_bank] first row keys:", Object.keys(rows[0]));
      console.log("[sinopac_bank] first row:", JSON.stringify(rows[0]));
    }

    for (const row of rows) {
      const rawDate = row["交易日"]?.trim() ?? "";
      if (!rawDate) continue;

      const date = parseDate(rawDate);
      if (!date) continue;

      const debit  = parseAmount(row["支出"]);
      const credit = parseAmount(row["存入"]);
      if (debit === 0 && credit === 0) continue;

      const note = (row["摘要"] ?? "").trim();

      if (debit > 0) {
        results.push({ date, amount: debit,  type: "支出", category: detectCategory(note), note, source: "sinopac_bank" });
      }
      if (credit > 0) {
        results.push({ date, amount: credit, type: "收入", category: detectCategory(note), note, source: "sinopac_bank" });
      }
    }

    return results;
  },

  getLastBalance(rows) {
    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i];
      const date   = parseDate(row["交易日"]?.trim() ?? "");
      const amount = parseAmount(row["餘額"]);
      if (date && !isNaN(amount)) {
        return { date, amount };
      }
    }
    return null;
  },
};
