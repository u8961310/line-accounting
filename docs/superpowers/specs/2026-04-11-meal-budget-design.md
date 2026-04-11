# 三餐日預算 + LINE 記帳警示

**日期**：2026-04-11
**作者**：蛋糕 + Claude
**狀態**：設計已核可，待寫實作計畫

## 目標

讓使用者分別設定早餐 / 午餐 / 晚餐的**每日**預算上限，LINE 記帳時自動判斷該筆屬於哪一餐，當下回覆顯示今日該餐進度，超標即時警示。早上 08:00 透過 kogao 既有早報推播當日三餐預算作為提醒。

## 背景與脈絡

現況：
- `Budget` model 以 category 為鍵（飲食 / 交通 / 娛樂…）儲存**月預算**。
- LINE 記帳流程在 `src/app/api/webhook/route.ts`，透過 `parseExpenseText`（Claude Haiku）抽 amount / category / type / note / date。
- `Transaction` 無「早 / 中 / 晚餐」分層，現有月預算「飲食 15000/月」無法對應單餐單日硬上限的心理模型。
- kogao 已有 `/api/cron/morning-report` 每日 08:00 推播早報，可直接擴充。

使用者痛點：想設定「早餐只能花 100」這種硬上限並在記帳當下被提醒，但現行月預算粒度太粗。

## 關鍵設計決策

| 決策點 | 選擇 | 理由 |
|--------|------|------|
| 辨識三餐的方式 | AI parser 抽 `mealType` + 時間 fallback | 自然語言優先，補記也能靠時間兜底 |
| 預算時間範圍 | 每日 | 符合「早餐只能多少錢」直覺，當日歸零 |
| 與現有 Budget 的關係 | 獨立新 `MealBudget` model | 語意清楚、互不干擾、零動現有功能 |
| 記帳警示呈現 | 每筆都顯示當前進度 | 隨時掌握該餐剩餘額度 |
| 早上提醒機制 | 整合進 kogao 既有 08:00 早報 | 不新增 cron、單一推播、不擾民 |
| 超標處理 | 警示但仍記帳 | 記錄完整，不中斷流程 |

## 架構總覽

```
Dashboard「預算」Tab → MealBudgetCard 設定三餐日預算
                            ↓
                      PUT /api/meal-budgets
                            ↓
                 ┌──────────┴──────────┐
                 ↓                     ↓
LINE 記帳 → webhook         kogao /api/cron/morning-report
     ↓                              ↓
parseExpenseText                GET /api/meal-budgets/today
(含 mealType)                       ↓
     ↓                         Flex 早報掛「三餐預算」區塊
mealType fallback(時間)             ↓
     ↓                          LINE push
存 Transaction (mealType)
     ↓
查今日該餐已花 vs MealBudget
     ↓
Flex 卡片掛進度/警示 → reply
```

## 1. 資料模型

### 新增 `MealBudget`

```prisma
model MealBudget {
  id        String   @id @default(cuid())
  userId    String
  mealType  String   // "breakfast" | "lunch" | "dinner"
  amount    Decimal  @db.Decimal(12, 2)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, mealType])
}
```

同步在 `User` model 加 relation：`mealBudgets MealBudget[]`。

### 擴充 `Transaction`

```prisma
model Transaction {
  // 既有欄位...
  mealType String?  // "breakfast" | "lunch" | "dinner"，只有飲食類才有值
}
```

`mealType` 為可空欄位，不影響既有資料與查詢。

### Migration 策略

依照 `feedback_prisma_migration.md` 規則：**手動建立 migration SQL 檔**，不可只用 `db push`。migration 名稱：`YYYYMMDDHHMMSS_add_meal_budget`。

## 2. API Endpoints

所有 endpoint 走 iron-session middleware 驗證（除了 `/today` 另外處理）。

### `GET /api/meal-budgets`

回傳當前三餐預算 + 今日已花：
```json
{
  "budgets": [
    { "mealType": "breakfast", "amount": 100, "isActive": true, "spentToday": 80 },
    { "mealType": "lunch",     "amount": 200, "isActive": true, "spentToday": 150 },
    { "mealType": "dinner",    "amount": 250, "isActive": true, "spentToday": 0 }
  ],
  "date": "2026-04-11"
}
```

