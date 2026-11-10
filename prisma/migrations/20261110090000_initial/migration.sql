-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'suspended');

-- CreateEnum
CREATE TYPE "UserRoleCode" AS ENUM ('platform_owner', 'registration_manager', 'support', 'analyst');

-- CreateEnum
CREATE TYPE "LegacyIdeaStatus" AS ENUM ('initial', 'in_development', 'awaiting_confirmation', 'submitted');

-- CreateEnum
CREATE TYPE "LegacyIdeaStage" AS ENUM ('initial', 'development', 'review');

-- CreateEnum
CREATE TYPE "StructuredRegistrationStatus" AS ENUM ('draft', 'submitted');

-- CreateEnum
CREATE TYPE "WorkbookFlow" AS ENUM ('C', 'P', 'S', 'E');

-- CreateEnum
CREATE TYPE "WorkbookStatus" AS ENUM ('locked', 'available', 'draft', 'submitted');

-- CreateEnum
CREATE TYPE "MentorMessageRole" AS ENUM ('user', 'assistant');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "mobile" VARCHAR(20) NOT NULL,
    "fullName" VARCHAR(160),
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "mobileVerifiedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" UUID NOT NULL,
    "role" "UserRoleCode" NOT NULL,
    "assignedBy" UUID,
    "assignedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","role")
);

-- CreateTable
CREATE TABLE "UserIdeaSlot" (
    "userId" UUID NOT NULL,
    "slotNumber" INTEGER NOT NULL,
    "legacyIdeaId" UUID,
    "registrationId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserIdeaSlot_pkey" PRIMARY KEY ("userId","slotNumber")
);

