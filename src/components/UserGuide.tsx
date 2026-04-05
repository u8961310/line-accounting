"use client";
import React, { useState, useEffect } from "react";

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

interface FeatureSection {
  icon: string;
  title: string;
  color: string;
  items: { label: string; example?: string }[];
  note: string;
  isNew?: boolean;
}

type GuideTab = "flow" | "workflow" | "quickref" | "features";

// ── Tab Config ─────────────────────────────────────────────────────────────────
const GUIDE_TABS: { id: GuideTab; label: string; icon: string }[] = [
  { id: "flow",     label: "資料流程", icon: "🔄" },
  { id: "workflow", label: "操作流程", icon: "📋" },
  { id: "quickref", label: "功能入口", icon: "⚡" },
  { id: "features", label: "詳細說明", icon: "📖" },
];

// ── Flow Diagram ──────────────────────────────────────────────────────────────
const FLOW: FlowSection[] = [
  {
    stage: "① 資料輸入",
    nodes: [
      { icon: "💬", label: "LINE 記帳",       sub: "AI 自動解析金額、分類、備註",            color: "#10B981" },
      { icon: "📁", label: "CSV / PDF 匯入",  sub: "支援 8 家銀行 + 5 家信用卡自動偵測",     color: "#3B82F6" },
      { icon: "✏️", label: "手動記帳",        sub: "Dashboard 直接新增 / 編輯 / 行內金額修改", color: "#8B5CF6" },
    ],
  },
  {
    stage: "② 核心處理",
    nodes: [
      { icon: "🗄️", label: "PostgreSQL 資料庫", sub: "去重偵測（日期 + 金額 + 來源）",       color: "#F59E0B" },
      { icon: "📓", label: "Notion 同步",        sub: "交易背景同步；月報可手動推送",          color: "#6366F1" },
    ],
  },
  {
    stage: "③ 分析模組",
    nodes: [
      { icon: "📊", label: "收支統計",    sub: "月摘要、分類圓餅、趨勢折線、YoY 年同期",          color: "#3B82F6" },
      { icon: "🎯", label: "預算控制",    sub: "各分類上限 + 超標警示 + 歷史建議預算",            color: "#EF4444" },
      { icon: "🏦", label: "帳戶 & 淨資產", sub: "銀行餘額、淨資產快照",                         color: "#10B981" },
      { icon: "💳", label: "信用卡 & 貸款", sub: "帳單管理、還款時間軸",                         color: "#F59E0B" },
      { icon: "🔁", label: "訂閱偵測",    sub: "自動識別每月重複支出（±5% 容忍）",               color: "#06B6D4" },
      { icon: "✨", label: "AI 洞察",     sub: "月度毒舌分析 + z-score 異常偵測 + QuickChart 圖表", color: "#8B5CF6" },
      { icon: "📈", label: "進階分析",    sub: "FIRE / 退休 / 帳戶流量 / 年報",                  color: "#6366F1" },
      { icon: "📍", label: "財務里程碑",  sub: "所有目標 + 研究所 + FIRE 統一橫向時間軸",          color: "#8B5CF6" },
    ],
  },
  {
    stage: "④ 輸出 & 警示",
    nodes: [
      { icon: "🖥️", label: "Dashboard 圖表", sub: "即時更新，三主題切換，每日箴言",              color: "#10B981" },
      { icon: "🔔", label: "通知中心",        sub: "預算超標 / 帳單到期 / 目標落後",             color: "#EF4444" },
      { icon: "📄", label: "列印報表",        sub: "月報 / 年報 HTML 正式格式",                  color: "#F59E0B" },
      { icon: "📝", label: "Notion 月報",     sub: "AI 洞察 + 圖表 + 支出表同步至 Notion",       color: "#6366F1" },
    ],
  },
];

