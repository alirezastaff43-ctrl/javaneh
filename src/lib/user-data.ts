import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { Prisma as PrismaNamespace } from "@prisma/client";
import { z } from "zod";
import {
  emptyState,
  normalizeState,
  SCHEMA_VERSION,
  type AppState,
  type Idea,
} from "@/lib/domain";
import {
  REGISTRATION_STEPS,
  normalizeRegistrationStore,
  type StructuredRegistration,
} from "@/lib/structured-registration";
import { prisma } from "@/lib/prisma";

type Transaction = PrismaNamespace.TransactionClient;

const uuidSchema = z.string().uuid();
const dateSchema = z.string().datetime({ offset: true });
const legacyIdeaSchema = z.object({
  id: uuidSchema,
  title: z.string().max(80),
  seed: z.string().max(1200),
  status: z.enum(["initial", "in-development", "awaiting-confirmation", "submitted"]),
  stage: z.enum(["initial", "development", "review"]),
  answers: z.array(z.object({
    section: z.string().max(80),
    question: z.string().max(600),
    answer: z.string().max(1500),
    createdAt: dateSchema,
  }).strict()).max(20),
  proposal: z.record(z.string().max(80), z.string().max(3000)).refine(
    (proposal) => Object.keys(proposal).length <= 20,
  ),
  tokens: z.array(z.object({
    id: uuidSchema,
    reason: z.string().max(160),
    amount: z.number().int().min(0).max(10),
    dedupeKey: z.string().min(1).max(120),
    createdAt: dateSchema,
  }).strict()).max(100),
  intakeIndex: z.number().int().min(0).max(5).optional(),
  developmentIndex: z.number().int().min(0).max(10).optional(),
  invalidResponseCount: z.number().int().min(0).max(3).optional(),
  intakeSummary: z.string().max(5000).optional(),
  draftAnswer: z.string().max(1500).optional(),
  mentorNextQuestion: z.object({
    stage: z.enum(["initial", "development"]),
    index: z.number().int().min(0).max(9),
    section: z.string().max(80).optional(),
    text: z.string().max(600),
    questionContext: z.string().max(360).optional(),
  }).strict().optional(),
  pendingTurn: z.object({
    stage: z.enum(["initial", "development"]),
    index: z.number().int().min(0).max(9),
    section: z.string().max(80),
    question: z.string().max(600),
    answer: z.string().min(1).max(1500),
    questionContext: z.string().max(360).optional(),
  }).strict().optional(),
  skippedSections: z.object({
    initial: z.array(z.string().max(80)).max(10).optional(),
    development: z.array(z.string().max(80)).max(10).optional(),
  }).strict().optional(),
  editingProgress: z.object({
    stage: z.enum(["initial", "development"]),
    index: z.number().int().min(0).max(10),
  }).strict().optional(),
  createdAt: dateSchema,
  updatedAt: dateSchema,
  confirmationDeadlineAt: dateSchema.optional(),
  submittedAt: dateSchema.optional(),
  autoSubmitted: z.boolean().optional(),
}).strict();

