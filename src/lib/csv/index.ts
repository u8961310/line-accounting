import Papa from "papaparse";
import { detectAndConvertToUtf8 } from "./encoding";
import { detectSource } from "./detector";
import { ParsedTransaction, BankSource, CsvAdapter } from "./types";
import { esunBankAdapter } from "./adapters/esun_bank";
import { ctbcBankAdapter } from "./adapters/ctbc_bank";
import { megaBankAdapter } from "./adapters/mega_bank";
import { yuantaBankAdapter } from "./adapters/yuanta_bank";
import { sinopacBankAdapter } from "./adapters/sinopac_bank";
import { kgiBankAdapter, isKgiBankText, parseKgiText } from "./adapters/kgi_bank";
import { cathayBankAdapter } from "./adapters/cathay_bank";
import { tbankAdapter } from "./adapters/tbank";
import { cathayCcAdapter } from "./adapters/cathay_cc";
import { esunCcAdapter } from "./adapters/esun_cc";
import { ctbcCcAdapter } from "./adapters/ctbc_cc";
import { taishinCcAdapter } from "./adapters/taishin_cc";
import { createAiFallbackAdapter, parseWithAiFallback } from "./adapters/ai_fallback";
import { parseXls } from "./xls";
import { batchCategorize } from "./categorizer";
import { prisma } from "../db";

const ADAPTERS: Record<Exclude<BankSource, "unknown" | "sinopac_cc">, CsvAdapter> = {
  tbank:        tbankAdapter,
  cathay_bank:  cathayBankAdapter,
  esun_bank:    esunBankAdapter,
  ctbc_bank:    ctbcBankAdapter,
  mega_bank:    megaBankAdapter,
  yuanta_bank:  yuantaBankAdapter,
  sinopac_bank: sinopacBankAdapter,
  kgi_bank:     kgiBankAdapter,
  cathay_cc:    cathayCcAdapter,
  esun_cc:      esunCcAdapter,
  ctbc_cc:      ctbcCcAdapter,
  taishin_cc:   taishinCcAdapter,
};

