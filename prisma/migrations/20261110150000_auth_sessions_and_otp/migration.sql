CREATE TYPE "OtpPurpose" AS ENUM ('signup', 'login');

ALTER TABLE "User"
ADD COLUMN "dataVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "OtpChallenge" (
    "id" UUID NOT NULL,
    "mobile" VARCHAR(20) NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "codeHash" VARCHAR(64) NOT NULL,
    "requestIpHash" VARCHAR(64) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedAt" TIMESTAMPTZ(3),
    CONSTRAINT "OtpChallenge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthSession" (
    "tokenHash" VARCHAR(64) NOT NULL,
    "userId" UUID NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("tokenHash")
);

CREATE TABLE "FormValidationLock" (
    "userId" UUID NOT NULL,
    "invalidAttempts" INTEGER NOT NULL DEFAULT 0,
    "windowStartedAt" TIMESTAMPTZ(3),
    "lockedUntil" TIMESTAMPTZ(3),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "FormValidationLock_pkey" PRIMARY KEY ("userId")
);

CREATE INDEX "OtpChallenge_mobile_purpose_createdAt_idx"
ON "OtpChallenge"("mobile", "purpose", "createdAt");
CREATE INDEX "OtpChallenge_requestIpHash_createdAt_idx"
ON "OtpChallenge"("requestIpHash", "createdAt");
CREATE INDEX "OtpChallenge_expiresAt_idx" ON "OtpChallenge"("expiresAt");
CREATE INDEX "AuthSession_userId_expiresAt_idx"
ON "AuthSession"("userId", "expiresAt");
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

ALTER TABLE "AuthSession"
ADD CONSTRAINT "AuthSession_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FormValidationLock"
ADD CONSTRAINT "FormValidationLock_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
