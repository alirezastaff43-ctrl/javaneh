import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const mobileInput = process.env.ADMIN_BOOTSTRAP_MOBILE?.trim() ?? "";
const confirmed = process.argv.includes("--confirm");

function normalizeMobile(value) {
  const digits = value.replace(/[۰-۹]/gu, (digit) =>
    String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)),
  ).replace(/[٠-٩]/gu, (digit) =>
    String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)),
  ).replace(/[\s()-]/gu, "");
  const canonical = digits.startsWith("+")
    ? digits.slice(1)
    : digits.startsWith("00")
      ? digits.slice(2)
      : digits;
  const national = canonical.startsWith("98")
    ? canonical.slice(2)
    : canonical;
  const normalized = national.startsWith("9") && national.length === 10
    ? `0${national}`
    : national;
  if (!/^09\d{9}$/u.test(normalized)) return null;
  return `+98${normalized.slice(1)}`;
}

if (!confirmed || !mobileInput) {
  console.error("Set ADMIN_BOOTSTRAP_MOBILE to a verified account and pass --confirm.");
  process.exitCode = 2;
} else {
  const mobile = normalizeMobile(mobileInput);
  if (!mobile) {
    console.error("ADMIN_BOOTSTRAP_MOBILE is not a valid Iranian mobile number.");
    process.exitCode = 2;
  } else {
    try {
      const owner = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(904201711)::text AS acquired`;
        const existingOwner = await tx.userRole.findFirst({
          where: { role: "platform_owner" },
          select: { userId: true },
        });
        if (existingOwner) throw new Error("platform_owner_already_exists");
        const user = await tx.user.findUnique({
          where: { mobile },
          select: { id: true, mobile: true, status: true, mobileVerifiedAt: true },
        });
        if (!user || user.status !== "active" || !user.mobileVerifiedAt)
          throw new Error("verified_active_account_required");

        await tx.userRole.create({
          data: { userId: user.id, role: "platform_owner" },
        });
        await tx.auditEvent.create({
          data: {
            id: randomUUID(),
            subjectUserId: user.id,
            action: "admin.bootstrap.platform_owner",
            entityType: "user",
            entityId: user.id,
            metadata: { method: "one_time_cli_bootstrap" },
          },
        });
        return user;
      }, { isolationLevel: "Serializable" });
      console.log(`Initial platform owner assigned to verified account ending ${owner.mobile.slice(-4)}.`);
    } catch (error) {
      const safeMessage = error instanceof Error && error.message === "platform_owner_already_exists"
        ? "A platform owner already exists; bootstrap is one-time only."
        : error instanceof Error && error.message === "verified_active_account_required"
          ? "Target account must exist, be active, and have a verified mobile."
          : `database operation failed (${error instanceof Error ? error.name : "unknown error"})`;
      console.error(
        "Admin bootstrap failed:",
        safeMessage,
      );
      process.exitCode = 1;
    }
  }
}

await prisma.$disconnect();
