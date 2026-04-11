# LINE 記帳系統

## Skills（輸入 `/` 觸發）
| Skill | 用途 |
|-------|------|
| `/security-check` | 逐項核查安全漏洞現況 |
| `/new-bank-adapter [銀行名] [source] [欄位]` | 新增銀行 CSV adapter |
| `/mcp-add [工具名] [描述]` | 新增 MCP 工具並更新文件 |
| `/update-guide` | 功能完成後更新 UserGuide.tsx |
| `/deploy` | 部署 line-accounting 到 Zeabur |

---

## 技術棧
- Next.js 14 App Router + TypeScript strict mode
- PostgreSQL + Prisma ORM（Zeabur 托管）
- LINE Messaging API (@line/bot-sdk)
- Claude API (@anthropic-ai/sdk)
- Notion API (@notionhq/client) — 單向同步，不回寫
- Tailwind CSS + Recharts
- chardet + iconv-lite — CSV 編碼處理 / papaparse — CSV 解析

---

## 專案結構
```
src/
├── app/
│   ├── api/
│   │   ├── webhook/                 # LINE Bot 入口（verifySignature 最先呼叫）
│   │   ├── transactions/            # CRUD + batch-delete + merge + split + categories
│   │   ├── summary/                 # Dashboard 統計（?month= 篩選）
│   │   ├── balances/                # 帳戶餘額
│   │   ├── budgets/                 # 預算 CRUD（?category=）
│   │   ├── loans/                   # 貸款 CRUD + payments + topup
│   │   ├── credit-cards/            # 信用卡 & 帳單 CRUD
│   │   ├── fixed-expenses/          # 固定支出 CRUD
│   │   ├── goals/                   # 財務目標 CRUD（含 linkedSource）
│   │   ├── net-worth/snapshots/     # 淨資產快照（upsert by month）
│   │   ├── health-score/snapshots/  # 健康評分快照（upsert by month）
│   │   ├── streak/                  # 記帳連續天數 GET
│   │   ├── user-settings/           # 警報門檻 + 時薪設定
│   │   ├── notifications/           # 通知中心（預算/帳單/目標警示）
│   │   ├── subscriptions/           # 訂閱偵測 + /verify
│   │   ├── import/                  # CSV/XLS 匯入
│   │   ├── import-json/             # JSON 備份還原
│   │   ├── import-pdf/              # PDF 匯入（KGI 銀行）
│   │   ├── duplicate-candidates/    # 疑似重複交易
│   │   ├── transfer-pair/           # 轉帳配對
│   │   ├── personal-debts/          # 借貸往來
│   │   ├── category-rules/          # AI 分類學習規則 CRUD
│   │   ├── anomaly-detection/       # z-score 異常支出偵測
│   │   ├── ai-insight/              # AI 月度洞察
│   │   ├── ai-personality-report/   # 消費性格 AI 報告
│   │   ├── annual-report/           # 年度財報（?year=YYYY）
│   │   ├── account-flow/            # 帳戶月度流量
│   │   ├── quick-entries/           # 快捷記帳
│   │   ├── tasks/                   # 待辦任務 CRUD
│   │   ├── audit-logs/              # Audit log（含 /stream SSE）
│   │   ├── mcp/                     # MCP HTTP endpoint（x-api-key 驗證）
│   │   ├── cron/
│   │   │   ├── monthly-snapshot/    # 每月 1 日 → 淨資產+健康分數快照
│   │   │   ├── monthly-report/      # 每月 1 日 → AI 月報+異常+訂閱漲價 → Notion
│   │   │   ├── annual-report/       # 每年 1/1 → 年度財報 → Notion
│   │   │   └── quarterly-personality-report/  # 每季 1 日 → 消費性格 AI → Notion
│   │   ├── auth/login/              # 登入（rate limit + timingSafeEqual）
│   │   └── health/                  # 健康檢查
│   ├── dashboard/page.tsx           # 主頁面 SPA（主 Tab + 進階分析/規劃/工具下拉）
│   └── login/
├── components/                      # 各功能元件（略，見 src/components/）
├── lib/
│   ├── db.ts                        # Prisma singleton
│   ├── time.ts                      # 台灣時區工具（taipeiToday/Yesterday/Month/AsUTC）
│   ├── streak.ts                    # 連續天數更新邏輯
│   ├── audit.ts                     # Audit log 寫入
│   ├── parser.ts                    # AI 解析記帳文字（claude-haiku）
│   ├── line.ts                      # LINE 工具函式
│   ├── session.ts                   # Session 管理（iron-session）
│   ├── category-rules.ts            # 分類規則比對
│   ├── notion.ts                    # Notion 同步
│   ├── themes.ts                    # 主題色彩系統
│   ├── quotes.ts                    # 每日財務箴言
│   ├── demo-data.ts                 # Demo 模式假資料（?demo=1）
│   └── csv/
│       ├── detector.ts / index.ts / types.ts / encoding.ts / transfer.ts
│       └── adapters/                # tbank / cathay / esun / ctbc / kgi / mega /
│                                    # sinopac / yuanta / taishin / ai_fallback 等
└── mcp/
    ├── createMcpServer.ts           # MCP 工具定義（HTTP + stdio 共用）
    └── server.ts                    # stdio transport 包裝（npx tsx 直接執行）
```

