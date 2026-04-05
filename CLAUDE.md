# LINE 記帳系統

## 可用 Skills（輸入 `/` 觸發）
| Skill | 用途 |
|-------|------|
| `/todo-scan` | 盤點 CLAUDE.md 待辦，按優先序列出並給建議 |
| `/todo-done [關鍵字] [備註]` | 將指定 TODO 標記為完成並補充實作備註 |
| `/security-check` | 逐項核查 8 個安全漏洞現況 |
| `/new-bank-adapter [銀行名] [source] [欄位]` | 新增銀行 CSV adapter |
| `/mcp-add [工具名] [描述]` | 新增 MCP 工具並更新文件 |
| `/suggest-features` | 分析專案現況，提出新功能建議，確認後自動寫入 CLAUDE.md TODO |
| `/update-guide` | 功能完成後判斷使用說明是否需要更新，若需要則直接修改 UserGuide.tsx |

## 技術棧
- Next.js 14 App Router + TypeScript strict mode
- Supabase (PostgreSQL) + Prisma ORM
- LINE Messaging API (@line/bot-sdk)
- Claude API (@anthropic-ai/sdk)
- Notion API (@notionhq/client) — 單向同步，不回寫
- Tailwind CSS + Recharts
- chardet + iconv-lite — CSV 編碼處理
- papaparse — CSV 解析

## 專案結構
```
src/
├── app/
│   ├── api/
│   │   ├── webhook/                # LINE Bot 入口
│   │   ├── summary/                # Dashboard 統計（支援 ?month= 篩選）
│   │   ├── transactions/           # 交易 CRUD（支援 note/month/exportCsv 參數）
│   │   ├── balances/               # 帳戶餘額
│   │   ├── budgets/                # 預算設定（GET/PUT/DELETE ?category=）
│   │   ├── loans/                  # 貸款 CRUD
│   │   ├── credit-cards/           # 信用卡 & 帳單 CRUD
│   │   ├── fixed-expenses/         # 固定支出 CRUD
│   │   ├── goals/                  # 財務目標 CRUD（含 linkedSource）
│   │   ├── net-worth/snapshots/    # 淨資產歷史快照（upsert by month）
│   │   ├── payees/                 # 帳號對照 CRUD
│   │   ├── transfer-candidates/    # 疑似轉帳配對
│   │   ├── duplicate-candidates/   # 疑似重複交易（同類型+金額+日期±1天）
│   │   ├── import/                 # CSV 匯入
│   │   ├── import-pdf/             # PDF 匯入（KGI 銀行）
│   │   ├── annual-report/          # 年度財報（?year=YYYY）
│   │   ├── account-flow/           # 帳戶月度流量（?months=N）
│   │   ├── notifications/          # 通知中心（預算/帳單/目標警示）
│   │   ├── subscriptions/          # 訂閱偵測（GET 偵測+合併標記 / PUT 更新標記）
│   │   ├── health-score/snapshots/ # 財務健康評分歷史快照（upsert by month）
│   │   ├── print-report/           # 列印月報（正式財務會計報表 HTML，自動 print）
│   │   ├── print-annual-report/    # 列印年報（正式年度財報 HTML，自動 print）
│   │   ├── savings-challenge/      # 存錢挑戰（GET/PUT，含 linkedGoalId）
│   │   ├── auth/                   # 登入驗證
│   │   └── health/                 # 健康檢查
│   ├── dashboard/                  # 前端主頁面（單頁 SPA，5 主Tab + 進階分析 / 財務規劃 / 工具 下拉）
│   └── login/                      # 登入頁
├── components/
│   ├── CsvImport.tsx               # CSV/XLS 匯入元件（自帶兩欄佈局）
│   ├── LoanManager.tsx             # 負債管理（貸款 + 信用卡）
│   ├── BudgetManager.tsx           # 預算控制
│   ├── FixedExpenseManager.tsx     # 固定支出管理（含損益平衡點）
│   ├── PayeeManager.tsx            # 帳號對照
│   ├── DebtOptimizer.tsx           # 還債優化（雪球法 vs 雪崩法）
│   ├── AnnualReport.tsx            # 年度財報（進階分析）
│   ├── AdvancedAnalysis.tsx        # 進階分析（退休/FIRE/收入穩定/固定vs變動/帳戶流量/消費預測）
│   ├── NotificationPanel.tsx       # 通知中心（Header 鈴鐺）
│   ├── SubscriptionDetector.tsx    # 訂閱偵測（自動識別重複交易，支援確認/排除/標籤）
│   ├── BillCalendar.tsx            # 帳單日曆（信用卡截止/結帳日、貸款還款日、固定支出）
│   ├── SavingsChallenge.tsx        # 存錢挑戰（52週遞增/遞減/每週固定/每月固定，可連動目標）
│   ├── SavingsPlan.tsx             # 儲蓄規劃（緊急備用金 + 學習目標 + 研究所 整合看板）
│   ├── GradSchoolPlanner.tsx       # 研究所規劃（2028/09 入學，含行動建議）
│   ├── EducationProgramPlanner.tsx # 教育學程規劃（自費課程分期，含行動建議）
│   └── UserGuide.tsx               # 使用說明（資料流 + 工作流程 + 功能入口對照）
├── lib/
│   ├── db.ts                       # Prisma singleton
│   ├── parser.ts                   # AI 解析記帳文字（claude-haiku）
│   ├── line.ts                     # LINE 工具函式
│   ├── line-messages.ts            # LINE 訊息組裝
│   ├── notion.ts                   # Notion 同步
│   ├── session.ts                  # Session 管理
│   ├── demo-data.ts                # Demo 模式假資料（?demo=1）
│   ├── themes.ts                   # 主題色彩系統
│   └── csv/
│       ├── types.ts
│       ├── encoding.ts
│       ├── detector.ts
│       ├── index.ts
│       └── adapters/
│           ├── tbank.ts
│           ├── cathay_bank.ts
│           ├── esun_bank.ts
│           ├── ctbc_bank.ts
│           ├── kgi_bank.ts
│           ├── mega_bank.ts
│           ├── sinopac_bank.ts
│           ├── yuanta_bank.ts
│           ├── cathay_cc.ts
│           ├── esun_cc.ts
│           ├── ctbc_cc.ts
│           ├── taishin_cc.ts
│           ├── sinopac_cc.ts
│           └── ai_fallback.ts
└── mcp/                            # MCP server（tsx 直接執行，修改後需 npm run build 重新編譯）
```

