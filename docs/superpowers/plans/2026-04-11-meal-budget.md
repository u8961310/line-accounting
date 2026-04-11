# 三餐日預算 + LINE 記帳警示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓使用者設定早/午/晚餐每日預算，LINE 記帳時自動判斷並顯示該餐進度與超標警示，早上 08:00 透過 kogao 既有早報推播當日三餐預算提醒。

**Architecture:** 以 line-accounting 為主（新增 `MealBudget` model + 3 個 API endpoint + webhook 擴充 + Dashboard UI），kogao 擴充 `accounting.ts` client 與 morning-report cron 整合。辨識方式為 parser `mealType` 欄位 + 時間 fallback 雙軌。

**Tech Stack:** Next.js 14 App Router / TypeScript strict / Prisma / PostgreSQL / Vitest / Claude Haiku / LINE Messaging API / Tailwind

**Spec:** `docs/superpowers/specs/2026-04-11-meal-budget-design.md`

---

## File Structure

### line-accounting
- **Modify** `prisma/schema.prisma` — add `MealBudget`, `Transaction.mealType`, `User.mealBudgets` relation
- **Create** `prisma/migrations/YYYYMMDDHHMMSS_add_meal_budget/migration.sql` — Postgres SQL for schema change
- **Create** `src/lib/meal-type.ts` — `MealType` type, `inferMealTypeByTime`, `isFoodCategory`, `normalizeMealType`
- **Create** `src/lib/meal-type.test.ts` — vitest tests（含 normalizeMealType 白名單測試）
- **Modify** `src/lib/parser.ts` — `ParsedExpense.mealType` + system prompt 規則 + 改用 `normalizeMealType`
- **Create** `src/app/api/meal-budgets/route.ts` — GET / PUT / DELETE
- **Create** `src/app/api/meal-budgets/route.test.ts` — CRUD 測試
- **Create** `src/app/api/meal-budgets/today/route.ts` — kogao 面向 endpoint（GET only）
- **Modify** `src/lib/line-messages.ts:30-126` — `buildRecordedMessage` 新增 `mealBudgetStatus?` 參數
- **Modify** `src/app/api/webhook/route.ts:107-208` — `handleTextMessage` 整合 mealType 解析、存 Transaction、查 MealBudget、計算進度並帶入 Flex
- **Create** `src/components/MealBudgetManager.tsx` — 三餐日預算設定卡片
- **Modify** `src/app/dashboard/page.tsx` — 在「預算」Tab 掛上 `MealBudgetManager`

### kogao
- **Modify** `src/lib/accounting.ts` — 加 `getMealBudgetsToday()` client
- **Modify** `src/lib/flex.ts:186` — `morningFlex` 擴充（接收 `mealBudgets` 欄位，附加一段 Flex box）
- **Modify** `src/app/api/cron/morning-report/route.ts` — 取 meal budgets 並傳入 `morningFlex`

### 禁區
不動 `kogao-os`、不動 `kogao/src/app/api/webhook/route.ts`（LINE 記帳是 line-accounting webhook，不是 kogao）。

---

## Task 1: Prisma Schema + Migration

**Files:**
- Modify: `D:\code\line-accounting\prisma\schema.prisma`
- Create: `D:\code\line-accounting\prisma\migrations\<timestamp>_add_meal_budget\migration.sql`

**前置：** 先關閉 line-accounting dev server（DLL lock）。參考 `CLAUDE.md` 常用指令。

- [ ] **Step 1.1: 修改 schema.prisma 加入 `MealBudget` model**

在 `model Budget { ... }` 區塊後面（約第 44 行）加入：

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
  @@index([userId])
}
```

- [ ] **Step 1.2: 修改 `Transaction` model，加 `mealType` 可空欄位**

找到 `model Transaction { ... }`（約第 61 行），在 `mood` 欄位後面加：

```prisma
  mealType       String?  // "breakfast" | "lunch" | "dinner"，僅飲食類有值
```

- [ ] **Step 1.3: 修改 `User` model，加 `mealBudgets` relation**

找到 `model User { ... }`，在既有 `budgets Budget[]` 後加一行：

```prisma
  mealBudgets MealBudget[]
```

- [ ] **Step 1.4: 停掉 dev server，建立 migration**

在 `D:\code\line-accounting` 目錄執行：

```bash
# 先關閉 dev server 視窗
npx prisma migrate dev --name add_meal_budget
```

預期：會在 `prisma/migrations/` 產生新資料夾（例 `20260411083000_add_meal_budget/migration.sql`），並自動套用到本機 DB。

驗證：`npx prisma studio` 開啟後能看到 `MealBudget` 表、`Transaction` 有 `mealType` 欄位。

- [ ] **Step 1.5: 檢查產出的 migration SQL**

讀 `prisma/migrations/<timestamp>_add_meal_budget/migration.sql`，確認包含：

```sql
-- CreateTable
CREATE TABLE "MealBudget" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mealType" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MealBudget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MealBudget_userId_mealType_key" ON "MealBudget"("userId", "mealType");
CREATE INDEX "MealBudget_userId_idx" ON "MealBudget"("userId");

-- AddForeignKey
ALTER TABLE "MealBudget" ADD CONSTRAINT "MealBudget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "mealType" TEXT;
```

如缺漏手動補齊。此檔 commit 後，Zeabur 會用 `prisma migrate deploy` 套用（依 `feedback_prisma_migration.md` 鐵律）。

- [ ] **Step 1.6: Regenerate Prisma client**

```bash
npx prisma generate
```

- [ ] **Step 1.7: Commit**

```bash
cd /d/code/line-accounting
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add MealBudget model and Transaction.mealType"
```

---

## Task 2: meal-type 工具函式（TDD）

**Files:**
- Create: `D:\code\line-accounting\src\lib\meal-type.ts`
- Create: `D:\code\line-accounting\src\lib\meal-type.test.ts`

- [ ] **Step 2.1: 寫 failing test**

Create `src/lib/meal-type.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { inferMealTypeByTime, isFoodCategory, normalizeMealType } from "./meal-type";

// 建 UTC Date 代表台北時間 hh:mm
// 台北 = UTC+8，所以 UTC 要減 8 小時
function taipeiHM(h: number, m = 0): Date {
  const d = new Date(Date.UTC(2026, 3, 11, h - 8, m, 0));
  return d;
}

