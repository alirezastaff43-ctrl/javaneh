import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import {
  getAuthenticatedUser,
  hasSameOrigin,
  unauthorizedResponse,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const WINDOW_MS = 12 * 60 * 60 * 1000;
const MAX_INVALID_ATTEMPTS = 3;
const requestSchema = z.object({ event: z.literal("invalid") }).strict();

function lockPayload(lockedUntil: Date | null, now = Date.now()) {
  const until = lockedUntil?.getTime() ?? 0;
  return {
    locked: until > now,
    lockedUntil: until > now ? until : 0,
  };
}

export async function GET(request: Request) {
  const limited = await enforceApiRateLimit(request);
  if (limited) return limited;
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorizedResponse();
  const now = new Date();
  const lock = await prisma.formValidationLock.findUnique({
    where: { userId: user.id },
  });
  if (!lock) return NextResponse.json({ locked: false, lockedUntil: 0 });
  if (lock.lockedUntil && lock.lockedUntil <= now) {
    await prisma.formValidationLock.update({
      where: { userId: user.id },
      data: { invalidAttempts: 0, windowStartedAt: null, lockedUntil: null },
    });
    return NextResponse.json({ locked: false, lockedUntil: 0 });
  }
  return NextResponse.json(lockPayload(lock.lockedUntil, now.getTime()));
}

export async function POST(request: Request) {
  const limited = await enforceApiRateLimit(request);
  if (limited) return limited;
  if (!hasSameOrigin(request))
    return NextResponse.json({ error: "درخواست قابل تأیید نیست." }, { status: 403 });
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorizedResponse();
  try {
    requestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "درخواست معتبر نیست." }, { status: 400 });
  }

  const now = new Date();
  try {
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.formValidationLock.findUnique({
        where: { userId: user.id },
      });
      if (current?.lockedUntil && current.lockedUntil > now)
        return {
          ...lockPayload(current.lockedUntil, now.getTime()),
          attemptsRemaining: 0,
        };

      const windowExpired =
        !current?.windowStartedAt ||
        now.getTime() - current.windowStartedAt.getTime() >= WINDOW_MS;
      const invalidAttempts = windowExpired ? 1 : (current?.invalidAttempts ?? 0) + 1;
      const lockedUntil =
        invalidAttempts > MAX_INVALID_ATTEMPTS
          ? new Date(now.getTime() + WINDOW_MS)
          : null;
      const record = await tx.formValidationLock.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          invalidAttempts,
          windowStartedAt: now,
          lockedUntil,
        },
        update: {
          invalidAttempts,
          windowStartedAt: windowExpired ? now : current?.windowStartedAt,
          lockedUntil,
        },
      });
      return {
        ...lockPayload(record.lockedUntil, now.getTime()),
        attemptsRemaining: Math.max(0, MAX_INVALID_ATTEMPTS - invalidAttempts),
      };
    }, { isolationLevel: "Serializable" });
    return NextResponse.json(result);
  } catch (error) {
    console.error(
      "[form-validation] lock update failed",
      error instanceof Error ? error.name : "unknown",
    );
    return NextResponse.json(
      { code: "validation_unavailable", error: "بررسی پاسخ موقتاً ممکن نیست." },
      { status: 503 },
    );
  }
}