// ── Workflow Data ─────────────────────────────────────────────────────────────
const WORKFLOWS: WorkflowPhase[] = [
  {
    phase: "🚀 新手設定",
    color: "#6366F1",
    freq: "首次使用，一次性",
    steps: [
      { icon: "1", title: "匯入歷史資料",         desc: "工具 → 匯入資料，上傳銀行 CSV／PDF，系統自動去重",                                      tag: "必做", tagColor: "#EF4444" },
      { icon: "2", title: "設定每月預算",          desc: "預算控制 Tab → 各消費分類設定上限，或用「歷史建議」一鍵套用近 3 月平均",                 tag: "建議", tagColor: "#F59E0B" },
      { icon: "3", title: "登記固定支出",          desc: "負債管理 → 固定支出，記錄房租、訂閱費、保險等固定項目",                                  tag: "建議", tagColor: "#F59E0B" },
      { icon: "4", title: "新增貸款 / 信用卡",    desc: "負債管理 Tab → 輸入貸款餘額、利率；信用卡截止日、信額",                                  tag: "選填", tagColor: "#10B981" },
      { icon: "5", title: "設定財務目標",          desc: "財務規劃 → 儲蓄規劃，設定緊急備用金、研究所、教育程式目標金額",                         tag: "選填", tagColor: "#10B981" },
      { icon: "6", title: "設定 Notion 月報頁面", desc: "在 .env 加入 NOTION_MONTHLY_REPORT_PAGE_ID，之後可一鍵同步 AI 月報至 Notion",           tag: "選填", tagColor: "#10B981" },
    ],
  },
  {
    phase: "📅 每日記帳",
    color: "#10B981",
    freq: "每次消費後",
    steps: [
      { icon: "💬", title: "LINE 快速記帳",       desc: "傳送「早餐 80」「計程車 320」，AI 自動解析分類與金額",                                  tag: "最快", tagColor: "#10B981" },
      { icon: "✏️", title: "Dashboard 手動補記",  desc: "交易記錄 Tab → ＋ 新增，適合現金消費；點擊金額可行內直接修改",                          tag: "補充", tagColor: "#6366F1" },
      { icon: "🔔", title: "查看通知警示",         desc: "Header 鈴鐺 → 確認預算使用狀況，超標立即調整消費",                                      tag: "隨時", tagColor: "#EF4444" },
    ],
  },
  {
    phase: "📆 每週檢視",
    color: "#3B82F6",
    freq: "每週一次",
    steps: [
      { icon: "📊", title: "確認本週支出",         desc: "交易記錄 → 快速日期按鈕「本週」，確認分類是否正確",                                    tag: "10 分鐘", tagColor: "#3B82F6" },
      { icon: "📈", title: "查看異常支出警示",     desc: "圖表 Tab 頂端橘色 Banner — z-score 自動偵測超出歷史平均的分類",                        tag: "自動",   tagColor: "#FB923C" },
      { icon: "🔁", title: "識別訂閱費用",         desc: "訂閱偵測 Tab → 確認新偵測的重複扣款是否為訂閱",                                        tag: "選做",   tagColor: "#06B6D4" },
    ],
  },
  {
    phase: "🗓️ 每月收尾",
    color: "#F59E0B",
    freq: "月底 / 月初",
    steps: [
      { icon: "📁", title: "匯入銀行對帳單",       desc: "工具 → 匯入資料，上傳當月 CSV，補齊銀行端記錄",                                        tag: "必做", tagColor: "#EF4444" },
      { icon: "💳", title: "繳清信用卡帳單",       desc: "負債管理 → 信用卡，標記帳單已付，更新帳戶餘額",                                        tag: "必做", tagColor: "#EF4444" },
      { icon: "✨", title: "產生 AI 月度洞察",     desc: "圖表 Tab → AI 月度洞察 → 選當月 → 產生報告，毒舌分析 + 兩張 QuickChart 圖表",          tag: "建議", tagColor: "#8B5CF6" },
      { icon: "📝", title: "同步月報至 Notion",    desc: "AI 洞察卡片 → 📝 同步到 Notion，自動建立含圖表的結構化月報頁面",                       tag: "選做", tagColor: "#6366F1" },
      { icon: "🎯", title: "審查預算達成",          desc: "預算控制 Tab → 查看各分類達成率，調整下月預算上限",                                    tag: "建議", tagColor: "#F59E0B" },
      { icon: "🏦", title: "更新帳戶餘額",          desc: "圖表分析 → 帳戶餘額，對照銀行 App 確認數字一致",                                      tag: "建議", tagColor: "#F59E0B" },
      { icon: "📄", title: "列印月度財報",          desc: "Header → 工具 → 列印月報，產出正式 HTML 財務報表",                                    tag: "選做", tagColor: "#10B981" },
      { icon: "💰", title: "執行儲蓄轉帳",          desc: "儲蓄規劃 → 確認當月可存金額，依建議分配轉入各目標帳戶",                               tag: "選做", tagColor: "#10B981" },
    ],
  },
];

