"use client";

import { useEffect, useState, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  PieChart, Pie, ResponsiveContainer,
} from "recharts";
import CsvImport from "@/components/CsvImport";
import LoanManager from "@/components/LoanManager";
import { THEMES, themeToCSS, type AppTheme } from "@/lib/themes";

// ── Types ─────────────────────────────────────────────────────────────────────
interface MonthlySummary { month: string; income: number; expense: number }
interface CategorySummary { category: string; type: "收入" | "支出"; total: number }
interface RecentTransaction { id: string; date: string; amount: number; category: string; type: string; note: string; source: string }
interface SummaryData {
  monthly: MonthlySummary[];
  byCategory: CategorySummary[];
  recent: RecentTransaction[];
  totals: { income: number; expense: number; net: number };
}
interface BankBalanceItem { source: string; balance: number; asOfDate: string }
interface NetWorth {
  totalAssets: number; totalLoanDebt: number; totalCreditDebt: number;
  totalDebt: number; netWorth: number; monthlyInterest: number; totalInterestPaid: number;
}
type TabId = "charts" | "transactions" | "loans" | "import" | "guide";

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
  { id: "charts",       label: "圖表分析" },
  { id: "transactions", label: "交易記錄" },
  { id: "loans",        label: "貸款管理" },
  { id: "import",       label: "匯入資料" },
  { id: "guide",        label: "使用說明" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return Math.abs(n).toLocaleString("zh-TW", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
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
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold flex-shrink-0 border"
      style={{ color, borderColor: color + "40", backgroundColor: color + "18", letterSpacing: "0.02em" }}>
      {label}
    </span>
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
  const [data,       setData]       = useState<SummaryData | null>(null);
  const [balances,   setBalances]   = useState<BankBalanceItem[]>([]);
  const [netWorth,   setNetWorth]   = useState<NetWorth | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [recatLoading, setRecatLoading] = useState(false);
  const [recatMsg,   setRecatMsg]   = useState<string | null>(null);
  const [months,     setMonths]     = useState(6);
  const [activeTab,  setActiveTab]  = useState<TabId>("charts");
  const [txData,     setTxData]     = useState<TxPage | null>(null);
  const [txPage,     setTxPage]     = useState(1);
  const [txLoading,  setTxLoading]  = useState(false);
  const [editingTxId,  setEditingTxId]  = useState<string | null>(null);
  const [categories,   setCategories]   = useState<string[]>([]);
  const [theme,        setTheme]        = useState<AppTheme>(THEMES[1]); // slate default
  const [addModal,     setAddModal]     = useState(false);
  const [notionSyncing, setNotionSyncing] = useState(false);
  const [notionMsg,     setNotionMsg]     = useState<string | null>(null);
  const [addForm,      setAddForm]      = useState({ date: new Date().toISOString().split("T")[0], type: "收入", amount: "", category: "", note: "" });
  const [addSaving,    setAddSaving]    = useState(false);
  const TX_LIMIT = 30;
  const lineUserId = "dashboard_user";

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [s, b, nw] = await Promise.all([
        fetch(`/api/summary?months=${months}`),
        fetch("/api/balances"),
        fetch("/api/net-worth"),
      ]);
      setData(await s.json() as SummaryData);
      setBalances(await b.json() as BankBalanceItem[]);
      setNetWorth(await nw.json() as NetWorth);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [months]);

  const fetchTxPage = useCallback(async (page: number) => {
    setTxLoading(true);
    try {
      const res = await fetch(`/api/transactions?page=${page}&limit=${TX_LIMIT}`);
      setTxData(await res.json() as TxPage);
    } catch (e) { console.error(e); }
    finally { setTxLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

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
    fetch("/api/transactions/categories")
      .then(r => r.json())
      .then((cats: string[]) => setCategories(cats))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (activeTab === "transactions") fetchTxPage(txPage);
  }, [activeTab, txPage, fetchTxPage]);

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
      setAddForm({ date: new Date().toISOString().split("T")[0], type: "收入", amount: "", category: "", note: "" });
      setCategories(prev => prev.includes(addForm.category.trim()) ? prev : [...prev, addForm.category.trim()].sort());
      // refresh tx list if on transactions tab
      if (activeTab === "transactions") fetchTxPage(1);
      fetchData();
    } catch (e) { console.error(e); }
    setAddSaving(false);
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
      // add new category to local list if not already present
      setCategories(prev => prev.includes(cat) ? prev : [...prev, cat].sort());
    } catch (e) { console.error(e); }
    setEditingTxId(null);
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

  const expenseCats  = data?.byCategory.filter(c => c.type === "支出") ?? [];
  const incomeCats   = data?.byCategory.filter(c => c.type === "收入") ?? [];
  const expenseTotal = expenseCats.reduce((s, c) => s + c.total, 0);
  const incomeTotal  = incomeCats.reduce((s, c) => s + c.total, 0);

  const nw = netWorth?.netWorth ?? 0;

  return (
    <div className="min-h-screen" data-theme={theme.id} style={{
      background: "var(--bg-page)",
      fontFamily: "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
      color: "var(--text-primary)",
    }}>
      <style>{themeToCSS(theme)}</style>

      {/* ── Header ── */}
      <header className="sticky top-0 z-20 border-b" style={{ background: "var(--bg-card)", borderColor: "var(--border)", boxShadow: "var(--card-shadow)" }}>

        {/* Top row */}
        <div className="max-w-5xl mx-auto px-7 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--btn-gradient)", boxShadow: "0 0 16px rgba(59,130,246,0.4)" }}>
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-[19px] font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>個人記帳系統</p>
              <p className="text-[10px] font-semibold tracking-[0.18em] uppercase" style={{ color: "var(--accent)" }}>Personal Finance Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Theme switcher */}
            <div className="flex rounded-xl overflow-hidden mr-1" style={{ border: "1px solid var(--border)" }}>
              {THEMES.map(t => (
                <button key={t.id} onClick={() => switchTheme(t)}
                  className="px-3 py-1.5 text-[12px] font-bold transition-all"
                  style={theme.id === t.id
                    ? { background: "var(--btn-gradient)", color: "#fff" }
                    : { background: "transparent", color: "var(--text-sub)" }}>
                  {t.name}
                </button>
              ))}
            </div>
            <select value={months} onChange={e => setMonths(+e.target.value)}
              className="text-[13px] font-medium rounded-xl px-3 py-2 outline-none cursor-pointer"
              style={{ background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-sub)" }}>
              <option value={3}>近 3 個月</option>
              <option value={6}>近 6 個月</option>
              <option value={12}>近 12 個月</option>
            </select>
            <button onClick={handleNotionSync} disabled={notionSyncing}
              className="text-[13px] font-semibold px-4 py-2 rounded-xl disabled:opacity-40 transition-colors"
              style={{ background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-sub)" }}>
              {notionSyncing ? "同步中…" : "同步 Notion"}
            </button>
            <button onClick={handleRecategorize} disabled={recatLoading}
              className="text-[13px] font-semibold px-4 py-2 rounded-xl disabled:opacity-40 transition-colors"
              style={{ background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--accent-light)" }}>
              {recatLoading ? "分析中…" : "AI 重新分類"}
            </button>
            <button onClick={fetchData}
              className="text-[13px] font-semibold text-white px-4 py-2 rounded-xl transition-opacity hover:opacity-90"
              style={{ background: "var(--btn-gradient)", boxShadow: "0 0 12px rgba(59,130,246,0.3)" }}>
              重新整理
            </button>
          </div>
        </div>

        {/* Tab nav */}
        <div className="max-w-5xl mx-auto px-7 flex" style={{ borderTop: "1px solid var(--border-inner)" }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="relative px-6 py-3.5 text-[14px] font-semibold tracking-wide transition-colors duration-200"
              style={{ color: activeTab === tab.id ? "var(--accent-light)" : "var(--text-sub)" }}>
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-4 right-4 h-[2px] rounded-full" style={{ background: "linear-gradient(90deg, #1D4ED8, #60A5FA)" }} />
              )}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-7 py-6 space-y-5 pb-10">

        {/* Toast */}
        {recatMsg && (
          <div className="rounded-2xl px-5 py-3 flex items-center justify-between" style={{ background: "#0D2010", border: "1px solid #166534" }}>
            <p className="text-[13px] font-medium text-emerald-400">{recatMsg}</p>
            <button onClick={() => setRecatMsg(null)} className="text-emerald-600 text-lg">×</button>
          </div>
        )}
        {notionMsg && (
          <div className="rounded-2xl px-5 py-3 flex items-center justify-between" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>Notion：{notionMsg}</p>
            <button onClick={() => setNotionMsg(null)} className="text-lg" style={{ color: "var(--text-muted)" }}>×</button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
          </div>
        )}

        {/* ── Charts tab ── */}
        {!loading && activeTab === "charts" && (
          <div className="space-y-5">

            {/* Hero: 淨資產 */}
            <div className="rounded-2xl p-6 relative overflow-hidden" style={{
              background: "var(--hero-bg)",
              border: "1px solid var(--hero-border)",
              boxShadow: "0 0 40px rgba(37,99,235,0.12)",
            }}>
              <div className="absolute top-0 right-0 w-72 h-72 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)" }} />
              <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(96,165,250,0.06) 0%, transparent 70%)" }} />
              <p className="text-[12px] font-semibold tracking-[0.12em] uppercase mb-2 relative" style={{ color: "var(--accent-light)" }}>NET WORTH · 淨資產</p>
              <p className="text-[52px] font-black tracking-tight leading-none relative mb-5"
                style={{ color: nw < 0 ? "#F87171" : "#FFFFFF", textShadow: nw < 0 ? "0 0 24px rgba(248,113,113,0.35)" : "0 0 24px rgba(255,255,255,0.12)" }}>
                {nw < 0 ? "−" : ""}NT$ {fmt(nw)}
              </p>
              <div className="grid grid-cols-2 gap-3 relative sm:grid-cols-4">
                {[
                  { label: "本期收入",   value: data?.totals.income         ?? 0, pos: true  },
                  { label: "本期支出",   value: data?.totals.expense        ?? 0, pos: false },
                  { label: "貸款餘額",   value: netWorth?.totalLoanDebt     ?? 0, pos: null  },
                  { label: "信用卡未繳", value: netWorth?.totalCreditDebt   ?? 0, pos: null  },
                ].map(item => (
                  <div key={item.label} className="rounded-xl px-4 py-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <p className="text-[11px] font-medium mb-1.5 tracking-wide" style={{ color: "rgba(147,197,253,0.75)" }}>{item.label}</p>
                    <p className="text-[20px] font-bold" style={{ color: item.pos === true ? "#34D399" : item.pos === false ? "#F87171" : "rgba(255,255,255,0.75)" }}>
                      {item.pos === true ? "+" : item.pos === false ? "−" : ""}NT$ {fmt(item.value)}
                    </p>
                  </div>
                ))}
              </div>
              {(netWorth?.monthlyInterest ?? 0) > 0 && (
                <p className="text-[12px] mt-4 relative" style={{ color: "rgba(147,197,253,0.7)" }}>
                  每月利息約 NT$ {fmt(netWorth!.monthlyInterest)} · 累計已繳利息 NT$ {fmt(netWorth!.totalInterestPaid)}
                </p>
              )}
            </div>

            {/* Bank balances */}
            {balances.length > 0 && (
              <Card>
                <div className="px-6 pt-5 pb-4 flex items-center justify-between">
                  <p className="text-[15px] font-bold text-[var(--text-primary)]">銀行餘額</p>
                  <p className="text-[13px]" style={{ color: "var(--text-sub)" }}>合計 NT$ {fmt(balances.reduce((s, b) => s + b.balance, 0))}</p>
                </div>
                <div className="flex gap-3 px-6 pb-5 overflow-x-auto scrollbar-none">
                  {balances.map(b => (
                    <div key={b.source} className="flex-shrink-0 rounded-xl px-4 py-3 min-w-[130px]"
                      style={{ background: "var(--bg-input)", border: b.source === "cash" ? "1px solid #22C55E40" : "1px solid var(--border-inner)" }}>
                      <p className="text-[11px] font-semibold mb-1.5 tracking-wide"
                        style={{ color: b.source === "cash" ? "#22C55E" : "var(--accent)" }}>
                        {SOURCE_LABELS[b.source] ?? b.source}
                      </p>
                      <p className="text-[20px] font-bold text-[var(--text-primary)]">NT$ {fmt(b.balance)}</p>
                      {b.source === "cash"
                        ? <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>由現金分類累計</p>
                        : <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>{b.asOfDate}</p>
                      }
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {data && <>
              {/* Chart 1: 收支趨勢 Area */}
              <Card className="p-6">
                <p className="text-[16px] font-bold text-[var(--text-primary)] mb-0.5">收支趨勢</p>
                <p className="text-[12px] mb-5" style={{ color: "var(--text-sub)" }}>近 {months} 個月收入 vs 支出</p>
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
                ) : <p className="text-center py-14 text-sm" style={{ color: "var(--text-muted)" }}>尚無資料</p>}
                <div className="flex gap-5 mt-3">
                  {[{ color: "#10B981", label: "收入" }, { color: "#EF4444", label: "支出" }].map(l => (
                    <div key={l.label} className="flex items-center gap-2">
                      <span className="w-4 h-[3px] rounded-full" style={{ backgroundColor: l.color }} />
                      <span className="text-[12px]" style={{ color: "var(--text-sub)" }}>{l.label}</span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Chart 2: 資產 & 負債分佈 Donut */}
              {netWorth && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* 資產分佈 */}
                  <Card className="p-6">
                    <p className="text-[16px] font-bold text-[var(--text-primary)] mb-0.5">資產分佈</p>
                    <p className="text-[12px] mb-4" style={{ color: "var(--text-sub)" }}>各銀行帳戶餘額</p>
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
                              <span className="text-[13px] flex-1 truncate" style={{ color: "var(--text-sub)" }}>{SOURCE_LABELS[b.source] ?? b.source}</span>
                              <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>{netWorth.totalAssets > 0 ? Math.round((b.balance / netWorth.totalAssets) * 100) : 0}%</span>
                              <span className="text-[14px] font-bold text-[var(--text-primary)] w-28 text-right">NT$ {fmt(b.balance)}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : <p className="text-center py-10 text-sm" style={{ color: "var(--text-muted)" }}>尚無銀行餘額</p>}
                  </Card>

                  {/* 負債分佈 */}
                  <Card className="p-6">
                    <p className="text-[16px] font-bold text-[var(--text-primary)] mb-0.5">負債分佈</p>
                    <p className="text-[12px] mb-4" style={{ color: "var(--text-sub)" }}>貸款 vs 信用卡未繳</p>
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
                                <span className="text-[13px] flex-1 truncate" style={{ color: "var(--text-sub)" }}>{d.name}</span>
                                <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>{Math.round((d.total / netWorth.totalDebt) * 100)}%</span>
                                <span className="text-[14px] font-bold text-[var(--text-primary)] w-28 text-right">NT$ {fmt(d.total)}</span>
                              </div>
                            ))}
                            <div className="pt-2 flex items-center justify-between" style={{ borderTop: "1px solid var(--border-inner)" }}>
                              <span className="text-[12px]" style={{ color: "var(--text-sub)" }}>資產負債比</span>
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
                        <p className="text-[13px] font-semibold" style={{ color: "#34D399" }}>無負債</p>
                      </div>
                    )}
                  </Card>
                </div>
              )}

              {/* Chart 3 & 4: 支出/收入分類 Donut */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {[
                  { title: "支出分類", cats: expenseCats, total: expenseTotal },
                  { title: "收入分類", cats: incomeCats,  total: incomeTotal },
                ].map(({ title, cats, total }) => (
                  <Card key={title} className="p-6">
                    <p className="text-[16px] font-bold text-[var(--text-primary)] mb-5">{title}</p>
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
                          {cats.slice(0, 6).map((item, i) => (
                            <div key={item.category} className="flex items-center gap-2.5">
                              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                              <span className="text-[13px] flex-1 truncate" style={{ color: "var(--text-sub)" }}>{item.category}</span>
                              <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>{total > 0 ? Math.round((item.total / total) * 100) : 0}%</span>
                              <span className="text-[14px] font-bold text-[var(--text-primary)] w-28 text-right">NT$ {fmt(item.total)}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : <p className="text-center py-10 text-sm" style={{ color: "var(--text-muted)" }}>尚無資料</p>}
                  </Card>
                ))}
              </div>

              {/* Chart 5: 支出排行 Horizontal Bar */}
              {expenseCats.length > 0 && (
                <Card className="p-6">
                  <p className="text-[16px] font-bold text-[var(--text-primary)] mb-0.5">支出金額排行</p>
                  <p className="text-[12px] mb-5" style={{ color: "var(--text-sub)" }}>各分類累計支出</p>
                  <div className="space-y-3">
                    {[...expenseCats].sort((a, b) => b.total - a.total).slice(0, 8).map((item, i) => (
                      <div key={item.category} className="flex items-center gap-3">
                        <span className="text-[12px] w-16 text-right flex-shrink-0" style={{ color: "var(--text-sub)" }}>{item.category}</span>
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
            </>}
          </div>
        )}

        {/* ── Transactions ── */}
        {activeTab === "transactions" && (
          <div className="space-y-4">
            {/* Summary bar */}
            {data && (
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "總收入", value: data.totals.income,  color: "#34D399", prefix: "+" },
                  { label: "總支出", value: data.totals.expense, color: "#F87171", prefix: "−" },
                  { label: "淨收支", value: Math.abs(data.totals.net), color: data.totals.net >= 0 ? "#34D399" : "#F87171", prefix: data.totals.net >= 0 ? "+" : "−" },
                ].map(item => (
                  <div key={item.label} className="rounded-2xl px-5 py-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                    <p className="text-[11px] font-medium mb-1" style={{ color: "var(--text-sub)" }}>{item.label}</p>
                    <p className="text-[18px] font-black" style={{ color: item.color }}>{item.prefix}NT$ {fmt(item.value)}</p>
                  </div>
                ))}
              </div>
            )}

            <Card>
              {/* Header + pagination */}
              <div className="px-6 py-4 flex items-center justify-between flex-wrap gap-3" style={{ borderBottom: "1px solid var(--border-inner)" }}>
                <div className="flex items-center gap-3">
                  <p className="text-[16px] font-bold text-[var(--text-primary)]">交易記錄</p>
                  {txData && <span className="text-[12px] px-2 py-0.5 rounded-full" style={{ background: "var(--border-inner)", color: "var(--text-sub)" }}>共 {txData.total} 筆</span>}
                  <button onClick={() => setAddModal(true)}
                    className="text-[12px] font-bold px-3 py-1 rounded-lg transition-opacity hover:opacity-80"
                    style={{ background: "var(--btn-gradient)", color: "#fff" }}>
                    ＋ 新增
                  </button>
                </div>
                {txData && txData.totalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button disabled={txPage <= 1}
                      onClick={() => { setTxPage(p => p - 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                      className="px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-all disabled:opacity-30"
                      style={{ border: "1px solid var(--border)", color: "var(--text-sub)" }}>←</button>
                    {Array.from({ length: txData.totalPages }, (_, i) => i + 1)
                      .filter(p => p === 1 || p === txData.totalPages || Math.abs(p - txPage) <= 1)
                      .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                        if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("…");
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((p, i) =>
                        p === "…"
                          ? <span key={`e${i}`} className="text-[13px] px-1" style={{ color: "var(--text-muted)" }}>…</span>
                          : <button key={p} onClick={() => { setTxPage(p as number); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                              className="w-8 h-8 rounded-lg text-[13px] font-bold transition-all"
                              style={txPage === p ? { background: "var(--btn-gradient)", color: "#fff" } : { color: "var(--text-sub)" }}>
                              {p}
                            </button>
                      )}
                    <button disabled={txPage >= txData.totalPages}
                      onClick={() => { setTxPage(p => p + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                      className="px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-all disabled:opacity-30"
                      style={{ border: "1px solid var(--border)", color: "var(--text-sub)" }}>→</button>
                  </div>
                )}
              </div>

              {txLoading ? (
                <div className="flex justify-center py-16">
                  <div className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
                </div>
              ) : txData && txData.items.length > 0 ? (
                <div>
                  {groupByDate(txData.items).map(group => (
                    <div key={group.label}>
                      {/* Date group header */}
                      <div className="px-5 py-2 flex items-center gap-3" style={{ background: "var(--bg-input)", borderBottom: "1px solid var(--border-inner)" }}>
                        <span className="text-[11px] font-bold tracking-widest uppercase" style={{ color: "var(--accent)" }}>{group.label}</span>
                        <span className="flex-1 h-px" style={{ background: "var(--border-inner)" }} />
                        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                          {group.items.reduce((s, t) => t.type === "支出" ? s - t.amount : s + t.amount, 0) >= 0 ? "+" : ""}
                          NT$ {fmt(Math.abs(group.items.reduce((s, t) => t.type === "支出" ? s - t.amount : s + t.amount, 0)))}
                        </span>
                      </div>

                      {group.items.map((tx, i) => (
                        <div key={tx.id}
                          className="flex items-center gap-3 px-5 py-3.5 transition-all"
                          style={{
                            borderBottom: i < group.items.length - 1 ? "1px solid var(--border-inner)" : undefined,
                            background: "transparent",
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-input)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >
                          {/* Type toggle button */}
                          <button
                            onClick={() => updateTxCategory(tx.id, tx.category, tx.type === "收入" ? "支出" : "收入")}
                            title="點擊切換收入／支出"
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-[13px] font-black flex-shrink-0 transition-opacity hover:opacity-70"
                            style={{
                              background: tx.type === "收入" ? "linear-gradient(135deg,#065F46,#10B981)" : "linear-gradient(135deg,#7F1D1D,#EF4444)",
                              color: "#fff",
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
                            <div className="mt-1 flex items-center gap-1.5">
                              {editingTxId === tx.id ? (
                                <div onClick={e => e.stopPropagation()}>
                                  <input
                                    autoFocus
                                    list={`cats-${tx.id}`}
                                    defaultValue={tx.category}
                                    onBlur={e => updateTxCategory(tx.id, e.target.value, tx.type)}
                                    onKeyDown={e => {
                                      if (e.key === "Enter") updateTxCategory(tx.id, (e.target as HTMLInputElement).value, tx.type);
                                      if (e.key === "Escape") setEditingTxId(null);
                                    }}
                                    className="text-[12px] rounded-lg px-2 py-0.5 outline-none w-28"
                                    style={{ background: "var(--bg-input)", border: "1px solid var(--accent)", color: "var(--text-primary)" }}
                                  />
                                  <datalist id={`cats-${tx.id}`}>
                                    {categories.map(c => <option key={c} value={c} />)}
                                  </datalist>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setEditingTxId(tx.id)}
                                  title="點擊修改分類"
                                  className="text-[11px] px-2 py-0.5 rounded-md transition-all"
                                  style={{
                                    color: "var(--text-sub)",
                                    background: "var(--bg-input)",
                                    border: "1px solid var(--border-inner)",
                                  }}>
                                  {tx.category} ✎
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Amount */}
                          <div className="text-right flex-shrink-0">
                            <p className="text-[16px] font-black"
                              style={{ color: tx.type === "收入" ? "#10B981" : "#EF4444" }}>
                              {tx.type === "收入" ? "+" : "−"}NT$ {fmt(tx.amount)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-16 text-sm" style={{ color: "var(--text-muted)" }}>尚無交易記錄</p>
              )}
            </Card>
          </div>
        )}

        {/* ── Loans ── */}
        {activeTab === "loans" && <LoanManager />}

        {/* ── Import ── */}
        {activeTab === "import" && (
          <CsvImport lineUserId={lineUserId} onImportComplete={fetchData} />
        )}

        {/* ── Guide ── */}
        {activeTab === "guide" && (
          <div className="space-y-4">
            {[
              {
                icon: "💬",
                title: "LINE 記帳（最快速）",
                color: "#10B981",
                items: [
                  { label: "一般支出", example: "早餐 80" },
                  { label: "指定分類", example: "交通 悠遊卡 150" },
                  { label: "收入", example: "薪資入帳 50000" },
                  { label: "現金提款", example: "提款 3000（分類選現金）" },
                  { label: "查詢本月摘要", example: "傳送「摘要」或「本月」" },
                ],
                note: "AI 會自動判斷金額、分類、備註，不需要特定格式。",
              },
              {
                icon: "📁",
                title: "CSV 匯入銀行對帳單",
                color: "#3B82F6",
                items: [
                  { label: "玉山銀行存款", example: "CSV / XLS" },
                  { label: "中國信託存款", example: "CSV（Big5 編碼）" },
                  { label: "兆豐銀行存款", example: "CSV" },
                  { label: "元大銀行存款", example: "CSV" },
                  { label: "永豐銀行存款", example: "CSV" },
                  { label: "凱基銀行存款", example: "CSV（AI 解析）" },
                  { label: "永豐信用卡", example: "PDF（AI 解析）" },
                ],
                note: "至「匯入資料」頁面，選擇銀行或自動偵測，上傳檔案即可。系統自動去除重複紀錄。凱基存款、永豐信用卡由 AI 自動解析格式。",
              },
              {
                icon: "✏️",
                title: "手動新增記帳",
                color: "#8B5CF6",
                items: [
                  { label: "進入「交易記錄」頁面", example: "" },
                  { label: "點擊標題列的「＋ 新增」按鈕", example: "" },
                  { label: "填入日期、類型（收入/支出）、金額、分類、備註", example: "" },
                  { label: "儲存後立即出現在記錄中，並更新圖表統計", example: "" },
                ],
                note: "適合記錄現金消費、非銀行往來的臨時收支。",
              },
              {
                icon: "💵",
                title: "現金追蹤",
                color: "#22C55E",
                items: [
                  { label: "ATM 提款後，將該筆交易分類改為「現金」", example: "" },
                  { label: "圖表分析 → 銀行餘額 會自動累計現金欄位", example: "" },
                  { label: "支出類型的現金分類 = 累加（提款進口袋）", example: "" },
                  { label: "收入類型的現金分類 = 扣除（存回銀行）", example: "" },
                ],
                note: "現金欄位 = Σ(現金類型:支出) − Σ(現金類型:收入)，反映實際口袋現金。",
              },
              {
                icon: "🏦",
                title: "貸款管理",
                color: "#F59E0B",
                items: [
                  { label: "進入「貸款管理」頁面新增貸款", example: "本金、利率、起始日" },
                  { label: "記錄每月還款明細", example: "本金 + 利息分開記錄" },
                  { label: "貸款餘額自動反映在淨資產計算", example: "" },
                  { label: "累計已繳利息統計顯示在淨資產卡片", example: "" },
                ],
                note: "支援多筆貸款並行管理，狀態可切換為已結清。",
              },
              {
                icon: "🏷️",
                title: "分類管理",
                color: "#06B6D4",
                items: [
                  { label: "預設分類", example: "飲食 / 交通 / 娛樂 / 購物 / 醫療 / 薪資 / 獎金 / 現金 / 其他" },
                  { label: "AI 自動分類：LINE 傳入的記帳自動判斷", example: "" },
                  { label: "手動修改：交易記錄中點擊分類標籤即可編輯", example: "" },
                  { label: "新輸入的分類名稱會自動加入下拉選單", example: "" },
                  { label: "標題列「AI 重新分類」可批次重新判斷所有記錄", example: "" },
                ],
                note: "分類名稱沒有限制，直接輸入任意文字即可建立新分類。",
              },
            ].map(section => (
              <Card key={section.title} className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">{section.icon}</span>
                  <h3 className="text-[16px] font-bold" style={{ color: section.color }}>{section.title}</h3>
                </div>
                <div className="space-y-2 mb-3">
                  {section.items.map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: section.color }} />
                      <span className="text-[13px] flex-1" style={{ color: "var(--text-primary)" }}>{item.label}</span>
                      {item.example && (
                        <span className="text-[12px] px-2 py-0.5 rounded-md font-mono flex-shrink-0"
                          style={{ background: `${section.color}15`, color: section.color }}>
                          {item.example}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                {section.note && (
                  <p className="text-[12px] mt-3 pt-3 leading-relaxed" style={{ color: "var(--text-muted)", borderTop: "1px solid var(--border-inner)" }}>
                    💡 {section.note}
                  </p>
                )}
              </Card>
            ))}
          </div>
        )}

      </main>

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
                  className="flex-1 py-2 text-[13px] font-bold transition-all"
                  style={addForm.type === t
                    ? { background: t === "收入" ? "linear-gradient(135deg,#065F46,#10B981)" : "linear-gradient(135deg,#7F1D1D,#EF4444)", color: "#fff" }
                    : { background: "transparent", color: "var(--text-sub)" }}>
                  {t === "收入" ? "↑ 收入" : "↓ 支出"}
                </button>
              ))}
            </div>

            {/* Date */}
            <div>
              <label className="text-[12px] font-medium mb-1 block" style={{ color: "var(--text-sub)" }}>日期</label>
              <input type="date" value={addForm.date} onChange={e => setAddForm(f => ({ ...f, date: e.target.value }))}
                className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>

            {/* Amount */}
            <div>
              <label className="text-[12px] font-medium mb-1 block" style={{ color: "var(--text-sub)" }}>金額（NT$）</label>
              <input type="number" min="0" placeholder="0" value={addForm.amount}
                onChange={e => setAddForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>

            {/* Category */}
            <div>
              <label className="text-[12px] font-medium mb-1 block" style={{ color: "var(--text-sub)" }}>分類</label>
              <input list="add-cats" placeholder="飲食、交通、薪資…" value={addForm.category}
                onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))}
                className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              <datalist id="add-cats">
                {categories.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>

            {/* Note */}
            <div>
              <label className="text-[12px] font-medium mb-1 block" style={{ color: "var(--text-sub)" }}>備註（選填）</label>
              <input type="text" placeholder="說明用途…" value={addForm.note}
                onChange={e => setAddForm(f => ({ ...f, note: e.target.value }))}
                onKeyDown={e => { if (e.key === "Enter") saveManualTx(); }}
                className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => setAddModal(false)}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold transition-opacity hover:opacity-70"
                style={{ border: "1px solid var(--border)", color: "var(--text-sub)" }}>
                取消
              </button>
              <button onClick={saveManualTx} disabled={addSaving}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
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
