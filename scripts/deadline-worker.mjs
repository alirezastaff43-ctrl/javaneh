import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const intervalMs = 30_000;
let shuttingDown = false;

async function runOnce() {
  const now = new Date();
  const [deadlineResult] = await prisma.$queryRaw`
    WITH due_ideas AS (
      UPDATE "LegacyIdea"
      SET
        "status" = 'submitted'::"LegacyIdeaStatus",
        "submittedAt" = "confirmationDeadlineAt",
        "autoSubmitted" = true,
        "updatedAt" = ${now}
      WHERE
        "status" = 'awaiting_confirmation'::"LegacyIdeaStatus"
        AND "confirmationDeadlineAt" IS NOT NULL
        AND "confirmationDeadlineAt" <= ${now}
      RETURNING "userId"
    ),
    changed_users AS (
      UPDATE "User" AS account
      SET "dataVersion" = account."dataVersion" + 1
      FROM (SELECT DISTINCT "userId" FROM due_ideas) AS affected
      WHERE account."id" = affected."userId"
      RETURNING account."id"
    )
    SELECT COUNT(*)::int AS count FROM due_ideas
  `;
  const submitted = deadlineResult?.count ?? 0;
  const expiredSessions = await prisma.authSession.deleteMany({
    where: { expiresAt: { lte: now } },
  });
  const oldOtp = await prisma.otpChallenge.deleteMany({
    where: { createdAt: { lte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
  });
  if (submitted || expiredSessions.count || oldOtp.count)
    console.info("[deadline-worker] maintenance completed", {
      submitted,
      expiredSessions: expiredSessions.count,
      oldOtpChallenges: oldOtp.count,
    });
}

async function shutdown() {
  shuttingDown = true;
  await prisma.$disconnect();
}

process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());

if (process.env.DEADLINE_WORKER_ONCE === "true") {
  try {
    await runOnce();
  } finally {
    await prisma.$disconnect();
  }
  process.exit(0);
}

while (!shuttingDown) {
  try {
    await runOnce();
  } catch (error) {
    console.error("[deadline-worker] database operation failed", error);
  }
  if (!shuttingDown)
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
}
