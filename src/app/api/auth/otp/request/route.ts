import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { hasSameOrigin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  generateOtp,
  hashOtp,
  hashRequestIp,
  normalizeIranianMobile,
  sendOtp,
} from "@/lib/otp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  mobile: z.string().min(8).max(24),
  purpose: z.enum(["signup", "login"]),
}).strict();

const WINDOW_MS = 15 * 60 * 1000;
const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_DELAY_MS = 60 * 1000;
const MAX_MOBILE_REQUESTS = 5;
const MAX_IP_REQUESTS = 20;

function failure(code: string, error: string, status: number, retryAfter?: number) {
  const response = NextResponse.json({ code, error }, { status });
  if (retryAfter) response.headers.set("Retry-After", String(retryAfter));
  return response;
}

function requestIp(request: Request): string {
  return (
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export async function POST(request: Request) {
  const limited = await enforceApiRateLimit(request);
  if (limited) return limited;
  if (!hasSameOrigin(request))
    return failure("invalid_origin", "درخواست قابل تأیید نیست.", 403);

  let input: z.infer<typeof requestSchema>;
  try {
    input = requestSchema.parse(await request.json());
  } catch {
    return failure("invalid_request", "شمارهٔ همراه را بررسی کنید.", 400);
  }
  const mobile = normalizeIranianMobile(input.mobile);
  if (!mobile)
    return failure("invalid_mobile", "شمارهٔ همراه معتبر نیست.", 400);

  let ipHash: string;
  let otpHash: string;
  try {
    ipHash = hashRequestIp(`ip:${requestIp(request)}`);

    const now = new Date();
    const windowStart = new Date(now.getTime() - WINDOW_MS);
    const code = generateOtp();
    otpHash = hashOtp(mobile, input.purpose, code);
    const challengeId = randomUUID();
    const reservation = await prisma.$transaction(async (tx) => {
      const [mobileRequests, ipRequests, latest] = await Promise.all([
        tx.otpChallenge.count({
          where: { mobile, purpose: input.purpose, createdAt: { gte: windowStart } },
        }),
        tx.otpChallenge.count({
          where: { requestIpHash: ipHash, createdAt: { gte: windowStart } },
        }),
        tx.otpChallenge.findFirst({
          where: { mobile, purpose: input.purpose },
          orderBy: { createdAt: "desc" },
        }),
      ]);
      if (mobileRequests >= MAX_MOBILE_REQUESTS || ipRequests >= MAX_IP_REQUESTS)
        return { allowed: false as const, type: "rate" as const };
      if (latest) {
        const retryAfter = Math.ceil(
          (latest.createdAt.getTime() + RESEND_DELAY_MS - now.getTime()) / 1000,
        );
        if (retryAfter > 0)
          return { allowed: false as const, type: "resend" as const, retryAfter };
      }

      await tx.otpChallenge.updateMany({
        where: {
          mobile,
          purpose: input.purpose,
          consumedAt: null,
        },
        data: { consumedAt: now },
      });
      await tx.otpChallenge.create({
        data: {
          id: challengeId,
          mobile,
          purpose: input.purpose,
          codeHash: otpHash,
          requestIpHash: ipHash,
          expiresAt: new Date(now.getTime() + OTP_TTL_MS),
        },
      });
      return { allowed: true as const };
    }, { isolationLevel: "Serializable" });

    if (!reservation.allowed) {
      if (reservation.type === "resend")
        return failure(
          "otp_resend_limited",
          "برای ارسال دوبارهٔ کد کمی صبر کنید.",
          429,
          reservation.retryAfter,
        );
      return failure(
        "otp_rate_limited",
        "درخواست کد بیش از حد مجاز است؛ کمی بعد دوباره تلاش کنید.",
        429,
        Math.ceil(WINDOW_MS / 1000),
      );
    }

    if (!(await sendOtp(mobile, code))) {
      await prisma.otpChallenge.updateMany({
        where: { mobile, purpose: input.purpose, codeHash: otpHash, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      return failure(
        "sms_unavailable",
        "ارسال پیامک موقتاً ممکن نیست؛ کمی بعد دوباره تلاش کنید.",
        503,
      );
    }

    const response = NextResponse.json({
      ok: true,
      message: "اگر امکان ارسال وجود داشته باشد، کد تأیید ارسال می‌شود.",
      expiresIn: OTP_TTL_MS / 1000,
      ...(process.env.NODE_ENV !== "production" &&
      process.env.AUTH_OTP_DEBUG === "true" &&
      !process.env.SMS_PROVIDER_URL
        ? { debugCode: code }
        : {}),
    });
    return response;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2034"
    )
      return failure(
        "otp_rate_limited",
        "درخواست کد هم‌زمان انجام شد؛ کمی بعد دوباره تلاش کنید.",
        429,
        Math.ceil(RESEND_DELAY_MS / 1000),
      );
    console.error(
      "[auth] OTP request failed",
      error instanceof Error ? error.name : "unknown",
    );
    return failure(
      "otp_unavailable",
      "درخواست کد موقتاً انجام نشد؛ دوباره تلاش کنید.",
      503,
    );
  }
}
