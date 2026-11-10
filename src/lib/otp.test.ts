import { afterEach, describe, expect, it, vi } from "vitest";
import {
  hashOtp,
  normalizeIranianMobile,
  otpMatches,
} from "./otp";

afterEach(() => vi.unstubAllEnvs());

describe("OTP helpers", () => {
  it("normalizes Iranian mobile numbers written with Persian digits or country prefixes", () => {
    expect(normalizeIranianMobile("۰۹۱۲۱۲۳۴۵۶۷")).toBe("+989121234567");
    expect(normalizeIranianMobile("+989121234567")).toBe("+989121234567");
    expect(normalizeIranianMobile("00989121234567")).toBe("+989121234567");
    expect(normalizeIranianMobile("02112345678")).toBeNull();
  });

  it("uses a keyed digest and compares OTPs without revealing the code", () => {
    vi.stubEnv("AUTH_OTP_SECRET", "test-secret-with-more-than-thirty-two-characters");
    const digest = hashOtp("+989121234567", "login", "123456");
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(digest).not.toContain("123456");
    expect(otpMatches(digest, "+989121234567", "login", "123456")).toBe(true);
    expect(otpMatches(digest, "+989121234567", "signup", "123456")).toBe(false);
    expect(otpMatches(digest, "+989121234567", "login", "000000")).toBe(false);
  });
});
