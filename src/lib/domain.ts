import {
  axesForStage,
  findAxis,
  type InterviewStage,
} from "./interviewer";

export const MAX_IDEAS = 3;
export const STORAGE_KEY = "javaneh-demo-v1";
export const SCHEMA_VERSION = 1;

export type Stage = "initial" | "development" | "review";
export type IdeaStatus =
  | "initial"
  | "in-development"
  | "awaiting-confirmation"
  | "submitted";

export type Answer = {
  section: string;
  question: string;
  answer: string;
  createdAt: string;
};
export type TokenEntry = {
  id: string;
  reason: string;
  amount: number;
  dedupeKey: string;
  createdAt: string;
};
export type Idea = {
  id: string;
  title: string;
  seed: string;
  status: IdeaStatus;
  stage: Stage;
  answers: Answer[];
  proposal: Record<string, string>;
  tokens: TokenEntry[];
  intakeIndex?: number;
  developmentIndex?: number;
  intakeSummary?: string;
  draftAnswer?: string;
  mentorNextQuestion?: {
    stage: InterviewStage;
    index: number;
    section?: string;
    text: string;
  };
  pendingTurn?: {
    stage: InterviewStage;
    index: number;
    section: string;
    question: string;
    answer: string;
  };
  skippedSections?: Partial<Record<InterviewStage, string[]>>;
  editingProgress?: { stage: "initial" | "development"; index: number };
  createdAt: string;
  updatedAt: string;
  confirmationDeadlineAt?: string;
  submittedAt?: string;
  autoSubmitted?: boolean;
};
export type AppState = {
  schemaVersion: number;
  profile: { name: string; verified: boolean } | null;
  ideas: Idea[];
};

export const emptyState = (): AppState => ({
  schemaVersion: SCHEMA_VERSION,
  profile: null,
  ideas: [],
});

export function canCreateIdea(state: AppState): boolean {
  return state.ideas.length < MAX_IDEAS;
}

export function removeIdea(state: AppState, ideaId: string): AppState {
  return {
    ...state,
    ideas: state.ideas.filter((idea) => idea.id !== ideaId),
  };
}

export function awardToken(
  idea: Idea,
  reason: string,
  dedupeKey: string,
  amount: number,
  now = new Date(),
): Idea {
  if (idea.tokens.some((entry) => entry.dedupeKey === dedupeKey)) return idea;
  const boundedAmount = Math.max(0, Math.min(10, Math.floor(amount)));
  if (!boundedAmount) return idea;
  return {
    ...idea,
    tokens: [
      ...idea.tokens,
      {
        id: crypto.randomUUID(),
        reason,
        amount: boundedAmount,
        dedupeKey,
        createdAt: now.toISOString(),
      },
    ],
  };
}

export function normalizeState(value: unknown): AppState {
  if (!value || typeof value !== "object") return emptyState();
  const candidate = value as Partial<AppState> & { ideas?: unknown };
  if (
    candidate.schemaVersion === SCHEMA_VERSION &&
    Array.isArray(candidate.ideas)
  ) {
    return {
      schemaVersion: SCHEMA_VERSION,
      profile:
        candidate.profile && typeof candidate.profile.name === "string"
          ? {
              name: candidate.profile.name.slice(0, 80),
              verified: Boolean(candidate.profile.verified),
            }
          : null,
      ideas: candidate.ideas
        .map(normalizeIdea)
        .filter((idea): idea is Idea => idea !== null)
        .slice(0, MAX_IDEAS),
    };
  }
  if (candidate.schemaVersion === 0 && Array.isArray(candidate.ideas)) {
    return {
      schemaVersion: SCHEMA_VERSION,
      profile: null,
      ideas: candidate.ideas
        .map(normalizeIdea)
        .filter((idea): idea is Idea => idea !== null)
        .slice(0, MAX_IDEAS),
    };
  }
  return emptyState();
}