## 環境變數
```
DATABASE_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
LINE_CHANNEL_SECRET
LINE_CHANNEL_ACCESS_TOKEN
ANTHROPIC_API_KEY
NOTION_TOKEN
NOTION_TRANSACTIONS_DB_ID
```

## 常用指令
```bash
npm run dev
npm run build                            # 重新編譯 MCP server（tsx → dist/mcp/server.js）
npx prisma migrate dev --name [說明]    # ⚠️ 先關閉 dev server（DLL lock）
npx prisma migrate deploy               # 套用手動建立的 migration
npx prisma generate                     # migration 後重新產生 client
npx prisma studio
```

## 開發慣例
- Server Component 為預設，需互動才加 `"use client"`
- 禁止使用 `any`
- 環境變數從 `process.env` 取，不做 default value
- Notion 同步一律不 `await`，錯誤只 `console.error` 不 `throw`
- LINE webhook 永遠回 200，錯誤放在 reply 內容
- CSV 每筆匯入後 `sleep(300ms)`
- 重複偵測條件：同 `user_id + date + amount + source`
- git commit 用 conventional commits 格式
- **React 子元件（含 input）必須定義在父元件函式外部**，否則每次 render 失焦
- Demo 模式：`useRef(typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "1")`
- 轉帳分類不列為收入（summary API 的 `byCategory` loop 有 `continue` 判斷）

## 資料流

**LINE 記帳**
```
LINE 輸入 → webhook 驗簽 → parseExpenseText (claude-haiku)
→ upsert user → 存 transactions (source: "line") → replyMessage
→ 背景 syncTransactionToNotion
```

**CSV 匯入**
```
上傳檔案 → 轉 UTF-8 → detectSource → getAdapter → parse
→ 去重 → 存 transactions → 背景 syncTransactionToNotion
```

## 記帳分類
```
支出：飲食 / 交通 / 娛樂 / 購物 / 醫療 / 居住 / 教育 / 通訊 / 保險 / 水電 / 美容 / 運動 / 旅遊 / 訂閱 / 寵物 / 其他
收入：薪資 / 獎金 / 兼職
通用：現金 / 轉帳
```