describe("inferMealTypeByTime", () => {
  it("03:59 → null", () => {
    expect(inferMealTypeByTime(taipeiHM(3, 59))).toBeNull();
  });
  it("04:00 → breakfast", () => {
    expect(inferMealTypeByTime(taipeiHM(4, 0))).toBe("breakfast");
  });
  it("10:29 → breakfast", () => {
    expect(inferMealTypeByTime(taipeiHM(10, 29))).toBe("breakfast");
  });
  it("10:30 → lunch", () => {
    expect(inferMealTypeByTime(taipeiHM(10, 30))).toBe("lunch");
  });
  it("14:59 → lunch", () => {
    expect(inferMealTypeByTime(taipeiHM(14, 59))).toBe("lunch");
  });
  it("15:00 → dinner", () => {
    expect(inferMealTypeByTime(taipeiHM(15, 0))).toBe("dinner");
  });
  it("21:59 → dinner", () => {
    expect(inferMealTypeByTime(taipeiHM(21, 59))).toBe("dinner");
  });
  it("22:00 → null", () => {
    expect(inferMealTypeByTime(taipeiHM(22, 0))).toBeNull();
  });
});

describe("isFoodCategory", () => {
  it.each([
    ["飲食", true],
    ["早餐", true],
    ["午餐", true],
    ["晚餐", true],
    ["food", true],
    ["交通", false],
    ["娛樂", false],
    ["", false],
  ])("%s → %s", (input, expected) => {
    expect(isFoodCategory(input)).toBe(expected);
  });
});

describe("normalizeMealType", () => {
  it("breakfast / lunch / dinner 通過", () => {
    expect(normalizeMealType("breakfast")).toBe("breakfast");
    expect(normalizeMealType("lunch")).toBe("lunch");
    expect(normalizeMealType("dinner")).toBe("dinner");
  });
  it("非法值回 undefined", () => {
    expect(normalizeMealType("snack")).toBeUndefined();
    expect(normalizeMealType("")).toBeUndefined();
    expect(normalizeMealType(null)).toBeUndefined();
    expect(normalizeMealType(undefined)).toBeUndefined();
    expect(normalizeMealType(123)).toBeUndefined();
  });
});
```

- [ ] **Step 2.2: Run test to verify it fails**

```bash
cd /d/code/line-accounting
npx vitest run src/lib/meal-type.test.ts
```

預期：FAIL — `Cannot find module './meal-type'`

- [ ] **Step 2.3: 實作 meal-type.ts**

Create `src/lib/meal-type.ts`:

```ts
export type MealType = "breakfast" | "lunch" | "dinner";

const FOOD_KEYWORDS = ["飲食", "早餐", "午餐", "晚餐", "宵夜", "food", "meal"];

/**
 * 從 Date 推斷三餐類型（以台灣時區小時為準）。
 * 04:00–10:29 breakfast / 10:30–14:59 lunch / 15:00–21:59 dinner / else null
 */
export function inferMealTypeByTime(date: Date): MealType | null {
  // 取台灣時區 hour + minute：UTC ms → +8h → hour mod 24
  const taipeiMs = date.getTime() + 8 * 3600 * 1000;
  const d = new Date(taipeiMs);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const total = h * 60 + m;

  if (total >= 4 * 60     && total <  10 * 60 + 30) return "breakfast";
  if (total >= 10 * 60 + 30 && total < 15 * 60)     return "lunch";
  if (total >= 15 * 60    && total <  22 * 60)      return "dinner";
  return null;
}

/**
 * 判斷 category 是否屬於飲食相關，用於決定是否要 fallback 到時間推斷。
 */
export function isFoodCategory(category: string): boolean {
  if (!category) return false;
  const lower = category.toLowerCase();
  return FOOD_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()));
}

/**
 * 將外部輸入（例如 LLM 產出的 JSON 欄位）白名單過濾成合法 MealType。
 */
export function normalizeMealType(raw: unknown): MealType | undefined {
  if (raw === "breakfast" || raw === "lunch" || raw === "dinner") return raw;
  return undefined;
}
```

- [ ] **Step 2.4: Run tests to verify pass**

```bash
npx vitest run src/lib/meal-type.test.ts
```

預期：All tests PASS（inferMealTypeByTime 8 項 + isFoodCategory 8 項 + normalizeMealType 2 項）

- [ ] **Step 2.5: Commit**

```bash
git add src/lib/meal-type.ts src/lib/meal-type.test.ts
git commit -m "feat(lib): add meal-type inference by time + food category check"
```

---

## Task 3: Parser 擴充 mealType

**Files:**
- Modify: `D:\code\line-accounting\src\lib\parser.ts`

**說明：** Parser 主要行為（呼叫 Claude Haiku）不值得 mock 測試（LLM 整合測試脆弱）。關鍵的白名單過濾邏輯已由 Task 2 的 `normalizeMealType` 測試覆蓋。本 Task 只改 parser 的型別與 prompt，不新增 test 檔。

- [ ] **Step 3.1: 修改 parser.ts**

在 `src/lib/parser.ts`：

1. 擴充 `ParsedExpense` interface（第 8-14 行）：

```ts
export interface ParsedExpense {
  amount: number;
  category: string;
  type: "收入" | "支出";
  note: string;
  date?: string; // YYYY-MM-DD，未指定則為 null
  mealType?: "breakfast" | "lunch" | "dinner";
}
```

2. 擴充 `systemPrompt`（第 19-45 行）— 在回應格式中加 `mealType`，並在規則中加入三餐判斷：

```ts
  const systemPrompt = `你是一個記帳助手，專門從自然語言中解析記帳資訊。
今天日期是 ${todayStr}。
請從使用者的訊息中提取記帳資訊，並以 JSON 格式回應。

回應格式：
{
  "amount": 數字（正數），
  "category": "分類名稱",
  "type": "收入" 或 "支出",
  "note": "備註說明",
  "date": "YYYY-MM-DD 或 null",
  "mealType": "breakfast" | "lunch" | "dinner" 或 null
}

常見分類參考：飲食、交通、娛樂、購物、醫療、住房、帳單、貸款、薪資、獎金、現金、其他
可自由使用更精確的分類名稱（如「保險費」「學費」「寵物」「美容」等）。

規則：
- amount 必須是正數
- 薪資、獎金、紅包等收入類型 → type: "收入"
- 其他消費支出 → type: "支出"
- 如果無法判斷是記帳訊息，回應 null
- note 保留原始描述（去除日期部分），category 選最合適的名稱
- 住房：房租、水電、瓦斯、管理費
- 帳單：電信費、網路費、訂閱服務費
- 貸款：貸款還款、信用卡繳費
- 提款、領錢 → category: "現金", type: "支出"
- date：若訊息含有日期（如「昨天」「3/28」「上週五」）則解析為 YYYY-MM-DD，否則為 null
- mealType（僅當訊息內容與飲食有關時才設定）：
  - 含「早餐」「早」「早上吃」「breakfast」→ "breakfast"
  - 含「午餐」「中餐」「中午吃」「lunch」→ "lunch"
  - 含「晚餐」「晚上吃」「dinner」→ "dinner"
  - 亦可從上下文推斷（例：「麥當勞大麥克早餐套餐」→ breakfast）
  - 無法判斷或非飲食類 → null`;
