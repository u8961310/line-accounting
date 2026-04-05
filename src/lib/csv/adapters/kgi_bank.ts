import { CsvAdapter, ParsedTransaction } from "../types";
import { detectCategory } from "../transfer";

/**
 * 凱基銀行存款 — 固定寬度 Big5 文字格式 (.txt)
 *
 * 欄位：交易日期, 帳務日期, 摘要, 支出, 存入, 結餘, 備註
 * parseCsv() 偵測到此格式後呼叫 parseKgiText() 將文字轉為 rows，
 * 再交由 kgiBankAdapter.parse() 處理。
 */

/** 依顯示列範圍截取字串 */
function sliceDisplayCols(line: string, startCol: number, endCol: number): string {
  let col = 0;
  let si = -1;
  let ei = line.length;
  for (let i = 0; i < line.length; i++) {
    if (col >= startCol && si < 0) si = i;
    if (col >= endCol) { ei = i; break; }
    col += (line.codePointAt(i) ?? 0) > 0x7F ? 2 : 1;
  }
  return si < 0 ? "" : line.slice(si, ei);
}

/** 找出 target 在 line 中的顯示起始列 */
function findDisplayColOf(line: string, target: string): number {
  let col = 0;
  for (let i = 0; i <= line.length - target.length; i++) {
    if (line.slice(i, i + target.length) === target) return col;
    col += (line.codePointAt(i) ?? 0) > 0x7F ? 2 : 1;
  }
  return -1;
}

/**
 * 在 line 的 [startCol, endCol) 顯示欄範圍內找所有數字序列，
 * 回傳每個數字的字串及其「起始顯示列」（相對於整行）。
 * 用於解決右對齊數字跨越欄位邊界的問題。
 */
function findNumbersInRange(
  line: string,
  startCol: number,
  endCol: number,
): Array<{ str: string; startCol: number }> {
  const results: Array<{ str: string; startCol: number }> = [];
  let col = 0;
  let i = 0;

  // 推進到 startCol
  while (i < line.length && col < startCol) {
    col += (line.codePointAt(i) ?? 0) > 0x7F ? 2 : 1;
    i++;
  }

  let numStart = -1;
  let numStartCol = -1;

  while (i < line.length && col <= endCol + 8) { // 多掃 8 cols 防右對齊溢出
    const ch = line[i];
    if (/[\d,]/.test(ch)) {
      if (numStart < 0) { numStart = i; numStartCol = col; }
    } else {
      if (numStart >= 0) {
        results.push({ str: line.slice(numStart, i), startCol: numStartCol });
        numStart = -1;
      }
    }
    col += (line.codePointAt(i) ?? 0) > 0x7F ? 2 : 1;
    i++;
  }
  if (numStart >= 0) {
    results.push({ str: line.slice(numStart, i), startCol: numStartCol });
  }
  return results;
}

function parseAmount(s: string): number {
  // 只取第一段數字（含逗號），忽略後面的字母/空白/備註帳號
  const match = s.match(/[\d,]+/);
  if (!match) return 0;
  const n = parseFloat(match[0].replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

function parseDate(s: string): Date | null {
  const m = s.trim().match(/^(\d{4})\/(\d{2})\/(\d{2})/);
  if (!m) return null;
  return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
}

/** 偵測是否為凱基固定寬度文字格式 */
export function isKgiBankText(text: string): boolean {
  return text.split(/\r?\n/).some(
    (l) => l.includes("交易日期") && l.includes("帳務日期") && l.includes("結餘"),
  );
}

/** 將凱基文字格式解析為 rows */
export function parseKgiText(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const HEADERS = ["交易日期", "摘要", "支出", "存入", "結餘", "備註"];
  const lines = text.split(/\r?\n/);

  const headerLineIdx = lines.findIndex(
    (l) => l.includes("交易日期") && l.includes("支出") && l.includes("存入") && l.includes("結餘"),
  );
  if (headerLineIdx < 0) return { headers: HEADERS, rows: [] };

  const hl = lines[headerLineIdx];
  const debitCol   = findDisplayColOf(hl, "支出");
  const creditCol  = findDisplayColOf(hl, "存入");
  const balanceCol = findDisplayColOf(hl, "結餘");
  const noteCol    = findDisplayColOf(hl, "備註");

  const rows: Record<string, string>[] = [];

  for (const line of lines.slice(headerLineIdx + 1)) {
    // 資料行特徵：前置空白 + 序號 + 空白 + YYYY/MM/DD HH:MM:SS
    const dateMatch = line.match(/^\s+\d+\s+(\d{4}\/\d{2}\/\d{2})\s+\d{2}:\d{2}:\d{2}/);
    if (!dateMatch) continue;

    // 摘要：第二個日期（帳務日期）之後、第一個 2+ 空白之前的文字
    // 注意：兩個日期之間夾著時間（HH:MM:SS），所以用更具體的 pattern
    const afterSecondDate = line.replace(
      /^.*\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}\s+\d{4}\/\d{2}\/\d{2}\s+/,
      "",
    );
    const description = afterSecondDate.split(/\s{2,}/)[0].trim();

    // 支出/存入：在整個金額區間掃描數字，以數字「起始位置」判斷屬於哪欄，
    // 避免嚴格邊界切斷右對齊數字的問題。
    let debitStr = "";
    let creditStr = "";
    if (debitCol >= 0 && creditCol >= 0 && balanceCol >= 0) {
      const nums = findNumbersInRange(line, debitCol, balanceCol);
      for (const num of nums) {
        if (num.startCol < creditCol) {
          debitStr = num.str.replace(/,/g, "");
        } else {
          creditStr = num.str.replace(/,/g, "");
        }
      }
    }

    const balanceStr = balanceCol >= 0
      ? sliceDisplayCols(line, balanceCol, noteCol > 0 ? noteCol : balanceCol + 25)
          .replace(/[,N]/g, "").trim()
      : "";
    const noteStr = noteCol >= 0 ? sliceDisplayCols(line, noteCol, 999).trim() : "";

    rows.push({
      "交易日期": dateMatch[1],
      "摘要": description,
      "支出": debitStr,
      "存入": creditStr,
      "結餘": balanceStr,
      "備註": noteStr,
    });
  }

  return { headers: HEADERS, rows };
}

export const kgiBankAdapter: CsvAdapter = {
  source: "kgi_bank",

  parse(rows): ParsedTransaction[] {
    const results: ParsedTransaction[] = [];
    for (const row of rows) {
      const date = parseDate(row["交易日期"] ?? "");
      if (!date) continue;

      const debit  = parseAmount(row["支出"] ?? "");
      const credit = parseAmount(row["存入"] ?? "");
      if (debit === 0 && credit === 0) continue;

      const note = [(row["摘要"] ?? ""), (row["備註"] ?? "")].filter(Boolean).join(" ").trim();

      if (debit  > 0) results.push({ date, amount: debit,  type: "支出", category: detectCategory(note), note, source: "kgi_bank" });
      if (credit > 0) results.push({ date, amount: credit, type: "收入", category: detectCategory(note), note, source: "kgi_bank" });
    }
    return results;
  },

  getLastBalance(rows) {
    let best: { amount: number; date: Date } | null = null;
    for (const row of rows) {
      const date   = parseDate(row["交易日期"] ?? "");
      const amount = parseAmount(row["結餘"] ?? "");
      if (date && !isNaN(amount) && (!best || date >= best.date)) {
        best = { amount, date };
      }
    }
    return best;
  },
};
