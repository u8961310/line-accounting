/**
 * 轉帳交易偵測
 *
 * 銀行對帳單中，下列摘要關鍵字代表帳戶間轉帳，
 * 應標為「轉帳」分類，避免計入支出/收入統計。
 */
const TRANSFER_KEYWORDS = [
  "轉帳", "跨行匯款", "電匯", "帳戶轉帳", "網路轉帳", "跨行轉帳",
  "臨櫃轉帳", "行動轉帳", "自動轉帳", "外匯匯款", "匯款",
  "轉入", "轉出", "代轉",
];

/**
 * 若備註符合轉帳關鍵字，回傳 "轉帳"，否則回傳 "其他"。
 */
export function detectCategory(note: string): string {
  const n = note.toLowerCase();
  for (const kw of TRANSFER_KEYWORDS) {
    if (n.includes(kw.toLowerCase())) return "轉帳";
  }
  return "其他";
}