const workbookListItemSchema = z.object({
  text: z.string().max(4000),
  detail: z.string().max(4000),
  choice: z.string().max(300),
}).strict();
const workbookValueSchema = z.union([
  z.string().max(4000),
  z.array(z.string().max(300)).max(50),
  z.array(workbookListItemSchema).max(50),
  z.record(z.string().max(100), z.string().max(4000)).refine(
    (record) => Object.keys(record).length <= 50,
  ),
  z.boolean(),
]);
const workbookFollowupSchema = z.object({
  status: z.enum(["needs-more", "sufficient"]),
  sourceAnswer: z.string().max(3000),
  reply: z.string().max(240),
  questions: z.array(z.string().max(600)).max(3),
  answers: z.array(z.string().max(1500)).max(3),
  index: z.number().int().min(0).max(3),
  draft: z.string().max(1500),
}).strict();
const registrationDataSchema = z.object({
  education: z.string().max(200),
  educationOther: z.string().max(4000),
  fullName: z.string().max(160),
  email: z.string().max(200),
  province: z.string().max(120),
  city: z.string().max(120),
  cityOther: z.string().max(120),
  problem: z.string().max(4000),
  place: z.string().max(200),
  placeOther: z.string().max(4000),
  better: z.string().max(4000),
  action: z.string().max(4000),
  refine: z.enum(["more", "keep", ""]),
  outcomes: z.array(z.string().max(300)).max(30),
  outcomeOther: z.string().max(4000),
  groups: z.array(z.string().max(300)).max(30),
  groupOther: z.string().max(4000),
  axis: z.string().max(300),
  axisMulti: z.array(z.string().max(300)).max(30),
  title: z.string().max(200),
  titleDeferred: z.boolean(),
  field: z.string().max(300),
  audience: z.string().max(300),
  audienceOther: z.string().max(4000),
  news: z.boolean(),
}).strict();
const workbookProgressSchema = z.object({
  status: z.enum(["locked", "available", "draft", "submitted"]),
  step: z.string().max(8),
  answers: z.record(z.string().max(60), workbookValueSchema).refine(
    (answers) => Object.keys(answers).length <= 100,
  ),
  followups: z.record(z.string().max(80), workbookFollowupSchema).refine(
    (followups) => Object.keys(followups).length <= 30,
  ),
}).strict();
const registrationSchema = z.object({
  id: uuidSchema,
  status: z.enum(["draft", "submitted"]),
  step: z.enum(REGISTRATION_STEPS),
  activeFlow: z.enum(["F", "C", "P", "S", "E", "dashboard"]),
  data: registrationDataSchema,
  workbooks: z.object({
    C: workbookProgressSchema,
    P: workbookProgressSchema,
    S: workbookProgressSchema,
    E: workbookProgressSchema,
  }).strict(),
  scoreAwards: z.record(
    z.string().regex(/^[a-zA-Z][a-zA-Z0-9:_-]{0,99}$/),
    z.number().int().min(1).max(10),
  ).refine((awards) => Object.keys(awards).length <= 100),
  createdAt: dateSchema,
  updatedAt: dateSchema,
  submittedAt: dateSchema.optional(),
}).strict();
const snapshotSchema = z.object({
  version: z.number().int().nonnegative().safe(),
  state: z.object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    profile: z.object({
      name: z.string().max(80),
      verified: z.boolean(),
    }).strict().nullable(),
    ideas: z.array(legacyIdeaSchema).max(3),
  }).strict(),
  registrations: z.array(registrationSchema).max(3),
}).strict();

const jsonValue = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

function nullableJson(value: unknown) {
  return value === undefined || value === null ? Prisma.JsonNull : jsonValue(value);
}

function asObject(value: Prisma.JsonValue): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function legacyStatusToDb(status: Idea["status"]) {
  return status.replaceAll("-", "_") as
    | "initial"
    | "in_development"
    | "awaiting_confirmation"
    | "submitted";
}

function legacyStatusFromDb(status: string): Idea["status"] {
  return status.replaceAll("_", "-") as Idea["status"];
}

