import { BankSource } from "./types";

export function detectSource(headers: string[]): BankSource {
  const normalized = headers.map((h) => h.trim().replace(/\s+/g, ""));

  // 元大銀行 — 帳務日期, 支出金額, 存入金額
  if (
    normalized.some((h) => h.includes("帳務日期")) &&
    normalized.some((h) => h.includes("支出金額")) &&
    normalized.some((h) => h.includes("存入金額"))
  ) {
    return "yuanta_bank";
  }

  // 兆豐銀行 — 銀行帳務日, 存摺備註
  if (
    normalized.some((h) => h.includes("銀行帳務日")) &&
    normalized.some((h) => h.includes("存摺備註"))
  ) {
    return "mega_bank";
  }

  // 中國信託存款 — 交易說明, 提出, 存入
  if (
    normalized.some((h) => h.includes("交易說明")) &&
    normalized.some((h) => h.includes("提出")) &&
    normalized.some((h) => h.includes("存入"))
  ) {
    return "ctbc_bank";
  }

  // 玉山銀行存款 CSV — 支出/支出金額, 收入/收入金額
  if (
    normalized.some((h) => h === "支出" || h.includes("支出金額")) &&
    normalized.some((h) => h === "收入" || h.includes("收入金額"))
  ) {
    return "esun_bank";
  }

  // 玉山銀行存款 XLS — 交易日期, 提(支出), 存(收入)
  if (
    normalized.some((h) => h === "交易日期") &&
    normalized.some((h) => h === "提") &&
    normalized.some((h) => h === "存")
  ) {
    return "esun_bank";
  }

  // 永豐銀行存款 — metadata 已由 parseCsv 剝除，真正 header 為 交易日, 計息日, 摘要
  if (
    normalized.some((h) => h === "交易日") &&
    normalized.some((h) => h === "計息日") &&
    normalized.some((h) => h === "摘要")
  ) {
    return "sinopac_bank";
  }

  // 永豐信用卡 — 已有 sinopac_cc，透過 AI fallback 處理
  // 凱基存款 — 格式不定，交由 AI fallback 處理
  return "unknown";
}
