import * as XLSX from "xlsx";

// Exact-match keywords that identify a transaction header row.
// Using exact match (not includes) to avoid false positives like "交易時間由新到舊".
const HEADER_KEYWORDS = new Set([
  "交易時間", "交易日期", "交易日", "計息日",
  "消費日期", "提款金額", "交易說明", "交易金額",
  "消費說明", "消費名稱", "存摺備註",
]);

function findHeaderRowIdx(allRows: unknown[][]): number {
  for (let i = 0; i < allRows.length; i++) {
    const row = allRows[i] as string[];
    if (row.some((cell) => HEADER_KEYWORDS.has(String(cell).trim()))) {
      return i;
    }
  }
  return -1;
}

/**
 * Parses an XLS/XLSX buffer into headers and rows.
 *
 * Scans ALL sheets because some banks (e.g. 玉山) export HTML-based XLS where
 * each table section becomes a separate sheet — the transaction table is often
 * in sheet 2 or later.
 */
export function parseXls(buffer: Buffer): {
  headers: string[];
  rows: Record<string, string>[];
} {
  const workbook = XLSX.read(buffer, { type: "buffer", cellText: true, cellDates: false });

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const allRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      raw: false,
    });

    const headerRowIdx = findHeaderRowIdx(allRows);
    if (headerRowIdx < 0) continue;

    const headers = (allRows[headerRowIdx] as string[]).map((h) => String(h).trim());
    const rows = allRows.slice(headerRowIdx + 1).map((row) => {
      const record: Record<string, string> = {};
      headers.forEach((h, i) => {
        record[h] = String((row as string[])[i] ?? "").trim();
      });
      return record;
    });

    // Only accept if there are actual data rows
    const dataRows = rows.filter((r) => Object.values(r).some((v) => v !== ""));
    if (dataRows.length > 0) {
      return { headers, rows: dataRows };
    }
  }

  // Fallback: first sheet, first row as headers
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const allRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
  const headers = ((allRows[0] as string[]) ?? []).map((h) => String(h).trim());
  const rows = allRows.slice(1).map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((h, i) => { record[h] = String((row as string[])[i] ?? "").trim(); });
    return record;
  });
  return { headers, rows };
}
