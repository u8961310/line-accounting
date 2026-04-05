// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (buffer: Buffer) => Promise<{ text: string }>;
import { ParsedTransaction } from "../csv/types";

export interface SinopacBillSummary {
  billingMonth: string;           // "2026-03"
  statementDate: Date;            // 結帳日
  dueDate: Date;                  // 繳款截止日
  totalAmount: number;            // 本期應繳
  minimumPayment: number;         // 最低應繳
  installmentOutstanding: number; // 分期交易未清償餘額
}

export interface SinopacPdfResult {
  summary: SinopacBillSummary;
  transactions: ParsedTransaction[];
}

function parseDate(str: string): Date {
  const [y, m, d] = str.split("/").map(Number);
  return new Date(y, m - 1, d);
}

function parseAmount(str: string): number {
  return parseFloat(str.replace(/,/g, "").replace(/\$/, "")) || 0;
}

// Page marker like "1 / 6", "2 / 6"
function isPageMarker(line: string): boolean {
  return /^\d+ \/ \d+$/.test(line);
}

export async function parseSinopacCcPdf(buffer: Buffer): Promise<SinopacPdfResult> {
  const data = await pdfParse(buffer);
  const lines = data.text.split("\n").map((l: string) => l.trim()).filter((l: string) => l.length > 0);

  // ── Summary ──────────────────────────────────────────────────────────────
  let statementDate: Date | null = null;
  let dueDate: Date | null = null;
  let totalAmount = 0;
  let minimumPayment = 0;
  let billingMonth = "";
  let installmentOutstanding = 0;

  for (const line of lines) {
    // 結帳日
    const stmtMatch = line.match(/結帳日[：:]\s*(\d{4}\/\d{2}\/\d{2})/);
    if (stmtMatch) {
      statementDate = parseDate(stmtMatch[1]);
      billingMonth = `${statementDate.getFullYear()}-${String(statementDate.getMonth() + 1).padStart(2, "0")}`;
    }

    // 繳款截止日 (from bullet point line)
    const dueMatch = line.match(/繳款截止日[：:]\s*(\d{4}\/\d{2}\/\d{2})/);
    if (dueMatch) {
      dueDate = parseDate(dueMatch[1]);
    }

    // Due date also from auto-debit notice: "臺幣 3,728 元將於 2026/04/10"
    const autoDebitMatch = line.match(/臺幣\s+([\d,]+)\s*元將於\s*(\d{4}\/\d{2}\/\d{2})/);
    if (autoDebitMatch) {
      minimumPayment = parseAmount(autoDebitMatch[1]);
      if (!dueDate) dueDate = parseDate(autoDebitMatch[2]);
    }

    // Summary row: "臺幣22,82714,00015,805167024,7993,728" (all concatenated)
    // Extract comma-formatted numbers (e.g. 22,827 but not plain "167" or "0")
    // 本期應繳 = 2nd to last comma-number, 最低應繳 = last
    if (line.startsWith("臺幣") && /\d,\d{3}/.test(line)) {
      const nums = line.match(/\d{1,3},\d{3}/g);
      if (nums && nums.length >= 2) {
        totalAmount = parseAmount(nums[nums.length - 2]);
        if (minimumPayment === 0) minimumPayment = parseAmount(nums[nums.length - 1]);
      }
    }
  }

  // 分期交易未清償餘額：PDF 版面使兩個金額連續出現（換頁後）
  // 模式：獨立數字行 == totalAmount，緊接的下一個獨立數字行即為分期未清償餘額
  const standaloneNum = /^\d{1,3}(,\d{3})+$/;
  for (let i = 0; i < lines.length - 1; i++) {
    if (standaloneNum.test(lines[i]) && parseAmount(lines[i]) === totalAmount) {
      if (standaloneNum.test(lines[i + 1])) {
        installmentOutstanding = parseAmount(lines[i + 1]);
        break;
      }
    }
  }

  if (!statementDate || !dueDate) {
    throw new Error("無法解析帳單日期，請確認 PDF 格式正確");
  }

  // ── Transactions ─────────────────────────────────────────────────────────
  // Lines either contain full transaction on one line, or split across multiple lines.
  // Pattern: starts with YYYY/MM/DDYYYY/MM/DD followed by 4-digit card number.
  // e.g. "2026/03/042026/03/107800連加＊ＱＢｕｒｇｅｒ＿$90"
  //      "2025/11/302026/03/207800"  ← date-only header, description follows on next lines

  const txStartRegex = /^(\d{4}\/\d{2}\/\d{2})\d{4}\/\d{2}\/\d{2}\d{4}(.*)/;

  interface TxBlock { date: string; parts: string[] }
  let current: TxBlock | null = null;
  const blocks: TxBlock[] = [];

  for (const line of lines) {
    if (isPageMarker(line)) continue;
    const m = line.match(txStartRegex);
    if (m) {
      if (current) blocks.push(current);
      current = { date: m[1], parts: m[2].trim() ? [m[2].trim()] : [] };
    } else if (current) {
      current.parts.push(line);
    }
  }
  if (current) blocks.push(current);

  const transactions: ParsedTransaction[] = [];

  for (const block of blocks) {
    const text = block.parts.join(" ").trim();

    // Strip trailing interest rate like "10.50%" or "6.00%" before parsing amount
    const textNoRate = text.replace(/\d{1,2}\.\d{2}%\s*$/, "").trim();

    const amountMatch = textNoRate.match(/\$(-?[\d,]+)/);
    if (!amountMatch) continue;

    let amountStr = amountMatch[1];
    // Foreign currency lines: TWD amount has 8-digit date (YYYYMMDD) concatenated after it
    // e.g. "$55120260226" → $551 + 20260226. Strip last 8 digits when no comma and length > 7.
    if (!amountStr.includes(",") && amountStr.length > 7) {
      amountStr = amountStr.slice(0, amountStr.length - 8);
    }

    const amount = parseAmount(amountStr);
    if (amount <= 0) continue; // skip payments ($-xxx) and $0

    // Description = everything before the first $
    const description = textNoRate.split("$")[0].trim();
    if (!description) continue;

    const dateOnly = parseDate(block.date);
    dateOnly.setHours(0, 0, 0, 0);

    const isInterest = description.includes("利息");
    const note = description.replace(/\s+/g, " ").trim();

    transactions.push({
      date: dateOnly,
      amount,
      type: "支出",
      category: isInterest ? "帳單" : "其他",
      note,
      source: "sinopac_cc",
    });
  }

  return {
    summary: { billingMonth, statementDate, dueDate, totalAmount, minimumPayment, installmentOutstanding },
    transactions,
  };
}