## CSV 銀行代碼對應
| 代碼 | 銀行 | 備註 |
|------|------|------|
| `tbank` | 台灣銀行 | 民國年，Big5 |
| `cathay_bank` | 國泰世華存款 | |
| `esun_bank` | 玉山銀行存款 | CSV / XLS |
| `ctbc_bank` | 中國信託存款 | 民國年 1130328，Big5 |
| `kgi_bank` | 凱基銀行存款 | TXT 固定寬度格式 |
| `mega_bank` | 兆豐銀行存款 | |
| `sinopac_bank` | 永豐銀行存款 | |
| `yuanta_bank` | 元大銀行存款 | |
| `cathay_cc` | 國泰世華信用卡 | |
| `esun_cc` | 玉山信用卡 | |
| `ctbc_cc` | 中信信用卡 | Big5 |
| `taishin_cc` | 台新信用卡 | |
| `sinopac_cc` | 永豐信用卡 | PDF（AI 解析） |

## Prisma Schema 重要模型
| 模型 | 說明 |
|------|------|
| `User` | `lineUserId = "dashboard_user"`（Dashboard 固定用戶） |
| `Transaction` | unique(userId, date, amount, source) |
| `BankBalance` | unique(userId, source)；每個 source 只存一筆，更新覆蓋 |
| `Budget` | unique(userId, category)；循環月設定 |
| `Loan + LoanPayment` | 貸款與還款記錄 |
| `CreditCard + CreditCardBill` | 信用卡與帳單 |
| `FixedExpense` | 固定支出（每月必要支出） |
| `FinancialGoal` | 財務目標；`linkedSource` 可連結帳戶自動同步已存金額 |
| `NetWorthSnapshot` | unique(userId, month)；每月淨資產歷史快照 |
| `PayeeMapping` | 帳號對照（pattern → label/category） |
| `AuditLog` | 操作記錄 |
| `SubscriptionMark` | 訂閱標記；`patternKey = "note\|\|amount"`，確認/排除/自訂名稱/備註 |
| `UserCategory` | unique(userId, name)；自訂分類（type: expense/income/both） |
| `HealthScoreSnapshot` | unique(userId, month)；財務健康評分歷史快照 |
| `SavingsChallenge` | unique(userId)；存錢挑戰（type/multiplier/fixedAmount/completedWeeks JSON/linkedGoalId）；linkedGoalId 只讀取目標 savedAmount 顯示，不寫入目標 |

## Notion 欄位對應
| Notion 欄位 | 來源 |
|------------|------|
| 名稱 (title) | note 不空用 note，否則用 category_name |
| 金額 (number) | amount |
| 類型 (select) | 收入 / 支出 |
| 分類 (select) | category_name |
| 日期 (date) | date |
| 來源 (select) | source |

## 部署
- 平台：Vercel
- 正式 URL：（待填）
- 健康檢查：`GET /api/health`

## MCP 工具清單

### 已完成
| 工具 | 功能 |
|------|------|
| `get_summary` | 月收支摘要 |
| `get_transactions` | 交易列表（支援篩選） |
| `get_balances` | 銀行餘額 |
| `get_budgets` | 預算 vs 實際 |
| `get_net_worth` | 淨資產 |
| `get_loans` | 貸款明細 |
| `get_income_breakdown` | 收入來源分析 |
| ~~`get_payees` / `add_payee` / `update_payee` / `delete_payee`~~ | ~~帳號對照 CRUD~~（已移除） |
| `get_weekly_report` | 週報 |
| `get_spending_trend` | 跨月分類比較 |
| `get_loan_summary` | 貸款總覽 |
| `bulk_set_category` | 批量重新分類 |
| `get_cashflow_forecast` | 月底結餘預測 |
| `set_income_source` | 設定收入來源類型 |
| `get_today_spending` | 查今天花了多少、共幾筆 |
| `get_category_trend` | 指定分類近 N 個月趨勢 |
| `get_goals` | 所有目標 + 進度 + 預計達標日 |
| `get_grad_school_plan` | 研究所入學（2028/09）儲蓄規劃分析 |
| `get_budget_alert` | 超標（>100%）或接近上限（≥80%）的預算分類 |
| `get_fixed_expenses` | 固定支出清單 + 月費/年費合計 |
| `get_credit_cards` | 信用卡 + 未繳帳單 + 距截止天數 + 緊急程度 |
| `get_health_score` | 財務健康評分（儲蓄率 40% + 負債比 30% + 預算達成率 30%） |
| `get_fire_progress` | FIRE 進度、目標金額、預計達成年數（逐月複利模擬） |
| `get_subscription_summary` | 已確認訂閱清單 + 月費/年費合計 |
| `get_notifications` | 所有警示（預算/帳單/貸款/目標），危急優先排序 |
| `get_annual_report` | 年度財報摘要（月趨勢 + 分類排行 + 最高/最低月份） |

