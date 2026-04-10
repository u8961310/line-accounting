export const SOURCE_LABELS: Record<string, string> = {
  line: "LINE", manual: "手動", mcp: "手動", cash: "現金",
  tbank: "台灣銀行",
  esun_bank: "玉山銀行", ctbc_bank: "中國信託", mega_bank: "兆豐銀行",
  yuanta_bank: "元大銀行", sinopac_bank: "永豐銀行", kgi_bank: "凱基銀行",
  cathay_cc: "國泰信用卡", esun_cc: "玉山信用卡", ctbc_cc: "中信信用卡",
  taishin_cc: "台新信用卡", sinopac_cc: "永豐信用卡",
  unknown: "其他",
};

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}
