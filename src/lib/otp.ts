import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { getApprovedProviderUrl } from "@/lib/internal-provider-url";

function authSecret(): string {
  const secret = process.env.AUTH_OTP_SECRET?.trim();
  if (
    secret &&
    secret.length >= 32 &&
    !(
      process.env.NODE_ENV === "production" &&
      secret.toLowerCase().includes("replace-with")
    )
  )
    return secret;
  if (process.env.NODE_ENV !== "production")
    return "local-development-only-otp-secret-not-for-production";
  throw new Error("AUTH_OTP_SECRET is not configured");
}

export function normalizeIranianMobile(value: string): string | null {
  const digits = value
    .replace(/[۰-۹]/gu, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/gu, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[\s()-]/gu, "");
  const canonical = digits.startsWith("+")
    ? digits.slice(1)
    : digits.startsWith("00")
      ? digits.slice(2)
      : digits;
  const rawNational = canonical.startsWith("98")
    ? canonical.slice(2)
    : canonical;
  const national = rawNational.startsWith("9") && rawNational.length === 10
    ? `0${rawNational}`
    : rawNational;
  if (!/^09\d{9}$/.test(national)) return null;
  return `+98${national.slice(1)}`;
}

export function generateOtp(): string {
  return String(randomInt(100_000, 1_000_000));
}

export function hashOtp(mobile: string, purpose: string, code: string): string {
  return createHmac("sha256", authSecret())
    .update(`${mobile}:${purpose}:${code}`)
    .digest("hex");
}

export function hashRequestIp(value: string): string {
  return createHmac("sha256", authSecret()).update(value).digest("hex");
}

export function otpMatches(
  expectedHash: string,
  mobile: string,
  purpose: string,
  code: string,
): boolean {
  const expected = Buffer.from(expectedHash, "hex");
  const candidate = Buffer.from(hashOtp(mobile, purpose, code), "hex");
  return expected.length === candidate.length && timingSafeEqual(expected, candidate);
}

export async function sendOtp(mobile: string, code: string): Promise<boolean> {
  const configuredUrl = process.env.SMS_PROVIDER_URL?.trim();
  const debugEnabled =
    process.env.NODE_ENV !== "production" &&
    process.env.AUTH_OTP_DEBUG === "true";
  if (!configuredUrl) return debugEnabled;

  const endpoint = getApprovedProviderUrl(configuredUrl);
  const apiKey = process.env.SMS_PROVIDER_API_KEY?.trim();
  if (!endpoint || !apiKey) return false;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      redirect: "error",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: mobile,
        message: `کد ورود جوانه: ${code}`,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const accepted = response.ok;
    await response.body?.cancel();
    return accepted;
  } catch {
    return false;
  }
}
