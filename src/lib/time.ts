/**
 * 時區輔助工具
 *
 * Zeabur 容器預設 UTC，但業務日期一律以台灣時間為準。
 * 直接用 toISOString() 會踩到每天 00:00~07:59 的日期偏移 bug，
 * 所有「今天／昨天／本月／本週」的日期計算都要透過本檔的工具。
 *
 * 注意：Prisma 儲存的 Date 欄位是「UTC 午夜」語意的 Date（從 "YYYY-MM-DD" 解析而來），
 * 這類 Date 的 toISOString().split("T")[0] 是正確的，不需要透過本檔轉換。
 * 本檔的工具只用在「從 server now 取得台灣日期」的情境。
 */

const TZ = "Asia/Taipei";

/** 把 Date 格式化成台灣時區的 YYYY-MM-DD */
export function toTaipeiDate(d: Date = new Date()): string {
  return d.toLocaleDateString("sv-SE", { timeZone: TZ });
}

/** 取得今天（台灣時間）的 YYYY-MM-DD */
export function taipeiToday(): string {
  return toTaipeiDate();
}

/** 取得昨天（台灣時間）的 YYYY-MM-DD */
export function taipeiYesterday(): string {
  return toTaipeiDate(new Date(Date.now() - 24 * 3600 * 1000));
}

/** 取得台灣時間的月份字串 YYYY-MM */
export function taipeiMonth(): string {
  return taipeiToday().slice(0, 7);
}

/**
 * 取得「以台灣時間為基準的 UTC 午夜 Date」
 * 用在需要做日期算術的情境（setUTCDate、getUTCMonth 等）
 */
export function taipeiTodayAsUTC(): Date {
  return new Date(`${taipeiToday()}T00:00:00Z`);
}
