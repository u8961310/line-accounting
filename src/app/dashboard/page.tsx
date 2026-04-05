"use client";

import React, { useEffect, useLayoutEffect, useState, useCallback, useRef } from "react";
import {
  DEMO_SUMMARY, DEMO_BALANCES, DEMO_NET_WORTH, DEMO_BUDGETS,
  DEMO_TX_PAGE, DEMO_CATEGORIES, DEMO_FIXED_EXPENSES, DEMO_LOANS,
  DEMO_AUDIT_LOGS, DEMO_TRANSFER_CANDIDATES, DEMO_GOALS, DEMO_DUPLICATE_CANDIDATES, DEMO_HEALTH_SNAPSHOTS,
} from "@/lib/demo-data";
import {
  AreaChart, Area, LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis, Tooltip, Cell, Legend,
  PieChart, Pie, ResponsiveContainer, ReferenceLine,
} from "recharts";
import CsvImport from "@/components/CsvImport";
import LoanManager from "@/components/LoanManager";
import BudgetManager from "@/components/BudgetManager";
import PayeeManager from "@/components/PayeeManager";
import FixedExpenseManager from "@/components/FixedExpenseManager";
import DebtOptimizer from "@/components/DebtOptimizer";
import AnnualReport from "@/components/AnnualReport";
import { RetirementCalc, FireCalc, IncomeStability, ExpenseRatio, AccountFlow, SpendingForecast, CashflowForecast } from "@/components/AdvancedAnalysis";
import NotificationPanel from "@/components/NotificationPanel";
import SubscriptionDetector from "@/components/SubscriptionDetector";
import BillCalendar from "@/components/BillCalendar";
import GradSchoolPlanner from "@/components/GradSchoolPlanner";
import EducationProgramPlanner from "@/components/EducationProgramPlanner";
import SavingsPlan from "@/components/SavingsPlan";
import CategoryManager from "@/components/CategoryManager";
import UserGuide from "@/components/UserGuide";
import DuplicateReview from "@/components/DuplicateReview";
import { THEMES, themeToCSS, type AppTheme } from "@/lib/themes";
import type { TransferPair } from "@/app/api/transfer-candidates/route";
import type { DuplicatePair } from "@/app/api/duplicate-candidates/route";
import type { HealthSnapshot } from "@/app/api/health-score/snapshots/route";

// ── Types ─────────────────────────────────────────────────────────────────────
interface MonthlySummary { month: string; income: number; expense: number }
interface CategorySummary { category: string; type: "收入" | "支出"; total: number }
interface RecentTransaction { id: string; date: string; amount: number; category: string; type: string; note: string; source: string; mood?: string | null }
interface SummaryData {
  monthly: MonthlySummary[];
  byCategory: CategorySummary[];
  recent: RecentTransaction[];
  totals: { income: number; expense: number; net: number };
}
interface BankBalanceItem { source: string; balance: number; asOfDate: string; alias: string | null; savingsGoal: number | null }
interface NetWorth {
  totalAssets: number; totalLoanDebt: number; totalCreditDebt: number;
  totalDebt: number; netWorth: number; monthlyInterest: number; totalInterestPaid: number;
}
type TabId = "charts" | "transactions" | "loans" | "budget" | "subscriptions" | "annual"
  | "retirement" | "fire" | "income-stability" | "expense-ratio" | "account-flow" | "spending-forecast" | "cashflow-forecast" | "bill-calendar" | "grad-school" | "savings-plan" | "education-program"
  | "payees" | "import" | "guide" | "audit" | "categories" | "duplicate-review";
interface MonthDetail {
  byCategory: CategorySummary[];
  totals: { income: number; expense: number; net: number };
}
interface LoanTimelineItem {
  id: string;
  name: string;
  lender: string;
  originalPrincipal: number;
  remainingPrincipal: number;
  monthlyPrincipal: number;
  interestRate: number;
  endDate: string | null;
  monthsLeft: number | null;
  payoffDate: string | null;
}
interface AuditLogEntry {
  id: string;
  createdAt: string;
  action: string;
  tool: string | null;
  params: Record<string, unknown> | null;
  summary: Record<string, unknown> | null;
  status: string;
  errorMsg: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const CHART_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444", "#06B6D4", "#F97316", "#6366F1"];

const SOURCE_LABELS: Record<string, string> = {
  line: "LINE", manual: "手動", cash: "現金",
  esun_bank: "玉山銀行", ctbc_bank: "中國信託", mega_bank: "兆豐銀行",
  yuanta_bank: "元大銀行", sinopac_bank: "永豐銀行", kgi_bank: "凱基銀行", cathay_cc: "國泰信用卡",
  esun_cc: "玉山信用卡", ctbc_cc: "中信信用卡", taishin_cc: "台新信用卡",
  sinopac_cc: "永豐信用卡", unknown: "其他",
};
const CC_SOURCES   = new Set(["cathay_cc", "esun_cc", "ctbc_cc", "taishin_cc", "sinopac_cc"]);
const BANK_SOURCES = new Set(["esun_bank", "ctbc_bank", "mega_bank", "yuanta_bank", "sinopac_bank", "kgi_bank"]);

const TABS: { id: TabId; label: string }[] = [
  { id: "charts",        label: "圖表" },
  { id: "transactions",  label: "交易記錄" },
  { id: "loans",         label: "負債" },
  { id: "budget",        label: "預算" },
  { id: "subscriptions", label: "訂閱" },
];

const TOOLS_TABS: { id: TabId; label: string }[] = [
  { id: "payees",           label: "帳號對照" },
  { id: "categories",       label: "自訂分類" },
  { id: "import",           label: "匯入資料" },
  { id: "duplicate-review", label: "重複審核" },
  { id: "audit",            label: "稽核記錄" },
  { id: "guide",            label: "使用說明" },
];

// 進階分析子選單（資料分析 / 報表向）
const ANALYSIS_TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "annual",            label: "年度財報",    icon: "📊" },
  { id: "income-stability",  label: "收入穩定性",  icon: "📈" },
  { id: "expense-ratio",     label: "固定 vs 變動", icon: "⚖️" },
  { id: "account-flow",      label: "帳戶流量",    icon: "🏦" },
  { id: "spending-forecast", label: "消費預測",    icon: "⚠️" },
  { id: "cashflow-forecast", label: "現金流預測",  icon: "💰" },
];

// 財務規劃子選單（目標 / 計畫向）
const PLANNING_TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "savings-plan",      label: "儲蓄規劃",    icon: "💰" },
  { id: "grad-school",       label: "研究所規劃",  icon: "🎓" },
  { id: "education-program", label: "教育學程",    icon: "📚" },
  { id: "retirement",        label: "退休金試算",  icon: "🏖️" },
  { id: "fire",              label: "FIRE 試算",   icon: "🔥" },
  { id: "bill-calendar",     label: "帳單日曆",    icon: "📅" },
];

// ── Note Templates ────────────────────────────────────────────────────────────
const NOTE_TEMPLATE_KEY = "note_templates_v1";
const DEFAULT_NOTE_TEMPLATES = ["午餐", "晚餐", "早餐", "咖啡", "加油", "超市", "便利商店", "計程車", "捷運", "藥局"];

function getNoteTemplates(): string[] {
  if (typeof window === "undefined") return DEFAULT_NOTE_TEMPLATES;
  const stored = localStorage.getItem(NOTE_TEMPLATE_KEY);
  return stored ? (JSON.parse(stored) as string[]) : DEFAULT_NOTE_TEMPLATES;
}

function addNoteTemplate(note: string) {
  if (!note.trim() || note.trim().length > 20) return;
  const templates = getNoteTemplates();
  if (templates.includes(note.trim())) return;
  const updated = [note.trim(), ...templates].slice(0, 20);
  localStorage.setItem(NOTE_TEMPLATE_KEY, JSON.stringify(updated));
}

function NoteTemplatePicker({ onSelect }: { onSelect: (note: string) => void }) {
  const [templates, setTemplates] = React.useState<string[]>(DEFAULT_NOTE_TEMPLATES);
  React.useEffect(() => { setTemplates(getNoteTemplates()); }, []);

  const remove = (t: string) => {
    const updated = templates.filter(x => x !== t);
    setTemplates(updated);
    localStorage.setItem(NOTE_TEMPLATE_KEY, JSON.stringify(updated));
  };

  return (
    <div className="flex flex-wrap gap-1 mb-2">
      {templates.slice(0, 12).map(t => (
        <div key={t} className="flex items-center text-[12px] rounded-md group overflow-hidden"
          style={{ border: "1px solid var(--border-inner)" }}>
          <button onClick={() => onSelect(t)} className="px-2 py-0.5 transition-colors hover:opacity-80"
            style={{ background: "var(--bg-input)", color: "var(--text-sub)" }}>{t}</button>
          <button onClick={() => remove(t)}
            className="px-1 py-0.5 opacity-0 group-hover:opacity-60 transition-opacity leading-none"
            style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}>×</button>
        </div>
      ))}
    </div>
  );
}

// ── Split part type ───────────────────────────────────────────────────────────
interface SplitPart { category: string; amount: string; note: string }
interface SplitTx { id: string; date: string; amount: number; type: string; category: string; note: string }

// ── Chart card visibility ─────────────────────────────────────────────────────
const CHART_CARDS_DEFAULT = [
  { id: "savings-summary",  label: "儲蓄規劃摘要"   },
  { id: "month-compare",    label: "當月 vs 上月"   },
  { id: "net-worth",        label: "淨資產總覽"     },
  { id: "health-score",     label: "財務健康評分"   },
  { id: "budget-overview",  label: "分類預算快覽列" },
  { id: "trend",            label: "趨勢追蹤"       },
  { id: "goals",            label: "財務目標"       },
  { id: "distribution",     label: "收支分佈"       },
  { id: "fixed-loans",      label: "固定支出與貸款" },
];
type ChartCardId = (typeof CHART_CARDS_DEFAULT)[number]["id"];
const CHART_VIS_KEY   = "chart_cards_v1";
const CHART_ORDER_KEY = "chart_cards_order_v1";

function getHiddenCards(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try { return new Set(JSON.parse(localStorage.getItem(CHART_VIS_KEY) ?? "[]") as string[]); } catch { return new Set(); }
}
function getCardOrder(): ChartCardId[] {
  if (typeof window === "undefined") return CHART_CARDS_DEFAULT.map(c => c.id as ChartCardId);
  try {
    const stored = JSON.parse(localStorage.getItem(CHART_ORDER_KEY) ?? "null") as ChartCardId[] | null;
    if (!stored) return CHART_CARDS_DEFAULT.map(c => c.id as ChartCardId);
    // 補上新加的卡片（未存在 order 裡的）
    const extra = CHART_CARDS_DEFAULT.map(c => c.id as ChartCardId).filter(id => !stored.includes(id));
    return [...stored, ...extra];
  } catch { return CHART_CARDS_DEFAULT.map(c => c.id as ChartCardId); }
}

function ChartCardSettings({ hidden, order, onToggle, onReorder, onClose }: {
  hidden:    Set<string>;
  order:     ChartCardId[];
  onToggle:  (id: ChartCardId) => void;
  onReorder: (next: ChartCardId[]) => void;
  onClose:   () => void;
}) {
  const [dragIdx, setDragIdx] = React.useState<number | null>(null);
  const [overIdx, setOverIdx] = React.useState<number | null>(null);

  const ordered = order.map(id => CHART_CARDS_DEFAULT.find(c => c.id === id)!).filter(Boolean);

  const handleDrop = (toIdx: number) => {
    if (dragIdx === null || dragIdx === toIdx) { setDragIdx(null); setOverIdx(null); return; }
    const next = [...order];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(toIdx, 0, moved);
    onReorder(next);
    setDragIdx(null); setOverIdx(null);
  };

  return (
    <div className="rounded-2xl p-4 space-y-3"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}>
      <div className="flex items-center justify-between">
        <p className="text-[14px] font-bold" style={{ color: "var(--text-primary)" }}>自訂首頁顯示</p>
        <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded text-[18px] leading-none hover:opacity-70"
          style={{ color: "var(--text-muted)" }}>×</button>
      </div>
      <div className="space-y-1.5">
        {ordered.map((c, idx) => {
          const visible = !hidden.has(c.id);
          const isDragging = dragIdx === idx;
          const isOver     = overIdx === idx && dragIdx !== idx;
          return (
            <div key={c.id}
              draggable
              onDragStart={() => setDragIdx(idx)}
              onDragOver={e => { e.preventDefault(); setOverIdx(idx); }}
              onDragLeave={() => setOverIdx(null)}
              onDrop={() => handleDrop(idx)}
              onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-medium transition-all select-none"
              style={{
                background:  isOver ? "rgba(59,130,246,0.18)" : visible ? "rgba(59,130,246,0.08)" : "var(--bg-input)",
                border:      `1px solid ${isOver ? "rgba(59,130,246,0.6)" : visible ? "rgba(59,130,246,0.3)" : "var(--border-inner)"}`,
                opacity:     isDragging ? 0.4 : 1,
                cursor:      "grab",
                transform:   isOver ? "scale(1.02)" : "scale(1)",
              }}>
              <span className="text-[16px] select-none" style={{ color: "var(--text-muted)", cursor: "grab" }}>⠿</span>
              <span className="flex-1" style={{ color: visible ? "#60A5FA" : "var(--text-muted)" }}>{c.label}</span>
              <button onClick={() => onToggle(c.id as ChartCardId)}
                className="w-5 h-5 flex items-center justify-center rounded text-[13px] leading-none flex-shrink-0 transition-opacity hover:opacity-70"
                style={{ color: visible ? "#60A5FA" : "var(--text-muted)" }}>
                {visible ? "☑" : "☐"}
              </button>
            </div>
          );
        })}
      </div>
      <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>拖曳 ⠿ 調整順序，點 ☑ 切換顯示，設定自動儲存</p>
    </div>
  );
}