// ── Quick Reference Table ─────────────────────────────────────────────────────
const QUICK_REF = [
  { icon: "💬", action: "用 LINE 傳訊息記帳",       where: "LINE App → 加入 Bot 好友",               color: "#10B981" },
  { icon: "📁", action: "上傳銀行 CSV / PDF",        where: "工具 → 匯入資料",                        color: "#3B82F6" },
  { icon: "✏️", action: "手動新增 / 行內編輯交易",  where: "交易記錄 Tab → ＋ 新增 / 點金額",        color: "#8B5CF6" },
  { icon: "🎯", action: "設定每月分類預算",           where: "預算控制 Tab",                           color: "#EF4444" },
  { icon: "📊", action: "歷史消費建議預算",           where: "預算控制 Tab → 依歷史消費建議",          color: "#3B82F6" },
  { icon: "✨", action: "AI 月度洞察報告",            where: "圖表 Tab → AI 月度洞察",                 color: "#8B5CF6" },
  { icon: "📝", action: "同步月報至 Notion",          where: "AI 月度洞察 → 📝 同步到 Notion",         color: "#6366F1" },
  { icon: "📈", action: "異常支出自動偵測",           where: "圖表 Tab 頂端（自動顯示）",              color: "#FB923C" },
  { icon: "🏦", action: "管理貸款還款明細",           where: "負債管理 Tab",                           color: "#F59E0B" },
  { icon: "💳", action: "查看信用卡帳單",             where: "負債管理 Tab → 信用卡",                  color: "#06B6D4" },
  { icon: "📅", action: "收支日曆 / 熱力圖",          where: "交易記錄 Tab → 📅 日曆",                 color: "#06B6D4" },
  { icon: "🔁", action: "識別訂閱自動扣款",           where: "訂閱偵測 Tab",                           color: "#10B981" },
  { icon: "📈", action: "FIRE / 退休 / 年報分析",    where: "Header → 進階分析",                      color: "#6366F1" },
  { icon: "🎓", action: "研究所 / 財務規劃",          where: "Header → 財務規劃",                      color: "#6366F1" },
  { icon: "📍", action: "財務里程碑時間軸",           where: "Header → 財務規劃 → 里程碑時間軸",        color: "#8B5CF6" },
  { icon: "🔔", action: "查看所有警示通知",           where: "Header 右側鈴鐺",                        color: "#EF4444" },
  { icon: "📄", action: "列印正式財務報表",           where: "Header → 工具 → 列印月報",              color: "#F59E0B" },
  { icon: "🛡️", action: "備份 / 還原所有交易",       where: "工具 → 匯入資料 → 備份 / 還原",         color: "#94A3B8" },
  { icon: "🤖", action: "Claude 批次清理「其他」分類", where: "工具 → 分類清理",                         color: "#8B5CF6" },
  { icon: "🏷️", action: "支出心情分佈（衝動/計畫/必要）", where: "圖表 Tab → 支出心情分佈圖",             color: "#EF4444" },
];

// ── Keyboard Shortcuts ────────────────────────────────────────────────────────
const KEYBOARD_SHORTCUTS = [
  { key: "N",     desc: "新增記帳 Modal" },
  { key: "1 ~ 5", desc: "切換主 Tab（圖表 / 交易 / 預算 / 負債 / 訂閱）" },
  { key: "/",     desc: "開啟快速搜尋交易" },
  { key: "Esc",   desc: "關閉 Modal / 取消行內編輯" },
  { key: "Enter", desc: "行內金額 / 備註編輯儲存" },
];