今日範圍：用 `taipeiTodayAsUTC()` 計算 `start` / `end`。

### `PUT /api/meal-budgets`

body：`{ mealType: "breakfast" | "lunch" | "dinner", amount: number, isActive?: boolean }`

Upsert by `userId + mealType`。驗證：amount ≥ 0，mealType 必須是三個合法值。

### `DELETE /api/meal-budgets?mealType=breakfast`

硬刪除該使用者該餐的 budget。

### `GET /api/meal-budgets/today`

給 kogao 早報用。走 `x-api-key: INTERNAL_API_KEY` middleware 驗證。回傳結構同 `GET /api/meal-budgets`，但**過濾 `isActive=true`** 且**若所有都沒設定就回 `{ budgets: [] }`**（kogao 根據空陣列決定省略整段）。

## 3. Meal Type 辨識

### 3.1 Parser 擴充（`src/lib/parser.ts`）

`ParsedExpense` interface 加：
```ts
mealType?: "breakfast" | "lunch" | "dinner";
```

system prompt 追加規則：
```
- 若訊息內容是飲食相關，請判斷是哪一餐：
  - 含「早餐」「早」「breakfast」或上下文暗示早晨 → mealType: "breakfast"
  - 含「午餐」「中餐」「lunch」或中午時段描述 → mealType: "lunch"
  - 含「晚餐」「dinner」或晚上時段描述 → mealType: "dinner"
  - 無法判斷 → mealType 不設定
- 非飲食類不需要設定 mealType
```

JSON schema 輸出新增 `mealType` 欄位，解析時白名單過濾（只接受三個合法值或 undefined）。

### 3.2 時間 fallback（新檔 `src/lib/meal-type.ts`）

```ts
export type MealType = "breakfast" | "lunch" | "dinner";

export function inferMealTypeByTime(date: Date): MealType | null {
  // 使用台灣時區 hour
  // ...
}
```

規則：
| 台北時間 | mealType |
|---------|----------|
| 04:00 – 10:29 | breakfast |
| 10:30 – 14:59 | lunch |
| 15:00 – 21:59 | dinner |
| 其他（22:00 – 03:59） | null |

### 3.3 整合（`webhook/route.ts`）

於 `handleTextMessage` 解析完且準備存 Transaction 前：
```ts
let mealType = parsed.mealType ?? null;
if (!mealType && isFoodCategory(parsed.category)) {
  mealType = inferMealTypeByTime(new Date());
}
```

`isFoodCategory(category: string)`：白名單匹配「飲食」「早餐」「午餐」「晚餐」「food」等（放在 `meal-type.ts` 當工具函式）。非飲食分類不 fallback。

存 Transaction 時帶入 `mealType` 欄位。

## 4. 記帳警示（webhook）

存完 Transaction 後，**若** `mealType` 有值：

1. 查該使用者該 `mealType` 的 `MealBudget`（`isActive=true`）。若無則跳過整段警示邏輯。
2. 用 `taipeiTodayAsUTC()` 計算今日範圍，`groupBy` 查該使用者當日該 `mealType` 的總支出（`type=支出`）。
3. 計算 `spent / amount`：
   - `spent <= amount`：進度訊息 `🍳 今日{餐名} {spent} / {amount}（剩 {amount-spent}）`
   - `spent > amount`：警示訊息 `🍳 今日{餐名} {spent} / {amount} ⚠️ 已超 {spent-amount}`
4. 將字串透過新增的 `mealBudgetStatus?: string` 欄位傳給 `buildRecordedMessage`，由它決定在 Flex bubble 底部加一個 text box。

### Flex 呈現細節

在既有 `buildRecordedMessage` Flex bubble body 尾端加一個 separator + text：
- 正常：`text` 用預設色（灰）
- 超標：`text` 用紅色 `#E53935` + bold

`src/lib/line-messages.ts` 的 `buildRecordedMessage` 簽名擴充。

## 5. 早報整合（kogao）

### 5.1 kogao 新邏輯

`kogao/src/app/api/cron/morning-report/route.ts`（或對應位置）在既有早報組裝流程中：
1. 呼叫 `${LINE_ACCOUNTING_URL}/api/meal-budgets/today`，header 帶 `x-api-key: INTERNAL_API_KEY`
2. 取得 `budgets` 陣列後：
   - 空 → 整段 skip
   - 非空 → 組一段 Flex section：

