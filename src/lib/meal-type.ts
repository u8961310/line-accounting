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

  if (total >= 4 * 60 && total < 10 * 60 + 30) return "breakfast";
  if (total >= 10 * 60 + 30 && total < 15 * 60) return "lunch";
  if (total >= 15 * 60 && total < 22 * 60) return "dinner";
  return null;
}

/**
 * 判斷 category 是否屬於飲食相關，用於決定是否要 fallback 到時間推斷。
 */
export function isFoodCategory(category: string): boolean {
  if (!category) return false;
  const lower = category.toLowerCase();
  return FOOD_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}

/**
 * 將外部輸入（例如 LLM 產出的 JSON 欄位）白名單過濾成合法 MealType。
 */
export function normalizeMealType(raw: unknown): MealType | undefined {
  if (raw === "breakfast" || raw === "lunch" || raw === "dinner") return raw;
  return undefined;
}