```

3. 擴充 imports（檔案頂端）：

```ts
import { normalizeMealType } from "./meal-type";
```

4. 擴充 JSON 解析（第 72-91 行），在回傳物件前用 `normalizeMealType`：

```ts
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

    if (parsed === null) return null;

    const amount = Number(parsed["amount"]);
    const category = String(parsed["category"] ?? "其他");
    const type = parsed["type"] === "收入" ? "收入" : "支出";
    const note = String(parsed["note"] ?? "");
    const dateVal = parsed["date"];
    const date = typeof dateVal === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateVal) ? dateVal : undefined;
    const mealType = normalizeMealType(parsed["mealType"]);

    if (!isFinite(amount) || amount <= 0) return null;

    return {
      amount,
      category: category || "其他",
      type,
      note,
      date,
      mealType,
    };
```

- [ ] **Step 3.2: Type check**

```bash
cd /d/code/line-accounting
npx tsc --noEmit
```

預期：無 error。

- [ ] **Step 3.3: Commit**

```bash
git add src/lib/parser.ts
git commit -m "feat(parser): extract mealType from LINE expense text"
```

---

## Task 4: API `/api/meal-budgets` CRUD

**Files:**
- Create: `D:\code\line-accounting\src\app\api\meal-budgets\route.ts`
- Create: `D:\code\line-accounting\src\app\api\meal-budgets\route.test.ts`

- [ ] **Step 4.1: 寫 failing test**

Create `src/app/api/meal-budgets/route.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";

// mock prisma
vi.mock("@/lib/db", () => {
  const user = { id: "u1", lineUserId: "dashboard_user" };
  const budgets: Record<string, any> = {};
  const txs: any[] = [];

  return {
    prisma: {
      user: {
        upsert: vi.fn().mockResolvedValue(user),
        findFirst: vi.fn().mockResolvedValue(user),
      },
      mealBudget: {
        findMany: vi.fn(async () => Object.values(budgets)),
        upsert: vi.fn(async ({ where, update, create }: any) => {
          const key = `${where.userId_mealType.userId}_${where.userId_mealType.mealType}`;
          budgets[key] = { id: key, ...create, ...update };
          return budgets[key];
        }),
        deleteMany: vi.fn(async ({ where }: any) => {
          const key = `${where.userId}_${where.mealType}`;
          const existed = budgets[key] ? 1 : 0;
          delete budgets[key];
          return { count: existed };
        }),
      },
      transaction: {
        groupBy: vi.fn().mockResolvedValue([]),
      },
    },
  };
});

import { GET, PUT, DELETE } from "./route";
import { NextRequest } from "next/server";

function req(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost"), init as any);
}