function toIdea(row: {
  id: string;
  title: string;
  seed: string;
  status: string;
  stage: string;
  intakeIndex: number;
  developmentIndex: number;
  invalidResponseCount: number;
  intakeSummary: string | null;
  draftAnswer: string | null;
  mentorNextQuestion: Prisma.JsonValue | null;
  pendingTurn: Prisma.JsonValue | null;
  skippedSections: Prisma.JsonValue | null;
  editingProgress: Prisma.JsonValue | null;
  confirmationDeadlineAt: Date | null;
  submittedAt: Date | null;
  autoSubmitted: boolean;
  createdAt: Date;
  updatedAt: Date;
  answers: Array<{ section: string; question: string; answer: string; createdAt: Date }>;
  proposalFields: Array<{ fieldKey: string; text: string; position: number }>;
  tokenEntries: Array<{ id: string; reason: string; amount: number; dedupeKey: string; createdAt: Date }>;
}): Idea {
  const idea: Idea = {
    id: row.id,
    title: row.title,
    seed: row.seed,
    status: legacyStatusFromDb(row.status),
    stage: row.stage as Idea["stage"],
    answers: row.answers.map((answer) => ({
      section: answer.section,
      question: answer.question,
      answer: answer.answer,
      createdAt: answer.createdAt.toISOString(),
    })),
    proposal: Object.fromEntries(
      row.proposalFields
        .toSorted((left, right) => left.position - right.position)
        .map((field) => [field.fieldKey, field.text]),
    ),
    tokens: row.tokenEntries.map((entry) => ({
      ...entry,
      createdAt: entry.createdAt.toISOString(),
    })),
    intakeIndex: row.intakeIndex,
    developmentIndex: row.developmentIndex,
    invalidResponseCount: row.invalidResponseCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
  if (row.intakeSummary !== null) idea.intakeSummary = row.intakeSummary;
  if (row.draftAnswer !== null) idea.draftAnswer = row.draftAnswer;
  if (row.mentorNextQuestion !== null)
    idea.mentorNextQuestion = row.mentorNextQuestion as Idea["mentorNextQuestion"];
  if (row.pendingTurn !== null)
    idea.pendingTurn = row.pendingTurn as Idea["pendingTurn"];
  if (row.skippedSections !== null)
    idea.skippedSections = row.skippedSections as Idea["skippedSections"];
  if (row.editingProgress !== null)
    idea.editingProgress = row.editingProgress as Idea["editingProgress"];
  if (row.confirmationDeadlineAt)
    idea.confirmationDeadlineAt = row.confirmationDeadlineAt.toISOString();
  if (row.submittedAt) idea.submittedAt = row.submittedAt.toISOString();
  if (row.autoSubmitted) idea.autoSubmitted = true;
  return idea;
}

function toRegistration(row: {
  id: string;
  schemaVersion: number;
  status: "draft" | "submitted";
  step: string;
  activeFlow: string;
  data: Prisma.JsonValue;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  workbooks: Array<{
    flow: "C" | "P" | "S" | "E";
    status: "locked" | "available" | "draft" | "submitted";
    step: string;
    answers: Prisma.JsonValue;
    followups: Prisma.JsonValue;
  }>;
  scoreAwards: Array<{ awardKey: string; amount: number }>;
}): StructuredRegistration {
  const workbooks = Object.fromEntries(
    row.workbooks.map((workbook) => [
      workbook.flow,
      {
        status: workbook.status,
        step: workbook.step,
        answers: asObject(workbook.answers),
        followups: asObject(workbook.followups),
      },
    ]),
  );
  const candidate = {
    id: row.id,
    schemaVersion: row.schemaVersion,
    status: row.status,
    step: row.step,
    activeFlow: row.activeFlow,
    data: asObject(row.data),
    workbooks,
    scoreAwards: Object.fromEntries(
      row.scoreAwards.map((award) => [award.awardKey, award.amount]),
    ),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...(row.submittedAt ? { submittedAt: row.submittedAt.toISOString() } : {}),
  };
  return normalizeRegistrationStore([candidate])[0];
}

export async function loadUserData(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      dataVersion: true,
      fullName: true,
      mobile: true,
      legacyIdeas: {
        include: {
          answers: { orderBy: { position: "asc" } },
          proposalFields: { orderBy: { position: "asc" } },
          tokenEntries: { orderBy: { createdAt: "asc" } },
        },
        orderBy: { createdAt: "asc" },
      },
      registrations: {
        include: {
          workbooks: true,
          scoreAwards: { orderBy: { createdAt: "asc" } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  const ideas = user.legacyIdeas.map(toIdea);
  const registrations = user.registrations.map(toRegistration);
  const state: AppState = {
    ...emptyState(),
    profile: {
      name:
        user.fullName ??
        registrations.find((registration) => registration.data.fullName.trim())?.data.fullName ??
        "کاربر جوانه",
      verified: true,
    },
    ideas,
  };
  return { version: user.dataVersion, state, registrations };
}

export function normalizeIncomingData(value: unknown) {
  const parsed = snapshotSchema.safeParse(value);
  if (!parsed.success) throw new Error("invalid_snapshot");
  const candidate = parsed.data;
  const normalizedState = normalizeState(candidate.state);
  const normalizedRegistrations = normalizeRegistrationStore(candidate.registrations);

  const ids = [
    ...normalizedState.ideas.map((idea) => idea.id),
    ...normalizedRegistrations.map((registration) => registration.id),
  ];
  if (
    ids.length > 3 ||
    new Set(ids).size !== ids.length
  )
    throw new Error("invalid_snapshot");

  for (const idea of normalizedState.ideas) {
    if (
      idea.title.length > 80 ||
      idea.seed.length > 1200 ||
      idea.answers.length > 20 ||
      Object.entries(idea.proposal).length > 20 ||
      idea.tokens.length > 100 ||
      idea.tokens.some((token) => !uuidSchema.safeParse(token.id).success)
    )
      throw new Error("invalid_snapshot");
  }
  return {
    version: candidate.version,
    state: normalizedState,
    registrations: normalizedRegistrations,
  };
}

async function syncLegacyIdea(tx: Transaction, userId: string, idea: Idea) {
  const {
    answers,
    proposal,
    tokens,
    mentorNextQuestion,
    pendingTurn,
    skippedSections,
    editingProgress,
    confirmationDeadlineAt,
    submittedAt,
    ...fields
  } = idea;
  const data = {
    title: fields.title,
    seed: fields.seed,
    status: legacyStatusToDb(fields.status),
    stage: fields.stage,
    intakeIndex: fields.intakeIndex ?? 0,
    developmentIndex: fields.developmentIndex ?? 0,
    invalidResponseCount: fields.invalidResponseCount ?? 0,
    intakeSummary: fields.intakeSummary ?? null,
    draftAnswer: fields.draftAnswer ?? null,
    mentorNextQuestion: nullableJson(mentorNextQuestion),
    pendingTurn: nullableJson(pendingTurn),
    skippedSections: nullableJson(skippedSections),
    editingProgress: nullableJson(editingProgress),
    confirmationDeadlineAt: confirmationDeadlineAt
      ? new Date(confirmationDeadlineAt)
      : null,
    submittedAt: submittedAt ? new Date(submittedAt) : null,
    autoSubmitted: fields.autoSubmitted ?? false,
    updatedAt: new Date(fields.updatedAt),
  };
  const existing = await tx.legacyIdea.findUnique({ where: { id: idea.id }, select: { userId: true } });
  if (existing && existing.userId !== userId) throw new Error("ownership_conflict");
  await tx.legacyIdea.upsert({
    where: { id: idea.id },
    create: {
      id: idea.id,
      userId,
      schemaVersion: 1,
      ...data,
      createdAt: new Date(fields.createdAt),
    },
    update: data,
  });
  await tx.legacyIdeaAnswer.deleteMany({ where: { ideaId: idea.id } });
  if (answers.length)
    await tx.legacyIdeaAnswer.createMany({
      data: answers.map((answer, position) => ({
        id: randomUUID(),
        ideaId: idea.id,
        position,
        section: answer.section.slice(0, 80),
        question: answer.question.slice(0, 600),
        answer: answer.answer.slice(0, 1500),
        createdAt: new Date(answer.createdAt),
      })),
    });
  await tx.legacyProposalField.deleteMany({ where: { ideaId: idea.id } });
  const proposals = Object.entries(proposal).slice(0, 50);
  if (proposals.length)
    await tx.legacyProposalField.createMany({
      data: proposals.map(([fieldKey, text], position) => ({
        id: randomUUID(),
        ideaId: idea.id,
        fieldKey: fieldKey.slice(0, 80),
        position,
        text: text.slice(0, 3000),
      })),
    });
  await tx.legacyTokenEntry.deleteMany({ where: { ideaId: idea.id } });
  if (tokens.length)
    await tx.legacyTokenEntry.createMany({
      data: tokens.map((token) => ({
        id: token.id,
        ideaId: idea.id,
        reason: token.reason.slice(0, 160),
        amount: Math.max(0, Math.min(10, Math.floor(token.amount))),
        dedupeKey: token.dedupeKey.slice(0, 120),
        createdAt: new Date(token.createdAt),
      })),
    });
}

async function syncRegistration(
  tx: Transaction,
  userId: string,
  registration: StructuredRegistration,
) {
  const existing = await tx.structuredRegistration.findUnique({
    where: { id: registration.id },
    select: { userId: true },
  });
  if (existing && existing.userId !== userId) throw new Error("ownership_conflict");
  await tx.structuredRegistration.upsert({
    where: { id: registration.id },
    create: {
      id: registration.id,
      userId,
      schemaVersion: 1,
      status: registration.status,
      step: registration.step,
      activeFlow: registration.activeFlow,
      data: jsonValue(registration.data),
      submittedAt: registration.submittedAt ? new Date(registration.submittedAt) : null,
      createdAt: new Date(registration.createdAt),
      updatedAt: new Date(registration.updatedAt),
    },
    update: {
      status: registration.status,
      step: registration.step,
      activeFlow: registration.activeFlow,
      data: jsonValue(registration.data),
      submittedAt: registration.submittedAt ? new Date(registration.submittedAt) : null,
      updatedAt: new Date(registration.updatedAt),
    },
  });

  for (const flow of ["C", "P", "S", "E"] as const) {
    const workbook = registration.workbooks[flow];
    await tx.workbookProgress.upsert({
      where: { registrationId_flow: { registrationId: registration.id, flow } },
      create: {
        id: randomUUID(),
        registrationId: registration.id,
        schemaVersion: 1,
        flow,
        status: workbook.status,
        step: workbook.step,
        answers: jsonValue(workbook.answers),
        followups: jsonValue(workbook.followups),
      },
      update: {
        status: workbook.status,
        step: workbook.step,
        answers: jsonValue(workbook.answers),
        followups: jsonValue(workbook.followups),
      },
    });
  }
  await tx.structuredScoreAward.deleteMany({
    where: { registrationId: registration.id },
  });
  const awards = Object.entries(registration.scoreAwards);
  if (awards.length)
    await tx.structuredScoreAward.createMany({
      data: awards.map(([awardKey, amount]) => ({
        id: randomUUID(),
        registrationId: registration.id,
        awardKey: awardKey.slice(0, 100),
        amount,
      })),
    });
}

export class SnapshotConflictError extends Error {}

export async function saveUserData(
  userId: string,
  snapshot: ReturnType<typeof normalizeIncomingData>,
) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.user.updateMany({
      where: { id: userId, dataVersion: snapshot.version },
      data: {
        dataVersion: { increment: 1 },
        ...(snapshot.registrations
          .map((registration) => registration.data.fullName.trim())
          .find(Boolean)
          ? {
              fullName: snapshot.registrations
                .map((registration) => registration.data.fullName.trim())
                .find(Boolean),
            }
          : {}),
      },
    });
    if (updated.count !== 1) throw new SnapshotConflictError();

    const ideaIds = snapshot.state.ideas.map((idea) => idea.id);
    const registrationIds = snapshot.registrations.map((item) => item.id);
    await tx.legacyIdea.deleteMany({
      where: { userId, ...(ideaIds.length ? { id: { notIn: ideaIds } } : {}) },
    });
    await tx.structuredRegistration.deleteMany({
      where: {
        userId,
        ...(registrationIds.length ? { id: { notIn: registrationIds } } : {}),
      },
    });

    for (const idea of snapshot.state.ideas)
      await syncLegacyIdea(tx, userId, idea);
    for (const registration of snapshot.registrations)
      await syncRegistration(tx, userId, registration);

    await tx.userIdeaSlot.deleteMany({ where: { userId } });
    let slotNumber = 1;
    for (const idea of snapshot.state.ideas) {
      await tx.userIdeaSlot.create({
        data: { userId, slotNumber, legacyIdeaId: idea.id },
      });
      slotNumber += 1;
    }
    for (const registration of snapshot.registrations) {
      await tx.userIdeaSlot.create({
        data: { userId, slotNumber, registrationId: registration.id },
      });
      slotNumber += 1;
    }
    return snapshot.version + 1;
  });
}
