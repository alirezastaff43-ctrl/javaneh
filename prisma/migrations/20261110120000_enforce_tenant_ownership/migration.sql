ALTER TABLE "LegacyIdea"
ADD CONSTRAINT "LegacyIdea_id_userId_key" UNIQUE ("id", "userId");

ALTER TABLE "StructuredRegistration"
ADD CONSTRAINT "StructuredRegistration_id_userId_key" UNIQUE ("id", "userId");

DROP INDEX "UserIdeaSlot_legacyIdeaId_key";
DROP INDEX "UserIdeaSlot_registrationId_key";

ALTER TABLE "UserIdeaSlot"
ADD CONSTRAINT "UserIdeaSlot_slotNumber_check" CHECK ("slotNumber" BETWEEN 1 AND 3),
ADD CONSTRAINT "UserIdeaSlot_exactly_one_target_check" CHECK (
  ("legacyIdeaId" IS NOT NULL)::integer + ("registrationId" IS NOT NULL)::integer = 1
),
ADD CONSTRAINT "UserIdeaSlot_legacyIdeaId_userId_key" UNIQUE ("legacyIdeaId", "userId"),
ADD CONSTRAINT "UserIdeaSlot_registrationId_userId_key" UNIQUE ("registrationId", "userId");

ALTER TABLE "UserIdeaSlot"
DROP CONSTRAINT "UserIdeaSlot_legacyIdeaId_fkey",
ADD CONSTRAINT "UserIdeaSlot_legacyIdeaId_userId_fkey"
  FOREIGN KEY ("legacyIdeaId", "userId")
  REFERENCES "LegacyIdea" ("id", "userId")
  ON DELETE CASCADE ON UPDATE CASCADE,
DROP CONSTRAINT "UserIdeaSlot_registrationId_fkey",
ADD CONSTRAINT "UserIdeaSlot_registrationId_userId_fkey"
  FOREIGN KEY ("registrationId", "userId")
  REFERENCES "StructuredRegistration" ("id", "userId")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MentorConversation"
ADD CONSTRAINT "MentorConversation_one_target_check" CHECK (
  "legacyIdeaId" IS NULL OR "registrationId" IS NULL
),
DROP CONSTRAINT "MentorConversation_legacyIdeaId_fkey",
ADD CONSTRAINT "MentorConversation_legacyIdeaId_userId_fkey"
  FOREIGN KEY ("legacyIdeaId", "userId")
  REFERENCES "LegacyIdea" ("id", "userId")
  ON DELETE CASCADE ON UPDATE CASCADE,
DROP CONSTRAINT "MentorConversation_registrationId_fkey",
ADD CONSTRAINT "MentorConversation_registrationId_userId_fkey"
  FOREIGN KEY ("registrationId", "userId")
  REFERENCES "StructuredRegistration" ("id", "userId")
  ON DELETE CASCADE ON UPDATE CASCADE;