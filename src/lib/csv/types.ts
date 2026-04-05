export type BankSource =
  | "tbank"
  | "cathay_bank"
  | "esun_bank"
  | "ctbc_bank"
  | "mega_bank"
  | "yuanta_bank"
  | "sinopac_bank"
  | "kgi_bank"
  | "cathay_cc"
  | "esun_cc"
  | "ctbc_cc"
  | "taishin_cc"
  | "sinopac_cc"
  | "unknown";

export interface ParsedTransaction {
  date: Date;
  amount: number;
  type: "收入" | "支出";
  category: string;
  note: string;
  source: BankSource;
}

export interface CsvAdapter {
  source: BankSource;
  parse(rows: Record<string, string>[]): ParsedTransaction[];
  getLastBalance?(rows: Record<string, string>[]): { amount: number; date: Date } | null;
}