-- CreateTable
CREATE TABLE "LegacyIdea" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "title" VARCHAR(80) NOT NULL,
    "seed" VARCHAR(1200) NOT NULL,
    "status" "LegacyIdeaStatus" NOT NULL DEFAULT 'initial',
    "stage" "LegacyIdeaStage" NOT NULL DEFAULT 'initial',
    "intakeIndex" INTEGER NOT NULL DEFAULT 0,
    "developmentIndex" INTEGER NOT NULL DEFAULT 0,
    "invalidResponseCount" INTEGER NOT NULL DEFAULT 0,
    "intakeSummary" TEXT,
    "draftAnswer" VARCHAR(1500),
    "mentorNextQuestion" JSONB,
    "pendingTurn" JSONB,
    "skippedSections" JSONB,
    "editingProgress" JSONB,
    "confirmationDeadlineAt" TIMESTAMPTZ(3),
    "submittedAt" TIMESTAMPTZ(3),
    "autoSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "LegacyIdea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegacyIdeaAnswer" (
    "id" UUID NOT NULL,
    "ideaId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "section" VARCHAR(80) NOT NULL,
    "question" VARCHAR(600) NOT NULL,
    "answer" VARCHAR(1500) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegacyIdeaAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegacyProposalField" (
    "id" UUID NOT NULL,
    "ideaId" UUID NOT NULL,
    "fieldKey" VARCHAR(80) NOT NULL,
    "position" INTEGER NOT NULL,
    "text" VARCHAR(3000) NOT NULL,

    CONSTRAINT "LegacyProposalField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegacyTokenEntry" (
    "id" UUID NOT NULL,
    "ideaId" UUID NOT NULL,
    "reason" VARCHAR(160) NOT NULL,
    "amount" INTEGER NOT NULL,
    "dedupeKey" VARCHAR(120) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegacyTokenEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StructuredRegistration" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "status" "StructuredRegistrationStatus" NOT NULL DEFAULT 'draft',
    "step" VARCHAR(32) NOT NULL,
    "activeFlow" VARCHAR(32) NOT NULL,
    "data" JSONB NOT NULL,
    "submittedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "StructuredRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkbookProgress" (
    "id" UUID NOT NULL,
    "registrationId" UUID NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "flow" "WorkbookFlow" NOT NULL,
    "status" "WorkbookStatus" NOT NULL DEFAULT 'locked',
    "step" VARCHAR(8) NOT NULL,
    "answers" JSONB NOT NULL DEFAULT '{}',
    "followups" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "WorkbookProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StructuredScoreAward" (
    "id" UUID NOT NULL,
    "registrationId" UUID NOT NULL,
    "awardKey" VARCHAR(100) NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StructuredScoreAward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentorConversation" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "legacyIdeaId" UUID,
    "registrationId" UUID,
    "purpose" VARCHAR(40) NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "MentorConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentorMessage" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "role" "MentorMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MentorMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" UUID NOT NULL,
    "actorUserId" UUID,
    "subjectUserId" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entityType" VARCHAR(80) NOT NULL,
    "entityId" VARCHAR(100),
    "requestId" VARCHAR(100),
    "metadata" JSONB,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_mobile_key" ON "User"("mobile");

-- CreateIndex
CREATE INDEX "User_status_createdAt_idx" ON "User"("status", "createdAt");

-- CreateIndex
CREATE INDEX "UserRole_role_assignedAt_idx" ON "UserRole"("role", "assignedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserIdeaSlot_legacyIdeaId_key" ON "UserIdeaSlot"("legacyIdeaId");

-- CreateIndex
CREATE UNIQUE INDEX "UserIdeaSlot_registrationId_key" ON "UserIdeaSlot"("registrationId");

-- CreateIndex
CREATE INDEX "UserIdeaSlot_userId_createdAt_idx" ON "UserIdeaSlot"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "LegacyIdea_userId_updatedAt_idx" ON "LegacyIdea"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "LegacyIdea_status_confirmationDeadlineAt_idx" ON "LegacyIdea"("status", "confirmationDeadlineAt");

-- CreateIndex
CREATE INDEX "LegacyIdeaAnswer_ideaId_section_idx" ON "LegacyIdeaAnswer"("ideaId", "section");

-- CreateIndex
CREATE UNIQUE INDEX "LegacyIdeaAnswer_ideaId_position_key" ON "LegacyIdeaAnswer"("ideaId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "LegacyProposalField_ideaId_fieldKey_key" ON "LegacyProposalField"("ideaId", "fieldKey");

-- CreateIndex
CREATE UNIQUE INDEX "LegacyProposalField_ideaId_position_key" ON "LegacyProposalField"("ideaId", "position");

-- CreateIndex
CREATE INDEX "LegacyTokenEntry_ideaId_createdAt_idx" ON "LegacyTokenEntry"("ideaId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LegacyTokenEntry_ideaId_dedupeKey_key" ON "LegacyTokenEntry"("ideaId", "dedupeKey");

-- CreateIndex
CREATE INDEX "StructuredRegistration_userId_updatedAt_idx" ON "StructuredRegistration"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "StructuredRegistration_status_submittedAt_idx" ON "StructuredRegistration"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "WorkbookProgress_registrationId_status_idx" ON "WorkbookProgress"("registrationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkbookProgress_registrationId_flow_key" ON "WorkbookProgress"("registrationId", "flow");

-- CreateIndex
CREATE INDEX "StructuredScoreAward_registrationId_createdAt_idx" ON "StructuredScoreAward"("registrationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StructuredScoreAward_registrationId_awardKey_key" ON "StructuredScoreAward"("registrationId", "awardKey");

-- CreateIndex
CREATE INDEX "MentorConversation_userId_updatedAt_idx" ON "MentorConversation"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "MentorConversation_legacyIdeaId_createdAt_idx" ON "MentorConversation"("legacyIdeaId", "createdAt");

-- CreateIndex
CREATE INDEX "MentorConversation_registrationId_createdAt_idx" ON "MentorConversation"("registrationId", "createdAt");

-- CreateIndex
CREATE INDEX "MentorMessage_conversationId_createdAt_idx" ON "MentorMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MentorMessage_conversationId_position_key" ON "MentorMessage"("conversationId", "position");

-- CreateIndex
CREATE INDEX "AuditEvent_occurredAt_idx" ON "AuditEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "AuditEvent_actorUserId_occurredAt_idx" ON "AuditEvent"("actorUserId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditEvent_subjectUserId_occurredAt_idx" ON "AuditEvent"("subjectUserId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_idx" ON "AuditEvent"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserIdeaSlot" ADD CONSTRAINT "UserIdeaSlot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserIdeaSlot" ADD CONSTRAINT "UserIdeaSlot_legacyIdeaId_fkey" FOREIGN KEY ("legacyIdeaId") REFERENCES "LegacyIdea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserIdeaSlot" ADD CONSTRAINT "UserIdeaSlot_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "StructuredRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegacyIdea" ADD CONSTRAINT "LegacyIdea_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegacyIdeaAnswer" ADD CONSTRAINT "LegacyIdeaAnswer_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "LegacyIdea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegacyProposalField" ADD CONSTRAINT "LegacyProposalField_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "LegacyIdea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegacyTokenEntry" ADD CONSTRAINT "LegacyTokenEntry_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "LegacyIdea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StructuredRegistration" ADD CONSTRAINT "StructuredRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkbookProgress" ADD CONSTRAINT "WorkbookProgress_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "StructuredRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StructuredScoreAward" ADD CONSTRAINT "StructuredScoreAward_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "StructuredRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorConversation" ADD CONSTRAINT "MentorConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorConversation" ADD CONSTRAINT "MentorConversation_legacyIdeaId_fkey" FOREIGN KEY ("legacyIdeaId") REFERENCES "LegacyIdea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorConversation" ADD CONSTRAINT "MentorConversation_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "StructuredRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorMessage" ADD CONSTRAINT "MentorMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "MentorConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_subjectUserId_fkey" FOREIGN KEY ("subjectUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