describe("/api/meal-budgets", () => {
  it("PUT 新建 breakfast 預算", async () => {
    const r = await PUT(req("/api/meal-budgets", {
      method: "PUT",
      body: JSON.stringify({ mealType: "breakfast", amount: 100 }),
    }));
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.budget.mealType).toBe("breakfast");
    expect(body.budget.amount).toBe(100);
  });

  it("PUT 非法 mealType 回 400", async () => {
    const r = await PUT(req("/api/meal-budgets", {
      method: "PUT",
      body: JSON.stringify({ mealType: "snack", amount: 50 }),
    }));
    expect(r.status).toBe(400);
  });

  it("PUT 負金額回 400", async () => {
    const r = await PUT(req("/api/meal-budgets", {
      method: "PUT",
      body: JSON.stringify({ mealType: "lunch", amount: -10 }),
    }));
    expect(r.status).toBe(400);
  });

  it("GET 回傳 budgets 陣列 + 今日已花", async () => {
    const r = await GET(req("/api/meal-budgets"));
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(Array.isArray(body.budgets)).toBe(true);
    expect(body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("DELETE 移除指定 mealType", async () => {
    await PUT(req("/api/meal-budgets", {
      method: "PUT",
      body: JSON.stringify({ mealType: "dinner", amount: 300 }),
    }));
    const r = await DELETE(req("/api/meal-budgets?mealType=dinner"));
    expect(r.status).toBe(200);
  });

  it("DELETE 無參數回 400", async () => {
    const r = await DELETE(req("/api/meal-budgets"));
    expect(r.status).toBe(400);
  });
});
```

- [ ] **Step 4.2: Run test → 預期 FAIL**

```bash
npx vitest run src/app/api/meal-budgets/route.test.ts
```

預期：FAIL — `Cannot find module './route'`

- [ ] **Step 4.3: 實作 route.ts**

Create `src/app/api/meal-budgets/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { taipeiToday, taipeiTodayAsUTC } from "@/lib/time";

export const dynamic = "force-dynamic";

const DASHBOARD_USER_ID = "dashboard_user";
const VALID_MEAL_TYPES = ["breakfast", "lunch", "dinner"] as const;
type MealType = typeof VALID_MEAL_TYPES[number];

function isValidMealType(v: unknown): v is MealType {
  return typeof v === "string" && (VALID_MEAL_TYPES as readonly string[]).includes(v);
}

async function getDashboardUser() {
  return prisma.user.upsert({
    where: { lineUserId: DASHBOARD_USER_ID },
    update: {},
    create: { lineUserId: DASHBOARD_USER_ID, displayName: "Dashboard" },
  });
}

// GET /api/meal-budgets — 列出三餐日預算 + 今日已花
export async function GET(_req: NextRequest) {
  try {
    const user = await getDashboardUser();
    const todayStart = taipeiTodayAsUTC();
    const todayEnd = new Date(todayStart.getTime() + 24 * 3600 * 1000);

    const [budgets, spending] = await Promise.all([
      prisma.mealBudget.findMany({ where: { userId: user.id } }),
      prisma.transaction.groupBy({
        by: ["mealType"],
        where: {
          userId: user.id,
          type: "支出",
          mealType: { in: [...VALID_MEAL_TYPES] },
          date: { gte: todayStart, lt: todayEnd },
        },
        _sum: { amount: true },
      }),
    ]);

    const spentMap: Record<string, number> = {};
    for (const s of spending) {
      if (s.mealType) spentMap[s.mealType] = Number(s._sum.amount ?? 0);
    }

    const result = budgets.map((b) => ({
      id: b.id,
      mealType: b.mealType,
      amount: Number(b.amount),
      isActive: b.isActive,
      spentToday: spentMap[b.mealType] ?? 0,
    }));

    return NextResponse.json({ budgets: result, date: taipeiToday() });
  } catch (e) {
    console.error("[meal-budgets GET]", e);
    return NextResponse.json({ error: "操作失敗" }, { status: 500 });
  }
}

// PUT /api/meal-budgets — upsert 單餐預算
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json() as { mealType?: unknown; amount?: unknown; isActive?: unknown };

    if (!isValidMealType(body.mealType)) {
      return NextResponse.json({ error: "mealType 必須是 breakfast / lunch / dinner" }, { status: 400 });
    }
    const amount = Number(body.amount);
    if (!isFinite(amount) || amount < 0) {
      return NextResponse.json({ error: "amount 必須是 ≥ 0 的數字" }, { status: 400 });
    }
    const isActive = typeof body.isActive === "boolean" ? body.isActive : true;

    const user = await getDashboardUser();
    const budget = await prisma.mealBudget.upsert({
      where: { userId_mealType: { userId: user.id, mealType: body.mealType } },
      update: { amount, isActive },
      create: { userId: user.id, mealType: body.mealType, amount, isActive },
    });

    return NextResponse.json({
      success: true,
      budget: {
        id: budget.id,
        mealType: budget.mealType,
        amount: Number(budget.amount),
        isActive: budget.isActive,
      },
    });
  } catch (e) {
    console.error("[meal-budgets PUT]", e);
    return NextResponse.json({ error: "操作失敗" }, { status: 500 });
  }
}