function normalizeIdea(value: unknown): Idea | null {
  if (!value || typeof value !== "object") return null;
  const idea = value as Partial<Idea>;
  if (
    typeof idea.id !== "string" ||
    typeof idea.seed !== "string" ||
    typeof idea.title !== "string"
  )
    return null;
  const statuses = [
    "initial",
    "in-development",
    "awaiting-confirmation",
    "submitted",
  ];
  const stages = ["initial", "development", "review"];
  const normalizeDate = (date: unknown) =>
    typeof date === "string" && Number.isFinite(Date.parse(date))
      ? new Date(date).toISOString()
      : new Date(0).toISOString();
  const answers = Array.isArray(idea.answers)
    ? idea.answers
        .filter((answer): answer is Answer =>
          Boolean(
            answer &&
              typeof answer === "object" &&
              typeof answer.section === "string" &&
              typeof answer.question === "string" &&
              typeof answer.answer === "string" &&
              typeof answer.createdAt === "string",
          ),
        )
        .map((answer) => ({
          section: answer.section.slice(0, 80),
          question: answer.question.slice(0, 600),
          answer: answer.answer.slice(0, 1500),
          createdAt: answer.createdAt,
        }))
        .slice(0, 20)
    : [];
  const tokens = Array.isArray(idea.tokens)
    ? idea.tokens
        .filter((entry): entry is TokenEntry =>
          Boolean(
            entry &&
              typeof entry === "object" &&
              typeof entry.dedupeKey === "string" &&
              typeof entry.reason === "string" &&
              Number.isFinite(entry.amount),
          ),
        )
        .map((entry) => ({
          id: String(entry.id),
          reason: entry.reason.slice(0, 160),
          amount: Math.max(0, Math.min(10, Math.floor(entry.amount))),
          dedupeKey: entry.dedupeKey.slice(0, 120),
          createdAt: String(entry.createdAt),
        }))
        .slice(0, 100)
    : [];
  const proposal =
    idea.proposal && typeof idea.proposal === "object"
      ? Object.fromEntries(
          Object.entries(idea.proposal)
            .filter(
              (entry): entry is [string, string] =>
                typeof entry[1] === "string",
            )
            .slice(0, 20)
            .map(([key, text]) => [key.slice(0, 80), text.slice(0, 3000)]),
        )
      : {};
  const normalized: Idea = {
    id: idea.id.slice(0, 100),
    title: idea.title.slice(0, 80),
    seed: idea.seed.slice(0, 1200),
    status: statuses.includes(idea.status ?? "") ? idea.status! : "initial",
    stage: stages.includes(idea.stage ?? "") ? idea.stage! : "initial",
    answers,
    proposal,
    tokens,
    createdAt: normalizeDate(idea.createdAt),
    updatedAt: normalizeDate(idea.updatedAt),
    intakeIndex: Number.isInteger(idea.intakeIndex)
      ? Math.min(5, Math.max(0, idea.intakeIndex!))
      : 0,
    developmentIndex: Number.isInteger(idea.developmentIndex)
      ? Math.min(10, Math.max(0, idea.developmentIndex!))
      : 0,
  };
  if (typeof idea.intakeSummary === "string")
    normalized.intakeSummary = idea.intakeSummary.slice(0, 5000);
  if (typeof idea.draftAnswer === "string")
    normalized.draftAnswer = idea.draftAnswer.slice(0, 1500);
  if (
    idea.mentorNextQuestion &&
    typeof idea.mentorNextQuestion.text === "string" &&
    ["initial", "development"].includes(idea.mentorNextQuestion.stage) &&
    Number.isInteger(idea.mentorNextQuestion.index) &&
    idea.mentorNextQuestion.index >= 0 &&
    idea.mentorNextQuestion.index <
      axesForStage(idea.mentorNextQuestion.stage).length &&
    (!idea.mentorNextQuestion.section ||
      findAxis(idea.mentorNextQuestion.section, idea.mentorNextQuestion.stage)
        ?.section ===
        axesForStage(idea.mentorNextQuestion.stage)[
          idea.mentorNextQuestion.index
        ]?.section)
  ) {
    normalized.mentorNextQuestion = {
      stage: idea.mentorNextQuestion.stage,
      index: idea.mentorNextQuestion.index,
      section:
        idea.mentorNextQuestion.section ??
        axesForStage(idea.mentorNextQuestion.stage)[
          idea.mentorNextQuestion.index
        ].section,
      text: idea.mentorNextQuestion.text.slice(0, 600),
    };
  }
  if (
    idea.pendingTurn &&
    ["initial", "development"].includes(idea.pendingTurn.stage) &&
    Number.isInteger(idea.pendingTurn.index) &&
    idea.pendingTurn.index >= 0 &&
    idea.pendingTurn.index <
      axesForStage(idea.pendingTurn.stage).length &&
    idea.pendingTurn.index ===
      (idea.pendingTurn.stage === "initial"
        ? normalized.intakeIndex
        : normalized.developmentIndex) &&
    findAxis(idea.pendingTurn.section, idea.pendingTurn.stage)?.section ===
      axesForStage(idea.pendingTurn.stage)[idea.pendingTurn.index]?.section &&
    typeof idea.pendingTurn.question === "string" &&
    idea.pendingTurn.question.length <= 600 &&
    typeof idea.pendingTurn.answer === "string" &&
    idea.pendingTurn.answer.trim().length > 0 &&
    idea.pendingTurn.answer.length <= 1500
  ) {
    normalized.pendingTurn = {
      stage: idea.pendingTurn.stage,
      index: idea.pendingTurn.index,
      section: idea.pendingTurn.section,
      question: idea.pendingTurn.question,
      answer: idea.pendingTurn.answer,
    };
  }
  if (idea.skippedSections && typeof idea.skippedSections === "object") {
    normalized.skippedSections = {};
    for (const stage of ["initial", "development"] as const) {
      const validSections = new Set<string>(
        axesForStage(stage).map((axis) => axis.section),
      );
      const sections = idea.skippedSections[stage];
      if (Array.isArray(sections)) {
        normalized.skippedSections[stage] = [
          ...new Set(
            sections.filter(
              (section): section is string =>
                typeof section === "string" &&
                validSections.has(section) &&
                !answers.some((answer) => answer.section === section),
            ),
          ),
        ];
      }
    }
  }
  if (
    idea.editingProgress &&
    ["initial", "development"].includes(idea.editingProgress.stage) &&
    Number.isInteger(idea.editingProgress.index)
  ) {
    normalized.editingProgress = {
      stage: idea.editingProgress.stage,
      index: Math.min(
        idea.editingProgress.stage === "initial" ? 5 : 10,
        Math.max(0, idea.editingProgress.index),
      ),
    };
  }
  if (
    typeof idea.confirmationDeadlineAt === "string" &&
    Number.isFinite(Date.parse(idea.confirmationDeadlineAt))
  )
    normalized.confirmationDeadlineAt = new Date(
      idea.confirmationDeadlineAt,
    ).toISOString();
  else if (normalized.status === "awaiting-confirmation")
    normalized.status = "in-development";
  if (
    typeof idea.submittedAt === "string" &&
    Number.isFinite(Date.parse(idea.submittedAt))
  )
    normalized.submittedAt = new Date(idea.submittedAt).toISOString();
  if (typeof idea.autoSubmitted === "boolean")
    normalized.autoSubmitted = idea.autoSubmitted;
  return normalized;
}

export function applyDeadlineTransitions(
  state: AppState,
  now = new Date(),
): AppState {
  let changed = false;
  const ideas = state.ideas.map((idea) => {
    if (idea.status !== "awaiting-confirmation" || !idea.confirmationDeadlineAt)
      return idea;
    if (new Date(idea.confirmationDeadlineAt).getTime() > now.getTime())
      return idea;
    changed = true;
    return {
      ...idea,
      status: "submitted" as const,
      submittedAt: idea.confirmationDeadlineAt,
      autoSubmitted: true,
      updatedAt: now.toISOString(),
    };
  });
  return changed ? { ...state, ideas } : state;
}

export function submitNow(idea: Idea, now = new Date()): Idea {
  return {
    ...idea,
    status: "submitted",
    submittedAt: now.toISOString(),
    confirmationDeadlineAt: undefined,
    autoSubmitted: false,
    updatedAt: now.toISOString(),
  };
}

export function deferSubmission(idea: Idea, now = new Date()): Idea {
  const deadline = new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString();
  return {
    ...idea,
    status: "awaiting-confirmation",
    confirmationDeadlineAt: deadline,
    submittedAt: undefined,
    autoSubmitted: false,
    updatedAt: now.toISOString(),
  };
}