// ── Feature Detail Cards ──────────────────────────────────────────────────────
const FEATURES: FeatureSection[] = [
  {
    icon: "💬",
    title: "LINE 記帳（最快速）",
    color: "#10B981",
    items: [
      { label: "一般支出",       example: "早餐 80" },
      { label: "指定分類",       example: "交通 悠遊卡 150" },
      { label: "收入",           example: "薪資入帳 50000" },
      { label: "現金提款",       example: "提款 3000（分類選現金）" },
      { label: "查詢本月摘要",   example: "傳送「摘要」或「本月」" },
    ],
    note: "AI 會自動判斷金額、分類、備註，不需要特定格式。",
  },
  {
    icon: "📁",
    title: "CSV / PDF 匯入",
    color: "#3B82F6",
    items: [
      { label: "玉山銀行存款",   example: "CSV / XLS" },
      { label: "中國信託存款",   example: "CSV（Big5 編碼）" },
      { label: "兆豐銀行存款",   example: "CSV" },
      { label: "元大銀行存款",   example: "CSV" },
      { label: "永豐銀行存款",   example: "CSV" },
      { label: "凱基銀行存款",   example: "TXT（固定寬度格式）" },
      { label: "永豐信用卡",     example: "PDF（AI 解析）" },
    ],
    note: "至「匯入資料」頁面，選擇銀行或自動偵測，上傳即可。系統自動去除重複紀錄。",
  },
  {
    icon: "✏️",
    title: "手動新增 & 行內編輯",
    color: "#8B5CF6",
    items: [
      { label: "交易記錄 Tab → ＋ 新增，填入日期、類型、金額、分類、備註" },
      { label: "點擊金額數字可直接行內編輯，Enter 儲存 / Escape 取消" },
      { label: "點擊分類文字可下拉快速修改分類" },
      { label: "點擊備註可行內編輯文字" },
      { label: "批次選取後可一次修改分類或備註" },
    ],
    note: "適合記錄現金消費、非銀行往來的臨時收支。行內編輯免開 Modal，更快速。",
  },
  {
    icon: "✨",
    title: "AI 月度洞察",
    color: "#8B5CF6",
    isNew: true,
    items: [
      { label: "圖表 Tab → AI 月度洞察卡片 → 選月份 → 產生報告" },
      { label: "毒舌風格分析：一句話總評 + 問題條列 + 具體行動建議" },
      { label: "自動生成支出分類佔比（Donut）+ 月份對比（Bar）兩張圖表" },
      { label: "📝 同步到 Notion：含 AI 文字 + 圖表 + 支出明細表格" },
      { label: "可選歷史任意月份分析，非僅限本月" },
    ],
    note: "點「產生報告」後約需 3-5 秒，分析完可折疊收起，不佔版面。",
  },
  {
    icon: "📈",
    title: "支出異常偵測",
    color: "#FB923C",
    isNew: true,
    items: [
      { label: "圖表 Tab 頂端自動顯示橘色 Banner（無需手動觸發）" },
      { label: "以 z-score 統計：當月 > 過去 4 月平均 1.5 個標準差即觸發" },
      { label: "顯示分類、本月金額、歷史平均、z-score 數值" },
      { label: "標準差 < NT$100 的分類不顯示（波動不大無意義）" },
    ],
    note: "比固定閾值更聰明，自動適應個人消費習慣。進入圖表 Tab 時自動計算。",
  },
  {
    icon: "🎯",
    title: "預算控制 & 建議",
    color: "#EF4444",
    items: [
      { label: "預算控制 Tab → 各分類設定上限 → 即時顯示已用 % 和剩餘金額" },
      { label: "⚖️ 50/30/20 建議：依可分配收入自動試算各分類理想上限" },
      { label: "📊 歷史建議：根據近 3 個月實際支出平均 +10% 自動試算" },
      { label: "圖表 Tab → 分類預算快覽列：所有分類進度條一覽，超標變紅" },
      { label: "超標 / 接近上限時 Header 鈴鐺 Badge 同步提示" },
    ],
    note: "「歷史建議」適合已有 3 個月以上資料的使用者，比 50/30/20 更貼近實際習慣。",
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
    icon: "📅",
    title: "收支日曆 & 熱力圖",
    color: "#06B6D4",
    items: [
      { label: "交易記錄 Tab → 📅 切換至日曆視圖" },
      { label: "📅 收支模式：每格顯示當日支出總額（紅色深淺代表金額高低）" },
      { label: "純收入日顯示綠色，hover 彈出當日交易明細" },
      { label: "🔥 熱力模式：改用色塊強度顯示消費密度" },
      { label: "點擊月份左右箭頭瀏覽歷史月份" },
    ],
    note: "hover popup 顯示當日每筆交易的分類、備註、金額，不需進入篩選即可快速查看。",
  },
  {
    icon: "📈",
    title: "進階財務分析",
    color: "#6366F1",
    items: [
      { label: "年度財報 — 全年收支、12 月走勢、支出分類排行" },
      { label: "同月去年比較（YoY）— 今年 vs 去年同月各分類對比" },
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
      { label: "💡 提前還款試算 — 選單選負債 + 滑桿調整每月多還金額，即時顯示提前還清月數與節省利息" },
    ],
    note: "提前還款試算位於策略說明下方；高利率負債（如凱基 16%）多還一點 CP 值最高。",
  },
  {
    icon: "🤖",
    title: "Claude 分類清理",
    color: "#8B5CF6",
    isNew: true,
    items: [
      { label: "工具 → 分類清理 → 點「開始分析」" },
      { label: "Claude 分析備註內容，推測每筆「其他」的正確分類" },
      { label: "每次最多分析 50 筆，建議清單預設全選" },
      { label: "可手動修改個別分類後，點「套用選取」一鍵更新" },
    ],
    note: "分類完成後可繼續點「重新分析」清理剩餘的「其他」交易，直到全部清乾淨。",
  },
  {
    icon: "📍",
    title: "財務里程碑時間軸",
    color: "#8B5CF6",
    isNew: true,
    items: [
      { label: "Header → 財務規劃 → 里程碑時間軸" },
      { label: "橫向可捲動時間軸，所有節點交錯上下排列" },
      { label: "研究所入學（2028/09）自動列為固定節點" },
      { label: "財務目標：有截止日用設定日期；無截止日依月均淨收入估算達成時間" },
      { label: "貸款：有 endDate 的貸款自動列為「還清」里程碑" },
      { label: "FIRE：4% 法則（25× 月支出）＋ 5% 年化報酬率自動試算" },
      { label: "節點色：藍色 = 財務目標、紫色 = 人生規劃、紅色 = 貸款、橘色 = FIRE" },
    ],
    note: "進度條顯示各目標目前完成 %；目標未設截止日時，先設定後即以固定日期顯示更準確。",
  },
  {
    icon: "🏷️",
    title: "支出心情分佈圖",
    color: "#EF4444",
    isNew: true,
    items: [
      { label: "圖表 Tab → 支出心情分佈圖（需有已標記 mood 的支出才顯示）" },
      { label: "📊 趨勢視圖：近 6 個月必要 / 計畫 / 衝動堆疊 Bar Chart" },
      { label: "🥧 分佈視圖：整體佔比 Donut + 各類別進度條與金額" },
      { label: "右上角衝動 % 指標：≥30% 紅色警示，≥15% 橘色，<15% 綠色" },
      { label: "在交易記錄中點「🏷 性質」標記每筆消費的心情類型" },
    ],
    note: "標記越多筆，趨勢越準確；建議至少標記 30% 支出後圖表才有參考價值。",
  },
];

