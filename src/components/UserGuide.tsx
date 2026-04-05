"use client";
import React, { useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface FlowNode {
  icon: string;
  label: string;
  sub?: string;
  color: string;
}

interface FlowSection {
  stage: string;
  nodes: FlowNode[];
}

// ── Flow Diagram ──────────────────────────────────────────────────────────────
const FLOW: FlowSection[] = [
  {
    stage: "① 資料輸入",
    nodes: [
      { icon: "💬", label: "LINE 記帳", sub: "AI 自動解析金額、分類、備註", color: "#10B981" },
      { icon: "📁", label: "CSV / PDF 匯入", sub: "支援 8 家銀行 + 5 家信用卡自動偵測", color: "#3B82F6" },
      { icon: "✏️", label: "手動記帳", sub: "Dashboard 直接新增 / 編輯", color: "#8B5CF6" },
    ],
  },
  {
    stage: "② 核心處理",
    nodes: [
      { icon: "🗄️", label: "PostgreSQL 資料庫", sub: "去重偵測（日期 + 金額 + 來源）", color: "#F59E0B" },
      { icon: "📓", label: "Notion 同步", sub: "背景單向同步，不影響主流程", color: "#6366F1" },
    ],
  },
  {
    stage: "③ 分析模組",
    nodes: [
      { icon: "📊", label: "收支統計", sub: "月摘要、分類圓餅、趨勢折線", color: "#3B82F6" },
      { icon: "🎯", label: "預算控制", sub: "各分類上限設定與超標警示", color: "#EF4444" },
      { icon: "🏦", label: "帳戶 & 淨資產", sub: "銀行餘額、淨資產快照", color: "#10B981" },
      { icon: "💳", label: "信用卡 & 貸款", sub: "帳單管理、還款時間軸", color: "#F59E0B" },
      { icon: "🔁", label: "訂閱偵測", sub: "自動識別每月重複支出", color: "#06B6D4" },
      { icon: "📈", label: "進階分析", sub: "FIRE / 退休 / 帳戶流量 / 年報", color: "#8B5CF6" },
    ],
  },
  {
    stage: "④ 輸出 & 警示",
    nodes: [
      { icon: "🖥️", label: "Dashboard 圖表", sub: "即時更新，支援主題切換", color: "#10B981" },
      { icon: "🔔", label: "通知中心", sub: "預算超標 / 帳單到期 / 目標落後", color: "#EF4444" },
      { icon: "📄", label: "列印報表", sub: "月報 / 年報 HTML 正式格式", color: "#6366F1" },
    ],
  },
];

// ── Workflow Data ─────────────────────────────────────────────────────────────
interface WorkflowStep {
  icon: string;
  title: string;
  desc: string;
  tag?: string;
  tagColor?: string;
}

interface WorkflowPhase {
  phase: string;
  color: string;
  freq: string;
  steps: WorkflowStep[];
}

const WORKFLOWS: WorkflowPhase[] = [
  {
    phase: "🚀 新手設定",
    color: "#6366F1",
    freq: "首次使用，一次性",
    steps: [
      { icon: "1", title: "匯入歷史資料", desc: "工具 → 匯入資料，上傳銀行 CSV／PDF，系統自動去重", tag: "必做", tagColor: "#EF4444" },
      { icon: "2", title: "設定每月預算", desc: "預算控制 Tab → 各消費分類設定上限（飲食、交通、娛樂…）", tag: "建議", tagColor: "#F59E0B" },
      { icon: "3", title: "登記固定支出", desc: "負債管理 → 固定支出，記錄房租、訂閱費、保險等固定項目", tag: "建議", tagColor: "#F59E0B" },
      { icon: "4", title: "新增貸款 / 信用卡", desc: "負債管理 Tab → 輸入貸款餘額、利率；信用卡截止日、信額", tag: "選填", tagColor: "#10B981" },
      { icon: "5", title: "設定財務目標", desc: "財務規劃 → 儲蓄規劃，設定緊急備用金、研究所、教育程式目標金額", tag: "選填", tagColor: "#10B981" },
    ],
  },
  {
    phase: "📅 每日記帳",
    color: "#10B981",
    freq: "每次消費後",
    steps: [
      { icon: "💬", title: "LINE 快速記帳", desc: "傳送「早餐 80」「計程車 320」，AI 自動解析分類與金額", tag: "最快", tagColor: "#10B981" },
      { icon: "✏️", title: "Dashboard 手動補記", desc: "交易記錄 Tab → ＋ 新增，適合現金消費或需要細節備註時", tag: "補充", tagColor: "#6366F1" },
      { icon: "🔔", title: "查看通知警示", desc: "Header 鈴鐺 → 確認預算使用狀況，超標立即調整消費", tag: "隨時", tagColor: "#EF4444" },
    ],
  },
  {
    phase: "📆 每週檢視",
    color: "#3B82F6",
    freq: "每週一次",
    steps: [
      { icon: "📊", title: "確認本週支出", desc: "圖表分析 → 交易記錄篩選本週，確認分類是否正確", tag: "10 分鐘", tagColor: "#3B82F6" },
      { icon: "🔁", title: "識別訂閱費用", desc: "訂閱偵測 Tab → 確認新偵測的重複扣款是否為訂閱", tag: "選做", tagColor: "#06B6D4" },
    ],
  },
  {
    phase: "🗓️ 每月收尾",
    color: "#F59E0B",
    freq: "月底 / 月初",
    steps: [
      { icon: "📁", title: "匯入銀行對帳單", desc: "工具 → 匯入資料，上傳當月 CSV，補齊銀行端記錄", tag: "必做", tagColor: "#EF4444" },
      { icon: "💳", title: "繳清信用卡帳單", desc: "負債管理 → 信用卡，標記帳單已付，更新帳戶餘額", tag: "必做", tagColor: "#EF4444" },
      { icon: "🎯", title: "審查預算達成", desc: "預算控制 Tab → 查看各分類達成率，調整下月預算上限", tag: "建議", tagColor: "#F59E0B" },
      { icon: "🏦", title: "更新帳戶餘額", desc: "圖表分析 → 帳戶餘額，對照銀行 App 確認數字一致", tag: "建議", tagColor: "#F59E0B" },
      { icon: "📄", title: "列印月度財報", desc: "Header → 工具 → 列印月報，產出正式 HTML 財務報表", tag: "選做", tagColor: "#10B981" },
      { icon: "💰", title: "執行儲蓄轉帳", desc: "儲蓄規劃 → 確認當月可存金額，依建議分配轉入各目標帳戶", tag: "選做", tagColor: "#10B981" },
    ],
  },
];

// ── Feature Detail Cards ──────────────────────────────────────────────────────
interface FeatureSection {
  icon: string;
  title: string;
  color: string;
  items: { label: string; example?: string }[];
  note: string;
}

const FEATURES: FeatureSection[] = [
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
    title: "CSV / PDF 匯入",
    color: "#3B82F6",
    items: [
      { label: "玉山銀行存款", example: "CSV / XLS" },
      { label: "中國信託存款", example: "CSV（Big5 編碼）" },
      { label: "兆豐銀行存款", example: "CSV" },
      { label: "元大銀行存款", example: "CSV" },
      { label: "永豐銀行存款", example: "CSV" },
      { label: "凱基銀行存款", example: "TXT（固定寬度格式）" },
      { label: "永豐信用卡", example: "PDF（AI 解析）" },
    ],
    note: "至「匯入資料」頁面，選擇銀行或自動偵測，上傳即可。系統自動去除重複紀錄。",
  },
  {
    icon: "✏️",
    title: "手動新增記帳",
    color: "#8B5CF6",
    items: [
      { label: "進入「交易記錄」頁面" },
      { label: "點擊標題列「＋ 新增」按鈕" },
      { label: "填入日期、類型、金額、分類、備註" },
      { label: "儲存後立即出現在記錄中，圖表同步更新" },
    ],
    note: "適合記錄現金消費、非銀行往來的臨時收支。",
  },
  {
    icon: "💵",
    title: "現金追蹤邏輯",
    color: "#22C55E",
    items: [
      { label: "ATM 提款後，將該筆分類改為「現金」" },
      { label: "圖表分析 → 銀行餘額 自動累計現金欄位" },
      { label: "支出類型的現金 = 累加（提款進口袋）" },
      { label: "收入類型的現金 = 扣除（存回銀行）" },
    ],
    note: "現金欄位 = Σ(現金類型:支出) − Σ(現金類型:收入)，反映實際口袋現金。",
  },
  {
    icon: "🔔",
    title: "通知中心",
    color: "#EF4444",
    items: [
      { label: "Header 右側鈴鐺圖示，點擊展開通知面板" },
      { label: "預算超標：已超標（🚨）或已用 80%+（⚠️）自動提示" },
      { label: "帳單到期：信用卡截止日 ≤ 7 天自動提示" },
      { label: "儲蓄目標：截止 90 天內且進度不足 80% 提醒" },
      { label: "Badge 數字 = 緊急 + 警告筆數合計" },
    ],
    note: "每次點開鈴鐺時從最新資料重新計算，無需手動刷新。",
  },
  {
    icon: "📈",
    title: "進階財務分析",
    color: "#8B5CF6",
    items: [
      { label: "年度財報 — 全年收支、12 月走勢、支出分類排行" },
      { label: "退休金試算 — 目標金額 + 月儲蓄 + 報酬率" },
      { label: "FIRE 試算 — 4% 法則：月支出×300 = FI 目標" },
      { label: "收入穩定性 — 標準差、變異係數、月收入走勢" },
      { label: "固定 vs 變動支出 — 比例與 6 個月堆疊趨勢" },
      { label: "帳戶流量 — 各帳戶每月資金流入／流出" },
    ],
    note: "進階分析均支援 Demo 模式（?demo=1）預覽，不需要真實資料。",
  },
  {
    icon: "💰",
    title: "負債還款優化",
    color: "#F59E0B",
    items: [
      { label: "輸入每月可還款金額，比較兩種策略", example: "負債管理 Tab" },
      { label: "雪球法 — 從最小餘額開始還，心理激勵效果強" },
      { label: "雪崩法 — 從最高利率開始還，數學上利息最少" },
      { label: "損益平衡點 — 固定支出合計 → 最低收入需求 + 25% 緩衝" },
    ],
    note: "還清時間以複利模擬，信用卡利率預設 18%，可依實際利率調整。",
  },
];

