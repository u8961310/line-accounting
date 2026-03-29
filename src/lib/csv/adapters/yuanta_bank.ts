import { CsvAdapter, ParsedTransaction } from "../types";

/**
 * 元大銀行存款 (Yuanta Bank) adapter
 * Headers: 帳號, 帳務日期, 交易日期, 交易時間, 交易說明, 支出金額, 存入金額, 帳面餘額, 票據號碼, 備註
 * Date format: YYYYMMDD (西元)
 * 備註欄格式: "000000191008750 實際說明文字" — 前置數字需剝除
 */

function parseDate(str: string): Date {
  const s = str.replace(/\D/g, "");
  if (s.length === 8) {
    const y = parseInt(s.slice(0, 4), 10);
    const m = parseInt(s.slice(4, 6), 10) - 1;
    const d = parseInt(s.slice(6, 8), 10);
    return new Date(y, m, d);
  }
  return new Date(str);
}

function parseAmount(str: string): number {
  const cleaned = str.replace(/,/g, "").trim();
  if (!cleaned || cleaned === "-") return 0;
  return parseFloat(cleaned) || 0;
}

/** 剝除備註欄前置的純數字流水號，取後面有意義的文字 */
function cleanNote(remark: string, description: string): string {
  const trimmed = remark.trim();
  // 去掉開頭的純數字（流水號），保留後面的文字描述
  const stripped = trimmed.replace(/^\d+\s*/, "").trim();
  // 組合交易說明 + 備註（去重後合併）
  const parts = [description.trim(), stripped].filter(Boolean);
  const combined = parts[0] === parts[1] ? parts[0] : parts.join(" ");
  return combined;
}

export const yuantaBankAdapter: CsvAdapter = {
  source: "yuanta_bank",

  parse(rows: Record<string, string>[]): ParsedTransaction[] {
    const results: ParsedTransaction[] = [];

    for (const row of rows) {
      const dateStr    = (row["交易日期"] ?? row["帳務日期"] ?? "").trim();
      const desc       = (row["交易說明"] ?? "").trim();
      const remark     = (row["備註"] ?? "").trim();
      const expenseStr = row["支出金額"] ?? "0";
      const incomeStr  = row["存入金額"] ?? "0";

      if (!dateStr) continue;

      const date    = parseDate(dateStr);
      const expense = parseAmount(expenseStr);
      const income  = parseAmount(incomeStr);
      const note    = cleanNote(remark, desc);

      if (expense > 0) {
        results.push({ date, amount: expense, type: "支出", category: "其他", note, source: "yuanta_bank" });
      }
      if (income > 0) {
        results.push({ date, amount: income, type: "收入", category: "其他", note, source: "yuanta_bank" });
      }
    }

    return results;
  },

  getLastBalance(rows: Record<string, string>[]): { amount: number; date: Date } | null {
    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i];
      const balanceStr = (row["帳面餘額"] ?? "").trim();
      const dateStr    = (row["交易日期"] ?? row["帳務日期"] ?? "").trim();
      if (!balanceStr || !dateStr) continue;
      const amount = parseAmount(balanceStr);
      if (!isNaN(amount)) {
        return { amount, date: parseDate(dateStr) };
      }
    }
    return null;
  },
};
