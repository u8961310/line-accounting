import crypto from "crypto";
import { describe, it, expect, beforeEach } from "vitest";
import { verifySignature } from "./line";

const SECRET = "test-channel-secret-for-unit-tests";

function makeSignature(body: string, secret = SECRET): string {
  return crypto.createHmac("sha256", secret).update(body).digest("base64");
}

describe("verifySignature", () => {
  beforeEach(() => {
    process.env.LINE_CHANNEL_SECRET = SECRET;
  });

  it("valid signature passes", () => {
    const body = '{"events":[]}';
    expect(verifySignature(body, makeSignature(body))).toBe(true);
  });

  it("invalid signature string fails", () => {
    const body = '{"events":[]}';
    expect(verifySignature(body, "not-a-valid-signature")).toBe(false);
  });

  it("tampered body fails", () => {
    const body = '{"events":[]}';
    const sig = makeSignature(body);
    expect(verifySignature('{"events":[],"injected":true}', sig)).toBe(false);
  });

  it("signature from wrong secret fails", () => {
    const body = '{"events":[]}';
    const sig = makeSignature(body, "wrong-secret");
    expect(verifySignature(body, sig)).toBe(false);
  });

  it("empty body with matching signature passes", () => {
    const body = "";
    expect(verifySignature(body, makeSignature(body))).toBe(true);
  });
});
