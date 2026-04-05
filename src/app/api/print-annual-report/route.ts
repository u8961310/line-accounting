import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const yearParam   = request.nextUrl.searchParams.get("year");
  const year        = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();
  const reportDate  = new Date().toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric" });
  const isCurrentYear = year === new Date().getFullYear();
  const periodEnd   = isCurrentYear
    ? new Date().toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric" })
    : `${year} 年 12 月 31 日`;
  const periodLabel = `${year} 年 1 月 1 日 至 ${periodEnd}`;

  const user = await prisma.user.findFirst({ where: { lineUserId: "dashboard_user" } });
  if (!user) return new NextResponse("User not found", { status: 404 });

  const txs = await prisma.transaction.findMany({
    where: {
      userId: user.id,
      date:   { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) },
      NOT:    { category: "轉帳" },
    },
    orderBy: { date: "asc" },
    select: { date: true, type: true, category: true, amount: true },
  });

  // ── Monthly breakdown ────────────────────────────────────────────────────
  const mMap = new Map<string, { income: number; expense: number }>();
  for (let mo = 1; mo <= 12; mo++) {
    mMap.set(`${year}-${String(mo).padStart(2, "0")}`, { income: 0, expense: 0 });
  }
  for (const t of txs) {
    const key = t.date.toISOString().slice(0, 7);
    const e   = mMap.get(key) ?? { income: 0, expense: 0 };
    const a   = parseFloat(t.amount.toString());
    if (t.type === "收入") e.income += a; else e.expense += a;
    mMap.set(key, e);
  }
  const monthly = Array.from(mMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, d]) => ({
      month,
      income:      Math.round(d.income),
      expense:     Math.round(d.expense),
      net:         Math.round(d.income - d.expense),
      savingsRate: d.income > 0 ? Math.round(((d.income - d.expense) / d.income) * 100) : -1,
    }));

  // ── Category breakdown ───────────────────────────────────────────────────
  const incMap = new Map<string, number>();
  const expMap = new Map<string, number>();
  for (const t of txs) {
    const a = parseFloat(t.amount.toString());
    if (t.type === "收入") incMap.set(t.category, (incMap.get(t.category) ?? 0) + a);
    else                   expMap.set(t.category, (expMap.get(t.category) ?? 0) + a);
  }
  const incRows = Array.from(incMap.entries()).sort((a, b) => b[1] - a[1]);
  const expRows = Array.from(expMap.entries()).sort((a, b) => b[1] - a[1]);

  const totalIncome  = incRows.reduce((s, [, v]) => s + v, 0);
  const totalExpense = expRows.reduce((s, [, v]) => s + v, 0);
  const totalNet     = totalIncome - totalExpense;
  const savingsRate  = totalIncome > 0 ? ((totalNet / totalIncome) * 100).toFixed(1) : "0.0";

  // ── Highlights ───────────────────────────────────────────────────────────
  const active = monthly.filter(m => m.income > 0 || m.expense > 0);
  const peakIncomeMth    = active.length ? active.reduce((a, b) => b.income  > a.income  ? b : a).month : null;
  const peakExpenseMth   = active.length ? active.reduce((a, b) => b.expense > a.expense ? b : a).month : null;
  const lowestExpenseMth = active.filter(m => m.expense > 0).length
    ? active.filter(m => m.expense > 0).reduce((a, b) => b.expense < a.expense ? b : a).month : null;
  const bestSavingsMth   = active.filter(m => m.savingsRate >= 0).length
    ? active.filter(m => m.savingsRate >= 0).reduce((a, b) => b.savingsRate > a.savingsRate ? b : a).month : null;

  // ── Helpers ──────────────────────────────────────────────────────────────
  const fmt  = (n: number) => n === 0 ? "—" : Math.round(n).toLocaleString("zh-TW");
  const fmtR = (n: number) => Math.round(n).toLocaleString("zh-TW");
  const mLabel = (yyyymm: string) => {
    const [y, mo] = yyyymm.split("-");
    return `${y} 年 ${parseInt(mo)} 月`;
  };
  const srColor = (r: number) => r >= 30 ? "#166534" : r >= 15 ? "#854d0e" : r >= 0 ? "#991b1b" : "#555";

  const highlightRows = [
    peakIncomeMth    ? { label: "全年收入最高月",   value: mLabel(peakIncomeMth),    sub: `NT$ ${fmtR(monthly.find(m => m.month === peakIncomeMth)?.income ?? 0)}` } : null,
    peakExpenseMth   ? { label: "全年支出最高月",   value: mLabel(peakExpenseMth),   sub: `NT$ ${fmtR(monthly.find(m => m.month === peakExpenseMth)?.expense ?? 0)}` } : null,
    lowestExpenseMth ? { label: "全年支出最低月",   value: mLabel(lowestExpenseMth), sub: `NT$ ${fmtR(monthly.find(m => m.month === lowestExpenseMth)?.expense ?? 0)}` } : null,
    bestSavingsMth   ? { label: "全年儲蓄率最佳月", value: mLabel(bestSavingsMth),   sub: `${monthly.find(m => m.month === bestSavingsMth)?.savingsRate ?? 0}%` } : null,
  ].filter(Boolean) as { label: string; value: string; sub: string }[];

  const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<title>個人財務年度報告 ${year}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: "Times New Roman", "細明體", "新細明體", "PingFang TC", serif;
    font-size: 11.5pt;
    color: #0a0a0a;
    background: #fff;
    max-width: 210mm;
    margin: 0 auto;
    padding: 18mm 18mm 14mm;
  }

  .report-header {
    text-align: center;
    border-top: 3px solid #0a0a0a;
    border-bottom: 1px solid #0a0a0a;
    padding: 12px 0 10px;
    margin-bottom: 20px;
  }
  .report-title { font-size: 20pt; font-weight: 700; letter-spacing: 0.2em; margin-bottom: 6px; }
  .report-meta  { font-size: 10pt; color: #333; line-height: 1.9; }
  .report-meta span { margin: 0 14px; }

  .section { margin-bottom: 26px; }
  .section-title {
    font-size: 11pt; font-weight: 700; letter-spacing: 0.05em;
    border-bottom: 1.5px solid #0a0a0a; padding-bottom: 4px; margin-bottom: 0;
  }

  /* Income/Expense Statement */
  .stmt { width: 100%; border-collapse: collapse; font-size: 11pt; }
  .stmt td { padding: 3.5px 6px; vertical-align: top; }
  .stmt .sec td { font-weight: 700; padding-top: 10px; padding-bottom: 2px; }
  .stmt .indent { padding-left: 28px; }
  .stmt .num { text-align: right; font-variant-numeric: tabular-nums; min-width: 100px; padding-right: 20px; }
  .stmt .sub td { font-weight: 700; border-top: 1px solid #555; }
  .stmt .sub .num { text-decoration: underline; text-decoration-style: double; padding-right: 0; border-top: none; }
  .stmt .grand td {
    font-weight: 700; font-size: 12pt;
    border-top: 2px solid #0a0a0a; border-bottom: 3px double #0a0a0a;
    padding: 5px 6px; background: #f5f5f5;
  }
  .stmt .grand .num { padding-right: 0; }
  .stmt .spacer td { height: 8px; }

  /* Standard table */
  .tbl { width: 100%; border-collapse: collapse; font-size: 10.5pt; }
  .tbl thead tr { border-top: 1.5px solid #0a0a0a; border-bottom: 1px solid #0a0a0a; }
  .tbl th { padding: 5px 7px; text-align: center; font-weight: 700; font-size: 10pt; letter-spacing: 0.04em; }
  .tbl th:first-child { text-align: left; }
  .tbl td { padding: 4px 7px; border-bottom: 0.5px solid #d4d4d4; font-variant-numeric: tabular-nums; }
  .tbl .r  { text-align: right; }
  .tbl .c  { text-align: center; }
  .tbl .muted { color: #888; }
  .tbl .total { font-weight: 700; border-top: 1.5px solid #0a0a0a; border-bottom: 2px solid #0a0a0a; background: #f5f5f5; }
  .green { color: #166534; } .red { color: #991b1b; } .amber { color: #854d0e; }

  /* Highlights grid */
  .hl-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin-top: 6px; }
  .hl-item { display: flex; gap: 10px; align-items: baseline; border-bottom: 0.5px solid #d4d4d4; padding: 5px 0; }
  .hl-label { font-size: 10pt; color: #555; flex: 0 0 120px; }
  .hl-value { font-weight: 700; font-size: 11pt; }
  .hl-sub   { font-size: 9.5pt; color: #666; margin-left: 6px; }

  .sig-block { margin-top: 28px; display: flex; justify-content: flex-end; gap: 60px; font-size: 10pt; }
  .sig-item  { text-align: center; }
  .sig-line  { border-bottom: 1px solid #0a0a0a; width: 110px; margin: 18px auto 4px; }

  .page-footer {
    margin-top: 28px; padding-top: 8px; border-top: 1.5px solid #0a0a0a;
    display: flex; justify-content: space-between; font-size: 9.5pt; color: #444;
  }
  .notes { margin-top: 20px; padding-top: 8px; border-top: 1px solid #999; font-size: 9pt; color: #555; line-height: 1.7; }

  @media print {
    body  { padding: 10mm 14mm 10mm; }
    @page { size: A4 portrait; margin: 0; }
  }
</style>
</head>
<body>

<!-- Header -->
<div class="report-header">
  <div class="report-title">個人財務年度報告</div>
  <div class="report-meta">
    <span>報告年度：${year} 年度${isCurrentYear ? "（統計至本日）" : ""}</span>
    <span>幣別：新台幣（NT$）</span>
    <span>編製日期：${reportDate}</span>
  </div>
</div>

<!-- 壹、年度收支明細表 -->
<div class="section">
  <div class="section-title">壹、年度收支明細表</div>
  <table class="stmt">
    <colgroup><col style="width:42%"><col style="width:5%"><col style="width:28%"><col style="width:25%"></colgroup>
    <tbody>
      <tr class="sec"><td colspan="4">（一）全年收入</td></tr>
      ${incRows.length
        ? incRows.map(([cat, amt]) =>
            `<tr><td class="indent">${cat}</td><td></td><td class="num">${fmt(amt)}</td><td></td></tr>`
          ).join("")
        : `<tr><td class="indent" style="color:#999">（本年度無收入記錄）</td><td></td><td></td><td></td></tr>`}
      <tr class="sub"><td colspan="2">全年收入合計</td><td class="num">${fmtR(totalIncome)}</td><td></td></tr>

      <tr class="spacer"><td colspan="4"></td></tr>

      <tr class="sec"><td colspan="4">（二）全年支出</td></tr>
      ${expRows.length
        ? expRows.map(([cat, amt]) =>
            `<tr><td class="indent">${cat}</td><td></td><td class="num">${fmt(amt)}</td><td></td></tr>`
          ).join("")
        : `<tr><td class="indent" style="color:#999">（本年度無支出記錄）</td><td></td><td></td><td></td></tr>`}
      <tr class="sub"><td colspan="2">全年支出合計</td><td class="num">${fmtR(totalExpense)}</td><td></td></tr>

      <tr class="spacer"><td colspan="4"></td></tr>

      <tr class="grand">
        <td colspan="2">（三）全年淨結餘（收入－支出）</td>
        <td class="num" style="color:${totalNet >= 0 ? "#166534" : "#991b1b"}">${totalNet >= 0 ? "" : "△"}${fmtR(Math.abs(totalNet))}</td>
        <td></td>
      </tr>
      <tr><td class="indent" style="font-size:10pt;color:#444">全年儲蓄率（結餘 ÷ 收入）</td><td></td>
        <td class="num" style="font-size:10pt;color:#444">${savingsRate}%</td><td></td></tr>
      <tr><td class="indent" style="font-size:10pt;color:#444">全年交易筆數</td><td></td>
        <td class="num" style="font-size:10pt;color:#444">${txs.length} 筆</td><td></td></tr>
    </tbody>
  </table>
</div>

<!-- 貳、月度收支明細表 -->
<div class="section">
  <div class="section-title">貳、月度收支明細表</div>
  <table class="tbl">
    <thead>
      <tr>
        <th style="width:14%">月份</th>
        <th class="r" style="width:18%">收　入</th>
        <th class="r" style="width:18%">支　出</th>
        <th class="r" style="width:18%">月結餘</th>
        <th class="r" style="width:14%">儲蓄率</th>
        <th class="c" style="width:18%">收支狀況</th>
      </tr>
    </thead>
    <tbody>
      ${monthly.map(mo => {
        const hasData = mo.income > 0 || mo.expense > 0;
        const netCls  = mo.net >= 0 ? "green" : "red";
        const srCls   = mo.savingsRate >= 30 ? "green" : mo.savingsRate >= 15 ? "amber" : mo.savingsRate >= 0 ? "red" : "muted";
        const status  = !hasData ? "—" : mo.net >= 0 ? "結餘" : "赤字";
        return `<tr ${!hasData ? 'style="opacity:0.35"' : ""}>
          <td>${parseInt(mo.month.slice(5))} 月</td>
          <td class="r ${hasData ? "green" : "muted"}">${hasData ? fmt(mo.income) : "—"}</td>
          <td class="r ${hasData ? "red" : "muted"}">${hasData ? fmt(mo.expense) : "—"}</td>
          <td class="r ${netCls}">${hasData ? (mo.net >= 0 ? "" : "△") + fmt(Math.abs(mo.net)) : "—"}</td>
          <td class="r ${srCls}">${mo.savingsRate >= 0 ? mo.savingsRate + "%" : "—"}</td>
          <td class="c">${status}</td>
        </tr>`;
      }).join("")}
      <tr class="total">
        <td><strong>全　年</strong></td>
        <td class="r green">${fmtR(totalIncome)}</td>
        <td class="r red">${fmtR(totalExpense)}</td>
        <td class="r ${totalNet >= 0 ? "green" : "red"}">${totalNet >= 0 ? "" : "△"}${fmtR(Math.abs(totalNet))}</td>
        <td class="r" style="color:${srColor(parseFloat(savingsRate))}">${savingsRate}%</td>
        <td class="c">${totalNet >= 0 ? "結餘" : "赤字"}</td>
      </tr>
    </tbody>
  </table>
</div>

<!-- 參、支出分類排行 -->
${expRows.length > 0 ? `
<div class="section">
  <div class="section-title">參、支出分類排行</div>
  <table class="tbl">
    <thead>
      <tr>
        <th class="c" style="width:8%">排名</th>
        <th style="width:18%">支出科目</th>
        <th class="r" style="width:20%">全年金額</th>
        <th class="r" style="width:16%">月均金額</th>
        <th class="r" style="width:16%">佔總支出</th>
        <th style="width:22%">佔比示意</th>
      </tr>
    </thead>
    <tbody>
      ${expRows.map(([cat, amt], i) => {
        const pct    = totalExpense > 0 ? ((amt / totalExpense) * 100).toFixed(1) : "0.0";
        const barW   = totalExpense > 0 ? Math.min(100, (amt / totalExpense) * 100) : 0;
        const avgMth = Math.round(amt / 12);
        return `<tr>
          <td class="c">${i + 1}</td>
          <td>${cat}</td>
          <td class="r">${fmtR(amt)}</td>
          <td class="r" style="color:#555">${fmtR(avgMth)}</td>
          <td class="r">${pct}%</td>
          <td><div style="background:#e5e7eb;height:5px;border-radius:3px;margin:6px 0">
            <div style="width:${barW}%;height:5px;border-radius:3px;background:#374151"></div>
          </div></td>
        </tr>`;
      }).join("")}
      <tr class="total">
        <td colspan="2"><strong>合　計</strong></td>
        <td class="r">${fmtR(totalExpense)}</td>
        <td class="r" style="color:#555">${fmtR(Math.round(totalExpense / 12))}</td>
        <td class="r">100.0%</td>
        <td></td>
      </tr>
    </tbody>
  </table>
</div>` : ""}

<!-- 肆、年度財務亮點 -->
${highlightRows.length > 0 ? `
<div class="section">
  <div class="section-title">肆、年度財務亮點</div>
  <div class="hl-grid">
    ${highlightRows.map(h => `
    <div class="hl-item">
      <span class="hl-label">${h.label}</span>
      <span class="hl-value">${h.value}</span>
      <span class="hl-sub">${h.sub}</span>
    </div>`).join("")}
  </div>
</div>` : ""}

<!-- Signature -->
<div class="sig-block">
  <div class="sig-item"><div class="sig-line"></div><div>編　製　者</div></div>
  <div class="sig-item"><div class="sig-line"></div><div>審　　　核</div></div>
</div>

<!-- Footer -->
<div class="page-footer">
  <span>本報告由個人記帳系統自動產生，僅供個人財務管理參考。</span>
  <span>第 1 頁，共 1 頁</span>
</div>

<div class="notes">
  <strong>附　注：</strong><br>
  一、本報告幣別為新台幣（NT$），金額單位為元，採四捨五入。<br>
  二、「轉帳」類別交易已自動排除，不計入收支統計。<br>
  三、負數結餘以「△」符號表示。<br>
  四、月均金額以全年 12 個月為基礎計算，未滿 1 年者數值僅供參考。<br>
  五、本報告統計期間：${periodLabel}。
</div>

<script>window.onload = () => window.print();</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
