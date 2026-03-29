"use client";

import { useState, useRef, useEffect } from "react";

type BankSource =
  | "tbank"
  | "cathay_bank"
  | "esun_bank"
  | "ctbc_bank"
  | "mega_bank"
  | "cathay_cc"
  | "esun_cc"
  | "ctbc_cc"
  | "taishin_cc"
  | "auto";

interface BankOption {
  value: BankSource;
  label: string;
  tag: "存款" | "信用卡" | "自動";
}

const BANK_OPTIONS: BankOption[] = [
  { value: "auto",       label: "自動偵測",           tag: "自動" },
  { value: "tbank",      label: "台灣銀行",            tag: "存款" },
  { value: "cathay_bank",label: "國泰世華銀行",        tag: "存款" },
  { value: "esun_bank",  label: "玉山銀行",            tag: "存款" },
  { value: "ctbc_bank",  label: "中國信託",            tag: "存款" },
  { value: "mega_bank",  label: "兆豐銀行",            tag: "存款" },
  { value: "cathay_cc",  label: "國泰世華",            tag: "信用卡" },
  { value: "esun_cc",    label: "玉山銀行",            tag: "信用卡" },
  { value: "ctbc_cc",    label: "中信",                tag: "信用卡" },
  { value: "taishin_cc", label: "台新",                tag: "信用卡" },
];

const FORMAT_LIST = [
  { bank: "台灣銀行",     type: "存款",  fmt: "CSV (Big5)" },
  { bank: "國泰世華",     type: "存款",  fmt: "CSV" },
  { bank: "玉山銀行",     type: "存款",  fmt: "CSV" },
  { bank: "中國信託",     type: "存款",  fmt: "CSV (Big5)" },
  { bank: "兆豐銀行",     type: "存款",  fmt: "CSV" },
  { bank: "國泰世華",     type: "信用卡",fmt: "CSV" },
  { bank: "玉山銀行",     type: "信用卡",fmt: "XLS" },
  { bank: "中信",         type: "信用卡",fmt: "CSV (Big5)" },
  { bank: "台新",         type: "信用卡",fmt: "CSV" },
  { bank: "永豐",         type: "信用卡",fmt: "PDF" },
];

interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  source: string;
  errors: string[];
  message: string;
  error?: string;
  bill?: {
    billingMonth: string;
    totalAmount: number;
    dueDate: string;
  } | null;
}

interface CreditCard {
  id: string;
  name: string;
  bank: string;
}

interface CsvImportProps {
  lineUserId: string;
  onImportComplete?: () => void;
}

const inputClass =
  "w-full rounded-xl px-3 py-2 text-sm outline-none"
  + " bg-[var(--bg-input)] border border-[var(--border)] focus:border-[var(--accent)]"
  + " text-[var(--text-primary)] placeholder-[var(--text-muted)]";

