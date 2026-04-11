import { describe, it, expect, vi } from "vitest";

// mock prisma
vi.mock("@/lib/db", () => {
  const user = { id: "u1", lineUserId: "dashboard_user" };
  const budgets: Record<string, any> = {};

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
