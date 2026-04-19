# LINE 記帳系統

## Skills（輸入 `/` 觸發）
| Skill | 用途 |
|-------|------|
| `/security-check` | 逐項核查安全漏洞現況 |
| `/new-bank-adapter [銀行名] [source] [欄位]` | 新增銀行 CSV adapter |
| `/mcp-add [工具名] [描述]` | 新增 MCP 工具並更新文件 |
| `/update-guide` | 功能完成後更新 UserGuide.tsx |
| `/deploy` | 部署 line-accounting 到 Zeabur |

## 技術棧
Next.js 14 App Router / TypeScript strict / PostgreSQL + Prisma / LINE SDK / Claude API / Notion API / Tailwind + Recharts / chardet + iconv-lite + papaparse（CSV）

## 常用指令
```bash
npm run dev
npx prisma migrate dev --name [說明]   # ⚠️ 先關閉 dev server（DLL lock）
npx prisma migrate deploy              # Zeabur 用這個套用手建 migration
npx prisma generate                    # migration 後重跑
npx prisma studio
```

## 環境變數
DATABASE_URL / LINE_CHANNEL_SECRET / LINE_CHANNEL_ACCESS_TOKEN / ANTHROPIC_API_KEY / NOTION_TOKEN + 各 Notion DB/Page ID / SESSION_SECRET（≥32 字元）/ INTERNAL_API_KEY（kogao→本 repo）/ CRON_SECRET / ADMIN_PASSWORD / NOTION_SAVINGS_SOURCE

## 開發慣例
- Server Component 預設，需互動才加 `"use client"`
- 禁止使用 `any`
- 環境變數從 `process.env` 取，不做 default value
- **時區**：容器是 UTC，所有「當前日期」用 `src/lib/time.ts`（`taipeiToday` / `taipeiYesterday` / `taipeiMonth` / `taipeiTodayAsUTC`）
  - 禁用：`new Date().toISOString().split("T")[0]`、`new Date().getFullYear()` 等
  - 例外：Prisma 存的 Date 欄位（UTC 午夜）讀出來 `.toISOString().split("T")[0]` 仍正確
- Notion 同步一律不 `await`，錯誤只 `console.error` 不 `throw`
- LINE webhook 永遠回 200，錯誤放在 reply 內容
- CSV 每筆匯入後 `sleep(300ms)`
- 重複偵測：同 `userId + date + amount + source`（P2002 → 409）
- git commit 用 conventional commits 格式
- React 子元件（含 input）必須定義在父元件函式外部，否則每次 render 失焦

## 認證架構
| 端點類型 | 驗證方式 |
|---------|---------|
| Dashboard / 大部分 API | iron-session（middleware） |
| kogao → line-accounting | `x-api-key: INTERNAL_API_KEY`（middleware） |
| `/api/cron/*` | `Authorization: Bearer CRON_SECRET`（route 自驗） |
| `/api/webhook` | LINE `x-line-signature`（route 最先驗） |
| `/api/mcp` | `x-api-key: INTERNAL_API_KEY`（route 自驗） |
| `/api/health` | 公開 |

## 記帳分類
```
支出：飲食 / 交通 / 娛樂 / 購物 / 醫療 / 居住 / 教育 / 通訊 / 保險 / 水電 / 美容 / 運動 / 旅遊 / 訂閱 / 寵物 / 其他
收入：薪資 / 獎金 / 兼職
通用：現金 / 轉帳
```

## 部署（Zeabur）
- Project ID: `69d2656c18daef21c603e19c`
- Service ID: `69d265b318daef21c603e1c2`
- URL: `https://accoung.zeabur.app`
- Redeploy：`npx zeabur@latest deploy --project-id 69d2656c18daef21c603e19c --service-id 69d265b318daef21c603e1c2 --json`
- 健康檢查：`GET /api/health`

> Cronicle 排程（kogao 面向的 cron 端點）在 `kogao/CLAUDE.md`，這裡只列本 repo 的 cron：
> `monthly-snapshot`（每月 1 日 08:00）/ `monthly-report`（10:00）/ `annual-report`（1/1 11:00）/ `quarterly-personality-report`（1/4/7/10 月 1 日 10:00）

## 參考文件
- `agent_docs/structure.md` — 專案結構、src 目錄樹、資料流
- `agent_docs/mcp-tools.md` — MCP 工具清單（32 個）
- `agent_docs/csv-adapters.md` — CSV 銀行代碼對應
- `agent_docs/prisma-schema.md` — Prisma 模型說明、migration 注意事項
- `agent_docs/notion.md` — Notion 欄位對應、訂閱資料來源

## TODO
待辦清單集中在記憶檔：`project_line_accounting_todo.md` / `project_hearing_tracker.md` / `project_life_tracker_plan.md`
