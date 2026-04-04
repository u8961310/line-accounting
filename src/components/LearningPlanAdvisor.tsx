"use client";

import { useEffect, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

interface GoalItem { id: string; name: string; emoji: string; savedAmount: number; linkedSource: string | null }
interface BalanceItem { source: string; balance: number }
interface MonthlySummary { month: string; income: number; expense: number }
interface SummaryData { monthly: MonthlySummary[] }
interface LoanItem {
  status: string; remainingPrincipal: string; interestRate: string; endDate: string | null;
  payments: { principalPaid: string; interestPaid: string }[];
}
interface FixedExpenseItem { amount: number }
interface BudgetItem { amount: number }

// ── Storage keys ──────────────────────────────────────────────────────────

const GRAD_KEY = "grad_school_plan_v1";
const EDU_KEY  = "education_program_plan_v1";

interface GradPlan {
  linkedGoalId?: string; tuition?: number; living?: number; monthlyStipend?: number;
  duration?: number; initialSavings?: number;
}
interface EduPlan {
  linkedGoalId?: string; augustAmount?: number; februaryAmount?: number;
  startYear?: number; startMonth?: number; totalPayments?: number; paidCount?: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (!Number.isFinite(n)) return "0";
  return Math.abs(Math.round(n)).toLocaleString("zh-TW");
}

function getMonthsUntil(year: number, month: number): number {
  const now = new Date();
  return Math.max(0, (year - now.getFullYear()) * 12 + (month - 1 - now.getMonth()));
}

/** 下一筆教育學程繳費 */
function getNextEduPayment(edu: EduPlan): { label: string; amount: number; monthsAway: number } | null {
  const startYear  = edu.startYear  ?? new Date().getFullYear();
  const startMonth = edu.startMonth ?? 8;
  const total      = edu.totalPayments ?? 4;
  const paid       = edu.paidCount     ?? 0;
  if (paid >= total) return null;

  const cursor = new Date(startYear, startMonth - 1, 1);
  for (let i = 0; i < total; i++) {
    const month = cursor.getMonth() + 1;
    const y     = cursor.getFullYear();
    const monthsAway = getMonthsUntil(y, month);
    const amount = month === 8 ? (edu.augustAmount ?? 45000) : (edu.februaryAmount ?? 45000);
    if (i >= paid && monthsAway >= 0) {
      return { label: `${y} 年 ${month} 月`, amount, monthsAway };
    }
    cursor.setMonth(cursor.getMonth() + 6);
  }
  return null;
}

/** 研究所入學前需還的貸款月數（用於估算 loansDuringSchool） */
function getLoansDuringSchool(loans: LoanItem[], duration: number): number {
  const ENROLL_YM = "2028-09";
  return loans
    .filter(l => l.status === "active")
    .reduce((s, l) => {
      const payoffDate = l.endDate ? l.endDate.slice(0, 7) : null;
      if (payoffDate && payoffDate < ENROLL_YM) return s;
      const pay = l.payments?.[0];
      const monthly = pay ? Number(pay.principalPaid) + Number(pay.interestPaid) : 0;
      if (!monthly) return s;
      const overlapMonths = payoffDate
        ? (() => {
            const [py, pm] = payoffDate.split("-").map(Number);
            return Math.min(duration, (py - 2028) * 12 + (pm - 9));
          })()
        : duration;
      return s + monthly * Math.max(0, overlapMonths);
    }, 0);
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function LearningPlanAdvisor({ isDemo }: { isDemo: boolean }) {
  const [goals,    setGoals]    = useState<GoalItem[]>([]);
  const [balances, setBalances] = useState<BalanceItem[]>([]);
  const [avgMonthlyIncome,   setAvgMonthlyIncome]   = useState(0);
  const [totalFixedExpenses, setTotalFixedExpenses] = useState(0);
  const [totalLoanMonthly,   setTotalLoanMonthly]   = useState(0);
  const [totalBudget,        setTotalBudget]        = useState(0);
  const [loans,    setLoans]    = useState<LoanItem[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [grad, setGrad] = useState<GradPlan | null>(null);
  const [edu,  setEdu]  = useState<EduPlan  | null>(null);

  // 讀 localStorage
  useEffect(() => {
    try { setGrad(JSON.parse(localStorage.getItem(GRAD_KEY) ?? "null")); } catch { /* ignore */ }
    try { setEdu( JSON.parse(localStorage.getItem(EDU_KEY)  ?? "null")); } catch { /* ignore */ }
  }, []);

  // 載入 API
  useEffect(() => {
    if (isDemo) {
      setGoals([{ id: "g1", name: "研究所基金", emoji: "🎓", savedAmount: 350000, linkedSource: "esun_bank" }]);
      setBalances([{ source: "esun_bank", balance: 350000 }]);
      setAvgMonthlyIncome(75000);
      setTotalFixedExpenses(30000);
      setTotalLoanMonthly(13000);
      setTotalBudget(15000);
      setLoans([
        { status: "active", remainingPrincipal: "46239", interestRate: "16", endDate: "2026-10", payments: [{ principalPaid: "4500", interestPaid: "616" }] },
        { status: "active", remainingPrincipal: "300000", interestRate: "4.5", endDate: "2029-06", payments: [{ principalPaid: "7500", interestPaid: "1125" }] },
      ]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const thisMonth = new Date().toISOString().slice(0, 7);
    Promise.allSettled([
      fetch("/api/goals").then(r => r.json()),
      fetch("/api/balances").then(r => r.json()),
      fetch("/api/summary?months=3").then(r => r.json()),
      fetch("/api/fixed-expenses").then(r => r.json()),
      fetch("/api/loans").then(r => r.json()),
      fetch(`/api/budgets?month=${thisMonth}`).then(r => r.json()),
    ]).then(([goalsRes, balancesRes, sumRes, fixedRes, loansRes, budgetsRes]) => {
      setGoals(    goalsRes.status    === "fulfilled" && Array.isArray(goalsRes.value)    ? goalsRes.value    : []);
      setBalances( balancesRes.status === "fulfilled" && Array.isArray(balancesRes.value) ? balancesRes.value : []);
      const sumData: SummaryData | null = sumRes.status === "fulfilled" && sumRes.value && "monthly" in sumRes.value ? sumRes.value as SummaryData : null;
      const fixedRaw   = fixedRes.status   === "fulfilled" && fixedRes.value   && typeof fixedRes.value   === "object" ? fixedRes.value   : {};
      const budgetsRaw = budgetsRes.status === "fulfilled" && budgetsRes.value && typeof budgetsRes.value === "object" ? budgetsRes.value : {};
      const loansData: LoanItem[] = loansRes.status === "fulfilled" && Array.isArray(loansRes.value) ? loansRes.value : [];
      const fixedData: FixedExpenseItem[] = Array.isArray((fixedRaw as { fixedExpenses?: unknown }).fixedExpenses) ? (fixedRaw as { fixedExpenses: FixedExpenseItem[] }).fixedExpenses : [];
      const budgetsData: BudgetItem[]     = Array.isArray((budgetsRaw as { budgets?: unknown }).budgets)           ? (budgetsRaw as { budgets: BudgetItem[] }).budgets           : [];

      const recent = (sumData?.monthly ?? []).slice(-3);
      if (recent.length > 0)
        setAvgMonthlyIncome(recent.reduce((s, m) => s + (Number(m.income) || 0), 0) / recent.length);

      setTotalFixedExpenses(fixedData.reduce((s, f) => s + f.amount, 0));
      setTotalLoanMonthly(loansData.filter(l => l.status === "active").reduce((s, l) => {
        const pay = l.payments?.[0];
        return pay ? s + Number(pay.principalPaid) + Number(pay.interestPaid)
                   : s + Number(l.remainingPrincipal) * (Number(l.interestRate) / 100 / 12);
      }, 0));
      setTotalBudget(budgetsData.reduce((s, b) => s + b.amount, 0));
      setLoans(loansData);
    }).catch(e => console.error("[LearningPlanAdvisor]", e))
      .finally(() => setLoading(false));
  }, [isDemo]);

  // ── Computed ──────────────────────────────────────────────────────────────

  // 共用銀行餘額（以研究所計畫的連結帳戶為準）
  const gradGoal = grad?.linkedGoalId ? goals.find(g => g.id === grad!.linkedGoalId) : null;
  const sharedSavings = (() => {
    if (gradGoal?.linkedSource) {
      const bank = balances.find(b => b.source === gradGoal!.linkedSource);
      return bank ? bank.balance : (gradGoal?.savedAmount ?? 0);
    }
    return gradGoal?.savedAmount ?? (grad?.initialSavings ?? 0);
  })();

  // 每月可動用（收入 - 固定 - 貸款 - 預算）
  const monthlyAvailable = avgMonthlyIncome - totalFixedExpenses - totalLoanMonthly - totalBudget;

  // ── 教育學程 ──
  const nextEdu = edu ? getNextEduPayment(edu) : null;
  const eduMonthsAway    = nextEdu?.monthsAway ?? 0;
  const eduNextAmount    = nextEdu?.amount ?? 0;
  // 每月需為教育學程預留（針對下一筆）
  const eduMonthlyReserve = eduMonthsAway > 0
    ? Math.max(0, eduNextAmount - sharedSavings) / eduMonthsAway
    : 0;
  // 就學期間有收入 → 下一筆後的繳費可靠薪資支應
  const eduHasIncomeWhileStudying = true; // 明確設計前提

  // ── 研究所 ──
  const ENROLL_YEAR = 2028; const ENROLL_MONTH = 9;
  const gradMonthsLeft = getMonthsUntil(ENROLL_YEAR, ENROLL_MONTH);
  const gradDuration   = grad?.duration ?? 24;
  const netLiving      = Math.max(0, (grad?.living ?? 0) - (grad?.monthlyStipend ?? 0));
  const loansDuringSchool = getLoansDuringSchool(loans, gradDuration);
  const gradTotalTarget = (grad?.tuition ?? 0) + netLiving * gradDuration + loansDuringSchool;
  const gradSavingsForGoal = Math.max(0, sharedSavings - eduNextAmount); // 扣除教育學程下一筆後，剩給研究所
  const gradGap = Math.max(0, gradTotalTarget - sharedSavings);
  const gradMonthlyNeed = gradMonthsLeft > 0 ? gradGap / gradMonthsLeft : 0;
  // 就學期間沒有薪資收入（只有公費零用金，已算入 monthlyStipend）

  // ── 建議配置 ──
  const remainingAfterEdu = monthlyAvailable - eduMonthlyReserve;
  const canCoverBoth  = monthlyAvailable >= eduMonthlyReserve + gradMonthlyNeed;
  const shortage      = Math.max(0, (eduMonthlyReserve + gradMonthlyNeed) - monthlyAvailable);

  // 優先順序
  const priorities = [
    {
      rank: 1,
      plan: "教育學程",
      icon: "📚",
      color: "#F59E0B",
      reason: `${nextEdu ? `${nextEdu.label}（${eduMonthsAway} 個月後）需繳 NT$ ${fmt(eduNextAmount)}` : "無待繳款項"}。就學期間仍有薪資收入，繳費後可從薪資補回存款，財務壓力相對可控。`,
      monthlyReserve: eduMonthlyReserve,
      urgent: eduMonthsAway <= 4,
    },
    {
      rank: 2,
      plan: "研究所規劃",
      icon: "🎓",
      color: "#6366F1",
      reason: `2028/09 入學，還有 ${gradMonthsLeft} 個月。公費生可直接分發公立學校、免學費，長期生涯發展價值更高。入學後無薪資收入，入學前是唯一的儲蓄窗口。`,
      monthlyReserve: gradMonthlyNeed,
      urgent: gradMonthsLeft <= 12,
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 rounded-full animate-spin"
          style={{ borderColor: "var(--accent-light)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  if (!grad && !edu) {
    return (
      <div className="text-center py-16">
        <p className="text-[15px]" style={{ color: "var(--text-muted)" }}>
          請先在「研究所規劃」和「教育學程」各自完成設定
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto">

      {/* ── Header ── */}
      <div>
        <h2 className="text-[22px] font-black" style={{ color: "var(--text-primary)" }}>
          🧭 學習規劃建議
        </h2>
        <p className="text-[13px] mt-0.5" style={{ color: "var(--text-muted)" }}>
          整合教育學程與研究所規劃，給出儲蓄分配建議
        </p>
      </div>

      {/* ── 關鍵差異說明 ── */}
      <div className="rounded-2xl p-5 space-y-3"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-card)" }}>
        <p className="text-[13px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>兩個計畫的根本差異</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            {
              icon: "📚", title: "教育學程", color: "#F59E0B",
              points: [
                `每半年繳費一次（8月 / 2月），每次約 NT$ ${fmt((edu?.augustAmount ?? 45000 + (edu?.februaryAmount ?? 45000)) / 2)}`,
                "就學期間仍有薪資收入",
                "繳費後可從薪資補回存款",
                "緊急優先：下次繳費期限固定",
              ],
            },
            {
              icon: "🎓", title: "研究所規劃", color: "#6366F1",
              points: [
                `2028/09 入學，還有 ${gradMonthsLeft} 個月`,
                "公費生：直接分發公立學校、免學費",
                "就學期間無薪資收入（僅公費零用金）",
                "入學前必須備好所有資金，入學後無法再追存",
              ],
            },
          ].map(card => (
            <div key={card.title} className="rounded-xl p-4"
              style={{ background: `${card.color}0d`, border: `1px solid ${card.color}25` }}>
              <p className="text-[14px] font-bold mb-2" style={{ color: card.color }}>
                {card.icon} {card.title}
              </p>
              {card.points.map((p, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[12px] mt-1" style={{ color: "var(--text-muted)" }}>
                  <span className="mt-0.5 flex-shrink-0" style={{ color: card.color }}>›</span>
                  <span>{p}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── 優先順序 ── */}
      <p className="text-[11px] font-bold uppercase tracking-widest mt-2" style={{ color: "var(--text-muted)" }}>建議優先順序</p>
      <div className="space-y-2">
        {priorities.map(p => (
          <div key={p.rank} className="flex items-start gap-4 rounded-2xl px-5 py-4"
            style={{ background: "var(--bg-card)", border: `1px solid ${p.color}25` }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-black text-[15px]"
              style={{ background: p.color, color: "#000" }}>
              {p.rank}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[15px] font-bold" style={{ color: p.color }}>{p.icon} {p.plan}</span>
                {p.urgent && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: "#EF444420", color: "#EF4444" }}>緊急</span>
                )}
                <span className="text-[12px] ml-auto tabular-nums" style={{ color: "var(--text-muted)" }}>
                  每月預留 NT$ {fmt(p.monthlyReserve)}
                </span>
              </div>
              <p className="text-[12px] mt-1" style={{ color: "var(--text-muted)" }}>{p.reason}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── 每月儲蓄分配 ── */}
      <p className="text-[11px] font-bold uppercase tracking-widest mt-2" style={{ color: "var(--text-muted)" }}>每月儲蓄分配建議</p>
      <div className="rounded-2xl p-5"
        style={{ background: "var(--bg-card)", border: `1px solid ${canCoverBoth ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)"}` }}>

        {/* 收入流向圖 */}
        <div className="space-y-2 mb-4">
          {[
            { label: "每月可動用收入", value: monthlyAvailable, color: "#34D399", sign: "" },
            { label: `① 教育學程預留（距下筆 ${eduMonthsAway} 個月）`, value: -eduMonthlyReserve, color: "#F59E0B", sign: "−" },
            { label: `② 研究所儲蓄（距入學 ${gradMonthsLeft} 個月）`, value: -gradMonthlyNeed, color: "#818CF8", sign: "−" },
          ].map((row, i) => (
            <div key={i} className="flex items-center justify-between text-[13px]">
              <span style={{ color: "var(--text-muted)" }}>{row.label}</span>
              <span className="font-bold tabular-nums" style={{ color: row.color }}>
                {row.sign} NT$ {fmt(Math.abs(row.value))}
              </span>
            </div>
          ))}
          <div className="border-t pt-2 mt-1" style={{ borderColor: "var(--border-inner)" }}>
            <div className="flex items-center justify-between text-[14px] font-bold">
              <span style={{ color: "var(--text-primary)" }}>每月剩餘</span>
              <span style={{ color: canCoverBoth ? "#10B981" : "#EF4444" }}>
                {canCoverBoth ? "" : "−"} NT$ {fmt(Math.abs(monthlyAvailable - eduMonthlyReserve - gradMonthlyNeed))}
              </span>
            </div>
          </div>
        </div>

        {/* 配置比例視覺化 */}
        {monthlyAvailable > 0 && (
          <div className="mt-3">
            <p className="text-[11px] mb-1.5" style={{ color: "var(--text-muted)" }}>月收入分配比例</p>
            <div className="flex h-4 rounded-full overflow-hidden gap-0.5">
              {[
                { value: eduMonthlyReserve,  color: "#F59E0B", label: "教育學程" },
                { value: gradMonthlyNeed,     color: "#6366F1", label: "研究所" },
                { value: Math.max(0, monthlyAvailable - eduMonthlyReserve - gradMonthlyNeed), color: "#10B98140", label: "剩餘" },
              ].map((seg, i) => {
                const pct = Math.min(100, (seg.value / Math.max(1, monthlyAvailable)) * 100);
                if (pct < 1) return null;
                return (
                  <div key={i} className="h-full rounded-sm transition-all"
                    style={{ width: `${pct}%`, background: seg.color }} />
                );
              })}
              {/* 超額部分（shortage）紅色 */}
              {shortage > 0 && (
                <div className="h-full rounded-sm flex-shrink-0" style={{ width: `${Math.min(30, (shortage / Math.max(1, monthlyAvailable)) * 100)}%`, background: "#EF4444" }} />
              )}
            </div>
            <div className="flex gap-4 mt-1.5 flex-wrap">
              {[
                { color: "#F59E0B", label: `教育學程 NT$ ${fmt(eduMonthlyReserve)}/月` },
                { color: "#6366F1", label: `研究所 NT$ ${fmt(gradMonthlyNeed)}/月` },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: s.color }} />
                  {s.label}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── 可行性判斷 ── */}
      <p className="text-[11px] font-bold uppercase tracking-widest mt-2" style={{ color: "var(--text-muted)" }}>可行性分析</p>
      <div className="rounded-2xl p-5 space-y-3"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-card)" }}>
        {[
          {
            ok: monthlyAvailable > 0,
            icon: monthlyAvailable > 0 ? "✅" : "❌",
            label: "每月結餘為正",
            desc: monthlyAvailable > 0
              ? `扣除固定支出、貸款、預算後每月可動用 NT$ ${fmt(monthlyAvailable)}`
              : "目前月支出已超過收入，請先調整固定支出或預算",
          },
          {
            ok: eduMonthsAway === 0 || sharedSavings >= eduNextAmount || eduMonthlyReserve <= monthlyAvailable,
            icon: eduMonthsAway === 0 || sharedSavings >= eduNextAmount ? "✅"
              : eduMonthlyReserve <= monthlyAvailable ? "📚" : "⚠️",
            label: `教育學程下一筆（${nextEdu?.label ?? "無"}）`,
            desc: !nextEdu
              ? "所有學費已繳清"
              : sharedSavings >= eduNextAmount
                ? `帳戶已有 NT$ ${fmt(sharedSavings)}，足以支付 NT$ ${fmt(eduNextAmount)}`
                : `尚缺 NT$ ${fmt(Math.max(0, eduNextAmount - sharedSavings))}，每月預留 NT$ ${fmt(Math.ceil(eduMonthlyReserve))} 可在 ${eduMonthsAway} 個月內備妥`,
          },
          {
            ok: canCoverBoth,
            icon: canCoverBoth ? "✅" : "⚠️",
            label: "同時支援兩個計畫",
            desc: canCoverBoth
              ? `月可動用 NT$ ${fmt(monthlyAvailable)} 足以同時預留教育（NT$ ${fmt(eduMonthlyReserve)}）+ 研究所（NT$ ${fmt(gradMonthlyNeed)}），每月還剩 NT$ ${fmt(monthlyAvailable - eduMonthlyReserve - gradMonthlyNeed)}`
              : `同時支援兩個計畫每月需 NT$ ${fmt(eduMonthlyReserve + gradMonthlyNeed)}，比可動用收入多 NT$ ${fmt(shortage)}`,
          },
          {
            ok: !(!canCoverBoth && gradMonthsLeft <= 24),
            icon: gradMonthsLeft > 24 ? "✅" : canCoverBoth ? "✅" : "⚠️",
            label: "研究所入學前存足",
            desc: canCoverBoth
              ? `按每月 NT$ ${fmt(gradMonthlyNeed)} 存入，可在入學前備好 NT$ ${fmt(gradTotalTarget)}`
              : `若優先保教育學程繳費，研究所每月只能存 NT$ ${fmt(Math.max(0, remainingAfterEdu))}，` +
                (remainingAfterEdu >= gradMonthlyNeed
                  ? "仍可達標"
                  : `每月短缺 NT$ ${fmt(gradMonthlyNeed - Math.max(0, remainingAfterEdu))}，需尋找額外收入或降低目標金額`),
          },
        ].map(item => (
          <div key={item.label} className="flex items-start gap-3">
            <span className="text-[18px] mt-0.5 flex-shrink-0">{item.icon}</span>
            <div>
              <p className="text-[14px] font-semibold" style={{ color: item.ok ? "#34D399" : "var(--text-primary)" }}>
                {item.label}
              </p>
              <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── 行動建議 ── */}
      <p className="text-[11px] font-bold uppercase tracking-widest mt-2" style={{ color: "var(--text-muted)" }}>行動建議</p>
      <div className="rounded-2xl p-5 space-y-2"
        style={{ background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.2)" }}>
        {[
          nextEdu && eduMonthsAway <= 4 && `⚡ 距教育學程繳費（${nextEdu.label}）僅剩 ${eduMonthsAway} 個月，優先確保帳戶有 NT$ ${fmt(eduNextAmount)}`,
          `📚 教育學程：每月預留 NT$ ${fmt(Math.ceil(eduMonthlyReserve))}。繳費後帳戶減少，但就學期間薪資持續入帳，${eduMonthsAway + 3} 個月後可補回`,
          `🎓 研究所：每月存入 NT$ ${fmt(Math.ceil(gradMonthlyNeed))}。入學後無薪資，這是入學前唯一的儲蓄機會`,
          !canCoverBoth && `⚠️ 目前兩個計畫合計每月需 NT$ ${fmt(eduMonthlyReserve + gradMonthlyNeed)}，超過可動用 NT$ ${fmt(monthlyAvailable)}。建議先確保教育學程繳費，研究所以 NT$ ${fmt(Math.max(0, remainingAfterEdu))} 為底線`,
          eduHasIncomeWhileStudying && `💡 教育學程就學期間的薪資收入，可在繳費後用來加速補充研究所存款`,
          sharedSavings > 0 && `🔗 共用帳戶目前 NT$ ${fmt(sharedSavings)}，優先扣除教育學程下筆繳費後，剩 NT$ ${fmt(Math.max(0, sharedSavings - eduNextAmount))} 可計入研究所進度`,
        ].filter(Boolean).map((tip, i) => (
          <div key={i} className="flex items-start gap-2 text-[13px]" style={{ color: "var(--text-primary)" }}>
            <span className="mt-0.5 flex-shrink-0 text-indigo-400">›</span>
            <span>{tip}</span>
          </div>
        ))}
      </div>

    </div>
  );
}
