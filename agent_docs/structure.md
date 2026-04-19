# 專案結構

```
src/
├── app/
│   ├── api/
│   │   ├── webhook/                 # LINE Bot 入口（verifySignature 最先呼叫）
│   │   ├── transactions/            # CRUD + batch-delete + merge + split + categories
│   │   ├── summary/                 # Dashboard 統計（?month= 篩選）
│   │   ├── balances/                # 帳戶餘額
│   │   ├── budgets/                 # 預算 CRUD（?category=）
│   │   ├── meal-budgets/            # 三餐日預算 CRUD + today（kogao 面向）
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
├── components/                      # 各功能元件（見 src/components/）
├── lib/
│   ├── db.ts                        # Prisma singleton
│   ├── time.ts                      # 台灣時區工具（taipeiToday/Yesterday/Month/AsUTC）
│   ├── streak.ts                    # 連續天數更新邏輯
│   ├── audit.ts                     # Audit log 寫入
│   ├── parser.ts                    # AI 解析記帳文字（claude-haiku）
│   ├── meal-type.ts                 # 三餐類型推論（時間 + 飲食分類）
│   ├── line.ts                      # LINE 工具函式
│   ├── session.ts                   # Session 管理（iron-session）
│   ├── category-rules.ts            # 分類規則比對
│   ├── notion.ts                    # Notion 同步
│   ├── themes.ts                    # 主題色彩系統
│   ├── quotes.ts                    # 每日財務箴言
│   └── csv/
│       ├── detector.ts / index.ts / types.ts / encoding.ts / transfer.ts
│       └── adapters/                # tbank / cathay / esun / ctbc / kgi / mega /
│                                    # sinopac / yuanta / taishin / ai_fallback 等
└── mcp/
    ├── createMcpServer.ts           # MCP 工具定義（HTTP + stdio 共用）
    └── server.ts                    # stdio transport 包裝（npx tsx 直接執行）
```

## 資料流

**LINE 記帳**
```
LINE 輸入 → kogao webhook 驗簽 → parseIntent (claude-haiku)
→ POST /api/transactions（附 mealType）→ 存 transactions + updateStreak
→ 背景：checkBudgetAlert / checkBalanceAlert / 大額警示
```

**CSV 匯入**
```
上傳 → 轉 UTF-8 → detectSource → getAdapter → parse
→ 比對 CategoryRule → 比對訂閱關鍵字 → 去重 → 存 transactions
```