// DELETE /api/meal-budgets?mealType=breakfast
export async function DELETE(req: NextRequest) {
  try {
    const mealType = req.nextUrl.searchParams.get("mealType");
    if (!isValidMealType(mealType)) {
      return NextResponse.json({ error: "請提供合法 mealType 參數" }, { status: 400 });
    }

    const user = await getDashboardUser();
    await prisma.mealBudget.deleteMany({ where: { userId: user.id, mealType } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[meal-budgets DELETE]", e);
    return NextResponse.json({ error: "操作失敗" }, { status: 500 });
  }
}
```

- [ ] **Step 4.4: Run tests → 預期 PASS**

```bash
npx vitest run src/app/api/meal-budgets/route.test.ts
```

預期：6/6 PASS

- [ ] **Step 4.5: Commit**

```bash
git add src/app/api/meal-budgets/route.ts src/app/api/meal-budgets/route.test.ts
git commit -m "feat(api): add meal-budgets CRUD endpoint"
```

---

## Task 5: `/api/meal-budgets/today` kogao 面向 endpoint

**Files:**
- Create: `D:\code\line-accounting\src\app\api\meal-budgets\today\route.ts`

- [ ] **Step 5.1: 實作 today endpoint**

Create `src/app/api/meal-budgets/today/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { taipeiToday, taipeiTodayAsUTC } from "@/lib/time";

export const dynamic = "force-dynamic";

const DASHBOARD_USER_ID = "dashboard_user";

// GET /api/meal-budgets/today
// 給 kogao 早報使用。middleware 會用 x-api-key 驗證。
// 回傳 { budgets: [{ mealType, amount }], date } — 僅 isActive=true
export async function GET(_req: NextRequest) {
  try {
    const user = await prisma.user.findFirst({ where: { lineUserId: DASHBOARD_USER_ID } });
    if (!user) {
      return NextResponse.json({ budgets: [], date: taipeiToday() });
    }

    const todayStart = taipeiTodayAsUTC();
    const todayEnd = new Date(todayStart.getTime() + 24 * 3600 * 1000);

    const [budgets, spending] = await Promise.all([
      prisma.mealBudget.findMany({
        where: { userId: user.id, isActive: true },
        orderBy: { mealType: "asc" },
      }),
      prisma.transaction.groupBy({
        by: ["mealType"],
        where: {
          userId: user.id,
          type: "支出",
          mealType: { in: ["breakfast", "lunch", "dinner"] },
          date: { gte: todayStart, lt: todayEnd },
        },
        _sum: { amount: true },
      }),
    ]);

    const spentMap: Record<string, number> = {};
    for (const s of spending) {
      if (s.mealType) spentMap[s.mealType] = Number(s._sum.amount ?? 0);
    }

    return NextResponse.json({
      budgets: budgets.map(b => ({
        mealType: b.mealType,
        amount: Number(b.amount),
        spentToday: spentMap[b.mealType] ?? 0,
      })),
      date: taipeiToday(),
    });
  } catch (e) {
    console.error("[meal-budgets/today]", e);
    return NextResponse.json({ error: "操作失敗" }, { status: 500 });
  }
}
```

- [ ] **Step 5.2: 手動驗證（啟動 dev server）**

```bash
npm run dev
# 另開 terminal
curl -H "x-api-key: $INTERNAL_API_KEY" http://localhost:3000/api/meal-budgets/today
```

預期：`{"budgets":[],"date":"2026-04-11"}`（還沒建任何 meal budget）

- [ ] **Step 5.3: Commit**

```bash
git add src/app/api/meal-budgets/today/
git commit -m "feat(api): add meal-budgets/today endpoint for kogao morning report"
```

---

## Task 6: `buildRecordedMessage` 擴充 mealBudgetStatus

**Files:**
- Modify: `D:\code\line-accounting\src\lib\line-messages.ts:30-126`

- [ ] **Step 6.1: 擴充簽名與 Flex 輸出**

Modify `buildRecordedMessage`：

```ts
// ── 記帳確認卡片 ──────────────────────────────────────────────────────────────
export function buildRecordedMessage(p: {
  type: "收入" | "支出";
  amount: number;
  category: string;
  note: string;
  date: Date;
  mealBudgetStatus?: {
    label: string;        // 例 "今日早餐"
    spent: number;
    budget: number;
    isOver: boolean;
  };
}): Record<string, unknown> {
  const isIncome  = p.type === "收入";
  const typeColor = isIncome ? GRN : RED;
  const typeEmoji = isIncome ? "💰" : "💸";
  const dateStr   = p.date.toLocaleDateString("zh-TW", { month: "numeric", day: "numeric", weekday: "short" });

  const bodyContents: unknown[] = [
    // 類型標籤
    {
      type: "box",
      layout: "horizontal",
      contents: [{
        type: "box",
        layout: "vertical",
        backgroundColor: typeColor + "22",
        cornerRadius: "20px",
        paddingAll: "5px",
        paddingStart: "12px",
        paddingEnd: "12px",
        contents: [{
          type: "text",
          text: `${typeEmoji} ${p.type}`,
          color: typeColor,
          size: "xs",
          weight: "bold",
        }],
      }],
    },
    // 金額
    {
      type: "text",
      text: `NT$ ${fmt(p.amount)}`,
      size: "3xl",
      weight: "bold",
      color: TEXT,
      margin: "lg",
    },
    { type: "separator", margin: "lg", color: BORD },
    // 分類 + 備註
    {
      type: "box",
      layout: "horizontal",
      margin: "lg",
      spacing: "sm",
      alignItems: "center",
      contents: [
        {
          type: "box",
          layout: "vertical",
          backgroundColor: BLUE + "33",
          cornerRadius: "20px",
          paddingAll: "4px",
          paddingStart: "10px",
          paddingEnd: "10px",
          contents: [{
            type: "text",
            text: p.category,
            color: BLUE,
            size: "xs",
            weight: "bold",
          }],
        },
        ...(p.note ? [{
          type: "text",
          text: p.note,
          color: MUTE,
          size: "sm",
          flex: 1,
          wrap: true,
        }] : []),
      ],
    },
    // 日期
    { type: "text", text: dateStr, color: MUTE, size: "xs", margin: "md" },
  ];

  // 三餐預算進度（若有）
  if (p.mealBudgetStatus) {
    const { label, spent, budget, isOver } = p.mealBudgetStatus;
    const remain = Math.max(0, budget - spent);
    const statusText = isOver
      ? `🍳 ${label} ${fmt(spent)}/${fmt(budget)} ⚠️ 已超 ${fmt(spent - budget)}`
      : `🍳 ${label} ${fmt(spent)}/${fmt(budget)}（剩 ${fmt(remain)}）`;

    bodyContents.push({ type: "separator", margin: "md", color: BORD });
    bodyContents.push({
      type: "text",
      text: statusText,
      color: isOver ? RED : MUTE,
      size: "sm",
      weight: isOver ? "bold" : "regular",
      margin: "md",
      wrap: true,
    });
  }

  return {
    type: "flex",
    altText: `${typeEmoji} 已記錄${p.type} NT$ ${fmt(p.amount)}`,
    contents: {
      type: "bubble",
      size: "kilo",
      body: {
        type: "box",
        layout: "vertical",
        backgroundColor: BG,
        paddingAll: "20px",
        contents: bodyContents,
      },
    },
    quickReply: QUICK_REPLY,
  };
}
```

- [ ] **Step 6.2: TypeScript 檢查**

```bash
cd /d/code/line-accounting
npx tsc --noEmit
```

預期：無 error。

- [ ] **Step 6.3: Commit**

```bash
git add src/lib/line-messages.ts
git commit -m "feat(line): add mealBudgetStatus to recorded message card"
```

---

## Task 7: Webhook 整合 mealType + 進度顯示

**Files:**
- Modify: `D:\code\line-accounting\src\app\api\webhook\route.ts:107-208`

- [ ] **Step 7.1: 讀目前 handleTextMessage 完整實作**

參考 spec 中已列的檔案行號範圍（107-208），理解現有 flow。

- [ ] **Step 7.2: 新增 imports 與 helper**

在檔案頂端 imports 加：

```ts
import { inferMealTypeByTime, isFoodCategory, type MealType } from "@/lib/meal-type";
import { taipeiToday, taipeiTodayAsUTC } from "@/lib/time";
```

（`taipeiToday` 已 import，確認即可；新增 `taipeiTodayAsUTC` 與 meal-type imports）

在檔案下方（`handleTextMessage` 之前）加 helper：

```ts
const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "今日早餐",
  lunch:     "今日午餐",
  dinner:    "今日晚餐",
};

async function buildMealBudgetStatus(
  userId: string,
  mealType: MealType,
): Promise<{ label: string; spent: number; budget: number; isOver: boolean } | undefined> {
  const mb = await prisma.mealBudget.findUnique({
    where: { userId_mealType: { userId, mealType } },
  });
  if (!mb || !mb.isActive) return undefined;

  const start = taipeiTodayAsUTC();
  const end = new Date(start.getTime() + 24 * 3600 * 1000);

  const agg = await prisma.transaction.aggregate({
    where: {
      userId,
      type: "支出",
      mealType,
      date: { gte: start, lt: end },
    },
    _sum: { amount: true },
  });

  const spent = Number(agg._sum.amount ?? 0);
  const budget = Number(mb.amount);
  return {
    label: MEAL_LABELS[mealType],
    spent,
    budget,
    isOver: spent > budget,
  };
}
```

- [ ] **Step 7.3: 在 `handleTextMessage` 解析後決定 mealType**

修改 `handleTextMessage`（原第 107-208 行）。關鍵變動：
1. 在 `parsed` 取得後、存 Transaction 前，決定最終 `mealType`
2. 將 `mealType` 寫入 `Transaction.create` / `upsert`
3. 存完後若有 mealType 則組 `mealBudgetStatus` 傳給 `buildRecordedMessage`

變動程式片段（替換原本存 transaction + reply 那段）：

```ts
  // 決定 mealType：parser 抽到的優先，否則若是飲食類 fallback 到時間
  let finalMealType: MealType | null = parsed.mealType ?? null;
  if (!finalMealType && parsed.type === "支出" && isFoodCategory(parsed.category)) {
    finalMealType = inferMealTypeByTime(new Date());
  }

  // 儲存交易（使用 AI 解析的日期，未指定則用台灣今天）
  const txDateStr = parsed.date ?? taipeiToday();
  const txDate = new Date(`${txDateStr}T00:00:00Z`);

  // 用 create + 重複時 upsert fallback，避免同天同金額互蓋
  let transaction;
  try {
    transaction = await prisma.transaction.create({
      data: {
        userId: dashUser.id,
        date: txDate,
        amount: parsed.amount,
        category: parsed.category,
        type: parsed.type,
        note: parsed.note,
        source: "line",
        mealType: finalMealType ?? null,
      },
    });
  } catch {
    // unique 衝突（同天同金額）→ upsert 更新備註與分類
    transaction = await prisma.transaction.upsert({
      where: {
        userId_date_amount_source: {
          userId: dashUser.id,
          date: txDate,
          amount: parsed.amount,
          source: "line",
        },
      },
      update: {
        category: parsed.category,
        type: parsed.type,
        note: parsed.note,
        mealType: finalMealType ?? null,
      },
      create: {
        userId: dashUser.id,
        date: txDate,
        amount: parsed.amount,
        category: parsed.category,
        type: parsed.type,
        note: parsed.note,
        source: "line",
        mealType: finalMealType ?? null,
      },
    });
  }

  // 組 meal budget 進度
  const mealBudgetStatus = finalMealType
    ? await buildMealBudgetStatus(dashUser.id, finalMealType)
    : undefined;

  // 回覆 Flex Message
  await replyRawMessage(replyToken, [buildRecordedMessage({
    type:     parsed.type,
    amount:   parsed.amount,
    category: parsed.category,
    note:     parsed.note,
    date:     txDate,
    mealBudgetStatus,
  })]);
}
```

- [ ] **Step 7.4: Type check**

```bash
npx tsc --noEmit
```

預期：無 error。若有 `finalMealType ?? null` 的 type issue，確認 Transaction.mealType 是 `String?` 對應 TypeScript `string | null`。

- [ ] **Step 7.5: 手動煙霧測試**

1. 啟動 dev server（`npm run dev`）
2. 在 Prisma Studio（`npx prisma studio`）對 `MealBudget` 表手動插入：
   - `userId = <dashboard_user 的 id>, mealType = "breakfast", amount = 100, isActive = true`
3. 從 LINE Bot 傳：「早餐 麥當勞 80」
4. 預期 LINE 回 Flex 卡片最底附「🍳 今日早餐 80/100（剩 20）」（灰色）
5. 再傳「早餐 大杯咖啡 50」
6. 預期 LINE 回「🍳 今日早餐 130/100 ⚠️ 已超 30」（紅字粗體）

如本機 LINE 無法測，可用 ngrok 或直接跳過 LINE 驗證改打 webhook endpoint 模擬。

- [ ] **Step 7.6: Commit**

```bash
git add src/app/api/webhook/route.ts
git commit -m "feat(webhook): record mealType and show meal budget status in recorded card"
```

---

## Task 8: MealBudgetManager UI 元件

**Files:**
- Create: `D:\code\line-accounting\src\components\MealBudgetManager.tsx`

- [ ] **Step 8.1: 建立元件**

Create `src/components/MealBudgetManager.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";

