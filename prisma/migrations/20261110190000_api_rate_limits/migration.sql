CREATE TABLE "ApiRateLimitBucket" (
    "id" VARCHAR(64) NOT NULL,
    "windowStartedAt" TIMESTAMPTZ(3) NOT NULL,
    "requestCount" INTEGER NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "ApiRateLimitBucket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ApiRateLimitBucket_expiresAt_idx"
    ON "ApiRateLimitBucket"("expiresAt");