---

## 環境變數
```
# 資料庫
DATABASE_URL

# LINE
LINE_CHANNEL_SECRET
LINE_CHANNEL_ACCESS_TOKEN

# AI
ANTHROPIC_API_KEY

# Notion
NOTION_TOKEN
NOTION_TRANSACTIONS_DB_ID
NOTION_SUBSCRIPTIONS_DB_ID
NOTION_MONTHLY_REPORT_PAGE_ID
NOTION_ANNUAL_REPORT_PAGE_ID
NOTION_QUARTERLY_REPORT_PAGE_ID     # 季度消費性格報告歸檔頁面
NOTION_ANOMALY_PAGE_ID
NOTION_MILESTONES_PAGE_ID
NOTION_SAVINGS_SOURCE               # 連動帳戶 source 代碼（如 mega_bank）

# 認證
SESSION_SECRET                      # ≥ 32 字元
INTERNAL_API_KEY                    # kogao → line-accounting API key
CRON_SECRET                         # Cronicle → cron API Bearer token
ADMIN_PASSWORD
```

---

## 常用指令
```bash
npm run dev
npx prisma migrate dev --name [說明]   # ⚠️ 先關閉 dev server（DLL lock）
npx prisma migrate deploy              # 套用手動建立的 migration（Zeabur 用這個）
npx prisma generate                    # migration 後重新產生 client
npx prisma studio
```

---

## 開發慣例
- Server Component 為預設，需互動才加 `"use client"`
- 禁止使用 `any`
- 環境變數從 `process.env` 取，不做 default value
- **時區**：容器是 UTC，所有「當前日期」計算一律用 `src/lib/time.ts`
  - `taipeiToday()` / `taipeiYesterday()` / `taipeiMonth()` / `taipeiTodayAsUTC()`
  - 禁用：`new Date().toISOString().split("T")[0]`、`new Date().getFullYear()` 等
  - 例外：Prisma 存的 Date 欄位（UTC 午夜）讀出來 `.toISOString().split("T")[0]` 仍正確
- Notion 同步一律不 `await`，錯誤只 `console.error` 不 `throw`
- LINE webhook 永遠回 200，錯誤放在 reply 內容
- CSV 每筆匯入後 `sleep(300ms)`
- 重複偵測：同 `userId + date + amount + source`（P2002 → 409）
- git commit 用 conventional commits 格式
- React 子元件（含 input）必須定義在父元件函式外部，否則每次 render 失焦
- Demo 模式：URL `?demo=1` 觸發，`useRef` 讀取避免 SSR 問題

---

## 認證架構
| 端點類型 | 驗證方式 |
|---------|---------|
| Dashboard 頁面 / 大部分 API | iron-session（middleware） |
| kogao → line-accounting | `x-api-key: INTERNAL_API_KEY`（middleware） |
| `/api/cron/*` | `Authorization: Bearer CRON_SECRET`（route 自驗） |
| `/api/webhook` | LINE `x-line-signature`（route 最先驗） |
| `/api/mcp` | `x-api-key: INTERNAL_API_KEY`（route 自驗） |
| `/api/health` | 公開，無敏感資料 |

---

## 資料流
**LINE 記帳**
```
LINE 輸入 → webhook 驗簽 → parseExpenseText (claude-haiku)
→ 存 transactions → updateStreak → replyMessage
→ 背景：checkBudgetAlert / checkBalanceAlert / 大額警示
```

**CSV 匯入**
```
上傳 → 轉 UTF-8 → detectSource → getAdapter → parse
→ 比對 CategoryRule → 比對訂閱關鍵字 → 去重 → 存 transactions
```