// ── Sub-components ────────────────────────────────────────────────────────────
function Arrow() {
  return (
    <div className="flex justify-center items-center py-1">
      <div className="flex flex-col items-center gap-0.5">
        <div className="w-px h-5" style={{ background: "var(--border)" }} />
        <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
          <path d="M6 8L0 0h12L6 8z" fill="var(--text-muted)" fillOpacity="0.5" />
        </svg>
      </div>
    </div>
  );
}

function StageLabel({ label }: { label: string }) {
  return (
    <div className="text-center mb-3">
      <span className="text-[12px] font-bold tracking-widest px-3 py-1 rounded-full"
        style={{ background: "var(--bg-input)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
        {label}
      </span>
    </div>
  );
}

function FlowNodeCard({ node }: { node: FlowNode }) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl flex-1 min-w-[120px]"
      style={{ background: `${node.color}12`, border: `1px solid ${node.color}40` }}>
      <span className="text-xl">{node.icon}</span>
      <span className="text-[13px] font-bold text-center leading-tight" style={{ color: node.color }}>{node.label}</span>
      {node.sub && (
        <span className="text-[11px] text-center leading-tight" style={{ color: "var(--text-muted)" }}>{node.sub}</span>
      )}
    </div>
  );
}

function WorkflowPhaseCard({ phase }: { phase: WorkflowPhase }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${phase.color}40` }}>
      {/* Phase Header */}
      <div className="flex items-center justify-between px-5 py-3"
        style={{ background: `${phase.color}18`, borderBottom: `1px solid ${phase.color}30` }}>
        <span className="text-[14px] font-bold" style={{ color: phase.color }}>{phase.phase}</span>
        <span className="text-[11px] px-2.5 py-0.5 rounded-full font-medium"
          style={{ background: `${phase.color}25`, color: phase.color }}>{phase.freq}</span>
      </div>
      {/* Steps */}
      <div className="divide-y" style={{ background: "var(--bg-card)", borderColor: "var(--border-inner)" }}>
        {phase.steps.map((step, i) => (
          <div key={i} className="flex items-start gap-3 px-5 py-3">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0 mt-0.5"
              style={{ background: `${phase.color}20`, color: phase.color }}>
              {step.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>{step.title}</span>
                {step.tag && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-bold flex-shrink-0"
                    style={{ background: `${step.tagColor}20`, color: step.tagColor }}>
                    {step.tag}
                  </span>
                )}
              </div>
              <span className="text-[12px] leading-snug" style={{ color: "var(--text-muted)" }}>{step.desc}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FeatureCard({ section }: { section: FeatureSection }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">{section.icon}</span>
        <h3 className="text-[15px] font-bold" style={{ color: section.color }}>{section.title}</h3>
      </div>
      <div className="space-y-2 mb-3">
        {section.items.map((item, i) => (
          <div key={i} className="flex items-start gap-3">
            <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: section.color }} />
            <span className="text-[13px] flex-1" style={{ color: "var(--text-primary)" }}>{item.label}</span>
            {item.example && (
              <span className="text-[12px] px-2 py-0.5 rounded-md font-mono flex-shrink-0"
                style={{ background: `${section.color}18`, color: section.color }}>
                {item.example}
              </span>
            )}
          </div>
        ))}
      </div>
      <p className="text-[12px] mt-3 pt-3 leading-relaxed"
        style={{ color: "var(--text-muted)", borderTop: "1px solid var(--border-inner)" }}>
        💡 {section.note}
      </p>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function UserGuide() {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="space-y-6">
      {/* Flow Diagram */}
      <div className="rounded-2xl p-6" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <h2 className="text-[15px] font-bold mb-6 text-center" style={{ color: "var(--text-primary)" }}>
          系統資料流程圖
        </h2>

        {FLOW.map((section, si) => (
          <React.Fragment key={si}>
            <StageLabel label={section.stage} />
            <div className="flex gap-2 flex-wrap justify-center mb-2">
              {section.nodes.map((node, ni) => (
                <FlowNodeCard key={ni} node={node} />
              ))}
            </div>
            {si < FLOW.length - 1 && <Arrow />}
          </React.Fragment>
        ))}
      </div>

      {/* Workflow Section */}
      <div className="rounded-2xl p-6" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <h2 className="text-[15px] font-bold mb-1 text-center" style={{ color: "var(--text-primary)" }}>建議操作工作流程</h2>
        <p className="text-[12px] text-center mb-5" style={{ color: "var(--text-muted)" }}>
          依使用頻率分為四個階段，按順序操作可快速上手
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {WORKFLOWS.map(phase => (
            <WorkflowPhaseCard key={phase.phase} phase={phase} />
          ))}
        </div>
      </div>

      {/* Quick Reference Table */}
      <div className="rounded-2xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <h2 className="text-[15px] font-bold mb-4" style={{ color: "var(--text-primary)" }}>各功能入口對照</h2>
        <div className="space-y-2">
          {[
            { icon: "💬", action: "用 LINE 傳訊息記帳", where: "LINE App → 加入 Bot 好友", color: "#10B981" },
            { icon: "📁", action: "上傳銀行 CSV / PDF", where: "工具 → 匯入資料", color: "#3B82F6" },
            { icon: "✏️", action: "手動新增 / 編輯交易", where: "交易記錄 Tab → ＋ 新增", color: "#8B5CF6" },
            { icon: "🎯", action: "設定每月分類預算", where: "預算控制 Tab", color: "#EF4444" },
            { icon: "🏦", action: "管理貸款還款明細", where: "負債管理 Tab", color: "#F59E0B" },
            { icon: "💳", action: "查看信用卡帳單", where: "負債管理 Tab → 信用卡", color: "#06B6D4" },
            { icon: "🔁", action: "識別訂閱自動扣款", where: "訂閱偵測 Tab", color: "#10B981" },
            { icon: "📈", action: "FIRE / 退休 / 年報分析", where: "Header → 進階分析", color: "#8B5CF6" },
            { icon: "🎓", action: "研究所 / 財務規劃", where: "Header → 財務規劃", color: "#6366F1" },
            { icon: "🔔", action: "查看所有警示通知", where: "Header 右側鈴鐺", color: "#EF4444" },
            { icon: "📄", action: "列印正式財務報表", where: "Header → 工具 → 列印月報", color: "#F59E0B" },
          ].map((row, i) => (
            <div key={i} className="flex items-center gap-3 py-2 rounded-lg px-3"
              style={{ background: `${row.color}0a` }}>
              <span className="text-lg w-7 text-center">{row.icon}</span>
              <span className="text-[13px] flex-1 font-medium" style={{ color: "var(--text-primary)" }}>{row.action}</span>
              <span className="text-[12px] px-2 py-0.5 rounded-full font-medium"
                style={{ background: `${row.color}20`, color: row.color }}>
                {row.where}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Toggle detailed feature cards */}
      <div className="text-center">
        <button
          onClick={() => setShowDetails(v => !v)}
          className="text-[13px] px-5 py-2 rounded-full font-medium transition-all"
          style={{ background: "var(--bg-input)", color: "var(--text-sub)", border: "1px solid var(--border)" }}>
          {showDetails ? "▲ 收起詳細說明" : "▼ 展開各功能詳細說明"}
        </button>
      </div>

      {showDetails && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FEATURES.map(f => (
            <FeatureCard key={f.title} section={f} />
          ))}
        </div>
      )}
    </div>
  );
}
