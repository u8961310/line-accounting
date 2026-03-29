# LINE 記帳系統

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
src/
├── app/
│   ├── api/
│   │   ├── webhook/     # LINE Bot 入口
│   │   ├── summary/     # Dashboard 統計
│   │   ├── import/      # CSV 匯入
│   │   └── health/      # 健康檢查
│   └── dashboard/       # 前端頁面
├── components/
│   └── CsvImport.tsx
└── lib/
    ├── db.ts            # Prisma singleton
    ├── parser.ts        # AI 解析記帳文字
    ├── line.ts          # LINE 工具函式
    ├── notion.ts        # Notion 同步
    └── csv/
        ├── types.ts
        ├── encoding.ts
        ├── detector.ts
        ├── index.ts
        └── adapters/
            ├── tbank.ts
            ├── cathay_bank.ts
            ├── esun_bank.ts
            ├── ctbc_bank.ts
            ├── cathay_cc.ts
            ├── esun_cc.ts
            ├── ctbc_cc.ts
            ├── taishin_cc.ts
            └── ai_fallback.ts

## 環境變數
DATABASE_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
LINE_CHANNEL_SECRET
LINE_CHANNEL_ACCESS_TOKEN
ANTHROPIC_API_KEY
NOTION_TOKEN
NOTION_TRANSACTIONS_DB_ID

## 常用指令
- npm run dev
- npx prisma migrate dev --name [說明]
- npx prisma generate
- npx prisma studio

## 開發慣例
- Server Component 為預設，需互動才加 "use client"
- 禁止使用 any
- 環境變數從 process.env 取，不做 default value
- Notion 同步一律不 await，錯誤只 console.error 不 throw
- LINE webhook 永遠回 200，錯誤放在 reply 內容
- CSV 每筆匯入後 sleep(300ms)
- 重複偵測條件：同 user_id + date + amount + source
- git commit 用 conventional commits 格式

## 資料流
LINE 輸入
→ webhook 驗簽
→ parseExpenseText (claude-haiku)
→ upsert user
→ 存 transactions (source: "line")
→ replyMessage
→ 背景 syncTransactionToNotion

CSV 上傳
→ 轉 UTF-8
→ detectSource
→ getAdapter → parse
→ 去重
→ 存 transactions
→ 背景 syncTransactionToNotion

## 記帳分類
飲食 / 交通 / 娛樂 / 購物 / 醫療 / 薪資 / 獎金 / 其他

## CSV 銀行代碼對應
tbank        → 台灣銀行（民國年，Big5）
cathay_bank  → 國泰世華存款
esun_bank    → 玉山銀行存款
ctbc_bank    → 中國信託存款（民國年 1130328，Big5）
cathay_cc    → 國泰世華信用卡
esun_cc      → 玉山信用卡
ctbc_cc      → 中信信用卡（Big5）
taishin_cc   → 台新信用卡

## Notion 欄位對應
名稱 (title)   → note 不空用 note，否則用 category_name
金額 (number)  → amount
類型 (select)  → 收入 / 支出
分類 (select)  → category_name
日期 (date)    → date
來源 (select)  → source

## 部署
- 平台：Vercel
- 正式 URL：（待填）
- 健康檢查：GET /api/health