---

## 記帳分類
```
支出：飲食 / 交通 / 娛樂 / 購物 / 醫療 / 居住 / 教育 / 通訊 / 保險 / 水電 / 美容 / 運動 / 旅遊 / 訂閱 / 寵物 / 其他
收入：薪資 / 獎金 / 兼職
通用：現金 / 轉帳
```

---

## 部署（Zeabur）
- Project ID: `69d2656c18daef21c603e19c`
- Service ID: `69d265b318daef21c603e1c2`
- URL: `https://accoung.zeabur.app`
- Redeploy：`npx zeabur@latest deploy --project-id 69d2656c18daef21c603e19c --service-id 69d265b318daef21c603e1c2 --json`
- 健康檢查：`GET /api/health`

---

## Cronicle 排程
| 排程 | 時間（台灣） | 端點 |
|------|------------|------|
| 每日早報 | 08:00 | kogao `/api/cron/morning-report` |
| 每日記帳提醒 | 21:00 | kogao `/api/cron/daily-reminder` |
| 週報 | 週一 09:00 | kogao `/api/cron/weekly-report` |
| 帳單到期提醒 | 每日 09:00 | kogao `/api/cron/bill-reminder` |
| 任務到期提醒 | 每日 09:00 | kogao `/api/cron/task-reminder` |
| 月底財報 | 每月 28 日 20:00 | kogao `/api/push-report` |
| 月度快照 | 每月 1 日 08:00 | `/api/cron/monthly-snapshot` |
| 月報+異常+訂閱 | 每月 1 日 10:00 | `/api/cron/monthly-report` |
| 年度財報 | 每年 1/1 11:00 | `/api/cron/annual-report` |
| 季度消費性格 | 1/4/7/10 月 1 日 10:00 | `/api/cron/quarterly-personality-report` |

---

## MCP 工具清單
| 工具 | 功能 |
|------|------|
| `get_summary` | 月收支摘要 |
| `get_transactions` | 交易列表（支援篩選） |
| `get_balances` | 銀行餘額 |
| `get_budgets` | 預算 vs 實際 |
| `get_net_worth` | 淨資產 |
| `get_loans` | 貸款明細 |
| `get_loan_summary` | 貸款總覽 |
| `get_income_breakdown` | 收入來源分析 |
| `get_weekly_report` | 週報 |
| `get_spending_trend` | 跨月分類比較 |
| `get_cashflow_forecast` | 月底結餘預測 |
| `get_today_spending` | 今天花了多少 |
| `get_category_trend` | 指定分類近 N 月趨勢 |
| `get_goals` | 目標 + 進度 + 預計達標日 |
| `get_budget_alert` | 超標/接近上限的預算分類 |
| `get_fixed_expenses` | 固定支出清單 |
| `get_credit_cards` | 信用卡 + 未繳帳單 |
| `get_health_score` | 財務健康評分 |
| `get_fire_progress` | FIRE 進度與預計達成年數 |
| `get_subscription_summary` | 訂閱清單 + 月費合計 |
| `get_subscriptions` | 完整訂閱明細（含 nextBillingDate） |
| `get_notifications` | 所有警示（預算/帳單/貸款/目標） |
| `get_annual_report` | 年度財報摘要 |
| `get_anomaly_detection` | z-score 異常支出偵測 |
| `get_grad_school_plan` | 研究所儲蓄規劃分析 |
| `bulk_set_category` | 批量重新分類 |
| `set_income_source` | 設定收入來源類型 |
| `set_budget` | upsert 分類預算 |
| `add_transaction` | 新增記帳（source: "mcp"） |
| `update_transaction` | 修改分類/備註/金額/類型 |
| `delete_transaction` | 刪除交易（含 audit log） |
| `add_loan_payment` | 記錄還款 |

---

## 參考文件
- `agent_docs/csv-adapters.md` — CSV 銀行代碼對應、adapter 位置
- `agent_docs/prisma-schema.md` — Prisma 模型說明、migration 注意事項
- `agent_docs/notion.md` — Notion 欄位對應、訂閱資料來源

---

## TODO

待辦清單集中在記憶檔：
- `project_line_accounting_todo.md` — 本 repo 的 UI/UX 與功能待辦
- `project_hearing_tracker.md` — 聽力追蹤（跨 repo）
- `project_life_tracker_plan.md` — 習慣/日記/健康/人際 Phase 2-5（跨 repo）
