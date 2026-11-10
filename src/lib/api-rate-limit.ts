import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { hashRequestIp } from "@/lib/otp";
import { prisma } from "@/lib/prisma";

const WINDOW_MS = 60 * 1000;
const DEFAULT_MAX_REQUESTS_PER_WINDOW = 120;

export function configuredMaxRequestsPerMinute(): number | null {
  const configured = process.env.API_RATE_LIMIT_PER_MINUTE;
  if (configured === undefined || configured.trim() === "")
    return DEFAULT_MAX_REQUESTS_PER_WINDOW;
  const limit = Number(configured);
  return Number.isSafeInteger(limit) && limit >= 1 && limit <= 100_000
    ? limit
    : null;
}

function clientAddress(request: Request): string {
  return (
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export async function enforceApiRateLimit(request: Request): Promise<NextResponse | null> {
  if (process.env.NODE_ENV !== "production") return null;
  const maxRequests = configuredMaxRequestsPerMinute();
  if (maxRequests === null)
    return NextResponse.json(
      { code: "temporarily_unavailable", error: "سرویس موقتاً در دسترس نیست." },
      { status: 503 },
    );

  const now = new Date();
  const windowStartedAt = new Date(
    Math.floor(now.getTime() / WINDOW_MS) * WINDOW_MS,
  );
  const expiresAt = new Date(windowStartedAt.getTime() + 2 * WINDOW_MS);

  try {
    const clientHash = hashRequestIp(`api:${clientAddress(request)}`);
    const id = createHash("sha256")
      .update(`${clientHash}:${windowStartedAt.toISOString()}`)
      .digest("hex");
    const [bucket] = await prisma.$queryRaw<{ requestCount: number }[]>`
      WITH expired AS (
        DELETE FROM "ApiRateLimitBucket"
        WHERE "expiresAt" <= ${now}
        RETURNING "id"
      )
      INSERT INTO "ApiRateLimitBucket" ("id", "windowStartedAt", "requestCount", "expiresAt")
      VALUES (${id}, ${windowStartedAt}, 1, ${expiresAt})
      ON CONFLICT ("id") DO UPDATE
      SET "requestCount" = "ApiRateLimitBucket"."requestCount" + 1
      RETURNING "requestCount"
    `;

    if (bucket.requestCount <= maxRequests) return null;

    const retryAfter = Math.max(
      1,
      Math.ceil(
        (windowStartedAt.getTime() + WINDOW_MS - now.getTime()) / 1000,
      ),
    );
    return NextResponse.json(
      { code: "rate_limited", error: "تعداد درخواست‌ها بیش از حد مجاز است." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  } catch (error) {
    console.error(
      "[api] rate-limit storage failed",
      error instanceof Error ? error.name : "unknown",
    );
    return NextResponse.json(
      { code: "temporarily_unavailable", error: "سرویس موقتاً در دسترس نیست." },
      { status: 503, headers: { "Retry-After": "5" } },
    );
  }
}
