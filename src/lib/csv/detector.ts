import { BankSource } from "./types";

/**
 * Detects the bank source from CSV column headers.
 * Each bank has distinctive header patterns.
 */
export function detectSource(headers: string[]): BankSource {
  const normalized = headers.map((h) => h.trim().replace(/\s+/g, ""));

  // 台灣銀行 — distinctive: 交易日期, 摘要, 提款金額, 存款金額, 餘額
  if (
    normalized.some((h) => h.includes("提款金額")) &&
    normalized.some((h) => h.includes("存款金額")) &&
    normalized.some((h) => h.includes("摘要"))
  ) {
    // Disambiguate between tbank and ctbc_bank
    if (normalized.some((h) => h.includes("幣別"))) {
      return "tbank";
    }
    // ctbc_bank uses 備註 instead of 摘要 usually, but check further
    if (normalized.some((h) => h.includes("備註"))) {
      return "ctbc_bank";
    }
    return "tbank";
  }

  // 中國信託存款 — 交易日期, 交易說明, 提出, 存入, 餘額
  if (
    normalized.some((h) => h.includes("交易說明")) &&
    normalized.some((h) => h.includes("提出")) &&
    normalized.some((h) => h.includes("存入"))
  ) {
    return "ctbc_bank";
  }

  // 國泰世華銀行存款 — 交易日期, 交易說明, 交易金額, 幣別, 帳戶餘額
  if (
    normalized.some((h) => h.includes("交易金額")) &&
    normalized.some((h) => h.includes("帳戶餘額")) &&
    normalized.some((h) => h.includes("幣別"))
  ) {
    return "cathay_bank";
  }

  // 兆豐銀行存款 — 交易時間, 銀行帳務日, 交易項目, 支出, 收入, 帳戶餘額, 存摺備註
  if (
    normalized.some((h) => h.includes("交易時間")) &&
    normalized.some((h) => h.includes("銀行帳務日")) &&
    normalized.some((h) => h.includes("存摺備註"))
  ) {
    return "mega_bank";
  }

  // 玉山銀行存款 — 日期, 摘要, 支出, 收入, 餘額
  if (
    normalized.some((h) => h === "支出" || h.includes("支出金額")) &&
    normalized.some((h) => h === "收入" || h.includes("收入金額")) &&
    !normalized.some((h) => h.includes("交易說明"))
  ) {
    return "esun_bank";
  }

  // 國泰世華信用卡 — 消費日期, 消費說明, 消費金額
  if (
    normalized.some((h) => h.includes("消費日期")) &&
    normalized.some((h) => h.includes("消費說明")) &&
    normalized.some((h) => h.includes("消費金額"))
  ) {
    return "cathay_cc";
  }

  // 玉山信用卡 — 消費日期, 特店名稱, 台幣消費金額
  if (
    normalized.some((h) => h.includes("消費日期")) &&
    normalized.some((h) => h.includes("特店名稱"))
  ) {
    return "esun_cc";
  }

  // 中信信用卡 — 交易日期, 交易說明, 交易金額 (credit card variant)
  if (
    normalized.some((h) => h.includes("交易日期")) &&
    normalized.some((h) => h.includes("交易說明")) &&
    normalized.some((h) => h.includes("交易金額"))
  ) {
    return "ctbc_cc";
  }

  // 台新信用卡 — 交易日期, 消費名稱, 臺幣金額
  if (
    normalized.some((h) => h.includes("消費名稱")) &&
    normalized.some((h) => h.includes("臺幣金額"))
  ) {
    return "taishin_cc";
  }

  return "unknown";
}
