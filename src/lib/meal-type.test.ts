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