function getAdapter(source: BankSource): CsvAdapter {
  if (source === "sinopac_cc") return createAiFallbackAdapter("sinopac_cc");
  if (source === "unknown")    return createAiFallbackAdapter("unknown");
  return ADAPTERS[source];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface ImportedTransaction {
  date: string;
  type: string;
  amount: number;
  note: string;
  category: string;
}

export interface CsvImportResult {
  imported: number;
  skipped: number;
  errors: string[];
  source: BankSource;
  transactions: ImportedTransaction[];
}

async function saveTransactions(
  transactions: ParsedTransaction[],
  userId: string,
  result: CsvImportResult,
) {
  for (const tx of transactions) {
    try {
      const dateOnly = new Date(tx.date);
      dateOnly.setHours(0, 0, 0, 0);

      let existing;
      if (tx.source === "sinopac_cc") {
        // Credit card may have same date+amount+source but different merchants
        existing = await prisma.transaction.findFirst({
          where: { userId, date: dateOnly, amount: tx.amount, source: tx.source, note: tx.note },
        });
      } else {
        existing = await prisma.transaction.findFirst({
          where: { userId, date: dateOnly, amount: tx.amount, source: tx.source },
        });
      }

      if (existing) {
        result.skipped++;
      } else {
        await prisma.transaction.create({
          data: {
            userId,
            date: dateOnly,
            amount: tx.amount,
            category: tx.category,
            type: tx.type,
            note: tx.note,
            source: tx.source,
          },
        });

        result.imported++;
        result.transactions.push({
          date: dateOnly.toISOString().split("T")[0],
          type: tx.type,
          amount: tx.amount,
          note: tx.note ?? "",
          category: tx.category ?? "",
        });
      }

      await sleep(300);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Row error: ${msg}`);
    }
  }
}

async function parseAndSave(
  headers: string[],
  rows: Record<string, string>[],
  userId: string,
): Promise<CsvImportResult> {
  const result: CsvImportResult = { imported: 0, skipped: 0, errors: [], source: "unknown", transactions: [] };

  if (rows.length === 0) {
    result.errors.push("檔案無有效資料");
    return result;
  }

  const source = detectSource(headers);
  result.source = source;

  let transactions: ParsedTransaction[];

  if (source === "unknown") {
    try {
      transactions = await parseWithAiFallback(headers, rows, "unknown");
    } catch {
      result.errors.push("AI 解析失敗，無法識別格式");
      return result;
    }
  } else {
    const adapter = getAdapter(source);
    transactions = adapter.parse(rows);

    // Save last balance if adapter supports it — only update if newer than existing record
    if (adapter.getLastBalance) {
      const lastBalance = adapter.getLastBalance(rows);
      if (lastBalance) {
        const existing = await prisma.bankBalance.findUnique({
          where: { userId_source: { userId, source } },
        });
        if (!existing || lastBalance.date >= existing.asOfDate) {
          await prisma.bankBalance.upsert({
            where: { userId_source: { userId, source } },
            update: { balance: lastBalance.amount, asOfDate: lastBalance.date },
            create: { userId, source, balance: lastBalance.amount, asOfDate: lastBalance.date },
          });
        }
      }
    }
  }

  if (transactions.length === 0) {
    // Diagnostic: surface enough info to debug without needing server logs
    const firstRowKeys = rows.length > 0 ? Object.keys(rows[0]).join(", ") : "(no rows)";
    const firstRowSample = rows.length > 0 ? JSON.stringify(rows[0]).slice(0, 120) : "";
    console.error("[csv] 0 transactions. source:", source, "rows:", rows.length, "headers:", headers.join("|"));
    console.error("[csv] first row:", firstRowSample);
    result.errors.push(`無法從檔案解析出任何交易記錄（偵測來源：${source}，資料行數：${rows.length}，欄位：${firstRowKeys}）`);
    return result;
  }

  // AI batch categorization based on note/description
  transactions = await batchCategorize(transactions);

  await saveTransactions(transactions, userId, result);
  return result;
}

/**
 * 永豐銀行存款 CSV 前幾行為 metadata（帳號/查詢日期），
 * 找到 "交易日" 開頭的那行作為真正的 header，丟棄之前的行。
 */
function stripSinopacMetaRows(text: string): string {
  const lines = text.split(/\r?\n/);
  console.log("[strip] line0:", JSON.stringify(lines[0]?.slice(0, 30)));
  if (!lines[0]?.trimStart().startsWith("帳號")) return text;
  const idx = lines.findIndex((l) => l.trimStart().startsWith("交易日"));
  console.log("[strip] headerRowIdx:", idx);
  if (idx < 0) return text;
  const stripped = lines.slice(idx).join("\n");
  console.log("[strip] first stripped line:", JSON.stringify(stripped.split("\n")[0]));
  return stripped;
}

export async function parseCsv(buffer: Buffer, userId: string): Promise<CsvImportResult> {
  const raw = detectAndConvertToUtf8(buffer);

  // 凱基銀行固定寬度文字格式 — 繞過 PapaParse 直接解析
  if (isKgiBankText(raw)) {
    const { headers, rows } = parseKgiText(raw);
    return parseAndSave(headers, rows, userId);
  }

  const utf8Content = stripSinopacMetaRows(raw);

  const parseResult = Papa.parse<Record<string, string>>(utf8Content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  });

  const result = await parseAndSave(
    parseResult.meta.fields ?? [],
    parseResult.data,
    userId,
  );

  if (parseResult.errors.length > 0) {
    result.errors.unshift(...parseResult.errors.slice(0, 3).map((e) => e.message));
  }

  return result;
}

export async function parseXlsFile(buffer: Buffer, userId: string): Promise<CsvImportResult> {
  const { headers, rows } = parseXls(buffer);
  return parseAndSave(headers, rows, userId);
}