// ── Sub-components ─────────────────────────────────────────────────────────────
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

function GuideTabNav({ active, onChange }: { active: GuideTab; onChange: (t: GuideTab) => void }) {
  return (
    <div className="flex gap-1 p-1 rounded-xl mb-5" style={{ background: "var(--bg-input)", border: "1px solid var(--border)" }}>
      {GUIDE_TABS.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-medium transition-all"
          style={active === tab.id
            ? { background: "var(--accent)", color: "#fff" }
            : { color: "var(--text-muted)" }
          }
        >
          <span>{tab.icon}</span>
          <span className="hidden sm:inline">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}

function WorkflowPhaseCard({ phase }: { phase: WorkflowPhase }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${phase.color}40` }}>
      <div className="flex items-center justify-between px-5 py-3"
        style={{ background: `${phase.color}18`, borderBottom: `1px solid ${phase.color}30` }}>
        <span className="text-[14px] font-bold" style={{ color: phase.color }}>{phase.phase}</span>
        <span className="text-[11px] px-2.5 py-0.5 rounded-full font-medium"
          style={{ background: `${phase.color}25`, color: phase.color }}>{phase.freq}</span>
      </div>
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

function NewbieChecklist({
  steps, checked, onToggle, color,
}: {
  steps: WorkflowStep[];
  checked: boolean[];
  onToggle: (i: number) => void;
  color: string;
}) {
  const doneCount = checked.filter(Boolean).length;
  const allDone = doneCount === steps.length;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${color}40` }}>
      <div className="flex items-center justify-between px-5 py-3"
        style={{ background: `${color}18`, borderBottom: `1px solid ${color}30` }}>
        <span className="text-[14px] font-bold" style={{ color }}>🚀 新手設定</span>
        <div className="flex items-center gap-2">
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{doneCount}/{steps.length} 完成</span>
          <span className="text-[11px] px-2.5 py-0.5 rounded-full font-medium"
            style={{ background: `${color}25`, color }}>首次使用，一次性</span>
        </div>
      </div>

      {allDone && (
        <div className="px-5 py-2.5 text-center text-[13px] font-semibold"
          style={{ background: "#10B98115", color: "#10B981", borderBottom: "1px solid #10B98130" }}>
          ✅ 設定完成！你已準備好開始記帳了
        </div>
      )}

      <div className="divide-y" style={{ background: "var(--bg-card)", borderColor: "var(--border-inner)" }}>
        {steps.map((step, i) => (
          <div key={i}
            className="flex items-start gap-3 px-5 py-3 cursor-pointer transition-opacity select-none"
            style={{ opacity: checked[i] ? 0.55 : 1 }}
            onClick={() => onToggle(i)}>
            <div className="flex-shrink-0 mt-0.5">
              {checked[i] ? (
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-bold"
                  style={{ background: "#10B981", color: "#fff" }}>✓</div>
              ) : (
                <div className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-[11px] font-bold"
                  style={{ borderColor: `${color}80`, color }}>
                  {i + 1}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[13px] font-semibold"
                  style={{ color: "var(--text-primary)", textDecoration: checked[i] ? "line-through" : "none" }}>
                  {step.title}
                </span>
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

function KeyboardShortcutsCard() {
  return (
    <div className="rounded-2xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <h3 className="text-[14px] font-bold mb-4" style={{ color: "var(--text-primary)" }}>
        ⌨️ 鍵盤快捷鍵
      </h3>
      <div className="space-y-2">
        {KEYBOARD_SHORTCUTS.map((s, i) => (
          <div key={i} className="flex items-center gap-3">
            <kbd className="px-2.5 py-1 rounded-md text-[12px] font-mono font-bold min-w-[52px] text-center"
              style={{ background: "var(--bg-input)", color: "var(--accent)", border: "1px solid var(--border)", fontFamily: "monospace" }}>
              {s.key}
            </kbd>
            <span className="text-[13px]" style={{ color: "var(--text-primary)" }}>{s.desc}</span>
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
        <h3 className="text-[15px] font-bold flex-1" style={{ color: section.color }}>{section.title}</h3>
        {section.isNew && (
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0"
            style={{ background: "#FB923C20", color: "#FB923C", border: "1px solid #FB923C40" }}>
            NEW
          </span>
        )}
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
const SETUP_PHASE = WORKFLOWS[0];
const OTHER_PHASES = WORKFLOWS.slice(1);

export default function UserGuide() {
  const [activeTab, setActiveTab] = useState<GuideTab>("flow");
  const [setupChecked, setSetupChecked] = useState<boolean[]>(() =>
    Array(SETUP_PHASE.steps.length).fill(false)
  );
  const [refSearch, setRefSearch] = useState("");

  // Load persisted state from localStorage (client-side only)
  useEffect(() => {
    const savedTab = localStorage.getItem("guide_active_tab") as GuideTab | null;
    if (savedTab && GUIDE_TABS.some(t => t.id === savedTab)) setActiveTab(savedTab);

    const savedChecked = localStorage.getItem("guide_setup_checked");
    if (savedChecked) {
      try {
        const parsed: unknown = JSON.parse(savedChecked);
        if (Array.isArray(parsed) && parsed.length === SETUP_PHASE.steps.length) {
          setSetupChecked(parsed as boolean[]);
        }
      } catch {}
    }
  }, []);

  function handleTabChange(tab: GuideTab) {
    setActiveTab(tab);
    localStorage.setItem("guide_active_tab", tab);
  }

  function handleSetupToggle(index: number) {
    setSetupChecked(prev => {
      const next = [...prev];
      next[index] = !next[index];
      localStorage.setItem("guide_setup_checked", JSON.stringify(next));
      return next;
    });
  }

  const filteredRef = refSearch.trim()
    ? QUICK_REF.filter(r =>
        r.action.includes(refSearch) || r.where.includes(refSearch)
      )
    : QUICK_REF;

  return (
    <div className="space-y-2">
      <GuideTabNav active={activeTab} onChange={handleTabChange} />

      {/* Tab: 資料流程 */}
      {activeTab === "flow" && (
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
      )}

      {/* Tab: 操作流程 */}
      {activeTab === "workflow" && (
        <div className="rounded-2xl p-6" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <h2 className="text-[15px] font-bold mb-1 text-center" style={{ color: "var(--text-primary)" }}>建議操作工作流程</h2>
          <p className="text-[12px] text-center mb-5" style={{ color: "var(--text-muted)" }}>
            依使用頻率分為四個階段，新手設定打勾追蹤進度
          </p>
          <div className="space-y-4">
            <NewbieChecklist
              steps={SETUP_PHASE.steps}
              checked={setupChecked}
              onToggle={handleSetupToggle}
              color={SETUP_PHASE.color}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {OTHER_PHASES.map(phase => (
                <WorkflowPhaseCard key={phase.phase} phase={phase} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: 功能入口 */}
      {activeTab === "quickref" && (
        <div className="space-y-4">
          <div className="rounded-2xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[15px] font-bold" style={{ color: "var(--text-primary)" }}>各功能入口對照</h2>
              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                {filteredRef.length}/{QUICK_REF.length} 項
              </span>
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px]" style={{ color: "var(--text-muted)" }}>🔍</span>
              <input
                type="text"
                placeholder="搜尋功能或入口位置…"
                value={refSearch}
                onChange={e => setRefSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-lg text-[13px] outline-none"
                style={{
                  background: "var(--bg-input)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border)",
                }}
              />
              {refSearch && (
                <button
                  onClick={() => setRefSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px]"
                  style={{ color: "var(--text-muted)" }}>
                  ✕
                </button>
              )}
            </div>

            {filteredRef.length === 0 ? (
              <p className="text-center py-6 text-[13px]" style={{ color: "var(--text-muted)" }}>
                找不到「{refSearch}」相關功能
              </p>
            ) : (
              <div className="space-y-2">
                {filteredRef.map((row, i) => (
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
            )}
          </div>

          <KeyboardShortcutsCard />
        </div>
      )}

      {/* Tab: 詳細說明 */}
      {activeTab === "features" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
              共 {FEATURES.length} 個功能模組
            </p>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                style={{ background: "#FB923C20", color: "#FB923C", border: "1px solid #FB923C40" }}>
                NEW
              </span>
              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>= 近期新增</span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {FEATURES.map(f => (
              <FeatureCard key={f.title} section={f} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
