import pdfParse from "pdf-parse";
import type { ParsedTransaction } from "../csv/types";

/**
 * 凱基銀行存款 PDF 明細解析
 *
 * PDF 文字結構（每筆交易）：
 *   {序號 4碼}
 *   {交易日期 YYYY/MM/DD}
 *   {帳務日期 YYYY/MM/DD}
 *   {摘要}{支出或存入}{結餘}{備註（可能跨多行）}
 *
 * 金額緊接在摘要後，無空白分隔，需用逗號格式識別。
 */

export function isKgiBankPdf(text: string): boolean {
  return text.includes("臺幣活存明細") && text.includes("帳號");
}

/**
 * 從 amountStr（摘要後的字串）提取：支出/存入金額、結餘、備註殘留文字
 *
 * 規則：
 *   - 逗號格式數字（如 1,000）= 有效金額
 *   - 最後一個逗號數字後的短數字（1-4 位）= 結餘（如 0）
 *   - 其餘文字 = 備註起始
 */
function extractAmounts(
  amountStr: string,
  prevBalance: number | null,
): { debit: number; credit: number; balance: number | null; noteFromStr: string } {
  const commaRe = /\d{1,3}(?:,\d{3})+/g;
  const commaNums: Array<{ value: number; end: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = commaRe.exec(amountStr)) !== null) {
    commaNums.push({ value: parseFloat(m[0].replace(/,/g, "")), end: m.index + m[0].length });
  }

  let lastEnd = commaNums.length > 0 ? commaNums[commaNums.length - 1].end : 0;

  // 最後逗號金額之後，嘗試配對短數字（1–4 位）當作結餘 0 或小數值
  const shortM = amountStr.slice(lastEnd).match(/^(\d{1,4})(?!\d)/);
  let shortBalance: number | null = null;
  if (shortM) {
    shortBalance = parseFloat(shortM[1]);
    lastEnd += shortM[0].length;
  }

  const noteFromStr = amountStr.slice(lastEnd).trim();

  // 判斷：
  //   2 個逗號數字 → amounts[0]=金額, amounts[1]=結餘
  //   1 個逗號數字 + shortBalance → 金額 + 結餘
  //   1 個逗號數字 alone → 就是結餘（無支出/存入）
  //   只有 shortBalance → 結餘
  let amount: number | null = null;
  let balance: number | null = null;

  if (commaNums.length >= 2) {
    amount  = commaNums[0].value;
    balance = commaNums[1].value;
  } else if (commaNums.length === 1 && shortBalance !== null) {
    amount  = commaNums[0].value;
    balance = shortBalance;
  } else if (commaNums.length === 1) {
    balance = commaNums[0].value;
  } else if (shortBalance !== null) {
    balance = shortBalance;
  }

  let debit = 0;
  let credit = 0;

  if (amount !== null && amount > 0) {
    if (prevBalance !== null) {
      // 從結餘變化判斷方向
      const diffCredit = Math.abs(prevBalance + amount - (balance ?? 0));
      const diffDebit  = Math.abs(prevBalance - amount - (balance ?? 0));
      if (diffCredit <= diffDebit) credit = amount;
      else debit = amount;
    } else {
      // 第一筆：金額 == 結餘 → 從零存入（收入），否則依大小估算
      if (balance !== null && Math.abs(amount - balance) < 1) {
        credit = amount;
      } else if (balance !== null && amount > balance) {
        debit = amount;
      } else {
        credit = amount;
      }
    }
  }

  return { debit, credit, balance, noteFromStr };
}

export function parseKgiBankPdfText(text: string): {
  transactions: ParsedTransaction[];
  lastBalance: { amount: number; date: Date } | null;
} {
  const lines = text.split(/\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const transactions: ParsedTransaction[] = [];
  let prevBalance: number | null = null;
  let lastBalance: { amount: number; date: Date } | null = null;

  let i = 0;
  while (i < lines.length) {
    // 序號行：恰好 4 位數字
    if (!/^\d{4}$/.test(lines[i])) { i++; continue; }

    const txDateStr = lines[i + 1]?.trim() ?? "";
    const acDateStr = lines[i + 2]?.trim() ?? "";
    const dataLine  = lines[i + 3]?.trim() ?? "";

    if (!/^\d{4}\/\d{2}\/\d{2}$/.test(txDateStr)) { i++; continue; }

    const dm = txDateStr.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
    if (!dm) { i++; continue; }
    const date = new Date(+dm[1], +dm[2] - 1, +dm[3]);

    // 摘要 = dataLine 前置非數字
    const descM = dataLine.match(/^([^\d]*)/);
    const description = descM?.[1]?.trim() ?? "";
    const amountStr   = dataLine.slice(descM?.[0]?.length ?? 0);

    // 備註：下一個序號或「結束」之前的行
    const noteLines: string[] = [];
    let j = i + 4;
    while (
      j < lines.length &&
      !/^\d{4}$/.test(lines[j]) &&
      lines[j] !== "結束" &&
      !/^\d{4}\/\d{2}\/\d{2}$/.test(lines[j])
    ) {
      noteLines.push(lines[j]);
      j++;
    }

    const { debit, credit, balance, noteFromStr } = extractAmounts(amountStr, prevBalance);

    const note = [description, noteFromStr, ...noteLines]
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (balance !== null) {
      prevBalance = balance;
      lastBalance = { amount: balance, date };
    }

    if (debit  > 0) transactions.push({ date, amount: debit,  type: "支出", category: "其他", note, source: "kgi_bank" });
    if (credit > 0) transactions.push({ date, amount: credit, type: "收入", category: "其他", note, source: "kgi_bank" });

    i = j;
  }

  return { transactions, lastBalance };
}

export async function parseKgiBankPdf(buffer: Buffer): Promise<{
  transactions: ParsedTransaction[];
  lastBalance: { amount: number; date: Date } | null;
}> {
  const data = await pdfParse(buffer);
  return parseKgiBankPdfText(data.text);
}
