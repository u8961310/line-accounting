import Papa from "papaparse";
import { detectAndConvertToUtf8 } from "./encoding";
import { detectSource } from "./detector";
import { ParsedTransaction, BankSource, CsvAdapter } from "./types";
import { tbankAdapter } from "./adapters/tbank";
import { cathayBankAdapter } from "./adapters/cathay_bank";
import { esunBankAdapter } from "./adapters/esun_bank";
import { ctbcBankAdapter } from "./adapters/ctbc_bank";
import { megaBankAdapter } from "./adapters/mega_bank";
import { cathayCcAdapter } from "./adapters/cathay_cc";
import { esunCcAdapter } from "./adapters/esun_cc";
import { ctbcCcAdapter } from "./adapters/ctbc_cc";
import { taishinCcAdapter } from "./adapters/taishin_cc";
import { createAiFallbackAdapter, parseWithAiFallback } from "./adapters/ai_fallback";
import { parseXls } from "./xls";
import { batchCategorize } from "./categorizer";
import { prisma } from "../db";

const ADAPTERS: Record<Exclude<BankSource, "unknown" | "sinopac_cc">, CsvAdapter> = {
  tbank: tbankAdapter,
  cathay_bank: cathayBankAdapter,
  esun_bank: esunBankAdapter,
  ctbc_bank: ctbcBankAdapter,
  mega_bank: megaBankAdapter,
  cathay_cc: cathayCcAdapter,
  esun_cc: esunCcAdapter,
  ctbc_cc: ctbcCcAdapter,
  taishin_cc: taishinCcAdapter,
};

function getAdapter(source: BankSource): CsvAdapter {
  if (source === "unknown") {
    return createAiFallbackAdapter("unknown");
  }
  if (source === "sinopac_cc") {
    return createAiFallbackAdapter("sinopac_cc");
  }
  return ADAPTERS[source];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface CsvImportResult {
  imported: number;
  skipped: number;
  errors: string[];
  source: BankSource;
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
        const created = await prisma.transaction.create({
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

        const { syncTransactionToNotion } = await import("../notion");
        syncTransactionToNotion(created);

        result.imported++;
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
  const result: CsvImportResult = { imported: 0, skipped: 0, errors: [], source: "unknown" };

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
    result.errors.push("無法從檔案解析出任何交易記錄");
    return result;
  }

  // AI batch categorization based on note/description
  transactions = await batchCategorize(transactions);

  await saveTransactions(transactions, userId, result);
  return result;
}

export async function parseCsv(buffer: Buffer, userId: string): Promise<CsvImportResult> {
  const utf8Content = detectAndConvertToUtf8(buffer);

  const parseResult = Papa.parse<Record<string, string>>(utf8Content, {
    header: true,
    skipEmptyLines: true,
    trimHeaders: true,
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