function AnimatedScore({ target, color }: { target: number; color: string }) {
  const [displayed, setDisplayed] = React.useState(0);
  const rafRef = React.useRef<number | null>(null);
  React.useEffect(() => {
    const duration = 900;
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // easeOut cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(eased * target));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [target]);
  return (
    <p className="text-[44px] font-black leading-none tabular-nums" style={{ color }}>{displayed}</p>
  );
}

function AnimatedBar({ pct, color }: { pct: number; color: string }) {
  const [width, setWidth] = React.useState(0);
  React.useEffect(() => {
    const t = setTimeout(() => setWidth(pct), 50);
    return () => clearTimeout(t);
  }, [pct]);
  return <div className="h-full rounded-full transition-all duration-700" style={{ width: `${width}%`, background: color }} />;
}

function JsonRestorePanel({ onComplete }: { onComplete: () => void }) {
  const [jsonFile,    setJsonFile]    = React.useState<File | null>(null);
  const [jsonMsg,     setJsonMsg]     = React.useState<string | null>(null);
  const [jsonLoading, setJsonLoading] = React.useState(false);

  const restoreJson = async () => {
    if (!jsonFile) return;
    setJsonLoading(true); setJsonMsg(null);
    try {
      const text = await jsonFile.text();
      const rows = JSON.parse(text) as unknown[];
      if (!Array.isArray(rows)) throw new Error("格式錯誤：必須是 JSON 陣列");
      const res = await fetch("/api/import-json", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ rows }),
      });
      const d = await res.json() as { ok?: boolean; imported?: number; skipped?: number; error?: string };
      if (d.error) throw new Error(d.error);
      setJsonMsg(`✅ 還原完成：匯入 ${d.imported} 筆，跳過 ${d.skipped} 筆（重複或格式錯誤）`);
      setJsonFile(null);
      onComplete();
    } catch (e) {
      setJsonMsg(`❌ ${e instanceof Error ? e.message : "還原失敗"}`);
    } finally { setJsonLoading(false); }
  };

  return (
    <div className="rounded-2xl p-5 space-y-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div>
        <p className="text-[15px] font-bold" style={{ color: "var(--text-primary)" }}>從備份 JSON 還原</p>
        <p className="text-[13px] mt-0.5" style={{ color: "var(--text-muted)" }}>
          選取先前從交易記錄頁「↓ 備份」下載的 JSON 檔，重複資料會自動跳過
        </p>
      </div>
      <div className="flex items-center gap-3">
        <label className="flex-1 cursor-pointer">
          <div className="rounded-xl px-4 py-2.5 text-[14px] text-center transition-opacity hover:opacity-80"
            style={{ background: "var(--bg-input)", border: "1px dashed var(--border-inner)", color: jsonFile ? "var(--text-primary)" : "var(--text-muted)" }}>
            {jsonFile ? jsonFile.name : "選擇 .json 備份檔…"}
          </div>
          <input type="file" accept=".json" className="hidden"
            onChange={e => { setJsonFile(e.target.files?.[0] ?? null); setJsonMsg(null); }} />
        </label>
        <button onClick={restoreJson} disabled={!jsonFile || jsonLoading}
          className="px-4 py-2.5 rounded-xl text-[14px] font-bold text-white transition-opacity disabled:opacity-40"
          style={{ background: "var(--btn-gradient)" }}>
          {jsonLoading ? "還原中…" : "開始還原"}
        </button>
      </div>
      {jsonMsg && (
        <p className="text-[13px] font-medium" style={{ color: jsonMsg.startsWith("✅") ? "#10B981" : "#EF4444" }}>{jsonMsg}</p>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return Math.abs(n).toLocaleString("zh-TW", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="h-px flex-1" style={{ background: "var(--border-inner)" }} />
      <span className="text-[14px] font-bold tracking-[0.14em] uppercase flex-shrink-0 select-none" style={{ color: "var(--text-muted)" }}>{label}</span>
      <div className="h-px flex-1" style={{ background: "var(--border-inner)" }} />
    </div>
  );
}

function groupByDate(txs: RecentTransaction[]) {
  const today     = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const map = new Map<string, RecentTransaction[]>();
  for (const tx of txs) {
    if (!map.has(tx.date)) map.set(tx.date, []);
    map.get(tx.date)!.push(tx);
  }
  return Array.from(map.entries()).map(([date, items]) => ({
    label: date === today ? "今天" : date === yesterday ? "昨天" : date,
    items,
  }));
}

function SourceBadge({ source }: { source: string }) {
  const label = SOURCE_LABELS[source] ?? source;
  let color = "#64748B";
  if (CC_SOURCES.has(source))        color = "#F59E0B";
  else if (BANK_SOURCES.has(source)) color = "var(--accent)";
  else if (source === "line")        color = "#10B981";
  else if (source === "cash")        color = "#22C55E";
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[14px] font-bold flex-shrink-0 border"
      style={{ color, borderColor: color + "40", backgroundColor: color + "18", letterSpacing: "0.02em" }}>
      {label}
    </span>
  );
}

const QUICK_CATS_EXPENSE = ["飲食", "交通", "娛樂", "購物", "醫療", "居住", "教育", "通訊", "保險", "水電", "美容", "運動", "旅遊", "訂閱", "寵物", "現金", "轉帳", "其他"];
const QUICK_CATS_INCOME  = ["薪資", "獎金", "兼職", "投資", "租金", "退款", "現金", "轉帳", "其他"];

function CategoryPicker({ txId, txType, onPick, onCancel, customCats = [] }: {
  txId:       string;
  txType:     string;
  onPick:     (id: string, cat: string, type: string) => void;
  onCancel:   () => void;
  customCats?: string[];
}) {
  const [custom, setCustom] = React.useState("");
  const builtinCats = txType === "收入" ? QUICK_CATS_INCOME : QUICK_CATS_EXPENSE;
  const cats = [...builtinCats, ...customCats.filter(c => !builtinCats.includes(c))];
  return (
    <div className="flex flex-col gap-1.5" onClick={e => e.stopPropagation()}>
      <div className="flex items-center gap-1 flex-wrap">
        {cats.map(c => (
          <button key={c} onMouseDown={() => onPick(txId, c, txType)}
            className="text-[14px] px-2 py-0.5 rounded-md font-medium transition-colors hover:opacity-90"
            style={{ background: "#1E3A5F", color: "#60A5FA", border: "1px solid #1D4ED840" }}>
            {c}
          </button>
        ))}
        <button onMouseDown={onCancel}
          className="text-[14px] px-2 py-0.5 rounded-md transition-colors"
          style={{ color: "#475569", border: "1px solid #1E3054" }}>
          ✕
        </button>
      </div>
      <div className="flex items-center gap-1">
        <input
          value={custom}
          onChange={e => setCustom(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && custom.trim()) onPick(txId, custom.trim(), txType); }}
          placeholder="自訂分類…"
          className="text-[14px] px-2 py-0.5 rounded-md flex-1 outline-none"
          style={{ background: "#0F1827", color: "#94A3B8", border: "1px solid #1E3054" }}
        />
        <button
          onMouseDown={e => e.preventDefault()}
          onClick={() => { if (custom.trim()) onPick(txId, custom.trim(), txType); }}
          className="text-[14px] px-2 py-0.5 rounded-md font-medium"
          style={{ background: "#1E3A5F", color: "#60A5FA", border: "1px solid #1D4ED840" }}>
          確認
        </button>
      </div>
    </div>
  );
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-4 py-3 text-sm border" style={{ background: "var(--bg-input)", borderColor: "var(--border)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
      <p className="text-xs font-medium mb-2 tracking-wide" style={{ color: "var(--text-sub)" }}>{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mb-1 last:mb-0">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>{p.name}</span>
          <span className="font-bold text-[var(--text-primary)] ml-auto pl-4">NT$ {fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Card wrapper ──────────────────────────────────────────────────────────────
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border ${className}`}
      style={{ background: "var(--bg-card)", borderColor: "var(--border)", boxShadow: "var(--card-shadow)" }}>
      {children}
    </div>
  );
}

interface TxPage {
  items: RecentTransaction[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const isDemo = useRef(typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "1");
  // Tab 快取：記錄已成功載入過資料的 Tab，切回時不重新 fetch
  const loadedTabs = useRef<Set<TabId>>(new Set());

  const [data,       setData]       = useState<SummaryData | null>(null);
  const [balances,   setBalances]   = useState<BankBalanceItem[]>([]);
  const [netWorth,   setNetWorth]   = useState<NetWorth | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [recatLoading, setRecatLoading] = useState(false);
  const [recatMsg,   setRecatMsg]   = useState<string | null>(null);
  const [months,     setMonths]     = useState(6);
  const [activeTab,   setActiveTab]   = useState<TabId>("charts");
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [planningOpen, setPlanningOpen] = useState(false);
  const [toolsOpen,    setToolsOpen]    = useState(false);
  const [moreOpen,     setMoreOpen]     = useState(false);
  const [txData,     setTxData]     = useState<TxPage | null>(null);
  const [txPage,     setTxPage]     = useState(1);
  const [txLoading,  setTxLoading]  = useState(false);
  const txSentinelRef = useRef<HTMLDivElement>(null);
  const [editingTxId,  setEditingTxId]  = useState<string | null>(null);
  const [txFilterCat,    setTxFilterCat]    = useState<string | null>(null);
  const [txSearch,       setTxSearch]       = useState("");
  const [txAdvancedOpen, setTxAdvancedOpen] = useState(false);
  const [txDateFrom,     setTxDateFrom]     = useState("");
  const [txDateTo,       setTxDateTo]       = useState("");
  const [txAmountMin,    setTxAmountMin]    = useState("");
  const [txAmountMax,    setTxAmountMax]    = useState("");
  const [txTypeFilter,   setTxTypeFilter]   = useState<"" | "收入" | "支出">("");
  const [txSourceFilter, setTxSourceFilter] = useState<string[]>([]);
  const [txMoodFilter,   setTxMoodFilter]   = useState<string>("");
  const [moodPickerId,   setMoodPickerId]   = useState<string | null>(null);
  const [batchMode,      setBatchMode]      = useState(false);
  const [selectedIds,    setSelectedIds]    = useState<Set<string>>(new Set());
  const [batchCat,       setBatchCat]       = useState("");
  const [batchNote,      setBatchNote]      = useState("");
  const [batchUpdating,  setBatchUpdating]  = useState(false);
  const [categories,      setCategories]      = useState<string[]>([]);
  const [customExpenseCats, setCustomExpenseCats] = useState<string[]>([]);
  const [customIncomeCats,  setCustomIncomeCats]  = useState<string[]>([]);
  const [theme,        setTheme]        = useState<AppTheme>(THEMES[1]); // slate default
  const [addModal,     setAddModal]     = useState(false);
  const [bankEditSource, setBankEditSource] = useState<string | null>(null);
  const [bankEditForm,   setBankEditForm]   = useState({ alias: "", savingsGoal: "" });
  const [bankEditSaving, setBankEditSaving] = useState(false);
  const [notionSyncing, setNotionSyncing] = useState(false);
  const [notionMsg,     setNotionMsg]     = useState<string | null>(null);
  const [addForm,      setAddForm]      = useState({ date: new Date().toISOString().split("T")[0], type: "收入", amount: "", category: "", note: "" });
  const [addSaving,    setAddSaving]    = useState(false);
  const [splitModal,   setSplitModal]   = useState<SplitTx | null>(null);
  const [splitParts,   setSplitParts]   = useState<SplitPart[]>([{ category: "", amount: "", note: "" }, { category: "", amount: "", note: "" }]);
  const [splitSaving,  setSplitSaving]  = useState(false);
  const [mergeModal,   setMergeModal]   = useState(false);
  const [mergeForm,    setMergeForm]    = useState({ category: "", note: "" });
  const [mergeSaving,  setMergeSaving]  = useState(false);
  const [prevMonthSummary, setPrevMonthSummary] = useState<{ totals: { income: number; expense: number; net: number }; byCategory: CategorySummary[] } | null>(null);
  const [monthCompareExpanded, setMonthCompareExpanded] = useState(false);
  const [globalSearch,     setGlobalSearch]     = useState("");
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const globalSearchRef = React.useRef<HTMLInputElement>(null);
  const [hiddenCards,      setHiddenCards]      = useState<Set<string>>(() =>
    typeof window !== "undefined" ? getHiddenCards() : new Set()
  );
  const [cardOrder,        setCardOrder]        = useState<ChartCardId[]>(() =>
    typeof window !== "undefined" ? getCardOrder() : CHART_CARDS_DEFAULT.map(c => c.id as ChartCardId)
  );
  const [showCardSettings, setShowCardSettings] = useState(false);
  const showCard  = (id: string) => !hiddenCards.has(id);
  const toggleCard = (id: ChartCardId) => {
    setHiddenCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem(CHART_VIS_KEY, JSON.stringify([...next]));
      return next;
    });
  };
  const reorderCards = (next: ChartCardId[]) => {
    setCardOrder(next);
    localStorage.setItem(CHART_ORDER_KEY, JSON.stringify(next));
  };
  const [urgentBillCount, setUrgentBillCount] = useState(0);
  const [transferPairs, setTransferPairs] = useState<TransferPair[]>([]);
  const [dismissedPairs, setDismissedPairs] = useState<Set<string>>(new Set());
  const [duplicatePairs,         setDuplicatePairs]         = useState<DuplicatePair[]>([]);
  const [dismissedDupPairs,      setDismissedDupPairs]      = useState<Set<string>>(new Set());
  const [dupDeleting,            setDupDeleting]            = useState<Set<string>>(new Set());
  const [budgetOverview, setBudgetOverview] = useState<{ category: string; amount: number; spent: number }[]>([]);
  const [selectedMonth,      setSelectedMonth]      = useState<string | null>(null);
  const [monthDetail,        setMonthDetail]        = useState<MonthDetail | null>(null);
  const [monthDetailLoading, setMonthDetailLoading] = useState(false);
  const [prevMonthCats,      setPrevMonthCats]      = useState<CategorySummary[]>([]);
  const [moodTrend,          setMoodTrend]          = useState<{ month: string; label: string; 衝動: number; 計畫: number; 必要: number; taggedPct: number }[]>([]);
  const [merchantTxs,        setMerchantTxs]        = useState<{ note: string; amount: number; category: string }[]>([]);
  const [merchantView,       setMerchantView]       = useState<"count" | "amount">("count");
  const [yoyData,            setYoyData]            = useState<{ cur: { byCategory: CategorySummary[]; totals: { income: number; expense: number; net: number } }; prev: { byCategory: CategorySummary[]; totals: { income: number; expense: number; net: number } }; curMonth: string; prevMonth: string } | null>(null);
  const [loansTimeline,      setLoansTimeline]      = useState<LoanTimelineItem[]>([]);
  const [nwSnapshots,        setNwSnapshots]        = useState<{ month: string; netWorth: number; assets: number; debt: number }[]>([]);
  const [snapshotSaving,     setSnapshotSaving]     = useState(false);
  const [healthSnapshots,    setHealthSnapshots]    = useState<HealthSnapshot[]>([]);
  const [healthSaving,       setHealthSaving]       = useState(false);
  const [compareMonthA,      setCompareMonthA]      = useState<string>("");
  const [compareMonthB,      setCompareMonthB]      = useState<string>("");
  const [compareDataA,       setCompareDataA]       = useState<{ byCategory: CategorySummary[]; totals: { income: number; expense: number; net: number } } | null>(null);
  const [compareDataB,       setCompareDataB]       = useState<{ byCategory: CategorySummary[]; totals: { income: number; expense: number; net: number } } | null>(null);
  const [compareLoading,     setCompareLoading]     = useState(false);
  const [weekdayTxs,         setWeekdayTxs]         = useState<{ date: string; amount: number; type: string; category: string }[]>([]);
  const [calendarMonth,      setCalendarMonth]      = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; });
  const [calendarTxs,        setCalendarTxs]        = useState<{ date: string; amount: number; type: string }[]>([]);
  const [calendarOpen,       setCalendarOpen]       = useState(false);
  const [calendarView,       setCalendarView]       = useState<"calendar" | "heatmap">("calendar");
  const [merchantOpen,       setMerchantOpen]       = useState(false);
  type GoalItem = { id: string; name: string; emoji: string; targetAmount: number; savedAmount: number; linkedSource: string | null; deadline: string | null; note: string };
  const [goals,          setGoals]          = useState<GoalItem[]>([]);
  const [goalModal,      setGoalModal]      = useState<"add" | GoalItem | null>(null);
  const [goalForm,       setGoalForm]       = useState({ name: "", emoji: "🎯", targetAmount: "", savedAmount: "", linkedSource: "", deadline: "", note: "" });
  const [goalSaving,     setGoalSaving]     = useState(false);
  const [fixedExpenses,      setFixedExpenses]      = useState<{ id: string; name: string; amount: number; category: string; dayOfMonth: number | null }[]>([]);
  const [auditLogs,    setAuditLogs]    = useState<AuditLogEntry[]>([]);
  const [auditPage,    setAuditPage]    = useState(1);
  const [auditTotal,   setAuditTotal]   = useState(0);
  const [auditPages,   setAuditPages]   = useState(1);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditFilter,  setAuditFilter]  = useState<string>("");
  const TX_LIMIT = 30;
  const lineUserId = "dashboard_user";
  const currentMonth = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; })();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (isDemo.current) {
        setData(DEMO_SUMMARY);
        setBalances(DEMO_BALANCES);
        setNetWorth(DEMO_NET_WORTH);
        setBudgetOverview(DEMO_BUDGETS.budgets);
        return;
      }
      const [s, b, nw, bg] = await Promise.all([
        fetch(`/api/summary?months=${months}`),
        fetch("/api/balances"),
        fetch("/api/net-worth"),
        fetch(`/api/budgets?month=${currentMonth}`),
      ]);
      setData(await s.json() as SummaryData);
      setBalances(await b.json() as BankBalanceItem[]);
      setNetWorth(await nw.json() as NetWorth);
      const bgData = await bg.json() as { budgets: { category: string; amount: number; spent: number }[] };
      setBudgetOverview(bgData.budgets ?? []);
      // 上月資料（月份對比卡用）
      const prevDate = new Date(); prevDate.setMonth(prevDate.getMonth() - 1);
      const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
      fetch(`/api/summary?month=${prevMonth}`).then(r => r.json()).then(d => setPrevMonthSummary(d as typeof prevMonthSummary)).catch(() => {});
      // 信用卡帳單 — 計算 7 天內到期未繳筆數（負債 Tab badge 用）
      fetch("/api/credit-cards").then(r => r.json()).then((cards: { bills: { dueDate: string; status: string }[] }[]) => {
        const in7days = new Date(); in7days.setDate(in7days.getDate() + 7);
        const today   = new Date(); today.setHours(0, 0, 0, 0);
        let count = 0;
        for (const card of cards) {
          for (const bill of card.bills ?? []) {
            if (bill.status === "paid") continue;
            const due = new Date(bill.dueDate);
            if (due >= today && due <= in7days) count++;
          }
        }
        setUrgentBillCount(count);
      }).catch(() => {});
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [months, currentMonth]);

  const fetchTxPage = useCallback(async (_page: number, append = false) => {
    setTxLoading(true);
    try {
      if (isDemo.current) { setTxData(DEMO_TX_PAGE); return; }
      const p = new URLSearchParams({ page: String(_page), limit: String(TX_LIMIT) });
      if (txFilterCat)  p.set("category",  txFilterCat);
      if (txSearch)     p.set("note",      txSearch);
      if (txTypeFilter) p.set("type",      txTypeFilter);
      if (txDateFrom)   p.set("dateFrom",  txDateFrom);
      if (txDateTo)     p.set("dateTo",    txDateTo);
      if (txAmountMin)              p.set("amountMin", txAmountMin);
      if (txAmountMax)              p.set("amountMax", txAmountMax);
      if (txSourceFilter.length > 0) p.set("source",   txSourceFilter.join(","));
      const res = await fetch(`/api/transactions?${p.toString()}`);
      const d = await res.json() as TxPage;
      if (append) {
        setTxData(prev => prev ? { ...d, items: [...prev.items, ...d.items] } : d);
      } else {
        setTxData(d);
      }
    } catch (e) { console.error(e); }
    finally { setTxLoading(false); }
  }, [txFilterCat, txSearch, txTypeFilter, txDateFrom, txDateTo, txAmountMin, txAmountMax, txSourceFilter]);

  const fetchAuditLogs = useCallback(async (page: number, filter: string, silent = false) => {
    if (!silent) setAuditLoading(true);
    try {
      if (isDemo.current) {
        setAuditLogs(DEMO_AUDIT_LOGS.logs);
        setAuditTotal(DEMO_AUDIT_LOGS.total);
        setAuditPages(DEMO_AUDIT_LOGS.pages);
        return;
      }
      const actionParam = filter ? `&action=${encodeURIComponent(filter)}` : "";
      const res = await fetch(`/api/audit-logs?page=${page}${actionParam}`);
      const d = await res.json() as { logs: AuditLogEntry[]; total: number; pages: number };
      setAuditLogs(d.logs);
      setAuditTotal(d.total);
      setAuditPages(d.pages);
    } catch (e) { console.error(e); }
    finally { if (!silent) setAuditLoading(false); }
  }, []);

  const fetchMonthDetail = useCallback(async (month: string) => {
    setMonthDetailLoading(true);
    try {
      const res = await fetch(`/api/summary?month=${month}`);
      const d   = await res.json() as { byCategory: CategorySummary[]; totals: { income: number; expense: number; net: number } };
      setMonthDetail({ byCategory: d.byCategory, totals: d.totals });
    } catch (e) { console.error(e); }
    finally { setMonthDetailLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // 動態 title — 顯示當前月份
  useEffect(() => {
    document.title = `LINE 記帳 | ${currentMonth}`;
    return () => { document.title = "LINE 記帳"; };
  }, [currentMonth]);

  // Tab 記憶 — paint 前同步讀取，避免閃爍；useLayoutEffect 不在 server 執行，hydration 不會失配
  useLayoutEffect(() => {
    const VALID_TABS = new Set<string>(["charts","transactions","loans","budget","subscriptions","annual","retirement","fire","income-stability","expense-ratio","account-flow","spending-forecast","cashflow-forecast","bill-calendar","grad-school","savings-plan","education-program","payees","import","guide","audit","categories","duplicate-review"]);
    const saved = localStorage.getItem("activeTab") as TabId | null;
    if (saved && VALID_TABS.has(saved)) setActiveTab(saved);
  }, []);

  // Tab 記憶 — 持久化 activeTab
  useEffect(() => {
    localStorage.setItem("activeTab", activeTab);
  }, [activeTab]);

  // ── 鍵盤快捷鍵 ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // 如果焦點在 input/textarea/select 上，不攔截
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      // Esc：關閉 modal
      if (e.key === "Escape") {
        setAddModal(false);
        setSplitModal(null);
        setMergeModal(false);
        setGoalModal(null);
        setGlobalSearchOpen(false);
        return;
      }
      // /：開啟全域搜尋
      if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setGlobalSearchOpen(true);
        return;
      }
      // N：新增記帳
      if (e.key === "n" || e.key === "N") {
        setAddModal(true);
        return;
      }
      // 1-5：切換主 Tab
      if (e.key === "1") { setActiveTab("charts");       return; }
      if (e.key === "2") { setActiveTab("transactions");  return; }
      if (e.key === "3") { setActiveTab("loans");         return; }
      if (e.key === "4") { setActiveTab("budget");        return; }
      if (e.key === "5") { setActiveTab("subscriptions"); return; }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (activeTab !== "charts") return;
    if (loadedTabs.current.has("charts")) return;
    loadedTabs.current.add("charts");
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "transactions") { setTxData(null); setTxPage(1); fetchTxPage(1); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txFilterCat]);

  useEffect(() => {
    if (activeTab !== "transactions") return;
    const t = setTimeout(() => { setTxData(null); setTxPage(1); fetchTxPage(1); }, 400);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txSearch]);

  useEffect(() => {
    if (activeTab !== "transactions") return;
    const t = setTimeout(() => { setTxData(null); setTxPage(1); fetchTxPage(1); }, 400);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txTypeFilter, txDateFrom, txDateTo, txAmountMin, txAmountMax, txSourceFilter]);

  // Load saved theme
  useEffect(() => {
    const saved = localStorage.getItem("theme") as AppTheme["id"] | null;
    if (saved) {
      const found = THEMES.find(t => t.id === saved);
      if (found) setTheme(found);
    }
  }, []);

  function switchTheme(t: AppTheme) {
    setTheme(t);
    localStorage.setItem("theme", t.id);
  }

  useEffect(() => {
    if (isDemo.current) { setCategories(DEMO_CATEGORIES); return; }
    Promise.all([
      fetch("/api/transactions/categories").then(r => r.json()),
      fetch("/api/categories").then(r => r.json()),
    ]).then(([txCats, catData]: [string[], { expense: string[]; income: string[]; custom: { name: string; type: string }[] }]) => {
      setCategories(txCats);
      const custom = catData.custom ?? [];
      setCustomExpenseCats(custom.filter(c => c.type === "expense" || c.type === "both").map(c => c.name));
      setCustomIncomeCats( custom.filter(c => c.type === "income"  || c.type === "both").map(c => c.name));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (activeTab !== "transactions") return;
    // txPage 變動（換頁）永遠 fetch；初次進 Tab 也 fetch
    const firstVisit = !loadedTabs.current.has("transactions");
    if (!firstVisit && txPage === 1) return; // 切回 Tab 且在第一頁，跳過重 fetch
    if (firstVisit) loadedTabs.current.add("transactions");
    fetchTxPage(txPage, txPage > 1);
    if (firstVisit) {
      if (isDemo.current) { setTransferPairs(DEMO_TRANSFER_CANDIDATES.pairs); return; }
      fetch(`/api/transfer-candidates?lineUserId=${lineUserId}`)
        .then(r => r.json())
        .then((d: { pairs: TransferPair[] }) => setTransferPairs(d.pairs))
        .catch(() => {});
    }
  }, [activeTab, txPage, fetchTxPage]);

  // Infinite scroll sentinel observer
  useEffect(() => {
    const sentinel = txSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !txLoading && txData && txData.page < txData.totalPages) {
          setTxPage(p => p + 1);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [txLoading, txData]);

  useEffect(() => {
    if (activeTab !== "import") return;
    if (loadedTabs.current.has("import")) return;
    loadedTabs.current.add("import");
    if (isDemo.current) { setDuplicatePairs(DEMO_DUPLICATE_CANDIDATES.pairs as DuplicatePair[]); return; }
    fetch("/api/duplicate-candidates")
      .then(r => r.json())
      .then((d: { pairs: DuplicatePair[] }) => setDuplicatePairs(d.pairs))
      .catch(() => {});
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "audit") return;
    // 換頁 or 篩選變動時一律 fetch；初次進 Tab 也 fetch
    const firstVisit = !loadedTabs.current.has("audit");
    if (firstVisit) loadedTabs.current.add("audit");
    fetchAuditLogs(auditPage, auditFilter);

    const es = new EventSource("/api/audit-logs/stream");
    es.onmessage = () => fetchAuditLogs(auditPage, auditFilter, true);
    es.onerror   = () => es.close();
    return () => es.close();
  }, [activeTab, auditPage, auditFilter, fetchAuditLogs]);

  // 衝動消費趨勢：抓近 6 個月支出交易（含 mood），按月分組
  useEffect(() => {
    if (activeTab !== "charts") return;
    if (moodTrend.length > 0) return; // 已有資料則跳過
    const now = new Date();
    const dateFrom = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().split("T")[0];
    fetch(`/api/transactions?type=支出&dateFrom=${dateFrom}&limit=500`)
      .then(r => r.json())
      .then((d: { items: { date: string; amount: number; mood?: string | null }[] }) => {
        const map = new Map<string, { 衝動: number; 計畫: number; 必要: number; total: number; tagged: number }>();
        for (const tx of d.items ?? []) {
          const ym = tx.date.slice(0, 7);
          if (!map.has(ym)) map.set(ym, { 衝動: 0, 計畫: 0, 必要: 0, total: 0, tagged: 0 });
          const bucket = map.get(ym)!;
          bucket.total += tx.amount;
          if (tx.mood === "衝動" || tx.mood === "計畫" || tx.mood === "必要") {
            bucket[tx.mood] += tx.amount;
            bucket.tagged += tx.amount;
          }
        }
        const result = Array.from(map.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([ym, v]) => ({
            month: ym,
            label: `${parseInt(ym.slice(5))}月`,
            衝動: Math.round(v.衝動),
            計畫: Math.round(v.計畫),
            必要: Math.round(v.必要),
            taggedPct: v.total > 0 ? Math.round((v.tagged / v.total) * 100) : 0,
          }));
        setMoodTrend(result);
      })
      .catch(() => {});
  }, [activeTab]);

  // 高頻商家分析：抓近期支出交易（含 note）
  useEffect(() => {
    if (activeTab !== "charts") return;
    if (merchantTxs.length > 0) return; // 已有資料則跳過
    fetch("/api/transactions?type=支出&limit=500")
      .then(r => r.json())
      .then((d: { items: { note: string | null; amount: number; category: string }[] }) => {
        setMerchantTxs(
          (d.items ?? [])
            .filter(t => t.note && t.note.trim().length > 0)
            .map(t => ({ note: t.note!.trim(), amount: t.amount, category: t.category }))
        );
      })
      .catch(() => {});
  }, [activeTab]);

  // 同月去年比較：自動抓當月 vs 去年同月
  useEffect(() => {
    if (activeTab !== "charts") return;
    if (yoyData) return; // 已有資料則跳過
    const base = selectedMonth ?? currentMonth;
    const [y, m] = base.split("-").map(Number);
    const prevYear = `${y - 1}-${String(m).padStart(2, "0")}`;
    Promise.all([
      fetch(`/api/summary?month=${base}`).then(r => r.json()),
      fetch(`/api/summary?month=${prevYear}`).then(r => r.json()),
    ]).then(([cur, prev]) => {
      setYoyData({ cur, prev, curMonth: base, prevMonth: prevYear });
    }).catch(() => {});
  }, [activeTab, selectedMonth, currentMonth]);

  // 抓上月分類資料，用於環比計算
  useEffect(() => {
    if (activeTab !== "charts") return;
    const base = selectedMonth ?? currentMonth;
    const [y, m] = base.split("-").map(Number);
    const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
    fetch(`/api/summary?month=${prev}`)
      .then(r => r.json())
      .then((d: { byCategory: CategorySummary[] }) => setPrevMonthCats(d.byCategory ?? []))
      .catch(() => setPrevMonthCats([]));
  }, [activeTab, selectedMonth, currentMonth]);

  useEffect(() => {
    if (activeTab !== "charts") return;
    if (isDemo.current) { setFixedExpenses(DEMO_FIXED_EXPENSES.fixedExpenses); return; }
    fetch("/api/fixed-expenses")
      .then(r => r.json())
      .then((d: { fixedExpenses: typeof fixedExpenses }) => setFixedExpenses(d.fixedExpenses ?? []))
      .catch(() => {});
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "charts") return;
    if (isDemo.current) {
      setHealthSnapshots(DEMO_HEALTH_SNAPSHOTS);
      return;
    }
    fetch("/api/net-worth/snapshots")
      .then(r => r.json())
      .then((d: { month: string; netWorth: number; assets: number; debt: number }[]) => setNwSnapshots(d))
      .catch(() => {});
    fetch("/api/health-score/snapshots")
      .then(r => r.json())
      .then((d: HealthSnapshot[]) => setHealthSnapshots(d))
      .catch(() => {});
  }, [activeTab]);

  // 財務目標
  useEffect(() => {
    if (activeTab !== "charts") return;
    if (isDemo.current) { setGoals(DEMO_GOALS); return; }
    fetch("/api/goals").then(r => r.json()).then((d: GoalItem[]) => setGoals(d)).catch(() => {});
  }, [activeTab]);


  // 週消費分佈資料（近 3 個月交易）
  useEffect(() => {
    if (activeTab !== "charts") return;
    const src = isDemo.current ? Promise.resolve(DEMO_SUMMARY.recent) :
      fetch(`/api/transactions?limit=500`).then(r => r.json()).then((d: { items: typeof weekdayTxs }) => d.items);
    src.then(items => setWeekdayTxs(items.map((t: { date: string; amount: number; type: string; category: string }) => ({ date: t.date, amount: t.amount, type: t.type, category: t.category ?? "" })))
    ).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // 日曆視圖資料
  useEffect(() => {
    if (activeTab !== "charts") return;
    const src = isDemo.current ? Promise.resolve(DEMO_SUMMARY.recent) :
      fetch(`/api/transactions?limit=200&month=${calendarMonth}`).then(r => r.json()).then((d: { items: typeof calendarTxs }) => d.items);
    src.then(items => setCalendarTxs(items.map((t: { date: string; amount: number; type: string }) => ({ date: t.date, amount: t.amount, type: t.type })))
    ).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, calendarMonth]);

  useEffect(() => {
    if (activeTab !== "charts" || loansTimeline.length > 0) return;
    if (isDemo.current) {
      setLoansTimeline(DEMO_LOANS.filter(l => l.status === "active").map(l => {
        const remaining = Number(l.remainingPrincipal);
        const lastPay   = l.payments?.[0];
        const monthlyPrincipal = lastPay ? Number(lastPay.principalPaid) : 0;
        const monthsLeft = monthlyPrincipal > 0 ? Math.ceil(remaining / monthlyPrincipal) : null;
        const payoffDate = monthsLeft !== null
          ? (() => { const d = new Date(); d.setMonth(d.getMonth() + monthsLeft); return d.toISOString().slice(0, 7); })()
          : null;
        return { id: l.id, name: l.name, lender: l.lender, originalPrincipal: Number(l.originalPrincipal), remainingPrincipal: remaining, monthlyPrincipal, interestRate: Number(l.interestRate), endDate: l.endDate, monthsLeft, payoffDate };
      }));
      return;
    }
    fetch("/api/loans")
      .then(r => r.json())
      .then((loans: {
        id: string; name: string; lender: string; status: string;
        originalPrincipal: string; remainingPrincipal: string; interestRate: string;
        endDate: string | null;
        payments: { principalPaid: string }[];
      }[]) => {
        setLoansTimeline(
          loans.filter(l => l.status === "active").map(l => {
            const remaining        = Number(l.remainingPrincipal);
            const original         = Number(l.originalPrincipal);
            const lastPay          = l.payments?.[0];
            const monthlyPrincipal = lastPay ? Number(lastPay.principalPaid) : 0;
            const monthsLeft       = monthlyPrincipal > 0 ? Math.ceil(remaining / monthlyPrincipal) : null;
            const payoffDate       = l.endDate
              ? l.endDate.slice(0, 10)
              : monthsLeft !== null
                ? (() => { const d = new Date(); d.setMonth(d.getMonth() + monthsLeft); return d.toISOString().slice(0, 7); })()
                : null;
            return { id: l.id, name: l.name, lender: l.lender, originalPrincipal: original, remainingPrincipal: remaining, monthlyPrincipal, interestRate: Number(l.interestRate), endDate: l.endDate, monthsLeft, payoffDate };
          })
        );
      })
      .catch(() => {});
  }, [activeTab, loansTimeline.length]);

  async function saveGoal() {
    if (!goalForm.name || !goalForm.targetAmount) return;
    setGoalSaving(true);
    try {
      const payload = {
        name: goalForm.name, emoji: goalForm.emoji,
        targetAmount: parseFloat(goalForm.targetAmount),
        savedAmount:  parseFloat(goalForm.savedAmount) || 0,
        linkedSource: goalForm.linkedSource || null,
        deadline: goalForm.deadline || null,
        note: goalForm.note,
      };
      if (goalModal === "add") {
        await fetch("/api/goals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      } else if (goalModal && typeof goalModal === "object") {
        await fetch(`/api/goals/${goalModal.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      }
      const updated = await fetch("/api/goals").then(r => r.json()) as GoalItem[];
      setGoals(updated);
      setGoalModal(null);
    } catch (e) { console.error(e); }
    finally { setGoalSaving(false); }
  }

  async function deleteGoal(id: string) {
    await fetch(`/api/goals/${id}`, { method: "DELETE" });
    setGoals(g => g.filter(x => x.id !== id));
  }

  async function fetchCompare(mA: string, mB: string) {
    if (!mA || !mB) return;
    setCompareLoading(true);
    try {
      const [rA, rB] = await Promise.all([
        fetch(`/api/summary?month=${mA}`).then(r => r.json()),
        fetch(`/api/summary?month=${mB}`).then(r => r.json()),
      ]);
      setCompareDataA(rA as typeof compareDataA);
      setCompareDataB(rB as typeof compareDataB);
    } catch (e) { console.error(e); }
    finally { setCompareLoading(false); }
  }

  async function saveNwSnapshot() {
    if (!netWorth) return;
    setSnapshotSaving(true);
    try {
      await fetch("/api/net-worth/snapshots", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month:    currentMonth,
          netWorth: netWorth.netWorth,
          assets:   netWorth.totalAssets,
          debt:     netWorth.totalDebt,
        }),
      });
      const updated = await fetch("/api/net-worth/snapshots").then(r => r.json()) as typeof nwSnapshots;
      setNwSnapshots(updated);
    } catch (e) { console.error(e); }
    finally { setSnapshotSaving(false); }
  }

  async function saveHealthSnapshot(payload: HealthSnapshot) {
    setHealthSaving(true);
    try {
      await fetch("/api/health-score/snapshots", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const updated = await fetch("/api/health-score/snapshots").then(r => r.json()) as HealthSnapshot[];
      setHealthSnapshots(updated);
    } catch (e) { console.error(e); }
    finally { setHealthSaving(false); }
  }

  async function confirmTransfer(pair: TransferPair) {
    const key = `${pair.expense.id}:${pair.income.id}`;
    await Promise.all([
      fetch(`/api/transactions/${pair.expense.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category: "轉帳" }) }),
      fetch(`/api/transactions/${pair.income.id}`,  { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category: "轉帳" }) }),
    ]);
    setTransferPairs(p => p.filter(x => `${x.expense.id}:${x.income.id}` !== key));
    fetchData();
  }

  function dismissTransfer(pair: TransferPair) {
    const key = `${pair.expense.id}:${pair.income.id}`;
    setDismissedPairs(prev => new Set(Array.from(prev).concat(key)));
  }

  function dupKey(pair: DuplicatePair) { return `${pair.a.id}:${pair.b.id}`; }

  function dismissDup(pair: DuplicatePair) {
    setDismissedDupPairs(prev => new Set(Array.from(prev).concat(dupKey(pair))));
  }

  async function deleteDupTx(id: string, pair: DuplicatePair) {
    setDupDeleting(prev => new Set(Array.from(prev).concat(id)));
    try {
      await fetch("/api/duplicate-candidates", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      setDuplicatePairs(prev => prev.filter(p => p.a.id !== id && p.b.id !== id));
    } finally {
      setDupDeleting(prev => { const s = new Set(Array.from(prev)); s.delete(id); return s; });
      dismissDup(pair);
    }
  }

  async function handleNotionSync() {
    setNotionSyncing(true); setNotionMsg(null);
    try {
      const res = await fetch("/api/notion-sync", { method: "POST" });
      const json = await res.json() as { message: string };
      setNotionMsg(json.message);
    } catch { setNotionMsg("同步失敗"); }
    finally { setNotionSyncing(false); }
  }

  async function saveManualTx() {
    const amount = parseFloat(addForm.amount);
    if (!addForm.date || isNaN(amount) || amount <= 0 || !addForm.category.trim()) return;
    setAddSaving(true);
    try {
      await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: addForm.date, type: addForm.type, amount, category: addForm.category.trim(), note: addForm.note }),
      });
      setAddModal(false);
      if (addForm.note.trim()) addNoteTemplate(addForm.note.trim());
      setAddForm({ date: new Date().toISOString().split("T")[0], type: "收入", amount: "", category: "", note: "" });
      setCategories(prev => prev.includes(addForm.category.trim()) ? prev : [...prev, addForm.category.trim()].sort());
      // refresh tx list if on transactions tab
      if (activeTab === "transactions") fetchTxPage(1);
      fetchData();
    } catch (e) { console.error(e); }
    setAddSaving(false);
  }

  async function saveSplit() {
    if (!splitModal) return;
    const parts = splitParts.filter(p => p.category && parseFloat(p.amount) > 0);
    if (parts.length < 2) return;
    const sum = parts.reduce((s, p) => s + parseFloat(p.amount), 0);
    if (Math.abs(sum - splitModal.amount) > 0.5) return;
    setSplitSaving(true);
    try {
      await fetch(`/api/transactions/${splitModal.id}/split`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parts: parts.map(p => ({ category: p.category, amount: parseFloat(p.amount), note: p.note })) }),
      });
      setSplitModal(null);
      setSplitParts([{ category: "", amount: "", note: "" }, { category: "", amount: "", note: "" }]);
      fetchTxPage(txPage);
      fetchData();
    } catch (e) { console.error(e); }
    setSplitSaving(false);
  }

  async function saveMerge() {
    if (!mergeForm.category || selectedIds.size < 2) return;
    setMergeSaving(true);
    try {
      await fetch("/api/transactions/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), category: mergeForm.category, note: mergeForm.note }),
      });
      setMergeModal(false);
      setMergeForm({ category: "", note: "" });
      setBatchMode(false);
      setSelectedIds(new Set());
      fetchTxPage(1);
      fetchData();
    } catch (e) { console.error(e); }
    setMergeSaving(false);
  }

  async function updateTxCategory(id: string, category: string, type: string) {
    const cat = category.trim();
    if (!cat) { setEditingTxId(null); return; }
    try {
      await fetch(`/api/transactions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: cat, type }),
      });
      setTxData(prev => prev ? {
        ...prev,
        items: prev.items.map(tx => tx.id === id ? { ...tx, category: cat, type } : tx),
      } : prev);
      setCategories(prev => prev.includes(cat) ? prev : [...prev, cat].sort());
      fetchData();
    } catch (e) { console.error(e); }
    setEditingTxId(null);
  }

  async function batchUpdateCategory(category: string) {
    if (!category.trim() || selectedIds.size === 0) return;
    setBatchUpdating(true);
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      const tx = txData?.items.find(t => t.id === id);
      if (!tx) continue;
      try {
        await fetch(`/api/transactions/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category: category.trim(), type: tx.type }),
        });
      } catch (e) { console.error(e); }
    }
    setTxData(prev => prev ? {
      ...prev,
      items: prev.items.map(tx => selectedIds.has(tx.id) ? { ...tx, category: category.trim() } : tx),
    } : prev);
    setSelectedIds(new Set());
    setBatchMode(false);
    setBatchCat("");
    setBatchUpdating(false);
    fetchData();
  }

  async function batchUpdateNote(note: string) {
    if (!note.trim() || selectedIds.size === 0) return;
    setBatchUpdating(true);
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      try {
        await fetch(`/api/transactions/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: note.trim() }),
        });
      } catch (e) { console.error(e); }
    }
    setTxData(prev => prev ? {
      ...prev,
      items: prev.items.map(tx => selectedIds.has(tx.id) ? { ...tx, note: note.trim() } : tx),
    } : prev);
    setSelectedIds(new Set());
    setBatchMode(false);
    setBatchNote("");
    setBatchUpdating(false);
  }

  async function updateTxMood(id: string, mood: string | null) {
    try {
      await fetch(`/api/transactions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mood }),
      });
      setTxData(prev => prev ? {
        ...prev,
        items: prev.items.map(tx => tx.id === id ? { ...tx, mood } : tx),
      } : prev);
    } catch (e) { console.error(e); }
    setMoodPickerId(null);
  }

  async function deleteTx(id: string) {
    if (!confirm("確定刪除此筆交易？")) return;
    try {
      await fetch(`/api/transactions/${id}`, { method: "DELETE" });
      setTxData(prev => prev ? {
        ...prev,
        total: prev.total - 1,
        items: prev.items.filter(tx => tx.id !== id),
      } : prev);
    } catch (e) { console.error(e); }
  }

  async function handleRecategorize() {
    setRecatLoading(true); setRecatMsg(null);
    try {
      const res = await fetch("/api/recategorize", { method: "POST" });
      const json = await res.json() as { message: string };
      setRecatMsg(json.message);
      await fetchData();
    } catch { setRecatMsg("重新分類失敗"); }
    finally { setRecatLoading(false); }
  }

  const activeCategory = (selectedMonth && monthDetail ? monthDetail.byCategory : data?.byCategory) ?? [];
  const activeTotals   = (selectedMonth && monthDetail ? monthDetail.totals   : data?.totals);

  const expenseCatsBase = activeCategory.filter(c => c.type === "支出");

  // 圓餅圖：固定支出合併為一個「固定支出」項（貸款已在交易分類中，不重複加入）
  const fixedTotal = fixedExpenses.reduce((s, f) => s + f.amount, 0);
  const expensePieData = fixedTotal > 0
    ? [{ category: "固定支出", type: "支出" as const, total: fixedTotal }, ...expenseCatsBase]
    : expenseCatsBase;

  // 排行長條圖沿用純交易分類
  const expenseCats  = expenseCatsBase;
  const incomeCats   = activeCategory.filter(c => c.type === "收入");
  const expenseTotal = expenseCatsBase.reduce((s, c) => s + c.total, 0);
  const expensePieTotal = expensePieData.reduce((s, c) => s + c.total, 0);
  const incomeTotal  = incomeCats.reduce((s, c) => s + c.total, 0);

  const nw = netWorth?.netWorth ?? 0;

  return (
    <div className="min-h-screen" data-theme={theme.id} style={{
      background: "var(--bg-page)",
      fontFamily: "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
      color: "var(--text-primary)",
    }}>
      <style>{themeToCSS(theme)}</style>

      {/* ── Demo Badge (fixed bottom-right) ── */}
      {isDemo.current && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[14px] font-bold shadow-2xl select-none"
          style={{ background: "linear-gradient(135deg,#F59E0B,#EF4444)", color: "#fff", boxShadow: "0 8px 32px rgba(239,68,68,0.4)" }}>
          <span className="w-2 h-2 rounded-full bg-white animate-pulse inline-block" />
          DEMO 模式
        </div>
      )}

      {/* ── Header (單行) ── */}
      <header className="sticky top-0 z-20 border-b" style={{ background: "var(--bg-card)", borderColor: "var(--border)", boxShadow: "var(--card-shadow)" }}>
        <div className="max-w-6xl mx-auto px-6 h-[52px] flex items-stretch gap-2">

          {/* Logo */}
          <div className="flex items-center gap-2 flex-shrink-0 pr-1">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "var(--btn-gradient)", boxShadow: "0 0 12px rgba(59,130,246,0.35)" }}>
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-[15px] font-extrabold tracking-tight whitespace-nowrap" style={{ color: "var(--text-primary)" }}>個人記帳</span>
          </div>

          {/* 分隔線 */}
          <div className="self-center w-px h-5 flex-shrink-0" style={{ background: "var(--border-inner)" }} />

          {/* Tab nav — 主 Tab 可橫向捲動，下拉選單在外側避免被裁切 */}
          <div className="flex items-stretch flex-1 min-w-0">
            {/* 主 Tab（可捲動） */}
            <div className="flex items-stretch overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              {TABS.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className="relative px-3 text-[13px] font-semibold tracking-wide transition-colors duration-200 whitespace-nowrap flex items-center gap-1"
                  style={{ color: activeTab === tab.id ? "var(--accent-light)" : "var(--text-sub)" }}>
                  {tab.label}
                  {tab.id === "loans" && urgentBillCount > 0 && (
                    <span className="min-w-[16px] h-4 rounded-full flex items-center justify-center text-[11px] font-black text-white px-1 flex-shrink-0"
                      style={{ background: "#EF4444", boxShadow: "0 0 6px rgba(239,68,68,0.5)" }}>
                      {urgentBillCount > 9 ? "9+" : urgentBillCount}
                    </span>
                  )}
                  {activeTab === tab.id && (
                    <span className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full" style={{ background: "linear-gradient(90deg, #1D4ED8, #60A5FA)" }} />
                  )}
                </button>
              ))}
            </div>

            {/* 下拉選單群（不在 overflow 容器內，避免被裁切） */}
            <div className="flex items-stretch flex-shrink-0">

              {/* ── 進階分析 下拉 ── */}
              {(() => {
                const isActive = ANALYSIS_TABS.some(t => t.id === activeTab);
                return (
                  <div className="relative flex items-stretch">
                    <button
                      onClick={() => { setAnalysisOpen(o => !o); setPlanningOpen(false); setToolsOpen(false); }}
                      className="relative px-3 text-[13px] font-semibold tracking-wide transition-colors duration-200 flex items-center gap-1 whitespace-nowrap"
                      style={{ color: isActive ? "var(--accent-light)" : "var(--text-sub)" }}>
                      分析
                      <svg className="w-3 h-3 transition-transform" style={{ opacity: 0.6, transform: analysisOpen ? "rotate(180deg)" : "rotate(0deg)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                      {isActive && (
                        <span className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full"
                          style={{ background: "linear-gradient(90deg, #1D4ED8, #60A5FA)" }} />
                      )}
                    </button>
                    {analysisOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setAnalysisOpen(false)} />
                        <div className="absolute top-full left-0 z-20 rounded-xl overflow-hidden min-w-[160px]"
                          style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "0 12px 40px rgba(0,0,0,0.5)" }}>
                          {ANALYSIS_TABS.map(t => (
                            <button key={t.id}
                              onClick={() => { setActiveTab(t.id); setAnalysisOpen(false); }}
                              className="w-full text-left px-4 py-2.5 text-[14px] font-medium flex items-center gap-2 transition-colors"
                              style={{
                                color:      activeTab === t.id ? "var(--accent-light)" : "var(--text-primary)",
                                background: activeTab === t.id ? "var(--bg-input)"     : "transparent",
                              }}>
                              <span className="text-base">{t.icon}</span>
                              {t.label}
                              {activeTab === t.id && <span className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--accent-light)" }} />}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}

              {/* ── 財務規劃 下拉 ── */}
              {(() => {
                const isActive = PLANNING_TABS.some(t => t.id === activeTab);
                return (
                  <div className="relative flex items-stretch">
                    <button
                      onClick={() => { setPlanningOpen(o => !o); setAnalysisOpen(false); setToolsOpen(false); }}
                      className="relative px-3 text-[13px] font-semibold tracking-wide transition-colors duration-200 flex items-center gap-1 whitespace-nowrap"
                      style={{ color: isActive ? "var(--accent-light)" : "var(--text-sub)" }}>
                      規劃
                      <svg className="w-3 h-3 transition-transform" style={{ opacity: 0.6, transform: planningOpen ? "rotate(180deg)" : "rotate(0deg)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                      {isActive && (
                        <span className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full"
                          style={{ background: "linear-gradient(90deg, #1D4ED8, #60A5FA)" }} />
                      )}
                    </button>
                    {planningOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setPlanningOpen(false)} />
                        <div className="absolute top-full left-0 z-20 rounded-xl overflow-hidden min-w-[160px]"
                          style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "0 12px 40px rgba(0,0,0,0.5)" }}>
                          {PLANNING_TABS.map(t => (
                            <button key={t.id}
                              onClick={() => { setActiveTab(t.id); setPlanningOpen(false); }}
                              className="w-full text-left px-4 py-2.5 text-[14px] font-medium flex items-center gap-2 transition-colors"
                              style={{
                                color:      activeTab === t.id ? "var(--accent-light)" : "var(--text-primary)",
                                background: activeTab === t.id ? "var(--bg-input)"     : "transparent",
                              }}>
                              <span className="text-base">{t.icon}</span>
                              {t.label}
                              {activeTab === t.id && <span className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--accent-light)" }} />}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}

              {/* ── 工具 下拉 ── */}
              {(() => {
                const isActive = TOOLS_TABS.some(t => t.id === activeTab);
                return (
                  <div className="relative flex items-stretch">
                    <button
                      onClick={() => { setToolsOpen(o => !o); setAnalysisOpen(false); setPlanningOpen(false); }}
                      className="relative px-3 text-[13px] font-semibold tracking-wide transition-colors duration-200 flex items-center gap-1 whitespace-nowrap"
                      style={{ color: isActive ? "var(--accent-light)" : "var(--text-sub)" }}>
                      工具
                      <svg className="w-3 h-3 transition-transform" style={{ opacity: 0.6, transform: toolsOpen ? "rotate(180deg)" : "rotate(0deg)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                      {isActive && (
                        <span className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full"
                          style={{ background: "linear-gradient(90deg, #1D4ED8, #60A5FA)" }} />
                      )}
                    </button>
                    {toolsOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setToolsOpen(false)} />
                        <div className="absolute top-full left-0 z-20 rounded-xl overflow-hidden min-w-[128px]"
                          style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "0 12px 40px rgba(0,0,0,0.5)" }}>
                          {TOOLS_TABS.map(t => (
                            <button key={t.id}
                              onClick={() => { setActiveTab(t.id); setToolsOpen(false); }}
                              className="w-full text-left px-4 py-2.5 text-[14px] font-medium flex items-center gap-2 transition-colors"
                              style={{
                                color:      activeTab === t.id ? "var(--accent-light)" : "var(--text-primary)",
                                background: activeTab === t.id ? "var(--bg-input)"     : "transparent",
                              }}>
                              {t.label}
                              {activeTab === t.id && <span className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--accent-light)" }} />}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* 分隔線 */}
          <div className="self-center w-px h-5 flex-shrink-0" style={{ background: "var(--border-inner)" }} />

          {/* Controls */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* 月份範圍 */}
            <select value={months} onChange={e => setMonths(+e.target.value)}
              className="text-[13px] font-medium rounded-lg px-2 py-1.5 outline-none cursor-pointer"
              style={{ background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-sub)" }}>
              <option value={3}>近 3 月</option>
              <option value={6}>近 6 月</option>
              <option value={12}>近 12 月</option>
            </select>

            {/* 全域搜尋 */}
            {globalSearchOpen ? (
              <div className="relative">
                <input
                  ref={globalSearchRef}
                  autoFocus
                  type="text"
                  placeholder="搜尋備註…（Enter）"
                  value={globalSearch}
                  onChange={e => setGlobalSearch(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && globalSearch.trim()) {
                      setTxSearch(globalSearch.trim());
                      setActiveTab("transactions");
                      setGlobalSearchOpen(false);
                      setGlobalSearch("");
                    }
                    if (e.key === "Escape") { setGlobalSearchOpen(false); setGlobalSearch(""); }
                  }}
                  className="rounded-lg pl-8 pr-3 py-1.5 text-[13px] outline-none w-44"
                  style={{ background: "var(--bg-input)", border: "1px solid var(--accent)", color: "var(--text-primary)" }}
                />
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: "var(--text-muted)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
              </div>
            ) : (
              <button onClick={() => setGlobalSearchOpen(true)}
                className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
                style={{ background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-sub)" }}
                title="搜尋交易（/）">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
              </button>
            )}

            {/* 通知 */}
            <NotificationPanel isDemo={isDemo.current} />

            {/* 重新整理 */}
            <button onClick={() => {
              loadedTabs.current.clear();
              setMoodTrend([]);
              setMerchantTxs([]);
              setYoyData(null);
              fetchData();
            }}
              className="text-[13px] font-semibold text-white px-3 py-1.5 rounded-lg transition-opacity hover:opacity-90"
              style={{ background: "var(--btn-gradient)", boxShadow: "0 0 10px rgba(59,130,246,0.3)" }}>
              重整
            </button>

            {/* ⋯ 更多選單 */}
            <div className="relative">
              <button onClick={() => setMoreOpen(o => !o)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[16px] font-bold transition-colors"
                style={{
                  background: moreOpen ? "var(--bg-input)" : "transparent",
                  border:     `1px solid ${moreOpen ? "var(--border)" : "transparent"}`,
                  color:      "var(--text-sub)",
                }}>
                ···
              </button>

              {moreOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setMoreOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 z-40 rounded-2xl overflow-hidden"
                    style={{
                      minWidth:  "200px",
                      background:  "var(--bg-card)",
                      border:      "1px solid var(--border)",
                      boxShadow:   "0 12px 40px rgba(0,0,0,0.5)",
                    }}>

                    {/* 主題切換 */}
                    <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border-inner)" }}>
                      <p className="text-[14px] font-semibold mb-2 tracking-wide uppercase" style={{ color: "var(--text-muted)" }}>介面主題</p>
                      <div className="flex gap-1.5">
                        {THEMES.map(t => (
                          <button key={t.id} onClick={() => { switchTheme(t); }}
                            className="flex-1 py-1.5 rounded-lg text-[14px] font-bold transition-all"
                            style={theme.id === t.id
                              ? { background: "var(--btn-gradient)", color: "#fff" }
                              : { background: "var(--bg-input)", color: "var(--text-sub)", border: "1px solid var(--border-inner)" }}>
                            {t.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 操作 */}
                    <div className="py-1">
                      <button onClick={() => { handleNotionSync(); setMoreOpen(false); }} disabled={notionSyncing}
                        className="w-full text-left px-4 py-2.5 text-[14px] font-medium transition-colors disabled:opacity-40"
                        style={{ color: "var(--text-primary)" }}>
                        {notionSyncing ? "⟳ 同步中…" : "↗ 同步 Notion"}
                      </button>
                      <button onClick={() => { handleRecategorize(); setMoreOpen(false); }} disabled={recatLoading}
                        className="w-full text-left px-4 py-2.5 text-[14px] font-medium transition-colors disabled:opacity-40"
                        style={{ color: "var(--accent-light)" }}>
                        {recatLoading ? "⟳ 分析中…" : "✦ AI 重新分類"}
                      </button>
                    </div>

                    {/* 登出 */}
                    <div className="border-t py-1" style={{ borderColor: "var(--border-inner)" }}>
                      <button
                        onClick={async () => {
                          await fetch("/api/auth/login", { method: "DELETE" });
                          window.location.href = "/login";
                        }}
                        className="w-full text-left px-4 py-2.5 text-[14px] font-medium transition-colors"
                        style={{ color: "#ef4444" }}>
                        登出
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-8 py-7 space-y-6 pb-12">

        {/* Toast */}
        {recatMsg && (
          <div className="rounded-2xl px-5 py-3 flex items-center justify-between" style={{ background: "#0D2010", border: "1px solid #166534" }}>
            <p className="text-[14px] font-medium text-emerald-400">{recatMsg}</p>
            <button onClick={() => setRecatMsg(null)} className="text-emerald-600 text-lg">×</button>
          </div>
        )}
        {notionMsg && (
          <div className="rounded-2xl px-5 py-3 flex items-center justify-between" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <p className="text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>Notion：{notionMsg}</p>
            <button onClick={() => setNotionMsg(null)} className="text-lg" style={{ color: "var(--text-muted)" }}>×</button>
          </div>
        )}

        {/* ── Loading Skeleton ── */}
        {loading && (
          <div className="space-y-5">
            {/* Hero skeleton */}
            <div className="rounded-2xl p-6 animate-pulse" style={{ background: "var(--hero-bg)", border: "1px solid var(--hero-border)" }}>
              <div className="h-3 w-24 rounded-full mb-3" style={{ background: "rgba(255,255,255,0.1)" }} />
              <div className="h-12 w-48 rounded-xl mb-6" style={{ background: "rgba(255,255,255,0.12)" }} />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="rounded-xl px-4 py-3" style={{ background: "rgba(255,255,255,0.04)" }}>
                    <div className="h-2.5 w-16 rounded-full mb-2" style={{ background: "rgba(255,255,255,0.08)" }} />
                    <div className="h-5 w-20 rounded-lg" style={{ background: "rgba(255,255,255,0.1)" }} />
                  </div>
                ))}
              </div>
            </div>
            {/* Bank balance skeleton */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="rounded-2xl p-4 animate-pulse" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                  <div className="h-1 rounded-t-2xl absolute top-0 left-0 right-0" style={{ background: "var(--border)" }} />
                  <div className="h-4 w-20 rounded-full mb-2 mt-1" style={{ background: "var(--border-inner)" }} />
                  <div className="h-6 w-28 rounded-lg" style={{ background: "var(--border-inner)" }} />
                </div>
              ))}
            </div>
            {/* Chart card skeletons */}
            {[200, 160].map((h, i) => (
              <div key={i} className="rounded-2xl p-6 animate-pulse" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <div className="h-4 w-24 rounded-full mb-2" style={{ background: "var(--border-inner)" }} />
                <div className="h-3 w-40 rounded-full mb-5" style={{ background: "var(--border-inner)" }} />
                <div className="rounded-xl" style={{ height: h, background: "var(--bg-input)" }} />
              </div>
            ))}
          </div>
        )}

        {/* ── Charts tab ── */}
        {!loading && activeTab === "charts" && (
          <div className="flex flex-col gap-5">

            {/* ── 自訂卡片按鈕 ── */}
            <div className="flex justify-end">
              <button onClick={() => setShowCardSettings(s => !s)}
                className="text-[13px] font-semibold px-3 py-1.5 rounded-xl transition-opacity hover:opacity-80"
                style={{ background: "var(--bg-input)", color: "var(--text-sub)", border: "1px solid var(--border-inner)" }}>
                ⚙ 自訂卡片
              </button>
            </div>
            {showCardSettings && (
              <ChartCardSettings
                hidden={hiddenCards}
                order={cardOrder}
                onToggle={toggleCard}
                onReorder={reorderCards}
                onClose={() => setShowCardSettings(false)}
              />
            )}

            {/* ── 預算超標警示 Banner ── */}
            {budgetOverview.length > 0 && (() => {
              const overBudget = budgetOverview.filter(b => b.amount > 0 && b.spent > b.amount);
              const nearBudget = budgetOverview.filter(b => b.amount > 0 && b.spent <= b.amount && b.spent / b.amount >= 0.8);
              if (overBudget.length === 0 && nearBudget.length === 0) return null;
              return (
                <div className="space-y-2">
                  {overBudget.map(b => (
                    <div key={b.category} className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                      style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.35)" }}>
                      <span className="text-[18px]">🚨</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-[14px] font-bold" style={{ color: "#F87171" }}>
                          {b.category} 已超標
                        </span>
                        <span className="text-[14px] ml-2" style={{ color: "rgba(248,113,113,0.8)" }}>
                          已花 NT$ {fmt(b.spent)}　／　預算 NT$ {fmt(b.amount)}
                        </span>
                      </div>
                      <span className="text-[14px] font-bold tabular-nums flex-shrink-0" style={{ color: "#EF4444" }}>
                        +NT$ {fmt(b.spent - b.amount)}
                      </span>
                    </div>
                  ))}
                  {nearBudget.map(b => (
                    <div key={b.category} className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                      style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)" }}>
                      <span className="text-[18px]">⚠️</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-[14px] font-bold" style={{ color: "#F59E0B" }}>
                          {b.category} 接近上限
                        </span>
                        <span className="text-[14px] ml-2" style={{ color: "rgba(245,158,11,0.8)" }}>
                          已使用 {Math.round((b.spent / b.amount) * 100)}%　剩 NT$ {fmt(b.amount - b.spent)}
                        </span>
                      </div>
                      <span className="text-[14px] font-bold tabular-nums flex-shrink-0" style={{ color: "#F59E0B" }}>
                        {Math.round((b.spent / b.amount) * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* ── 分類預算快覽列 ── */}
            {showCard("budget-overview") && budgetOverview.filter(b => b.amount > 0).length > 0 && (() => {
              const cats = budgetOverview.filter(b => b.amount > 0).sort((a, b) => (b.spent / b.amount) - (a.spent / a.amount));
              const currentMth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
              return (
                <div className="rounded-2xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", order: cardOrder.indexOf("budget-overview") }}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-[16px] font-bold" style={{ color: "var(--text-primary)" }}>分類預算快覽</p>
                      <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>{currentMth} 各分類預算使用率</p>
                    </div>
                    <button onClick={() => setActiveTab("budget")}
                      className="text-[13px] px-3 py-1 rounded-lg transition-opacity hover:opacity-70"
                      style={{ background: "var(--bg-input)", color: "var(--text-sub)", border: "1px solid var(--border-inner)" }}>
                      管理預算 →
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                    {cats.map(b => {
                      const pct = Math.min((b.spent / b.amount) * 100, 100);
                      const over = b.spent > b.amount;
                      const near = !over && pct >= 80;
                      const barColor = over ? "#EF4444" : near ? "#F59E0B" : "#10B981";
                      const bgColor  = over ? "rgba(239,68,68,0.15)" : near ? "rgba(245,158,11,0.12)" : "rgba(16,185,129,0.12)";
                      return (
                        <div key={b.category}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[13px] font-semibold" style={{ color: over ? "#F87171" : near ? "#F59E0B" : "var(--text-sub)" }}>
                              {b.category}{over ? " 🚨" : near ? " ⚠️" : ""}
                            </span>
                            <span className="text-[12px] tabular-nums" style={{ color: "var(--text-muted)" }}>
                              {fmt(b.spent)} / {fmt(b.amount)}
                            </span>
                          </div>
                          <div className="h-2 rounded-full overflow-hidden" style={{ background: bgColor }}>
                            <div className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${over ? 100 : pct}%`, background: barColor }} />
                          </div>
                          {over && (
                            <p className="text-[11px] mt-0.5 text-right" style={{ color: "#F87171" }}>
                              超支 NT$ {fmt(b.spent - b.amount)}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* ── 儲蓄規劃摘要卡 ── */}
            {showCard("savings-summary") && (() => {
              // 讀取各計畫設定
              let gradPlan: { linkedGoalId?: string; tuition?: number; living?: number; duration?: number; monthlyStipend?: number; initialSavings?: number } | null = null;
              let efPlan:   { linkedGoalId?: string; targetMonths?: number; manualTarget?: number; initialSavings?: number } | null = null;
              let eduPlan:  { linkedGoalId?: string; augustAmount?: number; februaryAmount?: number; startYear?: number; startMonth?: number; totalPayments?: number; paidCount?: number } | null = null;
              try { gradPlan = JSON.parse(localStorage.getItem("grad_school_plan_v1") ?? "null"); } catch { /* ignore */ }
              try { efPlan   = JSON.parse(localStorage.getItem("emergency_fund_plan_v1")  ?? "null"); } catch { /* ignore */ }
              try { eduPlan  = JSON.parse(localStorage.getItem("education_program_plan_v1") ?? "null"); } catch { /* ignore */ }

              const recentMonths = (data?.monthly ?? []).slice(-3);
              const avgExp = recentMonths.length > 0 ? recentMonths.reduce((s, m) => s + m.expense, 0) / recentMonths.length : 0;

              // ── 緊急預備金 ──
              const efTargetMonths = efPlan?.targetMonths ?? 3;
              const efTarget = (efPlan?.manualTarget ?? 0) > 0 ? efPlan!.manualTarget! : efTargetMonths * avgExp;
              const efGoal = efPlan?.linkedGoalId ? goals.find(g => g.id === efPlan!.linkedGoalId) : null;
              const efSavings = efGoal?.linkedSource
                ? (balances.find(b => b.source === efGoal!.linkedSource)?.balance ?? efGoal.savedAmount)
                : (efGoal?.savedAmount ?? efPlan?.initialSavings ?? 0);
              const efCoverage = avgExp > 0 ? efSavings / avgExp : 0;
              const efPct = efTarget > 0 ? Math.min(100, (efSavings / efTarget) * 100) : 0;
              const efColor = efCoverage >= efTargetMonths ? "#10B981" : efCoverage >= 1 ? "#F59E0B" : "#EF4444";

              // ── 研究所 ──
              const ENROLL_YM = "2028-09";
              const ENROLLMENT = new Date(2028, 8, 1);
              const now = new Date();
              const monthsLeft = Math.max(0, Math.round((ENROLLMENT.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30)));
              const dur = gradPlan?.duration ?? 24;
              const netLiving = Math.max(0, (gradPlan?.living ?? 0) - (gradPlan?.monthlyStipend ?? 0));
              const loansDuringSchool = loansTimeline.reduce((s, l) => {
                if (!l.payoffDate || l.payoffDate < ENROLL_YM) return s;
                const [py, pm] = l.payoffDate.split("-").map(Number);
                return s + l.monthlyPrincipal * Math.max(0, Math.min(dur, (py - 2028) * 12 + (pm - 9)));
              }, 0);
              const gradTarget = gradPlan ? (gradPlan.tuition ?? 0) + netLiving * dur + loansDuringSchool : 0;
              const gradGoal = gradPlan?.linkedGoalId ? goals.find(g => g.id === gradPlan!.linkedGoalId) : null;
              const gradSavings = gradGoal?.linkedSource
                ? (balances.find(b => b.source === gradGoal!.linkedSource)?.balance ?? gradGoal.savedAmount)
                : (gradGoal?.savedAmount ?? gradPlan?.initialSavings ?? 0);
              const gradGap = Math.max(0, gradTarget - gradSavings);
              const gradPct = gradTarget > 0 ? Math.min(100, (gradSavings / gradTarget) * 100) : 0;
              const gradMonthlyNeed = monthsLeft > 0 ? gradGap / monthsLeft : 0;
              const gradOnTrack = gradSavings + gradMonthlyNeed * monthsLeft >= gradTarget;

              // ── 教育學程（下一筆）──
              const eduNextPayment = (() => {
                if (!eduPlan) return null;
                const startYear = eduPlan.startYear ?? now.getFullYear();
                const startMonth = eduPlan.startMonth ?? 8;
                const total = eduPlan.totalPayments ?? 4;
                const paid  = eduPlan.paidCount ?? 0;
                if (paid >= total) return null;
                const cursor = new Date(startYear, startMonth - 1, 1);
                for (let i = 0; i < total; i++) {
                  const m = cursor.getMonth() + 1;
                  const y = cursor.getFullYear();
                  const ma = Math.max(0, (y - now.getFullYear()) * 12 + (cursor.getMonth() - now.getMonth()));
                  if (i >= paid && ma >= 0) {
                    return { label: `${y}/${String(m).padStart(2,"0")}`, amount: m === 8 ? (eduPlan.augustAmount ?? 45000) : (eduPlan.februaryAmount ?? 45000), monthsAway: ma };
                  }
                  cursor.setMonth(cursor.getMonth() + 6);
                }
                return null;
              })();

              const hasAnyPlan = gradPlan || efPlan || eduPlan;
              if (!hasAnyPlan) return null;

              return (
                <div className="rounded-2xl p-5 relative overflow-hidden"
                  style={{ background: "var(--bg-card)", border: "1px solid rgba(99,102,241,0.25)", boxShadow: "0 0 24px rgba(99,102,241,0.06)", order: cardOrder.indexOf("savings-summary") }}>
                  <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
                    style={{ background: "linear-gradient(90deg, #10B981, #6366F1, #F59E0B)" }} />

                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-[15px] font-bold" style={{ color: "var(--text-primary)" }}>💰 儲蓄規劃</p>
                      <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                        緊急預備金 · 教育學程 · 研究所
                      </p>
                    </div>
                    <button onClick={() => setActiveTab("savings-plan")}
                      className="text-[13px] font-semibold px-3 py-1.5 rounded-xl transition-opacity hover:opacity-80"
                      style={{ background: "rgba(99,102,241,0.12)", color: "#818CF8", border: "1px solid rgba(99,102,241,0.25)" }}>
                      完整規劃 →
                    </button>
                  </div>

                  {/* 三目標橫列 */}
                  <div className="grid grid-cols-3 gap-3">
                    {/* 緊急預備金 */}
                    <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${efColor}25` }}>
                      <p className="text-[11px] font-semibold mb-1" style={{ color: efColor }}>🛡️ 緊急預備金</p>
                      <p className="text-[16px] font-black tabular-nums" style={{ color: efColor }}>
                        {efCoverage.toFixed(1)} 個月
                      </p>
                      <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                        目標 {efTargetMonths} 個月
                      </p>
                      <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <div className="h-full rounded-full" style={{ width: `${efPct}%`, background: efColor }} />
                      </div>
                    </div>

                    {/* 教育學程 */}
                    <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(245,158,11,0.25)" }}>
                      <p className="text-[11px] font-semibold mb-1" style={{ color: "#F59E0B" }}>📚 教育學程</p>
                      {eduNextPayment ? (
                        <>
                          <p className="text-[16px] font-black tabular-nums" style={{ color: "#F59E0B" }}>
                            NT$ {fmt(eduNextPayment.amount)}
                          </p>
                          <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                            {eduNextPayment.label} · {eduNextPayment.monthsAway} 個月後
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-[16px] font-black" style={{ color: "#10B981" }}>已繳清</p>
                          <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>無待繳款項</p>
                        </>
                      )}
                    </div>

                    {/* 研究所 */}
                    <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${gradOnTrack ? "rgba(16,185,129,0.25)" : "rgba(99,102,241,0.25)"}` }}>
                      <p className="text-[11px] font-semibold mb-1" style={{ color: "#818CF8" }}>🎓 研究所</p>
                      <p className="text-[16px] font-black tabular-nums" style={{ color: gradGap > 0 ? "#818CF8" : "#10B981" }}>
                        {gradGap > 0 ? `差 NT$ ${fmt(gradGap)}` : "✅ 足夠"}
                      </p>
                      <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {monthsLeft} 個月後入學
                      </p>
                      {gradTarget > 0 && (
                        <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                          <div className="h-full rounded-full" style={{ width: `${gradPct}%`, background: gradOnTrack ? "#10B981" : "#6366F1" }} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {showCard("net-worth") && <div style={{ order: cardOrder.indexOf("net-worth"), display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* Hero: 淨資產 */}
            <div className="rounded-2xl p-6 relative overflow-hidden" style={{
              background: "var(--hero-bg)",
              border: "1px solid var(--hero-border)",
              boxShadow: "0 0 40px rgba(37,99,235,0.12)",
            }}>
              <div className="absolute top-0 right-0 w-72 h-72 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)" }} />
              <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(96,165,250,0.06) 0%, transparent 70%)" }} />
              <p className="text-[14px] font-semibold tracking-[0.12em] uppercase mb-2 relative" style={{ color: "var(--accent-light)" }}>NET WORTH · 淨資產</p>
              <p className="text-[52px] font-black tracking-tight leading-none relative mb-5"
                style={{ color: nw < 0 ? "#F87171" : "#FFFFFF", textShadow: nw < 0 ? "0 0 24px rgba(248,113,113,0.35)" : "0 0 24px rgba(255,255,255,0.12)" }}>
                {nw < 0 ? "−" : ""}NT$ {fmt(nw)}
              </p>
              <div className="grid grid-cols-2 gap-3 relative sm:grid-cols-4">
                {[
                  { label: selectedMonth ? `${selectedMonth.slice(5)}月收入` : "本期收入", value: activeTotals?.income  ?? 0, pos: true  as boolean | null, tab: null as TabId | null },
                  { label: selectedMonth ? `${selectedMonth.slice(5)}月支出` : "本期支出", value: activeTotals?.expense ?? 0, pos: false as boolean | null, tab: null as TabId | null },
                  { label: "貸款餘額",   value: netWorth?.totalLoanDebt     ?? 0, pos: null as boolean | null, tab: "loans" as TabId | null },
                  { label: "信用卡未繳", value: netWorth?.totalCreditDebt   ?? 0, pos: null as boolean | null, tab: "loans" as TabId | null },
                ].map(item => {
                  const clickable = item.tab != null;
                  return (
                    <div key={item.label}
                      className="rounded-xl px-4 py-3"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", cursor: clickable ? "pointer" : "default", transition: "background 0.15s" }}
                      onClick={() => { if (item.tab) setActiveTab(item.tab); }}
                      onMouseEnter={e => { if (clickable) (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.08)"; }}
                      onMouseLeave={e => { if (clickable) (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.04)"; }}>
                      <p className="text-[14px] font-medium mb-1.5 tracking-wide flex items-center gap-1" style={{ color: "rgba(147,197,253,0.75)" }}>
                        {item.label}
                        {clickable && <span className="text-[11px] opacity-60">↗</span>}
                      </p>
                      <p className="text-[20px] font-bold" style={{ color: item.pos === true ? "#34D399" : item.pos === false ? "#F87171" : "rgba(255,255,255,0.75)" }}>
                        {item.pos === true ? "+" : item.pos === false ? "−" : ""}NT$ {fmt(item.value)}
                      </p>
                    </div>
                  );
                })}
              </div>
              {(netWorth?.monthlyInterest ?? 0) > 0 && (
                <p className="text-[14px] mt-4 relative" style={{ color: "rgba(147,197,253,0.7)" }}>
                  每月利息約 NT$ {fmt(netWorth!.monthlyInterest)} · 累計已繳利息 NT$ {fmt(netWorth!.totalInterestPaid)}
                </p>
              )}
            </div>

            {/* Bank balances */}
            {balances.length === 0 && (
              <div className="rounded-2xl p-6 text-center" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <p className="text-3xl mb-2">🏦</p>
                <p className="text-[15px] font-bold mb-1" style={{ color: "var(--text-primary)" }}>尚無帳戶餘額</p>
                <p className="text-[13px] mb-3" style={{ color: "var(--text-muted)" }}>匯入銀行 CSV 後帳戶餘額將自動顯示</p>
                <button onClick={() => setActiveTab("import")}
                  className="px-4 py-1.5 rounded-xl text-[13px] font-semibold text-white"
                  style={{ background: "var(--btn-gradient)" }}>
                  前往匯入 CSV →
                </button>
              </div>
            )}
            {balances.length > 0 && (() => {
              const ACCENT_COLORS = ["#4299E1","#10B981","#8B5CF6","#F59E0B","#EF4444","#06B6D4","#F97316","#22C55E"];
              return (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[15px] font-bold" style={{ color: "var(--text-primary)" }}>帳戶總覽</p>
                  <p className="text-[14px] tabular-nums" style={{ color: "var(--text-sub)" }}>
                    合計 NT$ {fmt(balances.reduce((s, b) => s + b.balance, 0))}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {balances.map((b, idx) => {
                    const accent      = b.source === "cash" ? "#22C55E" : ACCENT_COLORS[idx % ACCENT_COLORS.length];
                    const displayName = b.alias || (SOURCE_LABELS[b.source] ?? b.source);
                    const goalPct     = b.savingsGoal && b.savingsGoal > 0
                      ? Math.min((b.balance / b.savingsGoal) * 100, 100) : null;
                    const goalColor   = goalPct === null ? accent
                      : goalPct >= 100 ? "#10B981" : goalPct >= 60 ? "#F59E0B" : "#EF4444";
                    return (
                      <div key={b.source}
                        className="rounded-2xl p-4 relative overflow-hidden flex flex-col gap-2 group"
                        style={{ background: "var(--bg-card)", border: `1px solid ${accent}30`, boxShadow: "var(--card-shadow)" }}>
                        {/* 頂部彩色條 */}
                        <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style={{ background: accent }} />

                        {/* 銀行名稱（固定第一行）+ 編輯按鈕 */}
                        <div className="flex items-center justify-between gap-1 pt-1">
                          <span className="text-[14px] font-semibold px-2 py-0.5 rounded-full truncate"
                            style={{ background: `${accent}22`, color: accent }}>
                            {b.source === "cash" ? "現金錢包" : (SOURCE_LABELS[b.source] ?? b.source)}
                          </span>
                          <button
                            onClick={() => {
                              setBankEditSource(b.source);
                              setBankEditForm({ alias: b.alias ?? "", savingsGoal: b.savingsGoal ? String(b.savingsGoal) : "" });
                            }}
                            className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-lg flex items-center justify-center text-[14px]"
                            style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}
                            title="設定別名與目標">
                            ✎
                          </button>
                        </div>

                        {/* 別名（有設定才顯示） */}
                        {b.alias && (
                          <p className="text-[15px] font-bold truncate leading-tight" style={{ color: "var(--text-primary)" }}>
                            {b.alias}
                          </p>
                        )}

                        {/* 餘額 */}
                        <div>
                          <p className="text-[22px] font-black tabular-nums leading-none"
                            style={{ color: b.balance < 0 ? "#EF4444" : "var(--text-primary)" }}>
                            {b.balance < 0 ? "−" : ""}NT$ {fmt(b.balance)}
                          </p>
                          {(() => {
                            const linkedGoal = goals.find(g => g.linkedSource === b.source);
                            if (linkedGoal) {
                              return (
                                <p className="text-[14px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                                  🎯 {linkedGoal.name}（目標 NT$ {fmt(linkedGoal.targetAmount)}）
                                </p>
                              );
                            }
                            if (b.savingsGoal) {
                              return (
                                <p className="text-[14px] mt-0.5 tabular-nums" style={{ color: "var(--text-muted)" }}>
                                  目標 NT$ {fmt(b.savingsGoal)}
                                </p>
                              );
                            }
                            return (
                              <p className="text-[14px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                                {b.source === "cash" ? "提款累加・LINE 扣除" : "點擊 ✎ 設定目標"}
                              </p>
                            );
                          })()}
                        </div>

                        {/* 儲蓄目標進度條 */}
                        {goalPct !== null && (
                          <div>
                            <div className="flex justify-between text-[14px] mb-1">
                              <span style={{ color: "var(--text-muted)" }}>儲蓄進度</span>
                              <span className="tabular-nums font-semibold" style={{ color: goalColor }}>{goalPct.toFixed(0)}%</span>
                            </div>
                            <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-input)" }}>
                              <div className="h-full rounded-full transition-all duration-700"
                                style={{ width: `${goalPct}%`, background: `linear-gradient(90deg, ${goalColor}99, ${goalColor})` }} />
                            </div>
                            {b.savingsGoal && b.balance < b.savingsGoal && (
                              <p className="text-[14px] mt-1 tabular-nums" style={{ color: "var(--text-muted)" }}>
                                還差 NT$ {fmt(b.savingsGoal - b.balance)}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              );
            })()}
            </div>}

            {/* 別名 / 儲蓄目標 / 現金餘額 編輯 Modal */}
            {bankEditSource && (() => {
              const b = balances.find(x => x.source === bankEditSource);
              const isCash = bankEditSource === "cash";
              return (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                  style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
                  onClick={() => setBankEditSource(null)}>
                  <div className="w-full max-w-sm rounded-2xl overflow-hidden"
                    style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}
                    onClick={e => e.stopPropagation()}>
                    <div className="px-6 pt-5 pb-4 border-b" style={{ borderColor: "var(--border-inner)" }}>
                      <p className="font-bold text-[16px]" style={{ color: "var(--text-primary)" }}>
                        {b?.alias || SOURCE_LABELS[bankEditSource] || bankEditSource} 設定
                      </p>
                      <p className="text-[14px] mt-0.5" style={{ color: "var(--text-muted)" }}>別名・儲蓄目標{isCash ? "・現金餘額" : ""}</p>
                    </div>
                    <div className="px-6 py-5 space-y-4">
                      <div>
                        <label className="text-[14px] font-medium mb-1.5 block" style={{ color: "var(--text-sub)" }}>帳戶別名</label>
                        <input
                          className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                          style={{ background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                          placeholder="如「緊急備用金」「旅遊基金」（留空使用預設名稱）"
                          value={bankEditForm.alias}
                          onChange={e => setBankEditForm(f => ({ ...f, alias: e.target.value }))}
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className="text-[14px] font-medium mb-1.5 block" style={{ color: "var(--text-sub)" }}>儲蓄目標金額（選填）</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "var(--text-muted)" }}>NT$</span>
                          <input
                            type="number" min="0"
                            className="w-full rounded-xl pl-10 pr-3 py-2 text-sm outline-none"
                            style={{ background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                            placeholder="0"
                            value={bankEditForm.savingsGoal}
                            onWheel={e => e.currentTarget.blur()}
                            onChange={e => setBankEditForm(f => ({ ...f, savingsGoal: e.target.value }))}
                          />
                        </div>
                        {b && bankEditForm.savingsGoal && parseFloat(bankEditForm.savingsGoal) > 0 && (
                          <p className="text-[14px] mt-1.5 tabular-nums" style={{ color: "var(--text-muted)" }}>
                            目前達成率：{Math.min(Math.round((b.balance / parseFloat(bankEditForm.savingsGoal)) * 100), 100)}%
                            （NT$ {fmt(b.balance)} / {fmt(parseFloat(bankEditForm.savingsGoal))}）
                          </p>
                        )}
                      </div>
                      {isCash && (
                        <div>
                          <label className="text-[14px] font-medium mb-1.5 block" style={{ color: "var(--text-sub)" }}>現金餘額（直接設定錢包金額）</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "var(--text-muted)" }}>NT$</span>
                            <input
                              type="number" min="0"
                              className="w-full rounded-xl pl-10 pr-3 py-2 text-sm outline-none"
                              style={{ background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                              placeholder={String(b?.balance ?? 0)}
                              id="cash-balance-input"
                              onWheel={e => e.currentTarget.blur()}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="px-6 pb-5 flex gap-3">
                      <button onClick={() => setBankEditSource(null)}
                        className="flex-1 py-2.5 rounded-xl text-[14px] font-semibold"
                        style={{ border: "1px solid var(--border)", color: "var(--text-sub)" }}>
                        取消
                      </button>
                      <button
                        disabled={bankEditSaving}
                        onClick={async () => {
                          setBankEditSaving(true);
                          const cashInput = isCash
                            ? (document.getElementById("cash-balance-input") as HTMLInputElement)?.value
                            : null;
                          await fetch("/api/balances", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              source:      bankEditSource,
                              alias:       bankEditForm.alias.trim() || null,
                              savingsGoal: bankEditForm.savingsGoal ? parseFloat(bankEditForm.savingsGoal) : null,
                              ...(cashInput && !isNaN(parseFloat(cashInput)) && { balance: parseFloat(cashInput) }),
                            }),
                          });
                          await fetchData();
                          setBankEditSaving(false);
                          setBankEditSource(null);
                        }}
                        className="flex-1 py-2.5 rounded-xl text-[14px] font-bold transition-opacity"
                        style={{ background: "var(--accent)", color: "#fff", opacity: bankEditSaving ? 0.6 : 1 }}>
                        {bankEditSaving ? "儲存中…" : "儲存"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ── 當月 vs 上月對比卡 ── */}
            {showCard("month-compare") && data && prevMonthSummary && (() => {
              const cur  = data.totals;
              const prev = prevMonthSummary.totals;
              const expDiff    = cur.expense - prev.expense;
              const incDiff    = cur.income  - prev.income;
              const expDiffPct = prev.expense > 0 ? Math.round((expDiff / prev.expense) * 100) : null;
              const incDiffPct = prev.income  > 0 ? Math.round((incDiff / prev.income)  * 100) : null;
              const now = new Date();
              const curLabel  = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
              const prevDate  = new Date(now.getFullYear(), now.getMonth() - 1, 1);
              const prevLabel = `${prevDate.getFullYear()}-${String(prevDate.getMonth()+1).padStart(2,"0")}`;
              // Top 3 分類變化
              const curCats  = new Map(data.totals && data.byCategory.filter(c => c.type === "支出").map(c => [c.category, c.total]));
              const prevCats = new Map(prevMonthSummary.byCategory.filter(c => c.type === "支出").map(c => [c.category, c.total]));
              const allCats  = Array.from(new Set([...curCats.keys(), ...prevCats.keys()]));
              const catDiffs = allCats.map(cat => ({ cat, diff: (curCats.get(cat) ?? 0) - (prevCats.get(cat) ?? 0) }))
                .filter(x => Math.abs(x.diff) > 50)
                .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 3);
              return (
                <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", order: cardOrder.indexOf("month-compare") }}>
                  <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-inner)" }}>
                    <p className="text-[14px] font-bold" style={{ color: "var(--text-primary)" }}>📊 當月 vs 上月</p>
                    <div className="flex items-center gap-3">
                      <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>{curLabel} vs {prevLabel}</p>
                      <button onClick={() => setMonthCompareExpanded(o => !o)}
                        className="text-[12px] font-semibold px-2.5 py-1 rounded-lg transition-colors"
                        style={{ background: "var(--bg-input)", color: "var(--text-sub)", border: "1px solid var(--border-inner)" }}>
                        {monthCompareExpanded ? "收起 ▲" : "分類明細 ▼"}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 divide-x" style={{ borderColor: "var(--border-inner)" }}>
                    {[
                      { label: "支出", cur: cur.expense, prev: prev.expense, diff: expDiff, pct: expDiffPct, upBad: true  },
                      { label: "收入", cur: cur.income,  prev: prev.income,  diff: incDiff, pct: incDiffPct, upBad: false },
                    ].map(item => {
                      const up    = item.diff > 0;
                      const color = item.diff === 0 ? "var(--text-muted)" : (up === item.upBad ? "#EF4444" : "#10B981");
                      return (
                        <div key={item.label} className="px-5 py-4">
                          <p className="text-[12px] font-semibold mb-1" style={{ color: "var(--text-muted)" }}>{item.label}</p>
                          <p className="text-[20px] font-black tabular-nums" style={{ color: "var(--text-primary)" }}>NT$ {fmt(item.cur)}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[13px] font-bold tabular-nums" style={{ color }}>
                              {item.diff > 0 ? "▲" : item.diff < 0 ? "▼" : "─"} NT$ {fmt(Math.abs(item.diff))}
                            </span>
                            {item.pct !== null && (
                              <span className="text-[12px] font-semibold px-1.5 py-0.5 rounded" style={{ background: color + "18", color }}>
                                {item.pct > 0 ? "+" : ""}{item.pct}%
                              </span>
                            )}
                          </div>
                          <p className="text-[12px] mt-0.5 tabular-nums" style={{ color: "var(--text-muted)" }}>上月 NT$ {fmt(item.prev)}</p>
                        </div>
                      );
                    })}
                  </div>
                  {catDiffs.length > 0 && (
                    <div className="px-5 py-3 flex flex-wrap gap-2" style={{ borderTop: "1px solid var(--border-inner)" }}>
                      <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>支出變化：</span>
                      {catDiffs.map(({ cat, diff }) => {
                        const c = diff > 0 ? "#EF4444" : "#10B981";
                        return (
                          <span key={cat} className="text-[12px] font-semibold px-2 py-0.5 rounded-full" style={{ background: c + "15", color: c }}>
                            {cat} {diff > 0 ? "+" : "−"}NT${fmt(Math.abs(diff))}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  {/* 展開：全分類對比 BarChart */}
                  {monthCompareExpanded && (() => {
                    const chartData = allCats
                      .map(cat => ({ cat, 當月: curCats.get(cat) ?? 0, 上月: prevCats.get(cat) ?? 0 }))
                      .filter(d => d.當月 > 0 || d.上月 > 0)
                      .sort((a, b) => (b.當月 + b.上月) - (a.當月 + a.上月))
                      .slice(0, 10);
                    return (
                      <div className="px-5 pb-4 pt-3" style={{ borderTop: "1px solid var(--border-inner)" }}>
                        <p className="text-[13px] font-semibold mb-3" style={{ color: "var(--text-sub)" }}>支出分類對比（前 10 項）</p>
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={chartData} margin={{ top: 4, right: 4, left: -10, bottom: 40 }} barCategoryGap="30%">
                            <XAxis dataKey="cat" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} angle={-30} textAnchor="end" interval={0} />
                            <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                            <Tooltip formatter={(v: number, name: string) => [`NT$ ${fmt(v)}`, name]}
                              contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12, color: "var(--text-primary)" }} />
                            <Bar dataKey="當月" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="上月" fill="#64748B" radius={[4, 4, 0, 0]} />
                            <Legend wrapperStyle={{ fontSize: 12, color: "var(--text-muted)", paddingTop: 8 }} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    );
                  })()}
                </div>
              );
            })()}

            {data && <>
              {/* ── 財務健康評分（置頂摘要）── */}
              {showCard("health-score") && <div style={{ order: cardOrder.indexOf("health-score") }}>{(() => {
                const savingsRate = (data?.totals?.income ?? 0) > 0
                  ? ((data!.totals.income - data!.totals.expense) / data!.totals.income) * 100 : 0;
                const debtRatio = (netWorth?.totalAssets ?? 0) > 0
                  ? ((netWorth!.totalDebt) / netWorth!.totalAssets) * 100 : 0;
                const budgetAdherence = budgetOverview.length > 0
                  ? (budgetOverview.filter(b => b.amount > 0 && b.spent <= b.amount).length / budgetOverview.filter(b => b.amount > 0).length) * 100 : 100;
                const savingsScore  = savingsRate >= 30 ? 100 : savingsRate >= 20 ? 75 : savingsRate >= 10 ? 50 : savingsRate > 0 ? 25 : 0;
                const debtScore     = debtRatio  <= 20 ? 100 : debtRatio  <= 40 ? 75 : debtRatio  <= 60 ? 50 : 25;
                const budgetScore   = budgetAdherence >= 100 ? 100 : budgetAdherence >= 80 ? 75 : budgetAdherence >= 60 ? 50 : 25;
                const total = Math.round(savingsScore * 0.4 + debtScore * 0.3 + budgetScore * 0.3);
                const grade = total >= 80 ? { label: "優良", color: "#10B981" } : total >= 60 ? { label: "普通", color: "#F59E0B" } : total >= 40 ? { label: "待改善", color: "#F97316" } : { label: "需注意", color: "#EF4444" };
                const items = [
                  { label: "儲蓄率", score: savingsScore, detail: `${savingsRate.toFixed(0)}%`, weight: "40%" },
                  { label: "負債比",  score: debtScore,    detail: debtRatio > 100 ? `${(debtRatio / 100).toFixed(1)}x` : `${debtRatio.toFixed(0)}%`, weight: "30%" },
                  { label: "預算達成",score: budgetScore,  detail: `${budgetAdherence.toFixed(0)}%`, weight: "30%" },
                ];
                const currentPayload: HealthSnapshot = {
                  month: currentMonth, score: total,
                  savingsScore, debtScore, budgetScore,
                  savingsRate, debtRatio, budgetAdherence,
                };
                return (
                  <Card className="p-5">
                    <div className="flex items-center gap-5">
                      {/* Score circle */}
                      <div className="flex-shrink-0 text-center w-20">
                        <AnimatedScore target={total} color={grade.color} />
                        <p className="text-[14px] font-bold mt-0.5 px-2 py-0.5 rounded-full inline-block" style={{ color: grade.color, background: grade.color + "18" }}>{grade.label}</p>
                        <p className="text-[14px] mt-1" style={{ color: "var(--text-muted)" }}>財務健康評分</p>
                      </div>
                      {/* Score bars */}
                      <div className="flex-1 space-y-2.5">
                        {items.map(it => {
                          const c = it.score >= 75 ? "#10B981" : it.score >= 50 ? "#F59E0B" : "#EF4444";
                          return (
                            <div key={it.label}>
                              <div className="flex justify-between text-[14px] mb-1">
                                <span style={{ color: "var(--text-sub)" }}>{it.label}<span className="ml-1" style={{ color: "var(--text-muted)" }}>·{it.weight}</span></span>
                                <span className="tabular-nums font-bold" style={{ color: c }}>{it.detail}</span>
                              </div>
                              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-input)" }}>
                                <AnimatedBar pct={it.score} color={c} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Trend chart */}
                    {healthSnapshots.length > 0 && (() => {
                      const chartData = healthSnapshots.map(s => ({
                        month: s.month.slice(5),
                        score: s.score,
                        儲蓄率: s.savingsScore,
                        負債比: s.debtScore,
                        預算達成: s.budgetScore,
                      }));
                      return (
                        <div className="mt-5 pt-4" style={{ borderTop: "1px solid var(--border-inner)" }}>
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-[14px] font-semibold" style={{ color: "var(--text-sub)" }}>
                              健康評分趨勢
                              <span className="ml-2 font-normal" style={{ color: "var(--text-muted)" }}>{healthSnapshots.length} 個月記錄</span>
                            </p>
                            <button
                              onClick={() => saveHealthSnapshot(currentPayload)}
                              disabled={healthSaving || isDemo.current}
                              className="text-[14px] font-semibold px-3 py-1 rounded-lg transition-opacity hover:opacity-70 disabled:opacity-40"
                              style={{ background: "var(--bg-input)", border: "1px solid var(--border-inner)", color: "var(--text-sub)" }}>
                              {healthSaving ? "記錄中…" : `📌 記錄 ${currentMonth}`}
                            </button>
                          </div>
                          <ResponsiveContainer width="100%" height={140}>
                            <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                              <Tooltip
                                contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12, color: "var(--text-primary)" }}
                                formatter={(v: number, name: string) => [`${v} 分`, name]}
                              />
                              <ReferenceLine y={80} stroke="#10B981" strokeDasharray="3 3" strokeOpacity={0.4} />
                              <ReferenceLine y={60} stroke="#F59E0B" strokeDasharray="3 3" strokeOpacity={0.4} />
                              <ReferenceLine y={40} stroke="#F97316" strokeDasharray="3 3" strokeOpacity={0.4} />
                              <Line dataKey="score" name="總分" stroke={grade.color} strokeWidth={2.5} dot={{ r: 3, fill: grade.color }} activeDot={{ r: 5 }} />
                              <Line dataKey="儲蓄率" stroke="#3B82F6" strokeWidth={1} strokeDasharray="4 2" dot={false} />
                              <Line dataKey="負債比" stroke="#8B5CF6" strokeWidth={1} strokeDasharray="4 2" dot={false} />
                              <Line dataKey="預算達成" stroke="#F59E0B" strokeWidth={1} strokeDasharray="4 2" dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                          <p className="text-[14px] mt-1 text-right" style={{ color: "var(--text-muted)" }}>虛線：各維度分數（儲蓄率 / 負債比 / 預算達成）</p>
                        </div>
                      );
                    })()}

                    {/* No snapshots yet — show record prompt */}
                    {healthSnapshots.length === 0 && (
                      <div className="mt-4 pt-4 flex items-center justify-between" style={{ borderTop: "1px solid var(--border-inner)" }}>
                        <p className="text-[14px]" style={{ color: "var(--text-muted)" }}>記錄每月評分，即可追蹤健康趨勢</p>
                        <button
                          onClick={() => saveHealthSnapshot(currentPayload)}
                          disabled={healthSaving || isDemo.current}
                          className="text-[14px] font-semibold px-3 py-1 rounded-lg transition-opacity hover:opacity-70 disabled:opacity-40"
                          style={{ background: "var(--bg-input)", border: "1px solid var(--border-inner)", color: "var(--text-sub)" }}>
                          {healthSaving ? "記錄中…" : `📌 記錄 ${currentMonth}`}
                        </button>
                      </div>
                    )}
                  </Card>
                );
              })()}</div>}

              {showCard("trend") && <div style={{ order: cardOrder.indexOf("trend"), display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <SectionLabel label="趨勢追蹤" />
              {/* ── 月份選擇器 ── */}
              {data.monthly.length > 1 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[14px] font-medium flex-shrink-0" style={{ color: "var(--text-sub)" }}>篩選月份：</span>
                  <button onClick={() => { setSelectedMonth(null); setMonthDetail(null); }}
                    className="text-[14px] px-3 py-1 rounded-md font-medium transition-colors"
                    style={{ background: !selectedMonth ? "var(--accent)" : "var(--bg-input)", color: !selectedMonth ? "#fff" : "var(--text-sub)", border: !selectedMonth ? "1px solid var(--accent)" : "1px solid var(--border-inner)" }}>
                    全部
                  </button>
                  {[...data.monthly].reverse().map(m => (
                    <button key={m.month} onClick={() => { setSelectedMonth(m.month); fetchMonthDetail(m.month); }}
                      className="text-[14px] px-3 py-1 rounded-md font-medium transition-colors"
                      style={{ background: selectedMonth === m.month ? "var(--accent)" : "var(--bg-input)", color: selectedMonth === m.month ? "#fff" : "var(--text-sub)", border: selectedMonth === m.month ? "1px solid var(--accent)" : "1px solid var(--border-inner)" }}>
                      {m.month.slice(5)} 月
                    </button>
                  ))}
                  {monthDetailLoading && <span className="text-[14px] ml-1" style={{ color: "var(--text-muted)" }}>載入中…</span>}
                </div>
              )}

              {/* 月份篩選中提示 */}
              {selectedMonth && (
                <div className="flex items-center gap-2 rounded-xl px-4 py-2.5"
                  style={{ background: "rgba(66,153,225,0.1)", border: "1px solid rgba(66,153,225,0.3)" }}>
                  <span className="text-[14px]" style={{ color: "var(--accent-light)" }}>
                    📅 目前篩選：{selectedMonth.slice(0,4)} 年 {selectedMonth.slice(5)} 月　—　下方分類圖表與統計已套用此月份
                  </span>
                  <button onClick={() => { setSelectedMonth(null); setMonthDetail(null); }}
                    className="ml-auto text-[14px] px-2 py-0.5 rounded-md transition-opacity hover:opacity-70 flex-shrink-0"
                    style={{ color: "var(--accent-light)", border: "1px solid rgba(66,153,225,0.4)" }}>
                    清除
                  </button>
                </div>
              )}

              {/* Chart 1: 收支趨勢 Area */}
              <Card className="p-6">
                <p className="text-[16px] font-bold text-[var(--text-primary)] mb-0.5">收支趨勢</p>
                <p className="text-[14px] mb-5" style={{ color: "var(--text-sub)" }}>近 {months} 個月收入 vs 支出（總覽，不受月份篩選影響）</p>
                {data.monthly.length > 0 ? (
                  <ResponsiveContainer width="100%" height={230}>
                    <AreaChart data={data.monthly} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gIncome"  x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#10B981" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gExpense" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#EF4444" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="month" tick={{ fontSize: 12, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} tickFormatter={v => v.slice(5)} />
                      <YAxis tick={{ fontSize: 12, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="income"  name="收入" stroke="#10B981" strokeWidth={2.5} fill="url(#gIncome)"  dot={false} activeDot={{ r: 5, fill: "#10B981", strokeWidth: 0 }} />
                      <Area type="monotone" dataKey="expense" name="支出" stroke="#EF4444" strokeWidth={2.5} fill="url(#gExpense)" dot={false} activeDot={{ r: 5, fill: "#EF4444", strokeWidth: 0 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="py-14 flex flex-col items-center gap-2">
                    <p className="text-3xl">📊</p>
                    <p className="text-[14px] font-semibold" style={{ color: "var(--text-sub)" }}>尚無收支資料</p>
                    <p className="text-[14px]" style={{ color: "var(--text-muted)" }}>匯入交易資料後圖表將自動顯示</p>
                    <button onClick={() => setActiveTab("import")} className="mt-2 px-4 py-1.5 rounded-xl text-[14px] font-semibold text-white" style={{ background: "var(--btn-gradient)" }}>匯入資料 →</button>
                  </div>
                )}
                <div className="flex gap-5 mt-3">
                  {[{ color: "#10B981", label: "收入" }, { color: "#EF4444", label: "支出" }].map(l => (
                    <div key={l.label} className="flex items-center gap-2">
                      <span className="w-4 h-[3px] rounded-full" style={{ backgroundColor: l.color }} />
                      <span className="text-[14px]" style={{ color: "var(--text-sub)" }}>{l.label}</span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* ── 淨資產趨勢圖 ── */}
              {netWorth && (() => {
                // 優先使用真實快照；不足時用推估補齊
                const estimatedMonths = [...data.monthly].sort((a, b) => a.month.localeCompare(b.month));
                const estimated: { month: string; netWorth: number }[] = [];
                let running = netWorth.netWorth;
                for (let i = estimatedMonths.length - 1; i >= 0; i--) {
                  estimated.unshift({ month: estimatedMonths[i].month, netWorth: Math.round(running) });
                  running -= (estimatedMonths[i].income - estimatedMonths[i].expense);
                }
                // merge: real snapshots override estimated for same month
                const snapshotMap = new Map(nwSnapshots.map(s => [s.month, s.netWorth]));
                const history = estimated.map(e => ({
                  month:    e.month,
                  netWorth: snapshotMap.has(e.month) ? snapshotMap.get(e.month)! : e.month === currentMonth ? netWorth.netWorth : e.netWorth,
                  real:     snapshotMap.has(e.month),
                }));
                // also include snapshot months outside the estimated window
                for (const s of nwSnapshots) {
                  if (!history.find(h => h.month === s.month)) {
                    history.push({ month: s.month, netWorth: s.netWorth, real: true });
                  }
                }
                history.sort((a, b) => a.month.localeCompare(b.month));
                if (history.length < 2) return null;
                const minVal    = Math.min(...history.map(h => h.netWorth));
                const maxVal    = Math.max(...history.map(h => h.netWorth));
                const pad       = Math.max(Math.abs(maxVal - minVal) * 0.12, Math.abs(minVal) * 0.05, 10000);
                const domainMin = Math.round(minVal - pad);
                const domainMax = Math.round(maxVal + pad);
                const isGrowing = history[history.length - 1].netWorth >= history[0].netWorth;
                const hasRealData = nwSnapshots.length > 0;
                return (
                  <Card className="p-6">
                    <div className="flex items-start justify-between mb-0.5">
                      <p className="text-[16px] font-bold text-[var(--text-primary)]">淨資產趨勢</p>
                      <button onClick={saveNwSnapshot} disabled={snapshotSaving || isDemo.current}
                        className="text-[14px] font-semibold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80 disabled:opacity-40"
                        style={{ background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--accent-light)" }}>
                        {snapshotSaving ? "記錄中…" : `📌 記錄 ${currentMonth}`}
                      </button>
                    </div>
                    <p className="text-[14px] mb-5" style={{ color: "var(--text-sub)" }}>
                      {hasRealData ? `${nwSnapshots.length} 筆真實快照 + 推估補齊` : `近 ${history.length} 個月淨資產變化（推估）`}
                    </p>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={history} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="gNetWorth" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor={isGrowing ? "#10B981" : "#EF4444"} stopOpacity={0.2} />
                            <stop offset="95%" stopColor={isGrowing ? "#10B981" : "#EF4444"} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="month" tick={{ fontSize: 12, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} tickFormatter={v => v.slice(5)} />
                        <YAxis domain={[domainMin, domainMax]} tick={{ fontSize: 12, fill: "var(--text-muted)" }} axisLine={false} tickLine={false}
                          tickFormatter={(v: number) => {
                            const abs = Math.abs(v);
                            const str = abs >= 10000 ? `${(abs/10000).toFixed(0)}萬` : abs >= 1000 ? `${(abs/1000).toFixed(0)}k` : String(abs);
                            return v < 0 ? `-${str}` : str;
                          }} />
                        <Tooltip content={<ChartTooltip />} />
                        <Line type="monotone" dataKey="netWorth" name="淨資產"
                          stroke={isGrowing ? "#10B981" : "#EF4444"} strokeWidth={2.5}
                          dot={{ r: 4, fill: isGrowing ? "#10B981" : "#EF4444", strokeWidth: 0 }}
                          activeDot={{ r: 6, strokeWidth: 0 }} />
                      </LineChart>
                    </ResponsiveContainer>
                    <p className="text-[14px] mt-2" style={{ color: "var(--text-muted)" }}>
                      📌 = 已記錄快照（精確）　空心 = 推估值　點擊「記錄」可把今月存入歷史
                    </p>
                  </Card>
                );
              })()}

              {/* ── 儲蓄率走勢圖 ── */}
              {data.monthly.length >= 2 && (() => {
                const savingsData = data.monthly
                  .filter(m => m.income > 0)
                  .map(m => ({
                    month: m.month,
                    rate: Math.round(((m.income - m.expense) / m.income) * 100),
                  }));
                const subtitle = "每月 (收入－支出) ÷ 收入";
                if (savingsData.length < 2) return null;
                const avg = Math.round(savingsData.reduce((s, d) => s + d.rate, 0) / savingsData.length);
                const latest = savingsData[savingsData.length - 1].rate;
                const rateColor = latest >= 30 ? "#10B981" : latest >= 10 ? "#F59E0B" : "#EF4444";
                return (
                  <Card className="p-6">
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <p className="text-[16px] font-bold text-[var(--text-primary)]">儲蓄率走勢</p>
                        <p className="text-[14px] mt-0.5" style={{ color: "var(--text-sub)" }}>{subtitle}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[22px] font-black tabular-nums" style={{ color: rateColor }}>{latest}%</p>
                        <p className="text-[14px]" style={{ color: "var(--text-muted)" }}>本期 · 近期均值 {avg}%</p>
                      </div>
                    </div>
                    <div className="mb-5">
                      <div className="h-1.5 rounded-full overflow-hidden mt-3" style={{ background: "var(--bg-input)" }}>
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${Math.min(Math.max(latest, 0), 100)}%`, background: rateColor }} />
                      </div>
                      <div className="flex justify-between text-[14px] mt-1" style={{ color: "var(--text-muted)" }}>
                        <span>0%</span><span>目標 30%</span><span>100%</span>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={180}>
                      <AreaChart data={savingsData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="gSavings" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor={rateColor} stopOpacity={0.25} />
                            <stop offset="95%" stopColor={rateColor} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="month" tick={{ fontSize: 12, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} tickFormatter={v => v.slice(5)} />
                        <YAxis tick={{ fontSize: 12, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}%`} />
                        <Tooltip formatter={(v: number) => [`${v}%`, "儲蓄率"]}
                          contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12, color: "var(--text-primary)" }} />
                        <Area type="monotone" dataKey="rate" name="儲蓄率" stroke={rateColor} strokeWidth={2.5}
                          fill="url(#gSavings)" dot={{ r: 4, fill: rateColor, strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 0 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                    <p className="text-[14px] mt-2" style={{ color: "var(--text-muted)" }}>
                      ≥30% 健康　10–30% 普通　&lt;10% 偏低
                    </p>
                  </Card>
                );
              })()}

              </div>}

              {showCard("goals") && <div style={{ order: cardOrder.indexOf("goals"), display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <SectionLabel label="目標規劃" />
              {/* ── 財務目標追蹤 ── */}
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-[16px] font-bold text-[var(--text-primary)]">財務目標</p>
                    <p className="text-[14px] mt-0.5" style={{ color: "var(--text-sub)" }}>追蹤你的儲蓄與消費目標進度</p>
                  </div>
                  <button onClick={() => { setGoalForm({ name: "", emoji: "🎯", targetAmount: "", savedAmount: "", linkedSource: "", deadline: "", note: "" }); setGoalModal("add"); }}
                    className="px-3 py-1.5 rounded-xl text-[14px] font-semibold text-white"
                    style={{ background: "var(--btn-gradient)" }}>+ 新增目標</button>
                </div>
                {goals.length === 0 ? (
                  <div className="rounded-2xl py-10 text-center" style={{ background: "var(--bg-input)", border: "1px dashed var(--border)" }}>
                    <p className="text-3xl mb-2">🎯</p>
                    <p className="text-[14px] font-semibold" style={{ color: "var(--text-sub)" }}>尚無財務目標</p>
                    <p className="text-[14px] mt-1" style={{ color: "var(--text-muted)" }}>點擊「新增目標」設定你的第一個目標</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {goals.map(g => {
                      const effectiveSaved = g.linkedSource
                        ? (balances.find(b => b.source === g.linkedSource)?.balance ?? g.savedAmount)
                        : g.savedAmount;
                      const pct      = g.targetAmount > 0 ? Math.min((effectiveSaved / g.targetAmount) * 100, 100) : 0;
                      const pctColor = pct >= 100 ? "#10B981" : pct >= 60 ? "#3B82F6" : pct >= 30 ? "#F59E0B" : "#94A3B8";
                      const daysLeft = g.deadline ? Math.ceil((new Date(g.deadline).getTime() - Date.now()) / 86400000) : null;
                      const deadlineColor = daysLeft === null ? "var(--text-muted)" : daysLeft < 0 ? "#EF4444" : daysLeft <= 30 ? "#F59E0B" : "var(--text-muted)";
                      return (
                        <div key={g.id} className="rounded-2xl p-4 group relative"
                          style={{ background: "var(--bg-input)", border: `1px solid ${pctColor}25` }}>
                          <div className="flex items-start gap-3">
                            <span className="text-2xl flex-shrink-0 mt-0.5">{g.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <p className="text-[14px] font-bold truncate" style={{ color: "var(--text-primary)" }}>{g.name}</p>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                  <button onClick={() => { setGoalForm({ name: g.name, emoji: g.emoji, targetAmount: String(g.targetAmount), savedAmount: String(g.savedAmount), linkedSource: g.linkedSource ?? "", deadline: g.deadline ?? "", note: g.note }); setGoalModal(g); }}
                                    className="w-6 h-6 rounded-lg flex items-center justify-center text-[14px]"
                                    style={{ background: "var(--bg-card)", color: "var(--text-muted)" }}>✎</button>
                                  <button onClick={() => deleteGoal(g.id)}
                                    className="w-6 h-6 rounded-lg flex items-center justify-center text-[14px]"
                                    style={{ background: "var(--bg-card)", color: "#EF4444" }}>✕</button>
                                </div>
                              </div>
                              <div className="flex items-center justify-between text-[14px] mb-2">
                                <span className="tabular-nums font-semibold" style={{ color: pctColor }}>
                                  NT$ {fmt(effectiveSaved)} <span style={{ color: "var(--text-muted)" }}>/ NT$ {fmt(g.targetAmount)}</span>
                                </span>
                                <span className="tabular-nums font-bold" style={{ color: pctColor }}>{pct.toFixed(0)}%</span>
                              </div>
                              <div className="h-2 rounded-full overflow-hidden mb-1.5" style={{ background: "var(--bg-card)" }}>
                                <div className="h-full rounded-full transition-all duration-700"
                                  style={{ width: `${pct}%`, background: `linear-gradient(90deg,${pctColor}99,${pctColor})` }} />
                              </div>
                              <div className="flex items-center justify-between text-[14px]">
                                <span style={{ color: "var(--text-muted)" }}>
                                  {g.linkedSource
                                    ? <span>🔗 {SOURCE_LABELS[g.linkedSource] ?? g.linkedSource}{g.note ? ` · ${g.note}` : ""}</span>
                                    : g.note || ""}
                                </span>
                                {daysLeft !== null && (
                                  <span className="tabular-nums" style={{ color: deadlineColor }}>
                                    {daysLeft < 0 ? `逾期 ${Math.abs(daysLeft)} 天` : daysLeft === 0 ? "今天截止" : `${daysLeft} 天後`} · {g.deadline}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              {/* Goal Modal */}
              {goalModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                  style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
                  onClick={() => setGoalModal(null)}>
                  <div className="w-full max-w-sm rounded-2xl overflow-hidden"
                    style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}
                    onClick={e => e.stopPropagation()}>
                    <div className="px-6 pt-5 pb-4 border-b" style={{ borderColor: "var(--border-inner)" }}>
                      <p className="font-bold text-[16px]" style={{ color: "var(--text-primary)" }}>
                        {goalModal === "add" ? "新增財務目標" : "編輯目標"}
                      </p>
                    </div>
                    <div className="px-6 py-5 space-y-4">
                      <div className="flex gap-3">
                        <div>
                          <label className="text-[14px] font-medium mb-1.5 block" style={{ color: "var(--text-sub)" }}>圖示</label>
                          <input value={goalForm.emoji} onChange={e => setGoalForm(f => ({ ...f, emoji: e.target.value }))}
                            className="w-16 text-center rounded-xl px-2 py-2 text-[20px] outline-none"
                            style={{ background: "var(--bg-input)", border: "1px solid var(--border)" }} />
                        </div>
                        <div className="flex-1">
                          <label className="text-[14px] font-medium mb-1.5 block" style={{ color: "var(--text-sub)" }}>目標名稱 *</label>
                          <input value={goalForm.name} onChange={e => setGoalForm(f => ({ ...f, name: e.target.value }))}
                            placeholder="如：旅遊基金、換新車" autoFocus
                            className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                            style={{ background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                        </div>
                      </div>
                      <div>
                        <label className="text-[14px] font-medium mb-1.5 block" style={{ color: "var(--text-sub)" }}>目標金額 *</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "var(--text-muted)" }}>NT$</span>
                          <input type="number" min="0" placeholder="50000"
                            value={goalForm.targetAmount}
                            onChange={e => setGoalForm(f => ({ ...f, targetAmount: e.target.value }))}
                            onWheel={e => e.currentTarget.blur()}
                            className="w-full rounded-xl pl-10 pr-3 py-2 text-sm outline-none"
                            style={{ background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                        </div>
                      </div>
                      <div>
                        <label className="text-[14px] font-medium mb-1.5 block" style={{ color: "var(--text-sub)" }}>連結帳戶（選填）</label>
                        <select value={goalForm.linkedSource}
                          onChange={e => setGoalForm(f => ({ ...f, linkedSource: e.target.value }))}
                          className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                          style={{ background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                          <option value="" style={{ background: "var(--bg-card)" }}>不連結（手動輸入）</option>
                          {balances.filter(b => BANK_SOURCES.has(b.source) && b.balance >= 0).map(b => (
                            <option key={b.source} value={b.source} style={{ background: "var(--bg-card)" }}>
                              {SOURCE_LABELS[b.source] ?? b.source}{b.alias ? ` — ${b.alias}` : ""}（NT$ {fmt(b.balance)}）
                            </option>
                          ))}
                        </select>
                        {goalForm.linkedSource && (
                          <p className="text-[14px] mt-1" style={{ color: "var(--text-muted)" }}>
                            已存金額將自動同步帳戶餘額，無需手動更新
                          </p>
                        )}
                      </div>
                      {!goalForm.linkedSource && (
                        <div>
                          <label className="text-[14px] font-medium mb-1.5 block" style={{ color: "var(--text-sub)" }}>目前已存</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "var(--text-muted)" }}>NT$</span>
                            <input type="number" min="0" placeholder="0"
                              value={goalForm.savedAmount}
                              onChange={e => setGoalForm(f => ({ ...f, savedAmount: e.target.value }))}
                              onWheel={e => e.currentTarget.blur()}
                              className="w-full rounded-xl pl-10 pr-3 py-2 text-sm outline-none"
                              style={{ background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                          </div>
                        </div>
                      )}
                      <div>
                        <label className="text-[14px] font-medium mb-1.5 block" style={{ color: "var(--text-sub)" }}>目標日期（選填）</label>
                        <input type="date" value={goalForm.deadline} onChange={e => setGoalForm(f => ({ ...f, deadline: e.target.value }))}
                          className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                          style={{ background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                      </div>
                      <div>
                        <label className="text-[14px] font-medium mb-1.5 block" style={{ color: "var(--text-sub)" }}>備註（選填）</label>
                        <input value={goalForm.note} onChange={e => setGoalForm(f => ({ ...f, note: e.target.value }))}
                          placeholder="補充說明"
                          className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                          style={{ background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                      </div>
                    </div>
                    <div className="px-6 pb-6 flex gap-3">
                      <button onClick={() => setGoalModal(null)}
                        className="flex-1 py-2.5 rounded-xl text-[14px] font-semibold"
                        style={{ border: "1px solid var(--border)", color: "var(--text-sub)" }}>取消</button>
                      <button onClick={saveGoal} disabled={goalSaving || !goalForm.name || !goalForm.targetAmount}
                        className="flex-1 py-2.5 rounded-xl text-[14px] font-bold text-white disabled:opacity-40"
                        style={{ background: "var(--btn-gradient)" }}>
                        {goalSaving ? "儲存中…" : "儲存"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── 同月去年比較 ── */}
              {yoyData && (() => {
                const { cur, prev, curMonth, prevMonth } = yoyData;
                const cats = Array.from(new Set([
                  ...cur.byCategory.filter(c => c.type === "支出").map(c => c.category),
                  ...prev.byCategory.filter(c => c.type === "支出").map(c => c.category),
                ]));
                const chartData = cats.map(cat => ({
                  category: cat,
                  今年: cur.byCategory.find(c => c.category === cat && c.type === "支出")?.total ?? 0,
                  去年: prev.byCategory.find(c => c.category === cat && c.type === "支出")?.total ?? 0,
                })).filter(d => d.今年 > 0 || d.去年 > 0)
                  .sort((a, b) => (b.今年 + b.去年) - (a.今年 + a.去年)).slice(0, 10);

                const expDiff = cur.totals.expense - prev.totals.expense;
                const expDiffPct = prev.totals.expense > 0
                  ? Math.round((expDiff / prev.totals.expense) * 100) : null;
                const diffColor = expDiff > 0 ? "#EF4444" : "#10B981";

                if (chartData.length === 0 && prev.totals.expense === 0) return null;
                return (
                  <Card className="p-6">
                    <div className="flex items-start justify-between mb-4 gap-4">
                      <div>
                        <p className="text-[16px] font-bold text-[var(--text-primary)] mb-0.5">同月去年比較</p>
                        <p className="text-[14px]" style={{ color: "var(--text-sub)" }}>
                          {curMonth.slice(0,4)}年{parseInt(curMonth.slice(5))}月 vs {prevMonth.slice(0,4)}年{parseInt(prevMonth.slice(5))}月
                        </p>
                      </div>
                      {expDiffPct !== null && (
                        <div className="text-right flex-shrink-0">
                          <p className="text-[20px] font-black tabular-nums" style={{ color: diffColor }}>
                            {expDiff > 0 ? "▲" : "▼"} {Math.abs(expDiffPct)}%
                          </p>
                          <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>支出年增率</p>
                        </div>
                      )}
                    </div>

                    {/* 收支概覽並排 */}
                    <div className="grid grid-cols-2 gap-3 mb-5">
                      {[
                        { label: `今年 ${parseInt(curMonth.slice(5))}月`, d: cur, color: "#6366F1" },
                        { label: `去年 ${parseInt(prevMonth.slice(5))}月`, d: prev, color: "#94A3B8" },
                      ].map(({ label, d, color }) => (
                        <div key={label} className="rounded-xl px-4 py-3" style={{ background: "var(--bg-input)", border: `1px solid ${color}30` }}>
                          <p className="text-[13px] font-semibold mb-1.5" style={{ color }}>{label}</p>
                          <p className="text-[17px] font-black tabular-nums" style={{ color: "#F87171" }}>−NT$ {fmt(d.totals.expense)}</p>
                          <p className="text-[13px] tabular-nums mt-0.5" style={{ color: "#34D399" }}>+NT$ {fmt(d.totals.income)}</p>
                          <p className="text-[12px] tabular-nums mt-0.5" style={{ color: d.totals.net >= 0 ? "#34D399" : "#F87171" }}>
                            結餘 {d.totals.net >= 0 ? "+" : ""}NT$ {fmt(d.totals.net)}
                          </p>
                        </div>
                      ))}
                    </div>

                    {chartData.length > 0 && (
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 40 }}>
                          <XAxis dataKey="category" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} angle={-30} textAnchor="end" interval={0} />
                          <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false}
                            tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                          <Tooltip formatter={(v: number) => [`NT$ ${fmt(v)}`, undefined]}
                            contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 12 }} />
                          <Legend wrapperStyle={{ fontSize: 12, color: "var(--text-sub)", paddingTop: 8 }} />
                          <Bar dataKey="今年" fill="#6366F1" radius={[4,4,0,0]} maxBarSize={20} />
                          <Bar dataKey="去年" fill="#94A3B8" radius={[4,4,0,0]} maxBarSize={20} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                    {chartData.length === 0 && (
                      <p className="text-center py-6 text-[14px]" style={{ color: "var(--text-muted)" }}>去年同月尚無支出資料</p>
                    )}
                  </Card>
                );
              })()}

              {/* ── 週消費分佈 ── */}
              {weekdayTxs.length > 0 && (() => {
                const DAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];
                const buckets = Array.from({ length: 7 }, (_, i) => ({ day: DAY_LABELS[i], total: 0, count: 0 }));
                for (const tx of weekdayTxs) {
                  if (tx.type !== "支出") continue;
                  const d = new Date(tx.date).getDay();
                  buckets[d].total += tx.amount;
                  buckets[d].count += 1;
                }
                const maxVal = Math.max(...buckets.map(b => b.total));
                return (
                  <Card className="p-6">
                    <p className="text-[16px] font-bold text-[var(--text-primary)] mb-0.5">週消費分佈</p>
                    <p className="text-[14px] mb-5" style={{ color: "var(--text-sub)" }}>哪天最容易花錢（依近期交易統計）</p>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={buckets} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                        <XAxis dataKey="day" tick={{ fontSize: 13, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                        <Tooltip formatter={(v: number) => [`NT$ ${fmt(v)}`, "支出合計"]}
                          contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 12 }} />
                        <Bar dataKey="total" radius={[6,6,0,0]} maxBarSize={40}>
                          {buckets.map((b, i) => (
                            <Cell key={i} fill={b.total === maxVal ? "#EF4444" : b.total >= maxVal * 0.7 ? "#F59E0B" : "var(--accent)"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="flex justify-between text-[14px] mt-2 px-1" style={{ color: "var(--text-muted)" }}>
                      {buckets.map(b => (
                        <span key={b.day} className="text-center w-8">{b.count > 0 ? `${b.count}筆` : ""}</span>
                      ))}
                    </div>
                  </Card>
                );
              })()}

              {/* ── 收支日曆 / 消費熱力圖（可折疊，雙視圖）── */}
              <div>
                <button
                  onClick={() => setCalendarOpen(o => !o)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-opacity hover:opacity-80"
                  style={{ background: "var(--bg-card)", border: "1px solid var(--border-inner)" }}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{calendarView === "heatmap" ? "🔥" : "📅"}</span>
                    <span className="text-[15px] font-bold" style={{ color: "var(--text-primary)" }}>
                      {calendarView === "heatmap" ? "消費熱力圖" : "收支日曆"}
                    </span>
                    <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>
                      {calendarView === "heatmap" ? "支出深淺熱力圖" : "每日收支淨額"}
                    </span>
                  </div>
                  <span className="text-[14px] font-bold transition-transform" style={{ color: "var(--text-muted)", transform: calendarOpen ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
                </button>
                {calendarOpen && (() => {
                  const [cy, cm] = calendarMonth.split("-").map(Number);
                  const firstDay = new Date(cy, cm - 1, 1).getDay();
                  const daysInMonth = new Date(cy, cm, 0).getDate();
                  const prevMonth = cm === 1 ? `${cy-1}-12` : `${cy}-${String(cm-1).padStart(2,"0")}`;
                  const nextMonth = cm === 12 ? `${cy+1}-01` : `${cy}-${String(cm+1).padStart(2,"0")}`;
                  const todayKey = new Date().toISOString().split("T")[0];
                  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
                  while (cells.length % 7 !== 0) cells.push(null);

                  // 收支日曆資料
                  const dayMap = new Map<string, { income: number; expense: number }>();
                  for (const tx of calendarTxs) {
                    const key = tx.date;
                    const cur = dayMap.get(key) ?? { income: 0, expense: 0 };
                    if (tx.type === "收入") cur.income += tx.amount;
                    else cur.expense += tx.amount;
                    dayMap.set(key, cur);
                  }
                  const maxAbs = Math.max(...Array.from(dayMap.values()).map(d => Math.abs(d.income - d.expense)), 1);

                  // 熱力圖資料（只看支出）
                  const dayExpMap = new Map<string, number>();
                  for (const tx of calendarTxs) {
                    if (tx.type !== "支出") continue;
                    dayExpMap.set(tx.date, (dayExpMap.get(tx.date) ?? 0) + tx.amount);
                  }
                  const maxExp = Math.max(...Array.from(dayExpMap.values()), 1);

                  return (
                    <Card className="p-6 mt-2">
                      {/* Header：月份導航 + 視圖切換 */}
                      <div className="flex items-center justify-between mb-4 gap-3">
                        <div className="flex rounded-xl overflow-hidden flex-shrink-0" style={{ border: "1px solid var(--border-inner)" }}>
                          {([["calendar", "📅 收支"] , ["heatmap", "🔥 熱力"]] as const).map(([v, label]) => (
                            <button key={v} onClick={() => setCalendarView(v)}
                              className="px-3 py-1.5 text-[13px] font-semibold transition-colors"
                              style={{
                                background: calendarView === v ? "var(--accent)" : "var(--bg-input)",
                                color:      calendarView === v ? "#fff" : "var(--text-muted)",
                              }}>{label}</button>
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setCalendarMonth(prevMonth)}
                            className="px-2 py-1 rounded-lg text-[14px]" style={{ color: "var(--text-sub)", background: "var(--bg-input)" }}>←</button>
                          <span className="text-[14px] font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>{calendarMonth}</span>
                          <button onClick={() => setCalendarMonth(nextMonth)}
                            className="px-2 py-1 rounded-lg text-[14px]" style={{ color: "var(--text-sub)", background: "var(--bg-input)" }}>→</button>
                        </div>
                      </div>

                      {/* 星期 header */}
                      <div className="grid grid-cols-7 gap-1 mb-1">
                        {["日","一","二","三","四","五","六"].map(d => (
                          <div key={d} className="text-center text-[13px] font-semibold py-1" style={{ color: "var(--text-muted)" }}>{d}</div>
                        ))}
                      </div>

                      {/* 格子 */}
                      {calendarView === "calendar" ? (
                        <>
                          <div className="grid grid-cols-7 gap-1">
                            {cells.map((day, i) => {
                              if (!day) return <div key={`e${i}`} />;
                              const key = `${calendarMonth}-${String(day).padStart(2,"0")}`;
                              const d = dayMap.get(key);
                              const net = d ? d.income - d.expense : 0;
                              const intensity = d ? Math.min(Math.abs(net) / maxAbs, 1) : 0;
                              const isToday = key === todayKey;
                              return (
                                <div key={key} className="rounded-lg p-1.5 min-h-[52px] flex flex-col"
                                  style={{
                                    background: d ? (net >= 0 ? `rgba(16,185,129,${0.08 + intensity * 0.25})` : `rgba(239,68,68,${0.08 + intensity * 0.25})`) : "transparent",
                                    border: isToday ? "1px solid var(--accent)" : "1px solid transparent",
                                  }}>
                                  <span className="text-[13px] font-semibold leading-none mb-1"
                                    style={{ color: isToday ? "var(--accent)" : "var(--text-muted)" }}>{day}</span>
                                  {d && (
                                    <span className="text-[13px] tabular-nums font-bold leading-tight"
                                      style={{ color: net >= 0 ? "#10B981" : "#F87171" }}>
                                      {net >= 0 ? "+" : "−"}{Math.abs(net) >= 1000 ? `${(Math.abs(net)/1000).toFixed(1)}k` : fmt(Math.abs(net))}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex items-center gap-4 mt-3 text-[13px]" style={{ color: "var(--text-muted)" }}>
                            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: "rgba(16,185,129,0.4)" }} />收入 &gt; 支出</span>
                            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: "rgba(239,68,68,0.4)" }} />支出 &gt; 收入</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="grid grid-cols-7 gap-1">
                            {cells.map((day, i) => {
                              if (!day) return <div key={`e${i}`} className="aspect-square" />;
                              const key = `${calendarMonth}-${String(day).padStart(2,"0")}`;
                              const exp = dayExpMap.get(key) ?? 0;
                              const intensity = exp > 0 ? 0.15 + (exp / maxExp) * 0.75 : 0;
                              const isToday = key === todayKey;
                              return (
                                <div key={key}
                                  className="aspect-square rounded-lg flex flex-col items-center justify-center gap-0.5"
                                  title={exp > 0 ? `${key}　NT$ ${fmt(exp)}` : key}
                                  style={{
                                    background: exp > 0 ? `rgba(239,68,68,${intensity})` : "var(--bg-input)",
                                    border: isToday ? "1.5px solid var(--accent)" : "1px solid transparent",
                                    minHeight: 36,
                                  }}>
                                  <span className="text-[11px] font-semibold leading-none"
                                    style={{ color: isToday ? "var(--accent)" : intensity > 0.5 ? "#fff" : "var(--text-muted)" }}>
                                    {day}
                                  </span>
                                  {exp > 0 && (
                                    <span className="text-[10px] tabular-nums leading-none font-bold"
                                      style={{ color: intensity > 0.5 ? "rgba(255,255,255,0.85)" : "#F87171" }}>
                                      {exp >= 1000 ? `${(exp/1000).toFixed(1)}k` : fmt(exp)}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex items-center gap-2 mt-3">
                            <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>低</span>
                            {[0.15, 0.3, 0.5, 0.7, 0.9].map(v => (
                              <div key={v} className="w-5 h-3 rounded-sm" style={{ background: `rgba(239,68,68,${v})` }} />
                            ))}
                            <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>高</span>
                            <span className="text-[12px] ml-auto" style={{ color: "var(--text-muted)" }}>最高單日 NT$ {fmt(Math.round(maxExp))}</span>
                          </div>
                        </>
                      )}
                    </Card>
                  );
                })()}
              </div>

              {/* ── 高頻商家分析（可折疊）── */}
              {merchantTxs.length > 0 && (
                <div>
                  <button
                    onClick={() => setMerchantOpen(o => !o)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-opacity hover:opacity-80"
                    style={{ background: "var(--bg-card)", border: "1px solid var(--border-inner)" }}>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🏪</span>
                      <span className="text-[15px] font-bold" style={{ color: "var(--text-primary)" }}>高頻商家分析</span>
                      <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>最常消費的地點排行</span>
                    </div>
                    <span className="text-[14px] font-bold" style={{ color: "var(--text-muted)", transform: merchantOpen ? "rotate(180deg)" : "rotate(0deg)", display: "inline-block", transition: "transform 0.2s" }}>▼</span>
                  </button>
                  {merchantOpen && (() => {
                    type MerchantEntry = { note: string; count: number; total: number; avg: number; category: string };
                    const map = new Map<string, MerchantEntry>();
                    for (const tx of merchantTxs) {
                      const key = tx.note;
                      if (!map.has(key)) map.set(key, { note: key, count: 0, total: 0, avg: 0, category: tx.category });
                      const e = map.get(key)!;
                      e.count += 1;
                      e.total += tx.amount;
                    }
                    Array.from(map.values()).forEach(e => { e.avg = Math.round(e.total / e.count); });

                    const byCount  = Array.from(map.values()).sort((a, b) => b.count - a.count || b.total - a.total).slice(0, 10);
                    const byAmount = Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 10);

                    const displayed = merchantView === "count" ? byCount : byAmount;
                    const maxVal = Math.max(...displayed.map(e => merchantView === "count" ? e.count : e.total), 1);

                    return (
                      <Card className="p-6 mt-2">
                        <div className="flex items-start justify-between mb-4 gap-3">
                          <div>
                            <p className="text-[16px] font-bold text-[var(--text-primary)] mb-0.5">高頻商家分析</p>
                            <p className="text-[14px]" style={{ color: "var(--text-sub)" }}>最常出現的消費備註（近 500 筆支出）</p>
                          </div>
                          <div className="flex rounded-xl overflow-hidden flex-shrink-0" style={{ border: "1px solid var(--border-inner)" }}>
                            {([["count", "次數"] , ["amount", "金額"]] as const).map(([v, label]) => (
                              <button key={v} onClick={() => setMerchantView(v)}
                                className="px-3 py-1.5 text-[13px] font-semibold transition-colors"
                                style={{
                                  background: merchantView === v ? "var(--accent)" : "var(--bg-input)",
                                  color:      merchantView === v ? "#fff" : "var(--text-muted)",
                                }}>{label}</button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-2.5">
                          {displayed.map((e, i) => {
                            const val     = merchantView === "count" ? e.count : e.total;
                            const barPct  = (val / maxVal) * 100;
                            const colors  = ["#6366F1", "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#14B8A6", "#F97316", "#EC4899", "#64748B"];
                            const color   = colors[i % colors.length];
                            return (
                              <div key={e.note}>
                                <div className="flex items-center gap-2.5 mb-1">
                                  <span className="text-[12px] w-4 text-right flex-shrink-0 font-bold tabular-nums" style={{ color: "var(--text-muted)" }}>{i + 1}</span>
                                  <span className="text-[14px] flex-1 truncate" style={{ color: "var(--text-primary)" }} title={e.note}>{e.note}</span>
                                  <span className="text-[12px] px-1.5 py-0.5 rounded-md flex-shrink-0" style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}>{e.category}</span>
                                  <span className="text-[13px] font-bold tabular-nums flex-shrink-0 w-20 text-right" style={{ color }}>
                                    {merchantView === "count" ? `${e.count} 次` : `NT$ ${fmt(e.total)}`}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2.5">
                                  <span className="w-4 flex-shrink-0" />
                                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-input)" }}>
                                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${barPct}%`, background: color }} />
                                  </div>
                                  <span className="text-[12px] tabular-nums w-20 text-right flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                                    {merchantView === "count" ? `NT$ ${fmt(e.total)}` : `${e.count} 次 均 ${fmt(e.avg)}`}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </Card>
                    );
                  })()}
                </div>
              )}

              </div>}

              {showCard("distribution") && <div style={{ order: cardOrder.indexOf("distribution"), display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <SectionLabel label="收支分佈" />
              {/* Chart 2: 資產 & 負債分佈 Donut */}
              {netWorth && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* 資產分佈 */}
                  <Card className="p-6">
                    <p className="text-[16px] font-bold text-[var(--text-primary)] mb-0.5">資產分佈</p>
                    <p className="text-[14px] mb-4" style={{ color: "var(--text-sub)" }}>各銀行帳戶餘額</p>
                    {balances.length > 0 ? (
                      <>
                        <ResponsiveContainer width="100%" height={160}>
                          <PieChart>
                            <Pie data={balances.map(b => ({ name: SOURCE_LABELS[b.source] ?? b.source, total: b.balance }))}
                              dataKey="total" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={2} strokeWidth={0}>
                              {balances.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                            </Pie>
                            <Tooltip formatter={(value: number) => [`NT$ ${fmt(value)}`, undefined]}
                              contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 12 }} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="space-y-2.5 mt-3">
                          {balances.map((b, i) => (
                            <div key={b.source} className="flex items-center gap-2.5">
                              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                              <span className="text-[14px] flex-1 truncate" style={{ color: "var(--text-sub)" }}>{SOURCE_LABELS[b.source] ?? b.source}</span>
                              <span className="text-[14px]" style={{ color: "var(--text-muted)" }}>{netWorth.totalAssets > 0 ? Math.round((b.balance / netWorth.totalAssets) * 100) : 0}%</span>
                              <span className="text-[14px] font-bold text-[var(--text-primary)] w-28 text-right">NT$ {fmt(b.balance)}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="py-10 flex flex-col items-center gap-2">
                        <p className="text-3xl">🏦</p>
                        <p className="text-[14px] font-semibold" style={{ color: "var(--text-sub)" }}>尚無帳戶餘額</p>
                        <p className="text-[14px] text-center" style={{ color: "var(--text-muted)" }}>匯入銀行 CSV 後系統會自動記錄各帳戶餘額</p>
                      </div>
                    )}
                  </Card>

                  {/* 負債分佈 */}
                  <Card className="p-6">
                    <p className="text-[16px] font-bold text-[var(--text-primary)] mb-0.5">負債分佈</p>
                    <p className="text-[14px] mb-4" style={{ color: "var(--text-sub)" }}>貸款 vs 信用卡未繳</p>
                    {netWorth.totalDebt > 0 ? (() => {
                      const debtSlices = [
                        { name: "貸款餘額",   total: netWorth.totalLoanDebt   },
                        { name: "信用卡未繳", total: netWorth.totalCreditDebt },
                      ].filter(d => d.total > 0);
                      const debtColors = ["#EF4444", "#F59E0B"];
                      return (
                        <>
                          <ResponsiveContainer width="100%" height={160}>
                            <PieChart>
                              <Pie data={debtSlices} dataKey="total" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={2} strokeWidth={0}>
                                {debtSlices.map((_, i) => <Cell key={i} fill={debtColors[i]} />)}
                              </Pie>
                              <Tooltip formatter={(value: number) => [`NT$ ${fmt(value)}`, undefined]}
                                contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 12 }} />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="space-y-2.5 mt-3">
                            {debtSlices.map((d, i) => (
                              <div key={d.name} className="flex items-center gap-2.5">
                                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: debtColors[i] }} />
                                <span className="text-[14px] flex-1 truncate" style={{ color: "var(--text-sub)" }}>{d.name}</span>
                                <span className="text-[14px]" style={{ color: "var(--text-muted)" }}>{Math.round((d.total / netWorth.totalDebt) * 100)}%</span>
                                <span className="text-[14px] font-bold text-[var(--text-primary)] w-28 text-right">NT$ {fmt(d.total)}</span>
                              </div>
                            ))}
                            <div className="pt-2 flex items-center justify-between" style={{ borderTop: "1px solid var(--border-inner)" }}>
                              <span className="text-[14px]" style={{ color: "var(--text-sub)" }}>資產負債比</span>
                              <span className="text-[14px] font-bold" style={{ color: netWorth.totalAssets >= netWorth.totalDebt ? "#34D399" : "#F87171" }}>
                                {netWorth.totalDebt > 0 ? Math.round((netWorth.totalAssets / netWorth.totalDebt) * 100) : 100}%
                              </span>
                            </div>
                          </div>
                        </>
                      );
                    })() : (
                      <div className="flex flex-col items-center justify-center py-10 gap-2">
                        <p className="text-[28px]">🎉</p>
                        <p className="text-[14px] font-semibold" style={{ color: "#34D399" }}>無負債</p>
                      </div>
                    )}
                  </Card>
                </div>
              )}

              {/* Chart 3 & 4: 收入/支出分類 Donut */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {[
                  { title: "收入分類", cats: incomeCats,    total: incomeTotal },
                  { title: "支出分類", cats: expensePieData, total: expensePieTotal },
                ].map(({ title, cats, total }) => {
                  const monthLabel = selectedMonth ? `${selectedMonth.slice(0,4)}年${selectedMonth.slice(5)}月` : `近 ${months} 個月`;
                  const otherItem = title === "支出分類" ? cats.find(c => c.category === "其他") : null;
                  const otherPct  = otherItem && total > 0 ? Math.round((otherItem.total / total) * 100) : 0;
                  return (
                  <Card key={title} className="p-6">
                    <div className="flex items-baseline gap-2 mb-5">
                      <p className="text-[16px] font-bold text-[var(--text-primary)]">{title}</p>
                      <span className="text-[14px]" style={{ color: "var(--text-muted)" }}>{monthLabel}</span>
                    </div>
                    {cats.length > 0 ? (
                      <>
                        <ResponsiveContainer width="100%" height={160}>
                          <PieChart>
                            <Pie data={cats} dataKey="total" nameKey="category" cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={2} strokeWidth={0}>
                              {cats.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                            </Pie>
                            <Tooltip formatter={(value: number) => [`NT$ ${fmt(value)}`, undefined]}
                              contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 12 }} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="space-y-2.5 mt-3">
                          {cats.slice(0, 6).map((item, i) => {
                            const prevAmt = prevMonthCats.find(c => c.category === item.category && c.type === item.type)?.total ?? null;
                            const momPct  = prevAmt !== null && prevAmt > 0 ? Math.round(((item.total - prevAmt) / prevAmt) * 100) : null;
                            return (
                            <div key={item.category} className="flex items-center gap-2.5">
                              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                              <span className="text-[14px] flex-1 truncate" style={{ color: "var(--text-sub)" }}>{item.category}</span>
                              {title === "支出分類" && momPct !== null && (
                                <span className="text-[12px] font-semibold px-1.5 py-0.5 rounded-md flex-shrink-0 tabular-nums"
                                  style={{
                                    background: momPct > 0 ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)",
                                    color:      momPct > 0 ? "#EF4444" : "#10B981",
                                  }}>
                                  {momPct > 0 ? "▲" : "▼"} {Math.abs(momPct)}%
                                </span>
                              )}
                              <span className="text-[14px]" style={{ color: "var(--text-muted)" }}>{total > 0 ? Math.round((item.total / total) * 100) : 0}%</span>
                              <span className="text-[14px] font-bold text-[var(--text-primary)] w-28 text-right">NT$ {fmt(item.total)}</span>
                            </div>
                            );
                          })}
                        </div>
                        {otherPct >= 30 && (
                          <div className="mt-4 flex items-start gap-3 rounded-xl px-4 py-3"
                            style={{ background: "#431407", border: "1px solid #9A3412" }}>
                            <span className="text-base flex-shrink-0 mt-0.5">⚠️</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-[14px] font-semibold" style={{ color: "#FED7AA" }}>
                                「其他」佔支出 {otherPct}%，分類不夠明確
                              </p>
                              <p className="text-[14px] mt-0.5" style={{ color: "#9A6042" }}>
                                建議建立帳號對照表，讓轉帳交易自動標記正確分類
                              </p>
                            </div>
                            <button
                              onClick={() => setActiveTab("payees")}
                              className="flex-shrink-0 text-[14px] font-bold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
                              style={{ background: "#9A3412", color: "#FED7AA" }}>
                              前往設定
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="py-10 flex flex-col items-center gap-2">
                        <p className="text-3xl">{title === "收入分類" ? "💰" : "📊"}</p>
                        <p className="text-[14px] font-semibold" style={{ color: "var(--text-sub)" }}>
                          {title === "收入分類" ? "尚無收入資料" : "尚無支出資料"}
                        </p>
                        <p className="text-[14px]" style={{ color: "var(--text-muted)" }}>匯入交易資料後圖表將自動顯示</p>
                      </div>
                    )}
                  </Card>
                  );
                })}
              </div>

              {/* Chart 5: 支出排行 Horizontal Bar */}
              {expenseCats.length > 0 && (
                <Card className="p-6">
                  <p className="text-[16px] font-bold text-[var(--text-primary)] mb-0.5">支出金額排行</p>
                  <p className="text-[14px] mb-5" style={{ color: "var(--text-sub)" }}>
                    {selectedMonth ? `${selectedMonth.slice(0,4)}年${selectedMonth.slice(5)}月` : `近 ${months} 個月`} 各分類累計支出
                  </p>
                  <div className="space-y-3">
                    {[...expenseCats].sort((a, b) => b.total - a.total).slice(0, 8).map((item, i) => (
                      <div key={item.category} className="flex items-center gap-3">
                        <span className="text-[14px] w-16 text-right flex-shrink-0" style={{ color: "var(--text-sub)" }}>{item.category}</span>
                        <div className="flex-1 rounded-full overflow-hidden" style={{ background: "var(--bg-input)", height: 10 }}>
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${expenseTotal > 0 ? (item.total / expenseTotal) * 100 : 0}%`,
                              background: `linear-gradient(90deg, ${CHART_COLORS[i % CHART_COLORS.length]}cc, ${CHART_COLORS[i % CHART_COLORS.length]})`,
                              boxShadow: `0 0 8px ${CHART_COLORS[i % CHART_COLORS.length]}60`,
                            }} />
                        </div>
                        <span className="text-[14px] font-bold text-[var(--text-primary)] w-28 text-right flex-shrink-0">NT$ {fmt(item.total)}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* 本月預算 — 導引連結卡 */}
              {budgetOverview.length > 0 && (() => {
                const totalBudget  = budgetOverview.reduce((s, b) => s + b.amount, 0);
                const totalSpent   = budgetOverview.reduce((s, b) => s + b.spent,  0);
                const totalPct     = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;
                const overCount    = budgetOverview.filter(b => b.spent > b.amount).length;
                const overallColor = totalPct >= 100 ? "#EF4444" : totalPct >= 80 ? "#F59E0B" : "#10B981";
                return (
                  <Card className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: `${overallColor}20` }}>
                          <span className="text-lg">💰</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[14px] font-bold" style={{ color: "var(--text-primary)" }}>本月預算</p>
                          <p className="text-[13px] mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                            已用 <span style={{ color: overallColor, fontWeight: 700 }}>{totalPct.toFixed(0)}%</span>
                            　NT$ {fmt(totalSpent)} / {fmt(totalBudget)}
                            {overCount > 0 && <span style={{ color: "#EF4444" }}>　⚠ {overCount} 項超標</span>}
                          </p>
                        </div>
                      </div>
                      <button onClick={() => setActiveTab("budget")}
                        className="flex-shrink-0 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-opacity hover:opacity-80"
                        style={{ background: "var(--bg-input)", color: "var(--accent-light)", border: "1px solid var(--border-inner)", whiteSpace: "nowrap" }}>
                        前往預算控制 →
                      </button>
                    </div>
                  </Card>
                );
              })()}

              {/* ── 消費性質趨勢 ── */}
              {moodTrend.length > 0 && moodTrend.some(m => m.衝動 + m.計畫 + m.必要 > 0) && (() => {
                const avgTaggedPct = Math.round(moodTrend.reduce((s, m) => s + m.taggedPct, 0) / moodTrend.length);
                const totalImpulse = moodTrend.reduce((s, m) => s + m.衝動, 0);
                const totalTagged  = moodTrend.reduce((s, m) => s + m.衝動 + m.計畫 + m.必要, 0);
                const impulsePct   = totalTagged > 0 ? Math.round((totalImpulse / totalTagged) * 100) : 0;
                return (
                  <Card className="p-6">
                    <div className="flex items-start justify-between mb-5 gap-4">
                      <div>
                        <p className="text-[16px] font-bold text-[var(--text-primary)] mb-0.5">消費性質趨勢</p>
                        <p className="text-[14px]" style={{ color: "var(--text-sub)" }}>近 6 個月支出的必要 / 計畫 / 衝動佔比走勢</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[20px] font-black tabular-nums" style={{ color: impulsePct >= 30 ? "#EF4444" : impulsePct >= 15 ? "#F59E0B" : "#10B981" }}>
                          衝動 {impulsePct}%
                        </p>
                        <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>已標記 {avgTaggedPct}% 支出</p>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={moodTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                        <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false}
                          tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)} />
                        <Tooltip
                          formatter={(value: number, name: string) => [`NT$ ${fmt(value)}`, name]}
                          contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 13, paddingTop: 8 }} />
                        <Area type="monotone" dataKey="必要" stackId="1" stroke="#10B981" fill="#10B98130" strokeWidth={2} />
                        <Area type="monotone" dataKey="計畫" stackId="1" stroke="#6366F1" fill="#6366F130" strokeWidth={2} />
                        <Area type="monotone" dataKey="衝動" stackId="1" stroke="#EF4444" fill="#EF444430" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                    {avgTaggedPct < 30 && (
                      <p className="text-[13px] mt-4 text-center" style={{ color: "var(--text-muted)" }}>
                        目前僅標記 {avgTaggedPct}% 支出，在交易記錄中多標記「🏷 性質」可讓趨勢更準確
                      </p>
                    )}
                  </Card>
                );
              })()}

              </div>}

              {showCard("fixed-loans") && <div style={{ order: cardOrder.indexOf("fixed-loans"), display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {/* 固定支出與貸款 — 導引連結卡 */}
              <SectionLabel label="固定支出與貸款" />
              {(fixedExpenses.length > 0 || loansTimeline.length > 0) && (() => {
                const totalFixed  = fixedExpenses.reduce((s, f) => s + f.amount, 0);
                const totalLoans  = loansTimeline.reduce((s, l) => s + l.monthlyPrincipal, 0);
                const grandTotal  = totalFixed + totalLoans;
                const nextPayoff  = [...loansTimeline]
                  .filter(l => l.payoffDate)
                  .sort((a, b) => (a.payoffDate ?? "").localeCompare(b.payoffDate ?? ""))[0];
                const incomePct   = (activeTotals?.income ?? 0) > 0 ? Math.round((grandTotal / activeTotals!.income) * 100) : null;
                const incomeColor = incomePct !== null
                  ? incomePct >= 70 ? "#EF4444" : incomePct >= 50 ? "#F59E0B" : "#10B981"
                  : "var(--text-muted)";
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* 固定支出摘要 */}
                    <Card className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: "rgba(129,140,248,0.15)" }}>
                            <span className="text-lg">📌</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-[14px] font-bold" style={{ color: "var(--text-primary)" }}>每月必要支出</p>
                            <p className="text-[13px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                              NT$ <span style={{ color: "#818CF8", fontWeight: 700 }}>{fmt(totalFixed)}</span> 固定
                              ＋ NT$ <span style={{ color: "#F87171", fontWeight: 700 }}>{fmt(totalLoans)}</span> 還款
                              {incomePct !== null && <span style={{ color: incomeColor }}>　佔收入 {incomePct}%</span>}
                            </p>
                          </div>
                        </div>
                      </div>
                    </Card>

                    {/* 貸款還清時間軸摘要 */}
                    <Card className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: "rgba(248,113,113,0.15)" }}>
                            <span className="text-lg">🏦</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-[14px] font-bold" style={{ color: "var(--text-primary)" }}>貸款還清時間軸</p>
                            <p className="text-[13px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                              共 {loansTimeline.length} 筆貸款
                              {nextPayoff && <span>　最快 <span style={{ color: "#F87171", fontWeight: 600 }}>{nextPayoff.payoffDate}</span> 還清</span>}
                            </p>
                          </div>
                        </div>
                      </div>
                    </Card>

                    {/* 統一導引按鈕 */}
                    <button onClick={() => setActiveTab("loans")}
                      className="sm:col-span-2 py-2 rounded-xl text-[13px] font-semibold transition-opacity hover:opacity-80"
                      style={{ background: "var(--bg-input)", color: "var(--accent-light)", border: "1px solid var(--border-inner)" }}>
                      前往負債管理查看完整明細 →
                    </button>
                  </div>
                );
              })()}
              </div>}

            </>}

          </div>
        )}

        {/* ── Transactions ── */}
        {activeTab === "transactions" && (
          <div className="space-y-4">

            {/* Transfer review */}
            {transferPairs.filter(p => !dismissedPairs.has(`${p.expense.id}:${p.income.id}`)).length > 0 && (
              <Card>
                <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--border-inner)" }}>
                  <p className="text-[15px] font-bold text-[var(--text-primary)]">疑似自我轉帳</p>
                  <p className="text-[14px] mt-0.5" style={{ color: "var(--text-muted)" }}>以下交易可能是帳戶間轉帳，確認後將排除於收支統計</p>
                </div>
                <div className="divide-y" style={{ borderColor: "var(--border-inner)" }}>
                  {transferPairs
                    .filter(p => !dismissedPairs.has(`${p.expense.id}:${p.income.id}`))
                    .map(pair => (
                      <div key={`${pair.expense.id}:${pair.income.id}`} className="px-6 py-4">
                        <div className="flex items-start gap-4 flex-wrap">
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-center gap-2 text-[14px]">
                              <span className="font-semibold" style={{ color: "#F87171" }}>支出</span>
                              <SourceBadge source={pair.expense.source} />
                              <span className="font-bold text-[var(--text-primary)]">NT$ {fmt(pair.expense.amount)}</span>
                              <span style={{ color: "var(--text-muted)" }}>{pair.expense.date}</span>
                            </div>
                            <p className="text-[14px] truncate" style={{ color: "var(--text-muted)" }}>{pair.expense.note || "—"}</p>
                            <div className="flex items-center gap-2 text-[14px]">
                              <span className="font-semibold" style={{ color: "#34D399" }}>收入</span>
                              <SourceBadge source={pair.income.source} />
                              <span className="font-bold text-[var(--text-primary)]">NT$ {fmt(pair.income.amount)}</span>
                              <span style={{ color: "var(--text-muted)" }}>{pair.income.date}</span>
                            </div>
                            <p className="text-[14px] truncate" style={{ color: "var(--text-muted)" }}>{pair.income.note || "—"}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button onClick={() => confirmTransfer(pair)}
                              className="px-3 py-1.5 rounded-lg text-[14px] font-bold transition-opacity hover:opacity-80"
                              style={{ background: "var(--btn-gradient)", color: "#fff" }}>
                              確認轉帳
                            </button>
                            <button onClick={() => dismissTransfer(pair)}
                              className="px-3 py-1.5 rounded-lg text-[14px] font-semibold transition-opacity hover:opacity-70"
                              style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                              不是轉帳
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </Card>
            )}

            {/* ── 收支小結常駐卡 ── */}
            {data && (() => {
              const { income, expense, net } = data.totals;
              const savingsRate = income > 0 ? Math.round(((income - expense) / income) * 100) : null;
              const rateColor = savingsRate === null ? "var(--text-muted)" : savingsRate >= 20 ? "#10B981" : savingsRate >= 0 ? "#F59E0B" : "#EF4444";
              const budgetsOver = budgetOverview.filter(b => b.amount > 0 && b.spent > b.amount).length;
              return (
                <div className="rounded-2xl px-5 py-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[13px] font-bold tracking-wide uppercase" style={{ color: "var(--text-muted)" }}>
                      {currentMonth.slice(0,4)} 年 {parseInt(currentMonth.slice(5))} 月收支摘要
                    </p>
                    {budgetsOver > 0 && (
                      <span className="text-[12px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(239,68,68,0.12)", color: "#F87171" }}>
                        🚨 {budgetsOver} 項超標
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label: "本月收入", value: income,  color: "#34D399", prefix: "+" },
                      { label: "本月支出", value: expense, color: "#F87171", prefix: "−" },
                      { label: "淨收支",   value: Math.abs(net), color: net >= 0 ? "#34D399" : "#F87171", prefix: net >= 0 ? "+" : "−" },
                    ].map(item => (
                      <div key={item.label}>
                        <p className="text-[12px] mb-1" style={{ color: "var(--text-muted)" }}>{item.label}</p>
                        <p className="text-[17px] font-black tabular-nums" style={{ color: item.color }}>{item.prefix}NT$ {fmt(item.value)}</p>
                      </div>
                    ))}
                    <div>
                      <p className="text-[12px] mb-1" style={{ color: "var(--text-muted)" }}>儲蓄率</p>
                      <p className="text-[17px] font-black tabular-nums" style={{ color: rateColor }}>
                        {savingsRate !== null ? `${savingsRate}%` : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}

            <Card>
              {/* Search + filter toggle */}
              {(() => {
                const advActive = !!(txTypeFilter || txDateFrom || txDateTo || txAmountMin || txAmountMax || txSourceFilter.length > 0);
                const inputCls = "rounded-lg px-3 py-2 text-[14px] outline-none w-full";
                const inputSty = { background: "var(--bg-input)", border: "1px solid var(--border-inner)", color: "var(--text-primary)" } as React.CSSProperties;
                const clearAll = () => { setTxTypeFilter(""); setTxDateFrom(""); setTxDateTo(""); setTxAmountMin(""); setTxAmountMax(""); setTxSourceFilter([]); };
                return (
                  <div style={{ borderBottom: "1px solid var(--border-inner)" }}>
                    {/* Search row */}
                    <div className="px-6 pt-4 pb-3 flex items-center gap-2">
                      <div className="relative flex-1">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "var(--text-muted)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                        </svg>
                        <input
                          type="text"
                          placeholder="搜尋備註（如：7-11、租金…）"
                          value={txSearch}
                          onChange={e => setTxSearch(e.target.value)}
                          className="w-full rounded-xl pl-9 pr-8 py-2.5 text-[14px] outline-none"
                          style={{ background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                        />
                        {txSearch && (
                          <button onClick={() => setTxSearch("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[16px] leading-none hover:opacity-60"
                            style={{ color: "var(--text-muted)" }}>×</button>
                        )}
                      </div>
                      {/* Advanced filter toggle */}
                      <button
                        onClick={() => setTxAdvancedOpen(o => !o)}
                        className="relative flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-[14px] font-semibold transition-colors"
                        style={{
                          background: txAdvancedOpen ? "var(--bg-input)" : "transparent",
                          border: `1px solid ${txAdvancedOpen || advActive ? "var(--border)" : "transparent"}`,
                          color: advActive ? "var(--accent-light)" : "var(--text-sub)",
                        }}>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 12h10M11 20h2" />
                        </svg>
                        篩選
                        {advActive && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />}
                      </button>
                    </div>

                    {/* Advanced filter panel */}
                    {txAdvancedOpen && (
                      <div className="px-6 pb-4 space-y-3">
                        {/* Type */}
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] font-semibold w-12 flex-shrink-0" style={{ color: "var(--text-sub)" }}>類型</span>
                          <div className="flex gap-1">
                            {(["", "收入", "支出"] as const).map(t => (
                              <button key={t || "all"} onClick={() => setTxTypeFilter(t)}
                                className="px-2.5 py-1 rounded-lg text-[14px] font-semibold transition-colors"
                                style={txTypeFilter === t
                                  ? { background: "var(--accent)", color: "#fff" }
                                  : { background: "var(--bg-input)", color: "var(--text-sub)", border: "1px solid var(--border-inner)" }}>
                                {t || "全部"}
                              </button>
                            ))}
                          </div>
                        </div>
                        {/* Source filter */}
                        <div className="flex items-start gap-2">
                          <span className="text-[14px] font-semibold w-12 flex-shrink-0 pt-1" style={{ color: "var(--text-sub)" }}>來源</span>
                          <div className="flex flex-wrap gap-1">
                            {(Object.entries(SOURCE_LABELS) as [string, string][]).filter(([src]) => {
                              const fixed = new Set(["line", "manual", "cash"]);
                              return fixed.has(src) || balances.some(b => b.source === src);
                            }).map(([src, label]) => {
                              const active = txSourceFilter.includes(src);
                              return (
                                <button key={src}
                                  onClick={() => setTxSourceFilter(prev =>
                                    prev.includes(src) ? prev.filter(s => s !== src) : [...prev, src]
                                  )}
                                  className="px-2.5 py-1 rounded-lg text-[13px] font-semibold transition-colors"
                                  style={active
                                    ? { background: "var(--accent)", color: "#fff" }
                                    : { background: "var(--bg-input)", color: "var(--text-sub)", border: "1px solid var(--border-inner)" }}>
                                  {label}
                                </button>
                              );
                            })}
                            {txSourceFilter.length > 0 && (
                              <button onClick={() => setTxSourceFilter([])}
                                className="px-2.5 py-1 rounded-lg text-[13px] font-semibold transition-opacity hover:opacity-70"
                                style={{ background: "rgba(239,68,68,0.1)", color: "#F87171", border: "1px solid rgba(239,68,68,0.2)" }}>
                                清除
                              </button>
                            )}
                          </div>
                        </div>
                        {/* Date range */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[14px] font-semibold w-12 flex-shrink-0" style={{ color: "var(--text-sub)" }}>日期</span>
                          {/* 快速日期按鈕 */}
                          {(() => {
                            const now = new Date();
                            const pad = (n: number) => String(n).padStart(2, "0");
                            const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
                            const todayStr = fmt(now);
                            const dow = now.getDay();
                            const weekStart = new Date(now); weekStart.setDate(now.getDate() - dow);
                            const weekEnd = new Date(now); weekEnd.setDate(now.getDate() + (6 - dow));
                            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                            const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                            const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                            const prevMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0);
                            const presets = [
                              { label: "今天", from: todayStr,        to: todayStr },
                              { label: "本週", from: fmt(weekStart),  to: fmt(weekEnd) },
                              { label: "本月", from: fmt(monthStart), to: fmt(monthEnd) },
                              { label: "上月", from: fmt(prevMonthStart), to: fmt(prevMonthEnd) },
                            ];
                            return presets.map(p => {
                              const active = txDateFrom === p.from && txDateTo === p.to;
                              return (
                                <button key={p.label}
                                  onClick={() => { setTxDateFrom(p.from); setTxDateTo(p.to); }}
                                  className="px-2.5 py-1 rounded-lg text-[13px] font-semibold transition-colors"
                                  style={active
                                    ? { background: "var(--accent)", color: "#fff" }
                                    : { background: "var(--bg-input)", color: "var(--text-sub)", border: "1px solid var(--border-inner)" }}>
                                  {p.label}
                                </button>
                              );
                            });
                          })()}
                          <input type="date" value={txDateFrom} onChange={e => setTxDateFrom(e.target.value)} className={inputCls} style={{ ...inputSty, maxWidth: 140 }} />
                          <span className="text-[14px]" style={{ color: "var(--text-muted)" }}>—</span>
                          <input type="date" value={txDateTo}   onChange={e => setTxDateTo(e.target.value)}   className={inputCls} style={{ ...inputSty, maxWidth: 140 }} />
                        </div>
                        {/* Amount range */}
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] font-semibold w-12 flex-shrink-0" style={{ color: "var(--text-sub)" }}>金額</span>
                          <input type="number" min={0} placeholder="最小" value={txAmountMin} onChange={e => setTxAmountMin(e.target.value)} className={inputCls} style={{ ...inputSty, maxWidth: 100 }} />
                          <span className="text-[14px]" style={{ color: "var(--text-muted)" }}>—</span>
                          <input type="number" min={0} placeholder="最大" value={txAmountMax} onChange={e => setTxAmountMax(e.target.value)} className={inputCls} style={{ ...inputSty, maxWidth: 100 }} />
                          {advActive && (
                            <button onClick={clearAll}
                              className="ml-2 text-[14px] font-semibold px-2.5 py-1 rounded-lg transition-opacity hover:opacity-70"
                              style={{ background: "rgba(239,68,68,0.1)", color: "#F87171", border: "1px solid rgba(239,68,68,0.2)" }}>
                              清除篩選
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Header — Row 1: 標題 + 動作 + 分頁 */}
              <div style={{ borderBottom: "1px solid var(--border-inner)" }}>
                <div className="px-6 pt-4 pb-2.5 flex items-center gap-2.5 flex-wrap">
                  <p className="text-[16px] font-bold" style={{ color: "var(--text-primary)" }}>
                    {txSearch ? `「${txSearch}」搜尋結果` : "交易記錄"}
                  </p>
                  {txData && <span className="text-[13px] px-2 py-0.5 rounded-full" style={{ background: "var(--border-inner)", color: "var(--text-muted)" }}>共 {txData.total} 筆</span>}
                  <div className="flex-1" />
                  {/* Divider */}
                  <div className="w-px h-5 flex-shrink-0" style={{ background: "var(--border-inner)" }} />
                  {/* Primary action */}
                  <button onClick={() => setAddModal(true)}
                    className="text-[14px] font-bold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80 flex items-center gap-1"
                    style={{ background: "var(--btn-gradient)", color: "#fff" }}>
                    ＋ 新增
                  </button>
                  {/* Secondary actions */}
                  <a href={`/api/transactions?${new URLSearchParams({ export: "csv", month: selectedMonth ?? currentMonth, ...(txFilterCat ? { category: txFilterCat } : {}), ...(txSearch ? { note: txSearch } : {}), ...(txTypeFilter ? { type: txTypeFilter } : {}), ...(txDateFrom ? { dateFrom: txDateFrom } : {}), ...(txDateTo ? { dateTo: txDateTo } : {}), ...(txAmountMin ? { amountMin: txAmountMin } : {}), ...(txAmountMax ? { amountMax: txAmountMax } : {}), ...(txSourceFilter.length > 0 ? { source: txSourceFilter.join(",") } : {}) }).toString()}`}
                    download title="匯出 CSV"
                    className="text-[14px] font-semibold px-2.5 py-1.5 rounded-lg transition-opacity hover:opacity-80 inline-flex items-center gap-1"
                    style={{ background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-sub)" }}>
                    ↓ CSV
                  </a>
                  <a href={`/api/print-report?month=${selectedMonth ?? currentMonth}`}
                    target="_blank" rel="noopener noreferrer" title="列印月報 PDF"
                    className="text-[14px] font-semibold px-2.5 py-1.5 rounded-lg transition-opacity hover:opacity-80 inline-flex items-center gap-1"
                    style={{ background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-sub)" }}>
                    🖨 月報
                  </a>
                  <a href="/api/transactions?export=json" download title="備份全部交易為 JSON"
                    className="text-[14px] font-semibold px-2.5 py-1.5 rounded-lg transition-opacity hover:opacity-80 inline-flex items-center gap-1"
                    style={{ background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-sub)" }}>
                    ↓ 備份
                  </a>
                  <a href="/api/transactions?export=xlsx" download title="匯出全部交易為 Excel"
                    className="text-[14px] font-semibold px-2.5 py-1.5 rounded-lg transition-opacity hover:opacity-80 inline-flex items-center gap-1"
                    style={{ background: "var(--bg-input)", border: "1px solid var(--border)", color: "#10B981" }}>
                    ↓ Excel
                  </a>
                </div>

                {/* Header — Row 2: 篩選 chip 列 */}
                <div className="px-6 pb-3 flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setTxFilterCat(f => f === "其他" ? null : "其他")}
                    className="text-[13px] font-semibold px-2.5 py-1 rounded-lg transition-all"
                    style={txFilterCat === "其他"
                      ? { background: "#92400E", color: "#FCD34D", border: "1px solid #B45309" }
                      : { background: "var(--bg-input)", color: "#F59E0B", border: "1px solid #B4530940" }}>
                    ⚠ 未分類{txFilterCat === "其他" ? " ✕" : ""}
                  </button>
                  <div className="w-px h-4 flex-shrink-0" style={{ background: "var(--border-inner)" }} />
                  <span className="text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>消費性質</span>
                  {(["必要", "計畫", "衝動"] as const).map(m => {
                    const colors: Record<string, { on: string; off: string }> = {
                      衝動: { on: "#7F1D1D", off: "rgba(239,68,68,0.08)" },
                      計畫: { on: "#1E3A5F", off: "rgba(59,130,246,0.08)" },
                      必要: { on: "#14532D", off: "rgba(16,185,129,0.08)" },
                    };
                    const textColors: Record<string, string> = { 衝動: "#F87171", 計畫: "#60A5FA", 必要: "#34D399" };
                    const active = txMoodFilter === m;
                    return (
                      <button key={m} onClick={() => setTxMoodFilter(f => f === m ? "" : m)}
                        className="text-[13px] font-semibold px-2 py-1 rounded-lg transition-all"
                        style={{ background: active ? colors[m].on : colors[m].off, color: textColors[m], border: `1px solid ${textColors[m]}40` }}>
                        {m === "衝動" ? "⚡" : m === "計畫" ? "📋" : "✅"} {m}{active ? " ✕" : ""}
                      </button>
                    );
                  })}
                  <div className="flex-1" />
                  <button
                    onClick={() => { setBatchMode(b => { if (b) { setSelectedIds(new Set()); setBatchCat(""); } return !b; }); }}
                    className="text-[13px] font-semibold px-2.5 py-1 rounded-lg transition-all"
                    style={batchMode
                      ? { background: "#1E3A5F", color: "#60A5FA", border: "1px solid #3B82F680" }
                      : { background: "var(--bg-input)", color: "var(--text-sub)", border: "1px solid var(--border)" }}>
                    {batchMode ? "✕ 取消批次" : "☑ 批次改分類"}
                  </button>
                </div>
              </div>

              {txLoading && !txData ? (
                <div className="flex justify-center py-16">
                  <div className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
                </div>
              ) : txData && txData.items.length > 0 ? (
                <div>
                  {/* Mood stats bar */}
                  {(() => {
                    const expense = txData.items.filter(t => t.type === "支出");
                    const tagged  = expense.filter(t => t.mood);
                    if (tagged.length === 0) return null;
                    const impulse = tagged.filter(t => t.mood === "衝動");
                    const planned = tagged.filter(t => t.mood === "計畫");
                    const needed  = tagged.filter(t => t.mood === "必要");
                    const impAmt  = impulse.reduce((s, t) => s + t.amount, 0);
                    const plnAmt  = planned.reduce((s, t) => s + t.amount, 0);
                    const nedAmt  = needed.reduce((s, t)  => s + t.amount, 0);
                    const totAmt  = expense.reduce((s, t) => s + t.amount, 0);
                    const impPct  = totAmt > 0 ? Math.round((impAmt / totAmt) * 100) : 0;
                    const tagPct  = expense.length > 0 ? Math.round((tagged.length / expense.length) * 100) : 0;
                    return (
                      <div className="mx-4 my-3 px-4 py-3 rounded-xl flex items-center gap-4 flex-wrap"
                        style={{ background: "var(--bg-input)", border: "1px solid var(--border-inner)" }}>
                        <span className="text-[13px] font-semibold" style={{ color: "var(--text-muted)" }}>
                          消費性質分析
                          <span className="ml-1.5 font-normal">已標記 {tagged.length}/{expense.length} 筆（{tagPct}%）</span>
                        </span>
                        {needed.length > 0 && (
                          <span className="text-[13px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(16,185,129,0.12)", color: "#34D399" }}>
                            ✅ 必要 NT${fmt(nedAmt)}
                          </span>
                        )}
                        {planned.length > 0 && (
                          <span className="text-[13px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(59,130,246,0.12)", color: "#60A5FA" }}>
                            📋 計畫 NT${fmt(plnAmt)}
                          </span>
                        )}
                        {impulse.length > 0 && (
                          <span className="text-[13px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(239,68,68,0.12)", color: "#F87171" }}>
                            ⚡ 衝動 NT${fmt(impAmt)}・占支出 {impPct}%
                          </span>
                        )}
                      </div>
                    );
                  })()}
                  {groupByDate(txMoodFilter ? txData.items.filter(t => t.mood === txMoodFilter) : txData.items).map(group => (
                    <div key={group.label}>
                      {/* Date group header */}
                      <div className="px-5 py-2 flex items-center gap-3" style={{ background: "var(--bg-input)", borderBottom: "1px solid var(--border-inner)" }}>
                        <span className="text-[13px] font-bold tracking-widest uppercase" style={{ color: "var(--accent)" }}>{group.label}</span>
                        <span className="text-[12px] px-1.5 py-0.5 rounded" style={{ background: "var(--border-inner)", color: "var(--text-muted)" }}>{group.items.length} 筆</span>
                        <span className="flex-1 h-px" style={{ background: "var(--border-inner)" }} />
                        {(() => {
                          const inc = group.items.filter(t => t.type === "收入").reduce((s, t) => s + t.amount, 0);
                          const exp = group.items.filter(t => t.type === "支出").reduce((s, t) => s + t.amount, 0);
                          const net = inc - exp;
                          return (
                            <div className="flex items-center gap-2 text-[13px]">
                              {inc > 0 && <span style={{ color: "#10B981" }}>+{fmt(inc)}</span>}
                              {exp > 0 && <span style={{ color: "#EF4444" }}>−{fmt(exp)}</span>}
                              {inc > 0 && exp > 0 && <span style={{ color: "var(--border-inner)" }}>|</span>}
                              <span className="font-bold" style={{ color: net >= 0 ? "#10B981" : "#EF4444" }}>
                                淨 {net >= 0 ? "+" : "−"}NT${fmt(Math.abs(net))}
                              </span>
                            </div>
                          );
                        })()}
                      </div>

                      {group.items.map((tx, i) => {
                        const isSelected = batchMode && selectedIds.has(tx.id);
                        return (
                        <div key={tx.id}
                          className="group flex items-center gap-3 px-5 py-3.5 transition-colors"
                          style={{
                            borderBottom: i < group.items.length - 1 ? "1px solid var(--border-inner)" : undefined,
                            borderLeft: `3px solid ${tx.type === "收入" ? "#10B98160" : "#EF444460"}`,
                            background: isSelected ? "rgba(59,130,246,0.08)" : "transparent",
                          }}
                          onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "var(--bg-input)"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = isSelected ? "rgba(59,130,246,0.08)" : "transparent"; }}
                        >
                          {/* Batch checkbox */}
                          {batchMode && (
                            <input
                              type="checkbox"
                              checked={selectedIds.has(tx.id)}
                              onChange={e => setSelectedIds(prev => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(tx.id); else next.delete(tx.id);
                                return next;
                              })}
                              className="w-4 h-4 flex-shrink-0 cursor-pointer accent-blue-500"
                            />
                          )}
                          {/* Type indicator — small badge, hover reveals toggle */}
                          <button
                            onClick={() => updateTxCategory(tx.id, tx.category, tx.type === "收入" ? "支出" : "收入")}
                            title="點擊切換收入／支出"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-[13px] font-black flex-shrink-0 transition-opacity hover:opacity-70"
                            style={{
                              background: tx.type === "收入" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
                              color: tx.type === "收入" ? "#10B981" : "#EF4444",
                              border: `1px solid ${tx.type === "收入" ? "#10B98130" : "#EF444430"}`,
                            }}>
                            {tx.type === "收入" ? "↑" : "↓"}
                          </button>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <SourceBadge source={tx.source} />
                              <span className="text-[14px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                                {tx.note || tx.category}
                              </span>
                            </div>
                            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                              {editingTxId === tx.id ? (
                                <CategoryPicker
                                  txId={tx.id}
                                  txType={tx.type}
                                  onPick={(id, cat, type) => updateTxCategory(id, cat, type)}
                                  onCancel={() => setEditingTxId(null)}
                                  customCats={tx.type === "收入" ? customIncomeCats : customExpenseCats}
                                />
                              ) : (
                                <button
                                  onClick={() => setEditingTxId(tx.id)}
                                  title="點擊修改分類"
                                  className="text-[14px] px-2 py-0.5 rounded-md transition-all"
                                  style={tx.category === "其他" ? {
                                    color: "#FFFFFF",
                                    background: "#B45309",
                                    border: "1px solid #D97706",
                                    fontWeight: 700,
                                  } : {
                                    color: "var(--text-sub)",
                                    background: "var(--bg-input)",
                                    border: "1px solid var(--border-inner)",
                                  }}>
                                  {tx.category === "其他" ? "⚠ 其他 → 點擊分類" : `${tx.category} ✎`}
                                </button>
                              )}
                              {/* Mood tag — only for 支出 */}
                              {tx.type === "支出" && (() => {
                                const moodMeta: Record<string, { icon: string; color: string; bg: string; desc: string }> = {
                                  必要: { icon: "✅", color: "#34D399", bg: "rgba(16,185,129,0.12)", desc: "生活必需，不可省" },
                                  計畫: { icon: "📋", color: "#60A5FA", bg: "rgba(59,130,246,0.12)", desc: "事先規劃的支出" },
                                  衝動: { icon: "⚡", color: "#F87171", bg: "rgba(239,68,68,0.12)", desc: "臨時起意，可考慮省" },
                                };
                                const meta = tx.mood ? moodMeta[tx.mood] : null;
                                const pickerOpen = moodPickerId === tx.id;
                                return (
                                  <div className="relative">
                                    <button
                                      onClick={() => setMoodPickerId(pickerOpen ? null : tx.id)}
                                      title="標記此筆支出的消費性質（必要 / 計畫 / 衝動）"
                                      className="text-[13px] px-1.5 py-0.5 rounded-md transition-all hover:opacity-80"
                                      style={meta ? {
                                        color: meta.color, background: meta.bg, border: `1px solid ${meta.color}40`,
                                      } : {
                                        color: "var(--text-muted)", background: "transparent", border: "1px dashed var(--border-inner)",
                                      }}>
                                      {meta ? `${meta.icon} ${tx.mood}` : "🏷 性質"}
                                    </button>
                                    {pickerOpen && (
                                      <>
                                        <div className="fixed inset-0 z-30" onClick={() => setMoodPickerId(null)} />
                                        <div className="absolute left-0 top-full mt-1 z-40 rounded-xl overflow-hidden shadow-xl flex flex-col"
                                          style={{ background: "var(--bg-card)", border: "1px solid var(--border)", minWidth: 140 }}>
                                          <div className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wide" style={{ color: "var(--text-muted)" }}>消費性質</div>
                                          {(["必要", "計畫", "衝動"] as const).map(m => (
                                            <button key={m}
                                              onClick={() => updateTxMood(tx.id, m)}
                                              className="px-3 py-2 text-left transition-colors hover:opacity-80"
                                              style={{ color: moodMeta[m].color, background: tx.mood === m ? moodMeta[m].bg : "transparent" }}>
                                              <span className="block text-[13px] font-semibold">{moodMeta[m].icon} {m}</span>
                                              <span className="block text-[11px] opacity-60">{moodMeta[m].desc}</span>
                                            </button>
                                          ))}
                                          {tx.mood && (
                                            <button
                                              onClick={() => updateTxMood(tx.id, null)}
                                              className="px-3 py-2 text-[13px] transition-colors hover:opacity-80"
                                              style={{ color: "var(--text-muted)", borderTop: "1px solid var(--border-inner)" }}>
                                              ✕ 移除標記
                                            </button>
                                          )}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>

                          {/* Amount */}
                          <div className="text-right flex-shrink-0">
                            <p className="text-[16px] font-black"
                              style={{ color: tx.type === "收入" ? "#10B981" : "#EF4444" }}>
                              {tx.type === "收入" ? "+" : "−"}NT$ {fmt(tx.amount)}
                            </p>
                          </div>

                          {/* Split — hover only */}
                          <button
                            onClick={() => {
                              setSplitModal({ id: tx.id, date: tx.date, amount: tx.amount, type: tx.type, category: tx.category, note: tx.note });
                              const half = Math.floor(tx.amount / 2);
                              setSplitParts([
                                { category: tx.category, amount: String(half), note: "" },
                                { category: tx.category, amount: String(tx.amount - half), note: "" },
                              ]);
                            }}
                            title="分割此筆"
                            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all opacity-0 group-hover:opacity-100 hover:bg-blue-500/10 text-[13px]"
                            style={{ color: "#60A5FA" }}>
                            ⑂
                          </button>
                          {/* Delete — hover only */}
                          <button
                            onClick={() => deleteTx(tx.id)}
                            title="刪除此筆"
                            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all opacity-0 group-hover:opacity-100 hover:bg-red-500/10"
                            style={{ color: "#F87171" }}>
                            ✕
                          </button>
                        </div>
                      );
                      })}
                    </div>
                  ))}
                  {/* Infinite scroll sentinel */}
                  {txData && txData.page < txData.totalPages ? (
                    <div ref={txSentinelRef} className="flex justify-center py-6">
                      {txLoading && <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />}
                    </div>
                  ) : txData && txData.items.length > 0 ? (
                    <div className="py-5 text-center text-[13px]" style={{ color: "var(--text-muted)" }}>
                      — 已顯示全部 {txData.total} 筆 —
                    </div>
                  ) : null}
                  {/* Batch action bar */}
                  {batchMode && (
                    <div className="sticky bottom-4 mx-4 mt-3 px-4 py-3 rounded-2xl flex items-center gap-3 flex-wrap shadow-2xl"
                      style={{ background: "var(--bg-card)", border: "2px solid #3B82F6", zIndex: 50 }}>
                      <span className="text-[14px] font-bold" style={{ color: "#60A5FA" }}>
                        已選 {selectedIds.size} 筆
                      </span>
                      <button
                        onClick={() => {
                          const allIds = (txMoodFilter ? txData!.items.filter(t => t.mood === txMoodFilter) : txData!.items).map(t => t.id);
                          setSelectedIds(prev => prev.size === allIds.length ? new Set() : new Set(allIds));
                        }}
                        className="text-[13px] px-2 py-1 rounded-lg transition-all"
                        style={{ background: "var(--bg-input)", color: "var(--text-sub)", border: "1px solid var(--border)" }}>
                        {selectedIds.size === txData!.items.length ? "取消全選" : "全選本頁"}
                      </button>
                      <div className="flex-1" />
                      {/* Merge button — only show when 2+ selected */}
                      {selectedIds.size >= 2 && (
                        <button
                          onClick={() => { setMergeForm({ category: "", note: "" }); setMergeModal(true); }}
                          className="text-[14px] font-bold px-3 py-1.5 rounded-lg transition-all"
                          style={{ background: "rgba(245,158,11,0.15)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.35)" }}>
                          ⊕ 合併 {selectedIds.size} 筆
                        </button>
                      )}
                      <span className="text-[13px] font-semibold" style={{ color: "var(--text-muted)" }}>改備註：</span>
                      <input
                        type="text"
                        placeholder="輸入新備註…"
                        value={batchNote}
                        onChange={e => setBatchNote(e.target.value)}
                        className="text-[13px] px-2 py-1 rounded-lg outline-none w-36"
                        style={{ background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                      />
                      <button
                        disabled={!batchNote.trim() || selectedIds.size === 0 || batchUpdating}
                        onClick={() => batchUpdateNote(batchNote)}
                        className="text-[13px] font-bold px-3 py-1.5 rounded-lg transition-all disabled:opacity-40"
                        style={{ background: "rgba(16,185,129,0.15)", color: "#10B981", border: "1px solid rgba(16,185,129,0.35)" }}>
                        {batchUpdating ? "…" : "套用"}
                      </button>
                      <div className="w-px h-5 flex-shrink-0" style={{ background: "var(--border-inner)" }} />
                      <span className="text-[13px] font-semibold" style={{ color: "var(--text-muted)" }}>改分類：</span>
                      <select
                        value={batchCat}
                        onChange={e => setBatchCat(e.target.value)}
                        className="text-[14px] px-2 py-1 rounded-lg"
                        style={{ background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                        <option value="">請選擇分類</option>
                        {categories.map(c => <option key={c} value={c} style={{ background: "var(--bg-card)" }}>{c}</option>)}
                      </select>
                      <button
                        disabled={!batchCat || selectedIds.size === 0 || batchUpdating}
                        onClick={() => batchUpdateCategory(batchCat)}
                        className="text-[14px] font-bold px-4 py-1.5 rounded-lg transition-all disabled:opacity-40"
                        style={{ background: "var(--btn-gradient)", color: "#fff" }}>
                        {batchUpdating ? "更新中…" : `確認更改 →`}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-16 flex flex-col items-center gap-3">
                  <p className="text-4xl">📋</p>
                  <p className="text-[15px] font-semibold" style={{ color: "var(--text-sub)" }}>尚無交易記錄</p>
                  <p className="text-[14px] text-center max-w-xs" style={{ color: "var(--text-muted)" }}>
                    透過 LINE Bot 傳送消費訊息，或前往「匯入資料」上傳銀行 CSV 對帳單
                  </p>
                  <div className="flex gap-2 mt-1">
                    <button onClick={() => setActiveTab("import")}
                      className="px-4 py-2 rounded-xl text-[14px] font-semibold text-white"
                      style={{ background: "var(--btn-gradient)" }}>匯入資料 →</button>
                    <button onClick={() => setAddModal(true)}
                      className="px-4 py-2 rounded-xl text-[14px] font-semibold"
                      style={{ border: "1px solid var(--border)", color: "var(--text-sub)" }}>手動新增</button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ── Loans ── */}
        {activeTab === "loans" && (
          <div className="space-y-8">
            <FixedExpenseManager isDemo={isDemo.current} monthlyIncome={data?.totals?.income ?? 0} />
            <div>
              <p className="text-[15px] font-bold mb-4" style={{ color: "var(--text-sub)" }}>還債優化建議</p>
              <DebtOptimizer isDemo={isDemo.current} />
            </div>
            <div>
              <p className="text-[15px] font-bold mb-4" style={{ color: "var(--text-sub)" }}>貸款與信用卡管理</p>
              <LoanManager isDemo={isDemo.current} />
            </div>
          </div>
        )}

        {/* ── Budget ── */}
        {activeTab === "budget" && <BudgetManager extraCategories={customExpenseCats} />}

        {/* ── Subscriptions ── */}
        {activeTab === "subscriptions" && <SubscriptionDetector isDemo={isDemo.current} />}

        {/* ── Advanced Analysis (進階財務分析) ── */}
        {activeTab === "annual"            && <AnnualReport      isDemo={isDemo.current} />}
        {activeTab === "retirement"        && <RetirementCalc    isDemo={isDemo.current} />}
        {activeTab === "fire"              && <FireCalc          isDemo={isDemo.current} />}
        {activeTab === "income-stability"  && <IncomeStability   isDemo={isDemo.current} />}
        {activeTab === "expense-ratio"     && <ExpenseRatio      isDemo={isDemo.current} />}
        {activeTab === "account-flow"       && <AccountFlow        isDemo={isDemo.current} />}
        {activeTab === "spending-forecast"  && <SpendingForecast   isDemo={isDemo.current} />}
        {activeTab === "cashflow-forecast"  && <CashflowForecast   isDemo={isDemo.current} />}
        {activeTab === "bill-calendar"      && <BillCalendar        isDemo={isDemo.current} />}
        {activeTab === "savings-plan"       && <SavingsPlan          isDemo={isDemo.current} onNavigate={t => setActiveTab(t as TabId)} />}
        {activeTab === "education-program" && <EducationProgramPlanner isDemo={isDemo.current} />}
        {activeTab === "grad-school"       && <GradSchoolPlanner       isDemo={isDemo.current} />}

        {/* ── Payees ── */}
        {activeTab === "payees"      && <PayeeManager />}
        {activeTab === "categories"  && <CategoryManager isDemo={isDemo.current} />}

        {/* ── Import ── */}
        {activeTab === "import" && (
          <div className="space-y-6">
            {/* ── JSON 備份還原 ── */}
            <JsonRestorePanel onComplete={fetchData} />

            <CsvImport lineUserId={lineUserId} onImportComplete={() => {
              fetchData();
              // refresh duplicate list after import
              if (isDemo.current) return;
              fetch("/api/duplicate-candidates")
                .then(r => r.json())
                .then((d: { pairs: DuplicatePair[] }) => { setDuplicatePairs(d.pairs); setDismissedDupPairs(new Set()); })
                .catch(() => {});
            }} />

            {/* Duplicate review */}
            {duplicatePairs.filter(p => !dismissedDupPairs.has(dupKey(p))).length > 0 && (
              <Card>
                <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--border-inner)" }}>
                  <p className="text-[15px] font-bold" style={{ color: "var(--text-primary)" }}>疑似重複交易</p>
                  <p className="text-[14px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                    以下交易金額相同、日期相近但來源不同，可能是匯入重複。請逐筆確認後刪除或保留。
                  </p>
                </div>
                <div className="divide-y" style={{ borderColor: "var(--border-inner)" }}>
                  {duplicatePairs
                    .filter(p => !dismissedDupPairs.has(dupKey(p)))
                    .map(pair => (
                      <div key={dupKey(pair)} className="px-6 py-4">
                        <div className="flex items-start gap-4 flex-wrap">
                          <div className="flex-1 min-w-0 space-y-2">
                            {([pair.a, pair.b] as const).map((tx, idx) => (
                              <div key={tx.id} className="flex items-center gap-2 text-[14px] flex-wrap">
                                <span className="text-[14px] font-bold px-2 py-0.5 rounded" style={{ background: "var(--bg-input)", color: "var(--text-sub)" }}>
                                  {idx === 0 ? "A" : "B"}
                                </span>
                                <SourceBadge source={tx.source} />
                                <span className="font-bold" style={{ color: tx.type === "支出" ? "#F87171" : "#34D399" }}>
                                  {tx.type === "支出" ? "−" : "+"}NT$ {fmt(tx.amount)}
                                </span>
                                <span style={{ color: "var(--text-muted)" }}>{tx.date}</span>
                                <span className="text-[14px] px-1.5 py-0.5 rounded" style={{ background: "var(--bg-input)", color: "var(--text-sub)" }}>{tx.category}</span>
                                {tx.note && <span className="truncate max-w-[160px]" style={{ color: "var(--text-muted)" }}>{tx.note}</span>}
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                            <button
                              onClick={() => deleteDupTx(pair.a.id, pair)}
                              disabled={dupDeleting.has(pair.a.id)}
                              className="px-3 py-1.5 rounded-lg text-[14px] font-semibold transition-opacity hover:opacity-70 disabled:opacity-40"
                              style={{ background: "rgba(239,68,68,0.12)", color: "#F87171", border: "1px solid rgba(239,68,68,0.25)" }}>
                              刪除 A
                            </button>
                            <button
                              onClick={() => dismissDup(pair)}
                              className="px-3 py-1.5 rounded-lg text-[14px] font-semibold transition-opacity hover:opacity-70"
                              style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                              保留兩筆
                            </button>
                            <button
                              onClick={() => deleteDupTx(pair.b.id, pair)}
                              disabled={dupDeleting.has(pair.b.id)}
                              className="px-3 py-1.5 rounded-lg text-[14px] font-semibold transition-opacity hover:opacity-70 disabled:opacity-40"
                              style={{ background: "rgba(239,68,68,0.12)", color: "#F87171", border: "1px solid rgba(239,68,68,0.25)" }}>
                              刪除 B
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ── Audit ── */}
        {activeTab === "audit" && (
          <div className="space-y-4">
            {/* 篩選列 */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[14px] font-medium" style={{ color: "var(--text-sub)" }}>篩選類型：</span>
              {(["", "mcp_call", "csv_import", "pdf_import", "notion_sync"] as const).map(f => (
                <button key={f || "all"}
                  onClick={() => { setAuditFilter(f); setAuditPage(1); }}
                  className="text-[14px] px-3 py-1 rounded-md font-medium transition-colors"
                  style={{
                    background: auditFilter === f ? "var(--accent)" : "var(--card-bg)",
                    color:      auditFilter === f ? "#fff"           : "var(--text-sub)",
                    border:     "1px solid var(--border-inner)",
                  }}>
                  {f === "" ? "全部" : f === "mcp_call" ? "MCP 呼叫" : f === "csv_import" ? "CSV 匯入" : f === "pdf_import" ? "PDF 匯入" : "Notion 同步"}
                </button>
              ))}
              <span className="ml-auto text-[14px]" style={{ color: "var(--text-muted)" }}>共 {auditTotal} 筆</span>
            </div>

            {/* 記錄表格 */}
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-inner)" }}>
              <table className="w-full text-[14px]">
                <thead>
                  <tr style={{ background: "var(--card-bg)", borderBottom: "1px solid var(--border-inner)" }}>
                    {["時間", "類型", "工具 / 來源", "摘要", "狀態"].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 font-semibold" style={{ color: "var(--text-sub)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {auditLoading ? (
                    <tr><td colSpan={5} className="text-center py-10" style={{ color: "var(--text-muted)" }}>載入中...</td></tr>
                  ) : auditLogs.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-10" style={{ color: "var(--text-muted)" }}>尚無記錄</td></tr>
                  ) : auditLogs.map((log, i) => {
                    const dt = new Date(log.createdAt);
                    const dateStr = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;
                    const timeStr = `${String(dt.getHours()).padStart(2,"0")}:${String(dt.getMinutes()).padStart(2,"0")}:${String(dt.getSeconds()).padStart(2,"0")}`;
                    const ACTION_LABEL: Record<string, string> = { mcp_call: "MCP 呼叫", csv_import: "CSV 匯入", pdf_import: "PDF 匯入", notion_sync: "Notion 同步" };
                    const ACTION_COLOR: Record<string, string> = { mcp_call: "#8B5CF6", csv_import: "#3B82F6", pdf_import: "#F59E0B", notion_sync: "#10B981" };
                    const actionLabel = ACTION_LABEL[log.action] ?? log.action;
                    const actionColor = ACTION_COLOR[log.action] ?? "#64748B";
                    const summaryText = log.summary
                      ? Object.entries(log.summary).map(([k, v]) => `${k}: ${v}`).join("　")
                      : log.params
                        ? Object.entries(log.params).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join("　").slice(0, 60)
                        : "—";
                    return (
                      <tr key={log.id}
                        style={{ background: i % 2 === 0 ? "transparent" : "var(--card-bg)", borderBottom: "1px solid var(--border-inner)" }}>
                        <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                          <div style={{ color: "var(--text-primary)" }}>{dateStr}</div>
                          <div className="text-[14px]">{timeStr}</div>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[14px] font-bold"
                            style={{ color: actionColor, background: actionColor + "18", border: `1px solid ${actionColor}40` }}>
                            {actionLabel}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[14px]" style={{ color: "var(--text-primary)" }}>
                          {log.tool ?? "—"}
                        </td>
                        <td className="px-4 py-2.5 max-w-xs truncate" style={{ color: "var(--text-sub)" }} title={summaryText}>
                          {log.errorMsg ? <span style={{ color: "#EF4444" }}>{log.errorMsg.slice(0, 60)}</span> : summaryText}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[14px] font-bold"
                            style={{
                              color:      log.status === "success" ? "#10B981" : "#EF4444",
                              background: log.status === "success" ? "#10B98118" : "#EF444418",
                              border:     `1px solid ${log.status === "success" ? "#10B98140" : "#EF444440"}`,
                            }}>
                            {log.status === "success" ? "成功" : "錯誤"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 分頁 */}
            {auditPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button disabled={auditPage <= 1} onClick={() => setAuditPage(p => p - 1)}
                  className="px-3 py-1 rounded-md text-[14px] disabled:opacity-40"
                  style={{ background: "var(--card-bg)", border: "1px solid var(--border-inner)", color: "var(--text-sub)" }}>
                  上一頁
                </button>
                <span className="text-[14px]" style={{ color: "var(--text-muted)" }}>
                  第 {auditPage} / {auditPages} 頁
                </span>
                <button disabled={auditPage >= auditPages} onClick={() => setAuditPage(p => p + 1)}
                  className="px-3 py-1 rounded-md text-[14px] disabled:opacity-40"
                  style={{ background: "var(--card-bg)", border: "1px solid var(--border-inner)", color: "var(--text-sub)" }}>
                  下一頁
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Guide ── */}
        {activeTab === "guide" && <UserGuide />}

        {/* ── Duplicate Review ── */}
        {activeTab === "duplicate-review" && <DuplicateReview />}

      </main>

      {/* ── Split Transaction Modal ── */}
      {splitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) setSplitModal(null); }}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "0 24px 60px rgba(0,0,0,0.4)" }}>
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-bold" style={{ color: "var(--text-primary)" }}>分割交易</h3>
              <button onClick={() => setSplitModal(null)} className="text-xl leading-none hover:opacity-60 transition-opacity" style={{ color: "var(--text-muted)" }}>×</button>
            </div>
            {/* Original */}
            <div className="rounded-xl px-4 py-3 flex items-center justify-between"
              style={{ background: "var(--bg-input)", border: "1px solid var(--border-inner)" }}>
              <div>
                <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>原始交易 · {splitModal.date}</p>
                <p className="text-[14px] font-semibold mt-0.5" style={{ color: "var(--text-primary)" }}>{splitModal.note || splitModal.category}</p>
              </div>
              <p className="text-[18px] font-black" style={{ color: splitModal.type === "收入" ? "#10B981" : "#EF4444" }}>
                NT$ {fmt(splitModal.amount)}
              </p>
            </div>
            {/* Split parts */}
            <div className="space-y-3">
              {splitParts.map((part, i) => (
                <div key={i} className="rounded-xl p-3 space-y-2" style={{ background: "var(--bg-input)", border: "1px solid var(--border-inner)" }}>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-bold" style={{ color: "var(--text-muted)" }}>分割 {i + 1}</span>
                    {splitParts.length > 2 && (
                      <button onClick={() => setSplitParts(p => p.filter((_, j) => j !== i))}
                        className="text-[12px] hover:opacity-60" style={{ color: "var(--text-muted)" }}>移除</button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <select value={part.category} onChange={e => setSplitParts(p => p.map((x, j) => j === i ? { ...x, category: e.target.value } : x))}
                      className="flex-1 rounded-lg px-2 py-1.5 text-[13px] outline-none"
                      style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                      <option value="">選分類</option>
                      {categories.map(c => <option key={c} value={c} style={{ background: "var(--bg-card)" }}>{c}</option>)}
                    </select>
                    <input type="number" min="0" placeholder="金額" value={part.amount}
                      onChange={e => setSplitParts(p => p.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))}
                      className="w-24 rounded-lg px-2 py-1.5 text-[13px] outline-none"
                      style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                  </div>
                  <input type="text" placeholder="備註（選填）" value={part.note}
                    onChange={e => setSplitParts(p => p.map((x, j) => j === i ? { ...x, note: e.target.value } : x))}
                    className="w-full rounded-lg px-2 py-1.5 text-[13px] outline-none"
                    style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                </div>
              ))}
            </div>
            {/* Sum check */}
            {(() => {
              const sum = splitParts.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
              const diff = Math.abs(sum - splitModal.amount);
              return (
                <div className="flex items-center justify-between text-[13px] px-1">
                  <span style={{ color: "var(--text-muted)" }}>合計</span>
                  <span className="font-bold" style={{ color: diff > 0.5 ? "#EF4444" : "#10B981" }}>
                    NT$ {fmt(sum)}{diff > 0.5 ? ` (差 ${fmt(diff)})` : " ✓"}
                  </span>
                </div>
              );
            })()}
            <button onClick={() => setSplitParts(p => [...p, { category: splitModal.category, amount: "", note: "" }])}
              className="text-[13px] w-full py-1.5 rounded-lg transition-all"
              style={{ background: "var(--bg-input)", color: "var(--text-sub)", border: "1px solid var(--border-inner)" }}>
              + 新增分割項目
            </button>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setSplitModal(null)}
                className="flex-1 py-2.5 rounded-xl text-[14px] font-semibold hover:opacity-70 transition-opacity"
                style={{ border: "1px solid var(--border)", color: "var(--text-sub)" }}>取消</button>
              <button onClick={saveSplit} disabled={splitSaving}
                className="flex-1 py-2.5 rounded-xl text-[14px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{ background: "var(--btn-gradient)" }}>
                {splitSaving ? "分割中…" : "確認分割"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Merge Transactions Modal ── */}
      {mergeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) setMergeModal(false); }}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "0 24px 60px rgba(0,0,0,0.4)" }}>
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-bold" style={{ color: "var(--text-primary)" }}>合併 {selectedIds.size} 筆交易</h3>
              <button onClick={() => setMergeModal(false)} className="text-xl leading-none hover:opacity-60 transition-opacity" style={{ color: "var(--text-muted)" }}>×</button>
            </div>
            <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
              將選取的 {selectedIds.size} 筆合併為一筆，金額加總，以最早日期為準。原始紀錄將被刪除。
            </p>
            <div>
              <label className="text-[14px] font-medium mb-1 block" style={{ color: "var(--text-sub)" }}>合併後分類</label>
              <select value={mergeForm.category} onChange={e => setMergeForm(f => ({ ...f, category: e.target.value }))}
                className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                <option value="">請選擇分類</option>
                {categories.map(c => <option key={c} value={c} style={{ background: "var(--bg-card)" }}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[14px] font-medium mb-1 block" style={{ color: "var(--text-sub)" }}>備註（選填）</label>
              <input type="text" placeholder="合併後的說明…" value={mergeForm.note}
                onChange={e => setMergeForm(f => ({ ...f, note: e.target.value }))}
                className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setMergeModal(false)}
                className="flex-1 py-2.5 rounded-xl text-[14px] font-semibold hover:opacity-70 transition-opacity"
                style={{ border: "1px solid var(--border)", color: "var(--text-sub)" }}>取消</button>
              <button onClick={saveMerge} disabled={mergeSaving || !mergeForm.category}
                className="flex-1 py-2.5 rounded-xl text-[14px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{ background: "linear-gradient(135deg,#92400E,#F59E0B)" }}>
                {mergeSaving ? "合併中…" : "確認合併"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Transaction Modal ── */}
      {addModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) setAddModal(false); }}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "0 24px 60px rgba(0,0,0,0.4)" }}>
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-bold" style={{ color: "var(--text-primary)" }}>新增記帳</h3>
              <button onClick={() => setAddModal(false)} className="text-xl leading-none hover:opacity-60 transition-opacity" style={{ color: "var(--text-muted)" }}>×</button>
            </div>

            {/* Type toggle */}
            <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              {["收入", "支出"].map(t => (
                <button key={t} onClick={() => setAddForm(f => ({ ...f, type: t }))}
                  className="flex-1 py-2 text-[14px] font-bold transition-all"
                  style={addForm.type === t
                    ? { background: t === "收入" ? "linear-gradient(135deg,#065F46,#10B981)" : "linear-gradient(135deg,#7F1D1D,#EF4444)", color: "#fff" }
                    : { background: "transparent", color: "var(--text-sub)" }}>
                  {t === "收入" ? "↑ 收入" : "↓ 支出"}
                </button>
              ))}
            </div>

            {/* Date */}
            <div>
              <label className="text-[14px] font-medium mb-1 block" style={{ color: "var(--text-sub)" }}>日期</label>
              <input type="date" value={addForm.date} onChange={e => setAddForm(f => ({ ...f, date: e.target.value }))}
                className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>

            {/* Amount */}
            <div>
              <label className="text-[14px] font-medium mb-1 block" style={{ color: "var(--text-sub)" }}>金額（NT$）</label>
              <input type="number" min="0" placeholder="0" value={addForm.amount}
                onChange={e => setAddForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>

            {/* Category */}
            <div>
              <label className="text-[14px] font-medium mb-1 block" style={{ color: "var(--text-sub)" }}>分類</label>
              <div className="flex flex-wrap gap-1 mb-2">
                {[...(addForm.type === "收入" ? QUICK_CATS_INCOME : QUICK_CATS_EXPENSE), ...(addForm.type === "收入" ? customIncomeCats : customExpenseCats).filter(c => !(addForm.type === "收入" ? QUICK_CATS_INCOME : QUICK_CATS_EXPENSE).includes(c))].map(c => (
                  <button key={c} type="button"
                    onClick={() => setAddForm(f => ({ ...f, category: c }))}
                    className="text-[14px] px-2 py-0.5 rounded-md font-medium transition-all"
                    style={{
                      background: addForm.category === c ? "var(--accent)" : "var(--bg-input)",
                      color:      addForm.category === c ? "#fff"          : "var(--text-sub)",
                      border:     addForm.category === c ? "1px solid var(--accent)" : "1px solid var(--border-inner)",
                    }}>
                    {c}
                  </button>
                ))}
              </div>
              <input list="add-cats" placeholder="或自訂分類名稱…" value={addForm.category}
                onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))}
                className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              <datalist id="add-cats">
                {categories.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>

            {/* Note */}
            <div>
              <label className="text-[14px] font-medium mb-1 block" style={{ color: "var(--text-sub)" }}>備註（選填）</label>
              <NoteTemplatePicker onSelect={note => setAddForm(f => ({ ...f, note }))} />
              <input type="text" placeholder="說明用途，或點擊上方模板快速填入…" value={addForm.note}
                onChange={e => setAddForm(f => ({ ...f, note: e.target.value }))}
                onKeyDown={e => { if (e.key === "Enter") saveManualTx(); }}
                className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => setAddModal(false)}
                className="flex-1 py-2.5 rounded-xl text-[14px] font-semibold transition-opacity hover:opacity-70"
                style={{ border: "1px solid var(--border)", color: "var(--text-sub)" }}>
                取消
              </button>
              <button onClick={saveManualTx} disabled={addSaving}
                className="flex-1 py-2.5 rounded-xl text-[14px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{ background: "var(--btn-gradient)" }}>
                {addSaving ? "儲存中…" : "儲存"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