```
🍽️ 今日三餐預算
早餐 $100｜午餐 $200｜晚餐 $250
記得不要超過喔～
```

金額未設定的餐直接省略（例如只有早餐午餐）。區塊放在早報 Flex 的現有結構後段。

### 5.2 環境變數

kogao 需確認已有 `LINE_ACCOUNTING_URL` 與 `INTERNAL_API_KEY`（依照現有 CLAUDE.md 應該都有）。若無則補上。

## 6. Dashboard UI（line-accounting）

### 6.1 新元件 `src/components/MealBudgetCard.tsx`

三張卡片（早 / 午 / 晚）一組，每張顯示：
- 餐名 + icon（🌅 / ☀️ / 🌙）
- 日預算金額（點擊可編輯，類比現有 BudgetEditor）
- 今日已花 / 剩餘 進度條
- 「停用」toggle

呼叫 API：`GET /api/meal-budgets`、`PUT`、`DELETE`。

### 6.2 整合點

在 `src/app/dashboard/page.tsx` 的「預算」Tab 內新增「三餐日預算」子區塊，放在現有月預算清單上方或下方（視覺上與月預算清楚區隔，加 divider + 小標題）。

## 7. 測試

### 新檔案
- `src/lib/meal-type.test.ts`
  - `inferMealTypeByTime` 邊界：03:59 / 04:00 / 10:29 / 10:30 / 14:59 / 15:00 / 21:59 / 22:00
  - `isFoodCategory` 白名單：飲食 / 早餐 / 非飲食
- `src/app/api/meal-budgets/route.test.ts`
  - PUT upsert 新建
  - PUT upsert 更新
  - GET 含今日已花計算
  - DELETE 成功
  - 非法 mealType / 負金額 回 400

### 擴充
- `src/lib/parser.test.ts` 加三筆 case：「早餐 麥當勞 120」、「午餐 85」、「吃晚餐花 200」

## 8. 範圍外（Out of Scope）

明確不做：
- ❌ 既有「飲食」月預算不動（兩者共存）
- ❌ 週預算或彈性調配機制
- ❌ 硬擋超標記帳（只警示，仍記錄）
- ❌ kogao-os `/budgets` 頁面改動（本次只改 line-accounting Dashboard）
- ❌ 歷史 Transaction 回填 `mealType`（新欄位為可空，舊資料維持 null）
- ❌ 一日多餐同時警示（每筆記帳只處理該筆對應的那一餐）

## 9. 風險與注意事項

1. **Haiku parser mealType 穩定度**：新增欄位可能讓小模型偶爾漏抽，靠時間 fallback + 測試覆蓋降低風險。
2. **時區**：所有「今日」計算必須走 `taipeiTodayAsUTC()`，絕對不可用 `new Date().toISOString().split("T")[0]`（CLAUDE.md 硬規則）。
3. **Prisma migration**：不可只 `db push`，必須手建 SQL 檔才能 Zeabur `migrate deploy`。
4. **Flex Message text 欄位非空**：依 `feedback_line_flex_empty_text.md`，進度訊息不能為空字串，若無 MealBudget 設定直接不加這個 box。
5. **kogao → line-accounting 新 endpoint**：記得 `INTERNAL_API_KEY` middleware 要涵蓋新路由（看現有 middleware whitelist 設定）。

## 10. 驗收條件

- [ ] 可在 Dashboard 設定早/午/晚各自日預算
- [ ] LINE 記「早餐 麥當勞 150」自動抽到 breakfast 並存 `mealType`
- [ ] LINE 記「吃了個 50 的」在 09:00 自動 fallback 為 breakfast
- [ ] LINE 回覆 Flex 底下顯示「🍳 今日早餐 150 / 100 ⚠️ 已超 50」
- [ ] 未設定 meal budget 時，記帳 Flex 不顯示進度列，行為與原本完全一致
- [ ] 早上 08:00 的 kogao 早報出現「🍽️ 今日三餐預算」區塊（若有設定）
- [ ] 所有測試通過
- [ ] Zeabur 部署成功（`npx prisma migrate deploy` 乾淨跑過）