type MealType = "breakfast" | "lunch" | "dinner";

interface MealBudgetItem {
  id:         string;
  mealType:   MealType;
  amount:     number;
  isActive:   boolean;
  spentToday: number;
}

const MEAL_META: Record<MealType, { icon: string; label: string }> = {
  breakfast: { icon: "🌅", label: "早餐" },
  lunch:     { icon: "☀️", label: "午餐" },
  dinner:    { icon: "🌙", label: "晚餐" },
};

const MEAL_ORDER: MealType[] = ["breakfast", "lunch", "dinner"];

function fmt(n: number): string {
  return Math.abs(n).toLocaleString("zh-TW", { maximumFractionDigits: 0 });
}

function statusOf(spent: number, amount: number): "over" | "near" | "ok" | "none" {
  if (amount <= 0) return "none";
  const r = spent / amount;
  if (r > 1)    return "over";
  if (r >= 0.8) return "near";
  return "ok";
}

const STATUS_COLOR = {
  over: "#EF4444",
  near: "#F59E0B",
  ok:   "#10B981",
  none: "#94A3B8",
};

export default function MealBudgetManager() {
  const [items, setItems] = useState<Record<MealType, MealBudgetItem | null>>({
    breakfast: null, lunch: null, dinner: null,
  });
  const [editing, setEditing] = useState<MealType | null>(null);
  const [draft, setDraft] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/meal-budgets");
      if (!res.ok) return;
      const data = await res.json() as { budgets: MealBudgetItem[] };
      const map: Record<MealType, MealBudgetItem | null> = {
        breakfast: null, lunch: null, dinner: null,
      };
      for (const b of data.budgets) {
        if (MEAL_ORDER.includes(b.mealType)) map[b.mealType] = b;
      }
      setItems(map);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  async function handleSave(mealType: MealType) {
    const amount = Number(draft);
    if (!isFinite(amount) || amount < 0) return;
    setSaving(true);
    try {
      await fetch("/api/meal-budgets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mealType, amount }),
      });
      setEditing(null);
      setDraft("");
      await reload();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(mealType: MealType) {
    if (!confirm(`確定刪除${MEAL_META[mealType].label}預算？`)) return;
    await fetch(`/api/meal-budgets?mealType=${mealType}`, { method: "DELETE" });
    await reload();
  }

  if (loading) return <div className="text-sm text-[var(--text-muted)]">載入中…</div>;

  return (
    <div className="rounded-lg border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-bold">🍽️ 三餐日預算</h3>
        <span className="text-xs text-[var(--text-muted)]">每日歸零重算</span>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {MEAL_ORDER.map(mealType => {
          const item   = items[mealType];
          const meta   = MEAL_META[mealType];
          const amount = item?.amount ?? 0;
          const spent  = item?.spentToday ?? 0;
          const status = statusOf(spent, amount);
          const color  = STATUS_COLOR[status];
          const pct    = amount > 0 ? Math.min(100, Math.round((spent / amount) * 100)) : 0;
          const isEdit = editing === mealType;

          return (
            <div key={mealType} className="rounded-md border p-3" style={{ borderColor: "var(--border-inner)" }}>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold">
                  {meta.icon} {meta.label}
                </div>
                {item && !isEdit && (
                  <button
                    className="text-xs text-[var(--text-muted)] hover:underline"
                    onClick={() => handleDelete(mealType)}
                  >刪除</button>
                )}
              </div>

              {isEdit ? (
                <div className="space-y-2">
                  <input
                    type="number"
                    min="0"
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    className="w-full rounded border px-2 py-1 text-sm"
                    style={{ borderColor: "var(--border-inner)" }}
                    placeholder="日預算金額"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      disabled={saving}
                      onClick={() => handleSave(mealType)}
                      className="flex-1 rounded bg-blue-500 px-2 py-1 text-xs text-white disabled:opacity-50"
                    >{saving ? "儲存中…" : "儲存"}</button>
                    <button
                      onClick={() => { setEditing(null); setDraft(""); }}
                      className="flex-1 rounded border px-2 py-1 text-xs"
                      style={{ borderColor: "var(--border-inner)" }}
                    >取消</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-xl font-bold">
                    {item ? `NT$ ${fmt(amount)}` : "—"}
                  </div>
                  {item && (
                    <>
                      <div className="mt-1 text-xs" style={{ color }}>
                        已花 NT$ {fmt(spent)} / 剩 NT$ {fmt(Math.max(0, amount - spent))}
                      </div>
                      <div className="mt-2 h-1.5 w-full rounded-full" style={{ background: "var(--border-inner)" }}>
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, background: color }}
                        />
                      </div>
                    </>
                  )}
                  <button
                    className="mt-3 w-full rounded border px-2 py-1 text-xs"
                    style={{ borderColor: "var(--border-inner)" }}
                    onClick={() => {
                      setEditing(mealType);
                      setDraft(item ? String(item.amount) : "");
                    }}
                  >{item ? "編輯" : "設定預算"}</button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 8.2: Type check**

```bash
npx tsc --noEmit
```

預期：無 error。

- [ ] **Step 8.3: Commit**

```bash
git add src/components/MealBudgetManager.tsx
git commit -m "feat(ui): add MealBudgetManager component"
```

---

## Task 9: 掛上 Dashboard

**Files:**
- Modify: `D:\code\line-accounting\src\app\dashboard\page.tsx`

- [ ] **Step 9.1: 找到預算 Tab 區段**

先 grep 定位 BudgetManager 使用處：

```bash
grep -n "BudgetManager" src/app/dashboard/page.tsx
```

- [ ] **Step 9.2: import MealBudgetManager 並加到預算 Tab 上方**

在 `page.tsx` 的 `import` 區段加：

```ts
import MealBudgetManager from "@/components/MealBudgetManager";
```

在預算 Tab 的 JSX（BudgetManager 元件出現處）**前**插入：

```tsx
<div className="mb-4">
  <MealBudgetManager />
</div>
```

> 若 BudgetManager 被包在 tab content 條件判斷中，確保 MealBudgetManager 也在同一條件內、放在最上方。

- [ ] **Step 9.3: 本機煙霧測試**

```bash
npm run dev
```

1. 瀏覽 `http://localhost:3000/dashboard`
2. 登入後進「預算」Tab
3. 預期看到「🍽️ 三餐日預算」區塊 + 三張卡片
4. 點一張卡「設定預算」→ 輸 100 → 儲存 → 卡片顯示 NT$ 100
5. 重整頁面數字仍在

- [ ] **Step 9.4: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat(dashboard): mount MealBudgetManager in budget tab"
```

---

## Task 10: kogao — accounting client 擴充

**Files:**
- Modify: `D:\code\kogao\src\lib\accounting.ts`

- [ ] **Step 10.1: 加 `getMealBudgetsToday` client**

在 `D:\code\kogao\src\lib\accounting.ts` 底部（跟其他 getXxx 同風格）加：

```ts
// ── 三餐日預算 ──────────────────────────────────────────────────────────────

export interface MealBudgetTodayItem {
  mealType:   "breakfast" | "lunch" | "dinner";
  amount:     number;
  spentToday: number;
}

export async function getMealBudgetsToday(): Promise<MealBudgetTodayItem[]> {
  try {
    const res = await fetch(`${BASE}/api/meal-budgets/today`, { headers: headers() });
    if (!res.ok) return [];
    const data = await res.json() as { budgets?: MealBudgetTodayItem[] };
    return data.budgets ?? [];
  } catch {
    return [];
  }
}
```

- [ ] **Step 10.2: Type check**

```bash
cd /d/code/kogao
npx tsc --noEmit
```

預期：無 error。

- [ ] **Step 10.3: Commit**

```bash
git add src/lib/accounting.ts
git commit -m "feat(accounting): add getMealBudgetsToday client"
```

---

## Task 11: kogao — morning-report 整合三餐預算提醒

**Files:**
- Modify: `D:\code\kogao\src\lib\flex.ts:186` (`morningFlex`)
- Modify: `D:\code\kogao\src\app\api\cron\morning-report\route.ts`

- [ ] **Step 11.1: 擴充 morningFlex params interface**

在 `src/lib/flex.ts` 第 186 行附近找到 `morningFlex` 定義。將 params 改為：

```ts
export function morningFlex(params: {
  yesterdayExpense: number;
  monthExpense:     number;
  top3:             [string, number][];
  streak?:          number;
  mealBudgets?: Array<{
    mealType:   "breakfast" | "lunch" | "dinner";
    amount:     number;
    spentToday: number;
  }>;
}): FlexMsg {
```

- [ ] **Step 11.2: 在 `rows` 陣列尾端加三餐預算區塊**

`morningFlex` 內用 `const rows: line.messagingApi.FlexComponent[] = [...]` 組 body。在 `return { ... }` 之前（Top 3 區塊之後）加入：

```ts
  const MEAL_LABEL: Record<string, string> = { breakfast: "早餐", lunch: "午餐", dinner: "晚餐" };
  if (params.mealBudgets && params.mealBudgets.length > 0) {
    rows.push({ type: "separator", margin: "lg", color: "#eeeeee" });
    rows.push({
      type: "text",
      text: "🍽️ 今日三餐預算",
      size: "sm",
      weight: "bold",
      color: "#333333",
      margin: "lg",
    });
    const line = params.mealBudgets
      .map(b => `${MEAL_LABEL[b.mealType] ?? b.mealType} $${b.amount.toLocaleString("zh-TW")}`)
      .join("｜");
    rows.push({
      type: "text",
      text: line,
      size: "xs",
      wrap: true,
      color: "#666666",
      margin: "sm",
    });
    rows.push({
      type: "text",
      text: "記得不要超過喔～",
      size: "xs",
      color: "#999999",
      margin: "xs",
    });
  }
```

> **注意**（依 `feedback_line_flex_empty_text.md`）：`line` 變數絕不能是空字串。因為外層 `if (mealBudgets.length > 0)` 已檢查，至少有一筆時 `line` 必非空，安全。

- [ ] **Step 11.3: 型別檢查 flex.ts**

```bash
cd /d/code/kogao
npx tsc --noEmit
```

預期：無 error。

- [ ] **Step 11.4: 修改 morning-report cron route**

在 `D:\code\kogao\src\app\api\cron\morning-report\route.ts`：

1. imports 加：

```ts
import { getMorningData, getTodayTasks, getStreak, getMealBudgetsToday } from "@/lib/accounting";
```

2. 修改 Promise.all：

```ts
  const [data, tasks, streakData, mealBudgets] = await Promise.all([
    getMorningData(),
    getTodayTasks(),
    getStreak(),
    getMealBudgetsToday(),
  ]);
```

3. 修改 `morningFlex` 呼叫傳入 mealBudgets：

```ts
  const messages: line.messagingApi.Message[] = [
    morningFlex({ ...data, streak: streakData.currentStreak, mealBudgets }),
  ];
```

- [ ] **Step 11.5: 本機測試**

```bash
cd /d/code/kogao
npm run dev
```

```bash
# 另開 terminal
curl -X POST http://localhost:3001/api/cron/morning-report \
  -H "Authorization: Bearer $CRON_SECRET"
```

預期：
- 若 line-accounting 沒設 meal budget → 早報 Flex 不顯示三餐區塊（跟以前一樣）
- 若有設 → 早報底部出現「🍽️ 今日三餐預算 早餐 $100｜午餐 $200｜晚餐 $250 記得不要超過喔～」

- [ ] **Step 11.6: Commit**

```bash
git add src/lib/flex.ts src/app/api/cron/morning-report/route.ts
git commit -m "feat(cron): include meal budget reminder in morning report"
```

---

## Task 12: 部署到 Zeabur

**Files:**
- 無檔案變動，只跑部署指令。

- [ ] **Step 12.1: line-accounting 部署**

```bash
cd /d/code/line-accounting
# 確認 migration 有進 git
git status
# 推到 remote
git push
# 觸發 Zeabur redeploy（會自動跑 prisma migrate deploy）
npx zeabur@latest deploy --project-id 69d2656c18daef21c603e19c --service-id 69d265b318daef21c603e1c2 --json
```

驗證：部署完成後打 `https://accoung.zeabur.app/api/health` 應回 200。

手動測試：`curl https://accoung.zeabur.app/api/meal-budgets/today -H "x-api-key: $INTERNAL_API_KEY"` → 回 `{"budgets":[],"date":"..."}`

- [ ] **Step 12.2: kogao 部署**

```bash
cd /d/code/kogao
git push
npx zeabur@latest deploy --project-id 69d2656c18daef21c603e19c --service-id 69d2866393577fe0061d9e06 --json
```

- [ ] **Step 12.3: 線上端到端驗證**

1. 上 `https://accoung.zeabur.app/dashboard` → 預算 Tab → 設定早餐 100 / 午餐 200 / 晚餐 250
2. LINE 傳「早餐 80」→ 預期回卡附「🍳 今日早餐 80/100（剩 20）」
3. LINE 傳「早餐 大杯咖啡 50」→ 預期回卡附「🍳 今日早餐 130/100 ⚠️ 已超 30」紅字
4. 手動觸發早報：
   ```bash
   curl -X POST https://kogao.zeabur.app/api/cron/morning-report \
     -H "Authorization: Bearer $CRON_SECRET"
   ```
   預期 LINE 收到含三餐預算的早報

---

## 驗收條件對照

| Spec 驗收條件 | 對應 Task |
|--------------|----------|
| Dashboard 設定早/午/晚日預算 | Task 8, 9 |
| parser 抽 mealType | Task 3 |
| 時間 fallback | Task 2, 7 |
| Flex 顯示「今日早餐 150/100 ⚠️ 已超 50」 | Task 6, 7 |
| 未設定時記帳行為照舊 | Task 7（`mealBudgetStatus` undefined 時不加區塊） |
| 早報顯示三餐預算 | Task 10, 11 |
| 所有測試通過 | Task 2.4, 4.4 |
| Zeabur 部署成功 | Task 12 |

## 已知風險再確認

1. **Haiku mealType 不穩定** → 已用時間 fallback + 白名單過濾兜底
2. **時區** → 所有日期範圍用 `taipeiTodayAsUTC()`（Task 4/5/7/meal-type 都遵守）
3. **Prisma migration** → Task 1.4 走 `migrate dev` 產 SQL 檔 + Task 12.1 靠 `migrate deploy`
4. **Flex 空字串** → Task 11.2 加註記，不可推入空字串 text
5. **middleware**：line-accounting middleware 已支援 `x-api-key`（第 16-19 行），新 endpoint 不需改 middleware

## 實作順序建議

按 Task 編號順序執行，Task 1–9 在 line-accounting repo 做完後再進 Task 10–11 的 kogao repo。Task 12 最後。
