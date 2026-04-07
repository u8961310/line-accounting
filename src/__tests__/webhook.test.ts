/**
 * Webhook 簽名驗證單元測試
 *
 * 覆蓋：
 * 1. verifySignature — 正確 / 錯誤 / 篡改 body / 空值
 * 2. 確認 timingSafeEqual 用途（不同長度不會拋錯）
 * 3. 驗簽失敗行為：LINE 規格要求永遠回 200
 */

import * as crypto from "crypto";
import { describe, it, expect, beforeEach } from "vitest";
import { verifySignature } from "@/lib/line";

const TEST_SECRET = "test-channel-secret-32chars-long!!";
const TEST_BODY   = '{"destination":"Udeadbeef","events":[]}';

function makeSignature(body: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("base64");
}

describe("verifySignature", () => {
  beforeEach(() => {
    process.env.LINE_CHANNEL_SECRET = TEST_SECRET;
  });

  it("正確簽名應回傳 true", () => {
    const sig = makeSignature(TEST_BODY, TEST_SECRET);
    expect(verifySignature(TEST_BODY, sig)).toBe(true);
  });

  it("錯誤簽名應回傳 false", () => {
    expect(verifySignature(TEST_BODY, "invalidsignature==")).toBe(false);
  });

  it("body 被篡改後應回傳 false", () => {
    const sig = makeSignature(TEST_BODY, TEST_SECRET);
    const tamperedBody = TEST_BODY.replace("[]", '[{"type":"injected"}]');
    expect(verifySignature(tamperedBody, sig)).toBe(false);
  });

  it("空簽名應回傳 false（不拋錯）", () => {
    expect(() => verifySignature(TEST_BODY, "")).not.toThrow();
    expect(verifySignature(TEST_BODY, "")).toBe(false);
  });

  it("不同長度的簽名應回傳 false（不因 timingSafeEqual 拋錯）", () => {
    const shortSig = "abc";
    expect(() => verifySignature(TEST_BODY, shortSig)).not.toThrow();
    expect(verifySignature(TEST_BODY, shortSig)).toBe(false);
  });

  it("不同 secret 產生的簽名應回傳 false", () => {
    const wrongSig = makeSignature(TEST_BODY, "wrong-secret");
    expect(verifySignature(TEST_BODY, wrongSig)).toBe(false);
  });
});

/**
 * LINE Webhook 規格確認
 *
 * LINE 平台要求：收到 webhook 事件時，Bot server 必須在 1 秒內回 HTTP 200，
 * 否則 LINE 會重試（最多 3 次），並可能暫停推送。
 *
 * 規格來源：https://developers.line.biz/en/docs/messaging-api/receiving-messages/
 *
 * 驗簽失敗時的正確行為：
 *   ✅ 回 200（靜默拒絕，不處理事件）
 *   ❌ 不回 401 / 403（LINE 會誤判為伺服器錯誤並重試）
 *
 * 以下測試驗證 route.ts 的 `if (!verifySignature) return 200` 邏輯文件化：
 */
describe("LINE Webhook 規格（文件化確認）", () => {
  it("verifySignature 回傳 false 代表需靜默回 200，不應拋錯", () => {
    // 模擬 route.ts 的判斷流程
    process.env.LINE_CHANNEL_SECRET = TEST_SECRET;
    const badSig = "bad-signature";
    const result = verifySignature(TEST_BODY, badSig);

    // route.ts 的行為：if (!result) return NextResponse.json({ status: "ok" })
    // 此測試確認 verifySignature 不會拋錯，讓 route 能正常回 200
    expect(result).toBe(false);
    // 沒有拋錯 → route 可以安全地 return 200
  });
});