export default function CsvImport({ lineUserId, onImportComplete }: CsvImportProps) {
  const [selectedBank, setSelectedBank] = useState<BankSource>("auto");
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [selectedCreditCardId, setSelectedCreditCardId] = useState<string>("");
  const [isPdfSelected, setIsPdfSelected] = useState(false);
  const [pendingPdfFile, setPendingPdfFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/credit-cards")
      .then((r) => r.json())
      .then((cards: CreditCard[]) => setCreditCards(cards))
      .catch(() => {/* silent */});
  }, []);

  async function uploadFile(file: File) {
    setIsUploading(true);
    setResult(null);

    const isPdf = file.name.toLowerCase().endsWith(".pdf");

    try {
      if (isPdf) {
        const formData = new FormData();
        formData.append("file", file);
        if (selectedCreditCardId) formData.append("creditCardId", selectedCreditCardId);

        const response = await fetch("/api/import-pdf", {
          method: "POST",
          body: formData,
        });

        const data = await response.json() as (ImportResult & { error?: string; message?: string });
        if (response.ok) {
          setResult({
            success: true,
            imported: data.imported ?? 0,
            skipped: data.skipped ?? 0,
            source: "sinopac_cc",
            errors: data.errors ?? [],
            message: data.message ?? "匯入完成",
            bill: data.bill,
          });
          if (onImportComplete) onImportComplete();
        } else {
          setResult({
            success: false,
            imported: 0,
            skipped: 0,
            source: "sinopac_cc",
            errors: [],
            message: data.error ?? "匯入失敗",
            error: data.error ?? "匯入失敗",
          });
        }
      } else {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("lineUserId", lineUserId);
        if (selectedBank !== "auto") {
          formData.append("bankSource", selectedBank);
        }

        const response = await fetch("/api/import", {
          method: "POST",
          body: formData,
        });

        const data = (await response.json()) as ImportResult;
        setResult(data);

        if (data.success && onImportComplete) {
          onImportComplete();
        }
      }
    } catch (error) {
      setResult({
        success: false,
        imported: 0,
        skipped: 0,
        source: "unknown",
        errors: [error instanceof Error ? error.message : "上傳失敗"],
        message: "上傳失敗",
        error: "上傳失敗",
      });
    } finally {
      setIsUploading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.name.toLowerCase().endsWith(".pdf")) {
      setIsPdfSelected(true);
      setPendingPdfFile(file);
      setResult(null);
    } else {
      setIsPdfSelected(false);
      setPendingPdfFile(null);
      uploadFile(file);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file || !/\.(csv|xls|xlsx|pdf)$/i.test(file.name)) return;
    if (file.name.toLowerCase().endsWith(".pdf")) {
      setIsPdfSelected(true);
      setPendingPdfFile(file);
      setResult(null);
    } else {
      setIsPdfSelected(false);
      setPendingPdfFile(null);
      uploadFile(file);
    }
  }

  return (
    <div className="rounded-2xl border" style={{ background: "var(--bg-card)", borderColor: "var(--border)", boxShadow: "var(--card-shadow)" }}>
      {/* Header */}
      <div className="px-6 py-5 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border-inner)" }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "var(--btn-gradient)" }}>
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <div>
          <p className="text-[16px] font-bold" style={{ color: "var(--text-primary)" }}>匯入銀行對帳單</p>
          <p className="text-[12px]" style={{ color: "var(--text-sub)" }}>支援 CSV · XLS · XLSX · PDF（永豐信用卡）</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x" style={{ ["--tw-divide-color" as string]: "var(--border-inner)" }}>
        {/* ── Left: upload controls ── */}
        <div className="p-6 space-y-4">

          {/* Bank selector */}
          {!isPdfSelected && (
            <div>
              <label className="text-[12px] font-semibold mb-1.5 block" style={{ color: "var(--text-sub)" }}>銀行 / 發卡行</label>
              <select value={selectedBank} onChange={(e) => setSelectedBank(e.target.value as BankSource)} className={inputClass}>
                {BANK_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} style={{ background: "var(--bg-input)" }}>
                    {opt.tag !== "自動" ? `【${opt.tag}】` : ""}{opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* PDF pending */}
          {isPdfSelected && pendingPdfFile && (
            <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--bg-input)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(124,58,237,0.15)", color: "#A78BFA" }}>PDF</span>
                <p className="text-[13px] truncate" style={{ color: "var(--text-primary)" }}>{pendingPdfFile.name}</p>
              </div>
              <div>
                <label className="text-[12px] font-semibold mb-1.5 block" style={{ color: "var(--text-sub)" }}>關聯信用卡（選填）</label>
                <select value={selectedCreditCardId} onChange={(e) => setSelectedCreditCardId(e.target.value)} className={inputClass}>
                  <option value="" style={{ background: "var(--bg-input)" }}>不關聯信用卡</option>
                  {creditCards.map((card) => (
                    <option key={card.id} value={card.id} style={{ background: "var(--bg-input)" }}>{card.bank} {card.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setIsPdfSelected(false); setPendingPdfFile(null); }}
                  className="flex-1 py-2 rounded-xl text-[13px] font-semibold"
                  style={{ border: "1px solid var(--border)", color: "var(--text-sub)", background: "var(--bg-card)" }}>
                  取消
                </button>
                <button onClick={() => uploadFile(pendingPdfFile)} disabled={isUploading}
                  className="flex-1 py-2 rounded-xl text-[13px] font-bold text-white disabled:opacity-50"
                  style={{ background: "var(--btn-gradient)" }}>
                  {isUploading ? "匯入中…" : "確認匯入"}
                </button>
              </div>
            </div>
          )}

          {/* Drop zone */}
          <div
            className="rounded-xl p-8 text-center cursor-pointer transition-all"
            style={{
              border: dragOver ? "2px solid var(--accent)" : "2px dashed var(--border)",
              background: dragOver ? "rgba(59,130,246,0.06)" : "var(--bg-input)",
            }}
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
          >
            {isUploading ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
                <p className="text-[13px]" style={{ color: "var(--text-sub)" }}>正在匯入...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "var(--btn-gradient)", boxShadow: "0 4px 16px rgba(59,130,246,0.25)" }}>
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div>
                  <p className="text-[15px] font-bold mb-0.5" style={{ color: "var(--text-primary)" }}>拖曳或點擊上傳</p>
                  <p className="text-[12px]" style={{ color: "var(--text-sub)" }}>CSV · XLS · XLSX · PDF</p>
                </div>
              </div>
            )}
          </div>

          <input ref={fileInputRef} type="file" accept=".csv,.xls,.xlsx,.pdf" className="hidden" onChange={handleFileChange} />

          {/* Result */}
          {result && (
            <div className="rounded-xl px-4 py-3.5" style={result.success
              ? { background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.3)" }
              : { background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)" }}>
              {result.success ? (
                <>
                  <p className="text-[13px] font-semibold" style={{ color: "#10B981" }}>{result.message}</p>
                  <div className="mt-1.5 flex gap-4 text-[12px]" style={{ color: "#059669" }}>
                    <span>匯入 <b>{result.imported}</b> 筆</span>
                    <span>略過 <b>{result.skipped}</b> 筆</span>
                    {result.source !== "unknown" && <span>來源：{result.source}</span>}
                  </div>
                  {result.bill && (
                    <p className="mt-1 text-[11px]" style={{ color: "#059669" }}>
                      帳單 {result.bill.billingMonth}　應繳 NT$ {result.bill.totalAmount.toLocaleString()}　截止 {new Date(result.bill.dueDate).toLocaleDateString("zh-TW")}
                    </p>
                  )}
                  {result.errors.length > 0 && (
                    <ul className="mt-1.5 text-[11px] list-disc list-inside" style={{ color: "#F59E0B" }}>
                      {result.errors.slice(0, 3).map((err, i) => <li key={i}>{err}</li>)}
                    </ul>
                  )}
                </>
              ) : (
                <>
                  <p className="text-[13px] font-semibold" style={{ color: "#EF4444" }}>{result.error ?? "匯入失敗"}</p>
                  {result.errors?.length > 0 && (
                    <ul className="mt-1 text-[11px] list-disc list-inside" style={{ color: "#F87171" }}>
                      {result.errors.slice(0, 3).map((err, i) => <li key={i}>{err}</li>)}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Right: supported formats ── */}
        <div className="p-6">
          <p className="text-[12px] font-bold tracking-widest uppercase mb-4" style={{ color: "var(--accent)" }}>支援格式</p>
          <div className="space-y-1">
            {FORMAT_LIST.map((f, i) => (
              <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-xl transition-colors"
                style={{ border: "1px solid transparent" }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-input)", e.currentTarget.style.borderColor = "var(--border-inner)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent", e.currentTarget.style.borderColor = "transparent")}>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                  style={f.type === "存款"
                    ? { background: "rgba(59,130,246,0.12)", color: "var(--accent)" }
                    : { background: "rgba(192,132,252,0.12)", color: "#A78BFA" }}>
                  {f.type}
                </span>
                <span className="text-[13px] font-medium flex-1" style={{ color: "var(--text-primary)" }}>{f.bank}</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded" style={{ background: "var(--bg-input)", color: "var(--text-sub)" }}>{f.fmt}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 flex items-start gap-2" style={{ borderTop: "1px solid var(--border-inner)" }}>
            <span className="text-[11px] mt-0.5">💡</span>
            <p className="text-[11px]" style={{ color: "var(--text-sub)" }}>重複資料自動略過（相同日期 + 金額 + 來源）</p>
          </div>
        </div>
      </div>
    </div>
  );
}
