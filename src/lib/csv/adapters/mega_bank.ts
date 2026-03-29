import { CsvAdapter, ParsedTransaction } from "../types";

/**
 * 兆豐國際商業銀行 (Mega Bank) adapter
 * - XLS/XLSX format with metadata rows at the top
 * - Headers (row 7): 交易時間, 銀行帳務日, 交易項目, 支出, 收入, 帳戶餘額, 存摺備註
 * - Date format: "* 2026/02/28 09:31:52" or "2026/03/02 07:29:32"
 */

function parseDate(str: string): Date {
  // Remove leading "* " prefix, then take date part only
  const cleaned = str.trim().replace(/^\*\s*/, "");
  const datePart = cleaned.split(" ")[0]; // "2026/03/02"
  const [year, month, day] = datePart.split("/").map(Number);
  return new Date(year, month - 1, day);
}

function parseAmount(str: string): number {
  if (!str || str.trim() === "" || str.trim() === "-") return 0;
  return parseFloat(str.replace(/,/g, "").trim()) || 0;
}

function guessCategory(item: string, note: string): string {
  const text = item + note;
  if (text.includes("薪資") || text.includes("薪水")) return "薪資";
  if (text.includes("獎金") || text.includes("年終")) return "獎金";
  if (text.includes("餐") || text.includes("食") || text.includes("超商")) return "飲食";
  if (text.includes("悠遊") || text.includes("捷運") || text.includes("公車") || text.includes("停車") || text.includes("電支轉")) return "交通";
  if (text.includes("醫") || text.includes("藥") || text.includes("助聽")) return "醫療";
  if (text.includes("房租") || text.includes("租金") || text.includes("水電") || text.includes("管理費")) return "住房";
  if (text.includes("電信") || text.includes("網路費")) return "帳單";
  if (text.includes("貸款") || text.includes("信貸") || text.includes("繳交信用卡")) return "貸款";
  if (text.includes("娛樂") || text.includes("電影")) return "娛樂";
  return "其他";
}

export const megaBankAdapter: CsvAdapter = {
  source: "mega_bank",

  parse(rows: Record<string, string>[]): ParsedTransaction[] {
    const results: ParsedTransaction[] = [];

    for (const row of rows) {
      const dateStr = row["交易時間"] ?? "";
      const item = (row["交易項目"] ?? "").trim();
      const withdrawStr = row["支出"] ?? "";
      const depositStr = row["收入"] ?? "";
      const note = (row["存摺備註"] ?? "").trim();

      if (!dateStr.trim()) continue;

      let date: Date;
      try {
        date = parseDate(dateStr);
        if (isNaN(date.getTime())) continue;
      } catch {
        continue;
      }

      const withdraw = parseAmount(withdrawStr);
      const deposit = parseAmount(depositStr);
      // 存摺備註 first — it's the meaningful description for AI categorization
      // 交易項目 appended as context (網際轉, 電支轉, 現金…)
      const noteText = [note, item].filter(Boolean).join(" ");

      if (withdraw > 0) {
        results.push({
          date,
          amount: withdraw,
          type: "支出",
          category: guessCategory(item, note),
          note: noteText,
          source: "mega_bank",
        });
      }

      if (deposit > 0) {
        results.push({
          date,
          amount: deposit,
          type: "收入",
          category: guessCategory(item, note),
          note: noteText,
          source: "mega_bank",
        });
      }
    }

    return results;
  },

  getLastBalance(rows: Record<string, string>[]): { amount: number; date: Date } | null {
    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i];
      const balanceStr = row["帳戶餘額"] ?? "";
      const dateStr = row["交易時間"] ?? "";
      const amount = parseAmount(balanceStr);
      if (!isNaN(amount) && dateStr.trim()) {
        return { amount, date: parseDate(dateStr) };
      }
    }
    return null;
  },
};
