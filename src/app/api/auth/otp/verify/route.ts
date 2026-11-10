import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import {
  createSessionToken,
  hasSameOrigin,
  sessionExpiry,
  sessionTokenHash,
  setSessionCookie,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeDigits } from "@/lib/locale";
import { normalizeIranianMobile, otpMatches } from "@/lib/otp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  mobile: z.string().min(8).max(24),
  purpose: z.enum(["signup", "login"]),
  code: z.string().min(4).max(8),
}).strict();

function failure(code: string, error: string, status: number) {
  return NextResponse.json({ code, error }, { status });
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
    return failure("invalid_request", "کد تأیید را بررسی کنید.", 400);
  }
  const mobile = normalizeIranianMobile(input.mobile);
  const code = normalizeDigits(input.code).replace(/\D/gu, "");
  if (!mobile || !/^\d{6}$/.test(code))
    return failure("invalid_code", "کد تأیید معتبر نیست یا منقضی شده است.", 400);

  try {
    const now = new Date();
    const challenge = await prisma.otpChallenge.findFirst({
      where: {
        mobile,
        purpose: input.purpose,
        consumedAt: null,
        expiresAt: { gt: now },
        attempts: { lt: 5 },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!challenge)
      return failure("invalid_code", "کد تأیید معتبر نیست یا منقضی شده است.", 400);

    if (!otpMatches(challenge.codeHash, mobile, input.purpose, code)) {
      await prisma.$executeRaw`
        UPDATE "OtpChallenge"
        SET
          "attempts" = "attempts" + 1,
          "consumedAt" = CASE
            WHEN "attempts" + 1 >= 5 THEN ${now}
            ELSE "consumedAt"
          END
        WHERE
          "id" = ${challenge.id}::uuid
          AND "consumedAt" IS NULL
          AND "expiresAt" > ${now}
          AND "attempts" < 5
      `;
      return failure("invalid_code", "کد تأیید معتبر نیست یا منقضی شده است.", 400);
    }

    const consumed = await prisma.otpChallenge.updateMany({
      where: {
        id: challenge.id,
        attempts: challenge.attempts,
        consumedAt: null,
        expiresAt: { gt: now },
      },
      data: { consumedAt: now },
    });
    if (consumed.count !== 1)
      return failure("invalid_code", "کد تأیید معتبر نیست یا منقضی شده است.", 400);

    const existing = await prisma.user.findUnique({ where: { mobile } });
    if (input.purpose === "signup" && existing)
      return failure(
        "account_exists",
        "برای این شماره حسابی وجود دارد؛ از مسیر ورود استفاده کنید.",
        409,
      );
    if (input.purpose === "login" && (!existing || existing.status !== "active"))
      return failure(
        "authentication_failed",
        "شماره یا کد تأیید معتبر نیست.",
        401,
      );

    const token = createSessionToken();
    const tokenHash = sessionTokenHash(token);
    const user = await prisma.$transaction(async (tx) => {
      const authenticatedUser =
        input.purpose === "signup"
          ? await tx.user.create({
              data: {
                id: randomUUID(),
                mobile,
                mobileVerifiedAt: now,
              },
            })
          : await tx.user.update({
              where: { id: existing!.id, status: "active" },
              data: { mobileVerifiedAt: now },
            });

      await tx.authSession.create({
        data: {
          tokenHash,
          userId: authenticatedUser.id,
          expiresAt: sessionExpiry(now),
          lastUsedAt: now,
        },
      });
      await tx.auditEvent.create({
        data: {
          id: randomUUID(),
          actorUserId: authenticatedUser.id,
          subjectUserId: authenticatedUser.id,
          action: input.purpose === "signup" ? "auth.signup" : "auth.login",
          entityType: "user",
          entityId: authenticatedUser.id,
        },
      });
      return authenticatedUser;
    });

    const response = NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        mobile: user.mobile,
        fullName: user.fullName,
      },
    });
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    )
      return failure(
        "account_exists",
        "برای این شماره حسابی وجود دارد؛ از مسیر ورود استفاده کنید.",
        409,
      );
    console.error(
      "[auth] OTP verification failed",
      error instanceof Error ? error.name : "unknown",
    );
    return failure("authentication_unavailable", "ورود موقتاً ممکن نیست.", 503);
  }
}
