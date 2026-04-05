import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const month = request.nextUrl.searchParams.get("month") ?? (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();

  const user = await prisma.user.findFirst({ where: { lineUserId: "dashboard_user" } });
  if (!user) return new NextResponse("User not found", { status: 404 });

  const [y, m] = month.split("-").map(Number);
  const monthStart  = new Date(y, m - 1, 1);
  const monthEnd    = new Date(y, m, 1);
  const reportDate  = new Date().toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric" });
  const periodLabel = `${y} 年 ${m} 月 1 日至 ${y} 年 ${m} 月 ${new Date(y, m, 0).getDate()} 日`;

  const [txs, budgets, loans, creditCards] = await Promise.all([
    prisma.transaction.findMany({
      where:   { userId: user.id, date: { gte: monthStart, lt: monthEnd }, NOT: { category: "轉帳" } },
      orderBy: { date: "asc" },
      select:  { date: true, type: true, category: true, amount: true, note: true, source: true },
    }),
    prisma.budget.findMany({ where: { userId: user.id } }),
    prisma.loan.findMany({
      where:   { userId: user.id, status: "active" },
      select:  { name: true, lender: true, remainingPrincipal: true, interestRate: true },
    }),
    prisma.creditCard.findMany({
      where:   { userId: user.id },
      include: { bills: { where: { status: { not: "paid" } }, orderBy: { dueDate: "asc" }, take: 1 } },
    }),
  ]);

  // ── Aggregation ─────────────────────────────────────────────────────────────
  const incomeMap  = new Map<string, number>();
  const expenseMap = new Map<string, number>();

  for (const t of txs) {
    const a = parseFloat(t.amount.toString());
    if (t.type === "收入") incomeMap.set(t.category,  (incomeMap.get(t.category)  ?? 0) + a);
    else                   expenseMap.set(t.category, (expenseMap.get(t.category) ?? 0) + a);
  }

  const incomeRows  = Array.from(incomeMap.entries()).sort((a, b) => b[1] - a[1]);
  const expenseRows = Array.from(expenseMap.entries()).sort((a, b) => b[1] - a[1]);

  const totalIncome  = incomeRows.reduce((s, [, v]) => s + v, 0);
  const totalExpense = expenseRows.reduce((s, [, v]) => s + v, 0);
  const net          = totalIncome - totalExpense;
  const savingsRate  = totalIncome > 0 ? ((net / totalIncome) * 100).toFixed(1) : "0.0";

  const budgetRows = budgets.map(b => ({
    category: b.category,
    budget:   parseFloat(b.amount.toString()),
    spent:    expenseMap.get(b.category) ?? 0,
  })).sort((a, b) => b.budget - a.budget);
  const totalBudget = budgetRows.reduce((s, r) => s + r.budget, 0);
  const totalSpent  = budgetRows.reduce((s, r) => s + r.spent, 0);

  const top10 = txs
    .filter(t => t.type === "支出")
    .sort((a, b) => parseFloat(b.amount.toString()) - parseFloat(a.amount.toString()))
    .slice(0, 10);

  const loanDebt = loans.reduce((s, l) => s + parseFloat(l.remainingPrincipal.toString()), 0);
  const ccDebt   = creditCards.reduce((s, c) => {
    const bill = c.bills[0];
    return s + (bill ? parseFloat(bill.totalAmount.toString()) - parseFloat(bill.paidAmount.toString()) : 0);
  }, 0);
  const totalDebt = loanDebt + ccDebt;

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const fmt  = (n: number) => n === 0 ? "—" : Math.round(n).toLocaleString("zh-TW");
  const fmtR = (n: number) => Math.round(n).toLocaleString("zh-TW");  // always show
  const diff = (spent: number, budget: number) => {
    const d = budget - spent;
    return d >= 0
      ? `<span style="color:#166534">節餘 ${fmt(d)}</span>`
      : `<span style="color:#991b1b">超支 ${fmt(Math.abs(d))}</span>`;
  };

  const sectionHeader = (no: string, title: string) =>
    `<tr class="sec-head"><td colspan="4">${no}、${title}</td></tr>`;

  const rowItem = (label: string, amount: number, indent = true) =>
    `<tr class="item"><td class="${indent ? "indent" : ""}">${label}</td><td></td><td class="amt">${fmt(amount)}</td><td></td></tr>`;

  const rowTotal = (label: string, amount: number, style = "subtotal") =>
    `<tr class="${style}"><td colspan="2">${label}</td><td class="amt">${fmtR(amount)}</td><td></td></tr>`;

  const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<title>個人財務報告 ${month}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: "Times New Roman", "細明體", "新細明體", "PingFang TC", serif;
    font-size: 12pt;
    color: #0a0a0a;
    background: #fff;
    max-width: 210mm;
    margin: 0 auto;
    padding: 20mm 18mm 16mm;
  }

  /* ── Report header ── */
  .report-header {
    text-align: center;
    border-top: 3px solid #0a0a0a;
    border-bottom: 1px solid #0a0a0a;
    padding: 12px 0 10px;
    margin-bottom: 18px;
  }
  .report-title  { font-size: 18pt; font-weight: 700; letter-spacing: 0.15em; margin-bottom: 6px; }
  .report-meta   { font-size: 10pt; color: #333; line-height: 1.8; }
  .report-meta span { margin: 0 16px; }

  /* ── Section heading ── */
  .section { margin-bottom: 24px; }
  .section-title {
    font-size: 11pt;
    font-weight: 700;
    letter-spacing: 0.05em;
    border-bottom: 1.5px solid #0a0a0a;
    padding-bottom: 4px;
    margin-bottom: 0;
  }

  /* ── Statement table (收支明細表) ── */
  .stmt-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11pt;
  }
  .stmt-table td {
    padding: 4px 6px;
    vertical-align: top;
  }
  .stmt-table .sec-head td {
    font-weight: 700;
    padding-top: 10px;
    padding-bottom: 3px;
    font-size: 11pt;
    letter-spacing: 0.02em;
  }
  .stmt-table .item td { padding: 3px 6px; }
  .stmt-table .indent  { padding-left: 28px; }
  .stmt-table .amt     { text-align: right; font-variant-numeric: tabular-nums; min-width: 90px; padding-right: 24px; }
  .stmt-table .subtotal td {
    font-weight: 700;
    border-top: 1px solid #555;
    padding-top: 4px;
  }
  .stmt-table .subtotal .amt { border-top: none; padding-right: 0; text-decoration: underline; text-decoration-style: double; }
  .stmt-table .grand td {
    font-weight: 700;
    font-size: 12pt;
    border-top: 2px solid #0a0a0a;
    border-bottom: 3px double #0a0a0a;
    padding: 5px 6px;
    background: #f5f5f5;
  }
  .stmt-table .grand .amt { padding-right: 0; }
  .stmt-table .spacer td  { height: 8px; }

  /* ── Standard table ── */
  .std-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10.5pt;
  }
  .std-table thead tr {
    border-top: 1.5px solid #0a0a0a;
    border-bottom: 1px solid #0a0a0a;
  }
  .std-table th {
    padding: 5px 8px;
    text-align: center;
    font-weight: 700;
    font-size: 10pt;
    letter-spacing: 0.04em;
  }
  .std-table th:first-child { text-align: left; }
  .std-table td {
    padding: 4px 8px;
    border-bottom: 0.5px solid #d4d4d4;
    font-variant-numeric: tabular-nums;
  }
  .std-table .num  { text-align: right; }
  .std-table .ctr  { text-align: center; }
  .std-table .total-row td {
    font-weight: 700;
    border-top: 1px solid #0a0a0a;
    border-bottom: 2px solid #0a0a0a;
    background: #f5f5f5;
  }
  .std-table .over   { color: #991b1b; font-weight: 600; }
  .std-table .under  { color: #166534; }

  /* ── Notes section ── */
  .notes {
    margin-top: 28px;
    padding-top: 8px;
    border-top: 1px solid #999;
    font-size: 9pt;
    color: #555;
    line-height: 1.7;
  }

  /* ── Footer ── */
  .page-footer {
    margin-top: 32px;
    padding-top: 8px;
    border-top: 1.5px solid #0a0a0a;
    display: flex;
    justify-content: space-between;
    font-size: 9.5pt;
    color: #444;
  }

  /* ── Signature block ── */
  .sig-block {
    margin-top: 28px;
    display: flex;
    justify-content: flex-end;
    gap: 60px;
    font-size: 10pt;
  }
  .sig-item { text-align: center; }
  .sig-line { border-bottom: 1px solid #0a0a0a; width: 110px; margin: 18px auto 4px; }

  @media print {
    body        { padding: 10mm 14mm 10mm; }
    .no-print   { display: none; }
    @page       { size: A4 portrait; margin: 0; }
  }
</style>
</head>
<body>

<!-- ── Report Header ─────────────────────────────────────────── -->
<div class="report-header">
  <div class="report-title">個人財務月報表</div>
  <div class="report-meta">
    <span>報告期間：${periodLabel}</span>
    <span>幣別：新台幣（NT$）</span>
    <span>編製日期：${reportDate}</span>
  </div>
</div>

<!-- ── Section 1: 收支明細表 ──────────────────────────────────── -->
<div class="section">
  <div class="section-title">壹、本期收支明細表</div>
  <table class="stmt-table">
    <colgroup>
      <col style="width:40%">
      <col style="width:5%">
      <col style="width:30%">
      <col style="width:25%">
    </colgroup>
    <tbody>

      ${sectionHeader("（一）", "本期收入")}
      ${incomeRows.length > 0
        ? incomeRows.map(([cat, amt]) => rowItem(cat, amt)).join("")
        : `<tr class="item"><td class="indent" style="color:#999">（本期無收入記錄）</td><td></td><td></td><td></td></tr>`}
      ${rowTotal("本期收入合計", totalIncome, "subtotal")}

      <tr class="spacer"><td colspan="4"></td></tr>

      ${sectionHeader("（二）", "本期支出")}
      ${expenseRows.length > 0
        ? expenseRows.map(([cat, amt]) => rowItem(cat, amt)).join("")
        : `<tr class="item"><td class="indent" style="color:#999">（本期無支出記錄）</td><td></td><td></td><td></td></tr>`}
      ${rowTotal("本期支出合計", totalExpense, "subtotal")}

      <tr class="spacer"><td colspan="4"></td></tr>

      <tr class="grand">
        <td colspan="2">（三）本期結餘（收入－支出）</td>
        <td class="amt" style="color:${net >= 0 ? "#166534" : "#991b1b"}">${net >= 0 ? "" : "△"}${fmtR(Math.abs(net))}</td>
        <td></td>
      </tr>
      <tr class="item">
        <td class="indent" style="color:#444;font-size:10pt">儲蓄率（結餘 ÷ 收入）</td>
        <td></td>
        <td class="amt" style="font-size:10pt;color:#444">${savingsRate}%</td>
        <td></td>
      </tr>
      <tr class="item">
        <td class="indent" style="color:#444;font-size:10pt">本期交易筆數</td>
        <td></td>
        <td class="amt" style="font-size:10pt;color:#444">${txs.length} 筆</td>
        <td></td>
      </tr>

    </tbody>
  </table>
</div>

${budgetRows.length > 0 ? `
<!-- ── Section 2: 預算執行對照表 ─────────────────────────────── -->
<div class="section">
  <div class="section-title">貳、預算執行對照表</div>
  <table class="std-table">
    <thead>
      <tr>
        <th style="width:22%">支出科目</th>
        <th class="num" style="width:18%">預算金額</th>
        <th class="num" style="width:18%">實際支出</th>
        <th class="num" style="width:18%">差　　異</th>
        <th class="ctr" style="width:12%">執行率</th>
        <th class="ctr" style="width:12%">執行狀況</th>
      </tr>
    </thead>
    <tbody>
      ${budgetRows.map(r => {
        const p    = r.budget > 0 ? Math.round((r.spent / r.budget) * 100) : 0;
        const over = r.spent > r.budget;
        const d    = r.budget - r.spent;
        return `<tr>
          <td>${r.category}</td>
          <td class="num">${fmt(r.budget)}</td>
          <td class="num ${over ? "over" : ""}">${fmt(r.spent)}</td>
          <td class="num">${d >= 0
            ? `<span class="under">節餘 ${fmt(d)}</span>`
            : `<span class="over">超支 ${fmt(Math.abs(d))}</span>`}</td>
          <td class="ctr ${over ? "over" : p >= 80 ? "" : "under"}">${r.budget > 0 ? p + "%" : "—"}</td>
          <td class="ctr">${over ? "⚠ 超標" : p >= 80 ? "注意" : "正常"}</td>
        </tr>`;
      }).join("")}
      <tr class="total-row">
        <td><strong>合　　計</strong></td>
        <td class="num">${fmtR(totalBudget)}</td>
        <td class="num ${totalSpent > totalBudget ? "over" : ""}">${fmtR(totalSpent)}</td>
        <td class="num">${totalBudget - totalSpent >= 0
          ? `<span class="under">節餘 ${fmtR(totalBudget - totalSpent)}</span>`
          : `<span class="over">超支 ${fmtR(Math.abs(totalBudget - totalSpent))}</span>`}</td>
        <td class="ctr">${totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) + "%" : "—"}</td>
        <td></td>
      </tr>
    </tbody>
  </table>
  <p style="font-size:9pt;color:#666;margin-top:6px">△ 執行率超過 100% 表示超出預算；80% 以上為注意區間。</p>
</div>` : ""}

<!-- ── Section 3: 重大支出明細 ───────────────────────────────── -->
<div class="section">
  <div class="section-title">${budgetRows.length > 0 ? "參" : "貳"}、重大支出明細（前十大）</div>
  <table class="std-table">
    <thead>
      <tr>
        <th class="ctr" style="width:8%">序</th>
        <th style="width:14%">日　期</th>
        <th style="width:14%">科　目</th>
        <th>摘　要</th>
        <th class="num" style="width:18%">金　額</th>
        <th style="width:14%">來　源</th>
      </tr>
    </thead>
    <tbody>
      ${top10.map((t, i) => {
        const sourceMap: Record<string, string> = {
          line: "LINE", esun_bank: "玉山銀行", ctbc_bank: "中信銀行",
          esun_cc: "玉山信用卡", ctbc_cc: "中信信用卡", taishin_cc: "台新信用卡",
          kgi_bank: "凱基銀行", mega_bank: "兆豐銀行", sinopac_bank: "永豐銀行",
          cathay_cc: "國泰信用卡", manual: "手動", cash: "現金",
        };
        return `<tr>
          <td class="ctr">${i + 1}</td>
          <td>${t.date.toISOString().split("T")[0]}</td>
          <td>${t.category}</td>
          <td>${t.note || "（未填備註）"}</td>
          <td class="num over">${fmtR(parseFloat(t.amount.toString()))}</td>
          <td style="font-size:9.5pt;color:#555">${sourceMap[t.source] ?? t.source}</td>
        </tr>`;
      }).join("")}
      <tr class="total-row">
        <td colspan="4"><strong>前十大支出合計</strong></td>
        <td class="num">${fmtR(top10.reduce((s, t) => s + parseFloat(t.amount.toString()), 0))}</td>
        <td></td>
      </tr>
    </tbody>
  </table>
</div>

${totalDebt > 0 ? `
<!-- ── Section 4: 負債明細表 ─────────────────────────────────── -->
<div class="section">
  <div class="section-title">${budgetRows.length > 0 ? "肆" : "參"}、負債明細表</div>
  <table class="std-table">
    <thead>
      <tr>
        <th style="width:20%">項　目</th>
        <th style="width:20%">債　權　人</th>
        <th style="width:14%">性　質</th>
        <th class="num" style="width:20%">未償餘額</th>
        <th style="width:26%">備　注</th>
      </tr>
    </thead>
    <tbody>
      ${loans.map(l => `<tr>
        <td>${l.name}</td>
        <td>${l.lender}</td>
        <td>貸款</td>
        <td class="num over">${fmtR(parseFloat(l.remainingPrincipal.toString()))}</td>
        <td style="font-size:9.5pt;color:#555">年利率 ${parseFloat(l.interestRate.toString()).toFixed(2)}%</td>
      </tr>`).join("")}
      ${creditCards.filter(c => c.bills[0]).map(c => {
        const bill = c.bills[0]!;
        const unpaid = parseFloat(bill.totalAmount.toString()) - parseFloat(bill.paidAmount.toString());
        const due = new Date(bill.dueDate).toLocaleDateString("zh-TW");
        return `<tr>
          <td>${c.name}</td>
          <td>${c.bank}</td>
          <td>信用卡帳單</td>
          <td class="num over">${fmtR(unpaid)}</td>
          <td style="font-size:9.5pt;color:#555">繳款截止日 ${due}</td>
        </tr>`;
      }).join("")}
      <tr class="total-row">
        <td colspan="3"><strong>負債合計</strong></td>
        <td class="num">${fmtR(totalDebt)}</td>
        <td></td>
      </tr>
    </tbody>
  </table>
</div>` : ""}

<!-- ── Signature Block ───────────────────────────────────────── -->
<div class="sig-block">
  <div class="sig-item">
    <div class="sig-line"></div>
    <div>編　製　者</div>
  </div>
  <div class="sig-item">
    <div class="sig-line"></div>
    <div>審　　　核</div>
  </div>
</div>

<!-- ── Footer ───────────────────────────────────────────────── -->
<div class="page-footer">
  <span>本報告由個人記帳系統自動產生，僅供個人財務管理參考。</span>
  <span>第 1 頁，共 1 頁</span>
</div>

<!-- ── Notes ────────────────────────────────────────────────── -->
<div class="notes">
  <strong>附　注：</strong><br>
  一、本報告幣別為新台幣（NT$），金額單位為元，採四捨五入。<br>
  二、「轉帳」類別交易已自動排除，不計入收支統計。<br>
  三、負數結餘以「△」符號表示。<br>
  四、本報告資料期間：${periodLabel}。
</div>

<script>window.onload = () => window.print();</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