---

## TODO

> 優先順序：🔴 高 → 🟡 中 → 🟢 低

### 資訊安全（🔴 高優先）

#### 實際漏洞（需盡快修復）
- [ ] **登入暴力破解防護**：`/api/auth/login` 無速率限制，密碼可無限嘗試。加入 in-memory 或 Upstash Redis rate limit（e.g. 同一 IP 10 次失敗後鎖定 15 分鐘）
- [ ] **密碼時序攻擊**：`body.password !== adminPassword` 明文比對可被 timing attack 利用，改用 `crypto.timingSafeEqual(Buffer.from(input), Buffer.from(secret))`
- [ ] **上傳檔案無限制**：`/api/import`、`/api/import-pdf` 未驗證 `file.size` 及 MIME type，可上傳超大檔案耗盡記憶體。加入最大 10MB 限制與 `.csv/.xls/.xlsx/.pdf` 副檔名白名單驗證
- [ ] **lineUserId 可偽造**：`/api/import` 的 `lineUserId` 從 FormData 取得（client 控制），可建立任意 user。改為直接 hardcode `"dashboard_user"`（與其他所有 API 一致）

#### 縱深防禦（建議加入）
- [ ] **HTTP Security Headers**：在 `next.config.js` 的 `headers()` 加入以下回應標頭：
  - `X-Frame-Options: DENY`（防 Clickjacking）
  - `X-Content-Type-Options: nosniff`（防 MIME sniffing）
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Content-Security-Policy`：至少設定 `default-src 'self'`，允許 Recharts inline style
- [ ] **SESSION_SECRET 強度驗證**：啟動時（`src/lib/session.ts`）確認 `SESSION_SECRET` 長度 ≥ 32 字元，否則拋出明確錯誤
- [ ] **Audit Log 補齊敏感操作**：目前 AuditLog 只記錄匯入/AI 重分類，加入：登入成功/失敗、交易刪除、資料備份下載

#### 低風險確認
- [ ] **Webhook 簽名驗證**：確認 `verifySignature` 失敗時立即 return 200（LINE 要求），目前看起來正確但加入單元測試驗證
- [ ] **錯誤訊息稽核**：全面搜尋 API catch block 中的 `e.message` 是否回傳給 client，改為統一回傳 `"操作失敗"` 並 `console.error` 詳細訊息

---

### Phase A / C / LINE Bot 強化
> 已移至 kogao 專案（`d:\code\kogao\CLAUDE.md`）管理

### 資料管理強化（🟡 中）
- [x] 交易分割（一筆拆成多分類，如：超市 $500 → 飲食 $300 + 日用品 $200）
- [x] 資料備份 / 匯出（全部交易匯出 JSON，交易記錄頁「↓ 備份」按鈕）
- [x] 疑似重複交易審核介面（工具 → 重複審核，側邊選刪除或保留兩筆）
- [x] 交易合併（批次選取 ≥2 筆後出現「⊕ 合併」按鈕，金額加總）
- [x] 交易備註快速模板（新增記帳 modal 顯示模板，自動學習已輸入備註）
- [x] 批次修改分類（已存在）
- [x] 交易記錄日曆視圖（已存在）
- [x] 交易備註批次更新：批次選取後可一次修改備註（CSV 匯入的銀行描述碼）
- [x] 匯出 Excel 格式：在備份/匯出頁加入 .xlsx 下載（使用 exceljs 或 xlsx 套件）
- [x] 轉帳自動辨識改善：匯入時偵測轉帳行為直接標為「轉帳」分類，避免支出統計失真
- [x] **CSV 匯入自動套用訂閱分類**：匯入時比對 Notion 訂閱清單產品名稱，若 note 含關鍵字則自動套用對應分類，在 `src/lib/csv/index.ts` 後處理階段注入

### 訂閱管理（Notion 來源）（🟡 中）
> **設計原則**：固定支出只放非訂閱的固定費用（房租/保險/水電），訂閱服務一律在 Notion 維護，兩邊不重疊。


- [x] 訂閱資料改從 Notion Database 讀取（欄位：產品/訂閱開始日/付款方式/分類標籤/訂閱週期/訂閱費/每月金額/總計花費）
- [x] 勾選「取消訂閱」的項目自動排除，不列入計算也不顯示
- [x] 付款方式分布進度條（百分比 + 顏色）
- [x] 支援付款方式 filter chips + 關鍵字搜尋 + 排序（月費/累計/名稱/開始日）
- [x] **整合帳單日曆**：從「訂閱開始日 + 訂閱週期」計算下次扣款日，顯示在 BillCalendar（`/api/subscriptions` 新增 `nextBillingDate` 欄位）
- [x] **整合通知中心**：年繳訂閱距下次扣款 ≤14 天時，自動加入 `/api/notifications` 警示
- [x] **信用卡頁面顯示訂閱負擔**：LoanManager 信用卡列表旁顯示「綁定 X 項訂閱・月費 NT$Y」（比對付款方式欄位）
- [x] **分類標籤圓餅圖**：訂閱頁加「by 標籤」分組視圖，顯示各類別月費佔比
- ~~**年繳省錢試算**：月繳項目旁顯示「改年繳每年可省 NT$X」提示~~ → 不需要
- [ ] **LINE 推播**：年繳訂閱到期前 N 天自動推播提醒（由 kogao 負責呼叫）
- [x] **訂閱 vs 交易比對**：新增 `/api/subscriptions/verify`，比對本月交易與 Notion 訂閱清單（模糊比對名稱），顯示「已扣款 / 未找到交易」狀態於訂閱管理頁下方
- ~~**外幣訂閱換算顯示**：Notion DB 加 `原幣金額` + `幣別` 欄位，非 TWD 時顯示「USD 9.99 ≈ NT$ 320」，匯率可 hardcode 或串公開 API~~ → 不需要
- ~~**信用卡回饋試算**：訂閱管理頁新增回饋試算區塊，依付款方式分組月費 × 可設定回饋率，顯示每月可賺回饋金額，設定值存 localStorage~~ → 不需要

### 訂閱偵測優化（🟡 中）
- [x] 偵測邏輯加入金額容忍區間（±5%），處理國際訂閱匯率浮動
- ~~定期交易自動建立~~：工作流已用 CSV 匯入覆蓋，不需自動生成（會重複記帳）

### Dashboard 優化（🟢 低）
- [x] 圖表卡片自訂顯示（使用者可選擇首頁要顯示哪幾個圖表）
- [x] 圖表卡片拖曳排序（⠿ 拖曳調整順序，存入 localStorage）
- [x] 月份對比卡（圖表 tab 新增當月 vs 上月收支對比卡）
- [x] 快速搜尋 Bar（Header 搜尋鈕，Enter 跳到交易記錄，/ 鍵觸發）
- [x] 收支小結常駐卡（交易記錄頁頂端常駐本月收入/支出/儲蓄率）
- [x] JSON 備份還原（匯入頁支援從備份 JSON 反向還原，重複自動跳過）
- [x] 鍵盤快捷鍵（N=新增記帳, 1-5=切主Tab, /=搜尋, Esc=關Modal）
- [x] 財務健康評分動畫計數器（從 0 easeOut 動畫跳到目前分數）
- [x] 頁面 title 顯示當前月份（LINE 記帳 | YYYY-MM）
- [x] 分類預算快覽列：圖表 Tab 頂端顯示所有分類的 已用/預算 進度條，超標變紅（目前需切到預算 Tab）
- [x] 每日消費熱力圖：整合進收支日曆，新增「📅 收支 / 🔥 熱力」切換按鈕（共用資料與月份導航，不另開獨立卡片）
- [x] 消費月曆升級：日曆格子顯示當日支出總額（紅色漸層強度），hover 彈出當日交易明細 popup（分類/備註/金額），純收入日顯示綠色
- ~~搜尋歷史記錄：快速搜尋 Bar 顯示最近 5 筆紀錄（localStorage），點一下套用~~ → 不需要
- [x] 淺色主題：確認「☀️ 淺藍」「☀️ 白底」為淺色主題，「🌙 深色」為深色主題；優化命名加 ☀️/🌙 標示，並強化淺色主題卡片陰影與邊框細節
- [x] 月曆 hover popup 邊界修正：行末格子（週六/週日欄）的明細 popup 可能超出右側畫面，需偵測位置動態往左展開
- [x] 圖表 Tab 卡片懶載入：卡片數量多時初次進入較慢，考慮依 cardOrder/visibility 分批渲染
- [x] 預算月結轉機制：某月預算沒用完時，自動把剩餘的 X% 結轉到下月額度（`Budget` 加 `carryoverPct` 欄位，BudgetManager 加結轉設定 toggle，預算進度條顯示「基本 $3,000 + 結轉 $450」）

### 頁面 UX 優化（🟡 中）

#### 導覽 / Header
- [x] Tab 記憶：重新整理後回到上次所在的 Tab（localStorage 存 activeTab）
- [x] 通知鈴鐺紅點：在鈴鐺上直接顯示未讀通知數量 badge
- [x] Header 單行化：Logo 與 Tab nav 合併同一行，減少垂直空間佔用

#### 圖表 tab
- [x] 月份對比卡可展開：點擊展開看全分類對比 Bar Chart
- [x] 淨資產 Hero 點擊跳轉：點「貸款餘額」跳負債管理、點「信用卡未繳」跳信用卡
- [x] 帳戶餘額空狀態：沒有帳戶時顯示「→ 前往匯入 CSV」引導按鈕
- [x] 進度條動畫：健康評分三條子進度條也從 0 漸入
- [x] 圖表 Tooltip 統一格式：全部加 NT$ 前綴與千分位
- [x] 負債 Tab badge：Tab 標題旁顯示「最近 7 天到期帳單數」紅點，不需進 Tab 就看到警示

#### 交易記錄頁
- [x] 篩選快速日期按鈕：今天 / 本週 / 本月 / 上月 一鍵套用（在進階篩選日期列新增快速按鈕，點選高亮並自動填入 dateFrom/dateTo）
- [x] 銀行來源篩選：進階篩選新增「來源」多選列，支援 LINE / 手動 / 各銀行 / 信用卡，篩選條件同步至 export CSV
- [x] 無限滾動：滾到底部自動載入下一頁，取代分頁按鈕
- [x] 空狀態改善：搜尋無結果時顯示「清除篩選」按鈕（有篩選條件時顯示 🔍 找不到符合條件＋清除篩選按鈕；真的無資料才顯示原始引導畫面）
- [x] 行內金額編輯：點擊金額直接 inline 編輯，不用開 modal（點擊金額變 input，Enter/blur 儲存，Escape 取消，同步更新 PATCH API 支援 amount 欄位）

#### 效能
- [x] Tab 資料快取：切回之前看過的 Tab 時不重新 fetch（useRef 快取）

#### 手機 / 響應式
- [ ] Tab nav 水平捲動：手機上 Tab 超出螢幕時可左右滑動
- [ ] Modal 全螢幕：手機上新增記帳 modal 改為 bottom sheet 全螢幕

### 通知與推播
> 已移至 kogao 專案（`d:\code\kogao\CLAUDE.md`）管理

### AI 洞察（🔴 高）
- [x] AI 月度洞察報告：每月底用 Claude API 分析當月交易，自動生成個人化建議（支出異常、預算執行、目標進度、研究所儲蓄缺口），結果顯示在 Dashboard 並可 LINE 推播
- [x] 分類預算自動建議：進入預算設定時，根據近 3 個月平均支出自動建議各分類預算金額
- [x] 支出異常偵測（統計型）：以 z-score 偵測某分類當週/當月是否異常偏高（vs 過去 4 週平均），比固定閾值更聰明
- [x] Claude 批次「其他」分類清理：查出所有 category=「其他」交易，Claude 分析 note 批次建議分類，Dashboard 工具區顯示建議列表一鍵套用
- [x] 消費性格 AI 報告：用 Claude 分析近 3 個月交易，生成個人化報告（消費時段分佈、衝動消費比例、高風險分類、行為建議 3 條），新 API `/api/ai-personality-report`，顯示在進階分析 Tab，可傳送 LINE
- [x] **交易備注 AI 批次可讀化**：工具區新增「備注整理」，撈出 note 含英文且未手動編輯的交易，送 Claude API 批次建議中文可讀備注（如 `PAYPAL *ADOBE` → `Adobe 訂閱`），一鍵套用或逐筆確認

### 資料分析強化（🟡 中）
- [x] 收支年同期比較（YoY）：在月份對比卡或進階分析新增「今年 N 月 vs 去年 N 月」，追蹤長期財務進步
- ~~帳單行事曆 .ics 匯出~~ → 改用 LINE 推播提醒（帳單到期前 3 天自動推送）
- ~~財務日記（月度一句話）~~ → 不需要
- [x] 每日財務箴言：圖表 Tab 頂端顯示聖經理財金句 + 關聖帝君聖訓、佛教、文昌帝君，每天自動換一則，可手動 🔀 換一則
- [x] 支出心情分佈圖：mood 欄位（衝動/計畫/必要）月趨勢 Pie + Bar 圖，顯示衝動消費佔比與金額，圖表 Tab 新增卡片（原 AreaChart 升級為 Bar 趨勢 + Pie 分佈切換，右上角 toggle）
- ~~省錢月挑戰：每月自訂分類支出上限挑戰，首頁顯示進度條 + 每日剩餘可花額度，localStorage 存設定~~ → 功能與存錢挑戰（SavingsChallenge）重疊，一併移除
- [x] 貸款提前還款模擬器：負債管理頁加「每月多還 X 元」滑桿，即時試算提前還清月數與節省利息（對凱基 16% 特別有用）（整合進 DebtOptimizer 還債優化，滑桿即時對比還清時間與節省利息，含 CP 值顯示）
- [x] 財務里程碑時間軸：把研究所入學（2028/09）、FIRE 達成年份、各儲蓄目標預計達成日統一顯示在橫向時間軸，串接 goals / get_fire_progress / get_grad_school_plan，新 component `MilestoneTimeline.tsx`，嵌入進階分析 Tab


## 考慮移除 / 降權的功能

> 優先順序：🔴 高（立即可做）→ 🟡 中（需評估）→ 🟢 低（個人判斷）

### ✅ 已移除
| 功能 | 說明 |
|------|------|
| 存錢挑戰（SavingsChallenge） | 52週遞增邏輯複雜，已被「儲蓄規劃」看板取代 → **已完全移除**（Tab + 元件 + API + 資料表） |

---

### 移除 TODO（🔴 高 — 低風險，移除乾淨）

- [x] **疑似轉帳配對**：移除 `/api/transfer-candidates`、dashboard 的 `transferPairs` state + fetch + UI section（line ~3401）；轉帳辨識改由匯入時直接標分類處理
- [x] **帳號對照（PayeeMapping）**：移除 `payees` Tab、`PayeeManager` 元件、`/api/payees/` + `/api/payees/[id]/`；執行 `prisma migrate dev` 刪除 `PayeeMapping` 資料表（待執行 DB migration）

### 改造 TODO（🟡 中 — 保留功能但降低複雜度）

- [x] **財務健康評分快照**：移除手動「📌 記錄」按鈕，改為每次載入圖表 Tab 時自動 upsert 當月快照（趨勢圖保留）；移除 `/api/health-score/snapshots` 的手動呼叫邏輯（與淨資產快照合併為同一 useEffect 自動 upsert）
- ~~**使用說明 Tab**：把「使用說明」從 Tools 下拉移除，改為 Header 右側的 `?` 按鈕展開 Modal，減少 Tab 數量~~ → 保留現狀，待 UI 大改時再評估
- [x] **淨資產快照手動記錄**：與健康評分快照相同，移除「記錄快照」按鈕，改為自動 upsert（目前兩套快照邏輯重複）

### 保留（個人化頁面，確認繼續使用）

| 功能 | 說明 |
|------|------|
| 研究所規劃（GradSchoolPlanner） | 個人化頁面，2028/09 入學規劃 → **保留** |
| 教育學程規劃（EducationProgramPlanner） | 個人化頁面，自費課程分期規劃 → **保留** |
