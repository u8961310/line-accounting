import * as XLSX from "xlsx";

const KNOWN_HEADER_KEYWORDS = [
  "交易時間",
  "交易日期",
  "消費日期",
  "提款金額",
  "交易說明",
  "交易金額",
  "消費說明",
  "消費名稱",
];

/**
 * Parses an XLS/XLSX buffer into headers and rows.
 * Automatically finds the header row by scanning for known keywords.
 */
export function parseXls(buffer: Buffer): {
  headers: string[];
  rows: Record<string, string>[];
} {
  const workbook = XLSX.read(buffer, { type: "buffer", cellText: true, cellDates: false });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const allRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  // Find the header row
  let headerRowIdx = 0;
  for (let i = 0; i < allRows.length; i++) {
    const row = allRows[i] as string[];
    if (row.some((cell) => KNOWN_HEADER_KEYWORDS.some((kw) => String(cell).includes(kw)))) {
      headerRowIdx = i;
      break;
    }
  }

  const headers = (allRows[headerRowIdx] as string[]).map((h) => String(h).trim());

  const rows = allRows.slice(headerRowIdx + 1).map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((h, i) => {
      record[h] = String((row as string[])[i] ?? "").trim();
    });
    return record;
  });

  return { headers, rows };
}
