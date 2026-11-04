"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BookOpenText,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileText,
  Flower2,
  Gift,
  House,
  Info,
  Lightbulb,
  LockKeyhole,
  MessageCircle,
  Pencil,
  Plus,
  BarChart3,
  Database,
  Bell,
  FolderOpen,
  ArrowUpRight,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Sprout,
  Trash2,
  Users,
} from "lucide-react";
import {
  formatDate,
  formatNumber,
  isEnglishText,
  normalizeDigits,
} from "@/lib/locale";
import {
  applyDeadlineTransitions,
  awardToken,
  canCreateIdea,
  deferSubmission,
  emptyState,
  normalizeState,
  removeIdea,
  SCHEMA_VERSION,
  STORAGE_KEY,
  submitNow,
  type AppState,
  type Answer,
  type Idea,
  type Stage,
} from "@/lib/domain";
import {
  axesForStage,
  findAxis,
  validateInterviewDecision,
  INTAKE_AXES as intakeQuestions,
  DEVELOPMENT_AXES as developmentQuestions,
  type InterviewRequest,
} from "@/lib/interviewer";

type Screen =
  | "home"
  | "details"
  | "verify"
  | "intake"
  | "dashboard"
  | "develop"
  | "review"
  | "submitted";
const labels = {
  statuses: {
    initial: "Idea started",
    "in-development": "In development",
    "awaiting-confirmation": "Awaiting confirmation",
    submitted: "Submitted",
  },
  localNotice:
    "Your ideas and answers are saved only in this browser and are not synced across devices. Clearing browser data may permanently remove them.",
};

function mentorFailureMessage(payload: unknown): string {
  if (payload && typeof payload === "object" && "code" in payload) {
    switch (payload.code) {
      case "provider_rate_limited":
        return "The mentor service is temporarily busy. Your answer is saved; please wait a moment and try again.";
      case "provider_timeout":
        return "Preparing the next question took too long. Your answer is saved; please try again.";
      case "provider_unavailable":
        return "The mentor service is temporarily unavailable. Your answer is saved; please try again shortly.";
      case "provider_authentication":
      case "provider_configuration":
        return "The mentor service settings need attention. Your answer has been saved.";
      case "provider_request_rejected":
        return "The mentor service could not accept the request. Your answer is saved; the model settings may need attention.";
      case "provider_invalid_response":
        return "The next question could not be prepared. Your answer is saved; please try again.";
    }
  }
  if (payload && typeof payload === "object" && "error" in payload) {
    if (typeof payload.error === "string") return payload.error;
  }
  return "The next question could not be prepared. Your answer is saved; please try again.";
}

const sectionLabels: Record<string, string> = {
  "The problem": "The problem",
  "People affected": "People affected",
  "What is known": "What is known",
  "Your idea": "Your idea",
  "Your connection": "Your connection",
  Evidence: "Evidence",
  Stakeholders: "Stakeholders",
  "Root causes": "Root causes",
  Solution: "Solution",
  Feasibility: "Feasibility",
  Pilot: "Pilot",
  Outcomes: "Outcomes",
  "Inclusion and risk": "Inclusion and risk",
  Delivery: "Delivery",
  "Next actions": "Next actions",
};

const proposalLabels: Record<string, string> = {
  summary: "Short summary",
  problem: "Problem and evidence",
  beneficiaries: "People who benefit",
  solution: "Proposed solution",
  impact: "Expected social impact",
  evidence: "Evidence and assumptions",
  feasibility: "Feasibility and resources",
  pilot: "Pilot and next steps",
  measurement: "Measurement",
  risks: "Risks and mitigations",
  openQuestions: "Open questions",
};

function displaySection(section: string) {
  const knownSection = Object.keys(sectionLabels).find(
    (label) => label.toLowerCase() === section.toLowerCase(),
  );
  return knownSection ? sectionLabels[knownSection] : section;
}

function displayTokenReason(reason: string) {
  const knownReasons: Record<string, string> = {
    "Initial registration confirmed": "Initial idea confirmed",
    "Mentor development completed": "Idea development completed",
    "Proposal reviewed": "Proposal reviewed",
  };
  if (knownReasons[reason]) return knownReasons[reason];
  const prefix = "Thoughtful progress: ";
  return reason.startsWith(prefix)
    ? `Thoughtful progress: ${displaySection(reason.slice(prefix.length))}`
    : reason;
}

function displayProposalText(value: string) {
  return value === "Not yet explored with the participant." ||
    value ===
      "\u0627\u06cc\u0646\u0020\u0645\u0648\u0631\u062f\u0020\u0647\u0646\u0648\u0632\u0020\u0628\u0631\u0631\u0633\u06cc\u0020\u0646\u0634\u062f\u0647\u0020\u0627\u0633\u062a\u002e"
    ? "Not explored yet."
    : value;
}

function displayIntakeSummary(idea: Idea) {
  const generatedSummaries = new Set([
    `${idea.seed}\n\n${idea.answers.map((answer) => `${answer.section}: ${answer.answer}`).join("\n\n")}`,
    `${idea.seed}\n\n${idea.answers.map((answer) => `${displaySection(answer.section)}: ${answer.answer}`).join("\n\n")}`,
  ]);
  let matchesLegacyGeneratedSummary =
    idea.intakeSummary?.startsWith(`${idea.seed}\n\n`) ?? false;
  if (matchesLegacyGeneratedSummary && idea.intakeSummary) {
    let remaining = idea.intakeSummary.slice(idea.seed.length + 2);
    for (const [index, answer] of idea.answers.entries()) {
      const answerMarker = `: ${answer.answer}`;
      const markerIndex = remaining.indexOf(answerMarker);
      if (markerIndex <= 0 || remaining.slice(0, markerIndex).includes("\n")) {
        matchesLegacyGeneratedSummary = false;
        break;
      }
      remaining = remaining.slice(markerIndex + answerMarker.length);
      if (index < idea.answers.length - 1) {
        if (!remaining.startsWith("\n\n")) {
          matchesLegacyGeneratedSummary = false;
          break;
        }
        remaining = remaining.slice(2);
      }
    }
    matchesLegacyGeneratedSummary &&= remaining.length === 0;
  }
  if (
    idea.intakeSummary &&
    !generatedSummaries.has(idea.intakeSummary) &&
    !matchesLegacyGeneratedSummary
  )
    return idea.intakeSummary;
  return `${idea.seed}\n\n${idea.answers.map((answer) => `${displaySection(answer.section)}: ${answer.answer}`).join("\n\n")}`;
}

function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function newIdea(seed: string): Idea {
  const now = new Date().toISOString();
  const title =
    seed
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 48)
      .replace(/[.!?]$/, "") || "Untitled idea";
  return {
    id: makeId(),
    title,
    seed: seed.trim(),
    status: "initial",
    stage: "initial",
    answers: [],
    proposal: {},
    tokens: [],
    intakeIndex: 0,
    developmentIndex: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function getQuestion(idea: Idea, stage: "initial" | "development") {
  const index =
    stage === "initial"
      ? (idea.intakeIndex ?? 0)
      : (idea.developmentIndex ?? 0);
  const list = stage === "initial" ? intakeQuestions : developmentQuestions;
  const base = list[Math.min(index, list.length - 1)];
  const existing = idea.answers.find((item) => item.section === base.section);
  if (
    idea.pendingTurn?.stage === stage &&
    idea.pendingTurn.index === index &&
    idea.pendingTurn.section === base.section &&
    isEnglishText(idea.pendingTurn.question)
  )
    return { ...base, question: idea.pendingTurn.question };
  if (
    idea.mentorNextQuestion?.stage === stage &&
    idea.mentorNextQuestion.index === index &&
    (!idea.mentorNextQuestion.section ||
      idea.mentorNextQuestion.section === base.section) &&
    isEnglishText(idea.mentorNextQuestion.text)
  ) {
    return { ...base, question: idea.mentorNextQuestion.text };
  }
  if (
    idea.editingProgress?.stage === stage &&
    idea.editingProgress.index === index &&
    existing &&
    isEnglishText(existing.question)
  )
    return { ...base, question: existing.question };
  if (idea.draftAnswer) return base;
  if (stage === "initial" && index === 0 && idea.seed.length > 20) {
    return {
      ...base,
      question: `You mentioned “${idea.seed.slice(0, 95)}${idea.seed.length > 95 ? "…" : ""}.” When or where do you see this problem specifically?`,
    };
  }
  return base;
}

function getProgress(idea: Idea) {
  if (idea.status === "submitted") return 100;
  const initial = Math.min(
    new Set([
      ...idea.answers
        .filter((answer) =>
          intakeQuestions.some((q) => q.section === answer.section),
        )
        .map((answer) => answer.section),
      ...(idea.skippedSections?.initial ?? []),
    ]).size,
    5,
  );
  const development = Math.min(
    new Set([
      ...idea.answers
        .filter((answer) =>
          developmentQuestions.some((q) => q.section === answer.section),
        )
        .map((answer) => answer.section),
      ...(idea.skippedSections?.development ?? []),
    ]).size,
    10,
  );
  return Math.round((initial / 5) * 40 + (development / 10) * 60);
}

export default function Home() {
  const [state, setState] = useState<AppState>(emptyState());
  const stateRef = useRef(state);
  function commitState(
    updater: AppState | ((current: AppState) => AppState),
  ) {
    const nextState =
      typeof updater === "function" ? updater(stateRef.current) : updater;
    stateRef.current = nextState;
    setState(nextState);
  }
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState<Screen>("home");
  const [seed, setSeed] = useState("");
  const [formError, setFormError] = useState("");
  const [seedEditOpen, setSeedEditOpen] = useState(false);
  const [seedEditDraft, setSeedEditDraft] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [mobile, setMobile] = useState("");
  const [maskedMobile, setMaskedMobile] = useState("");
  const [code, setCode] = useState("");
  const [activeId, setActiveId] = useState("");
  const [draftAnswer, setDraftAnswer] = useState("");
  const [mentorMessage, setMentorMessage] = useState(
    "I’m here to help, one step at a time. You do not need to have every answer yet.",
  );
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [reviewDraft, setReviewDraft] = useState<Record<string, string>>({});
  const [now, setNow] = useState(Date.now());
  const [tokenNotice, setTokenNotice] = useState("");
  const [storageError, setStorageError] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed = saved ? normalizeState(JSON.parse(saved)) : emptyState();
      const transitioned = applyDeadlineTransitions(parsed);
      commitState(transitioned);
      if (saved && JSON.stringify(parsed) !== JSON.stringify(transitioned))
        localStorage.setItem(STORAGE_KEY, JSON.stringify(transitioned));
    } catch {
      commitState(emptyState());
      setStorageError(
        "Browser storage is unavailable or saved data could not be read. Changes in this session may be lost when you reload.",
      );
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      setStorageError(
        "Changes could not be saved in this browser and may be lost after reloading. Check your browser's storage access and available space.",
      );
    }
  }, [state, ready]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const deadline = state.ideas
      .filter((idea) => idea.status === "awaiting-confirmation")
      .map((idea) => new Date(idea.confirmationDeadlineAt ?? "").getTime())
      .filter(Number.isFinite)
      .sort((left, right) => left - right)[0];
    if (deadline === undefined) return;
    const timer = window.setTimeout(
      () => setNow(Date.now()),
      Math.max(0, deadline - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [state.ideas]);

  useEffect(() => {
    commitState((current) => applyDeadlineTransitions(current, new Date(now)));
  }, [now]);

  const activeIdea = useMemo(
    () => state.ideas.find((idea) => idea.id === activeId),
    [state.ideas, activeId],
  );
  const tokenTotal = state.ideas.reduce(
    (sum, idea) =>
      sum + idea.tokens.reduce((total, entry) => total + entry.amount, 0),
    0,
  );

  function announceNewToken(previous: Idea, next: Idea) {
    const newEntries = next.tokens.filter(
      (entry) => !previous.tokens.some((token) => token.id === entry.id),
    );
    if (newEntries.length)
      setTokenNotice(
        newEntries
          .map(
            (entry) =>
              `+${formatNumber(entry.amount)} tokens · ${displayTokenReason(entry.reason)}`,
          )
          .join("; "),
      );
  }

  useEffect(() => {
    if (!tokenNotice) return;
    const timer = window.setTimeout(() => setTokenNotice(""), 5000);
    return () => window.clearTimeout(timer);
  }, [tokenNotice]);

  function updateIdea(updated: Idea) {
    commitState((current) => ({
      ...current,
      ideas: current.ideas.map((idea) =>
        idea.id === updated.id
          ? { ...updated, updatedAt: new Date().toISOString() }
          : idea,
      ),
    }));
  }

  function saveIdeaImmediately(updated: Idea): Idea | null {
    const savedIdea = { ...updated, updatedAt: new Date().toISOString() };
    const currentState = stateRef.current;
    const nextState: AppState = {
      ...currentState,
      ideas: currentState.ideas.map((idea) =>
        idea.id === savedIdea.id ? savedIdea : idea,
      ),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    } catch {
      setFormError("Your answer could not be saved in this browser. Check storage and try again.");
      setStorageError(
        "Browser storage failed. Check your browser's storage access and available space.",
      );
      return null;
    }
    commitState(nextState);
    return savedIdea;
  }

  function deleteIdea(idea: Idea) {
    if (
      !window.confirm(
        `Are you sure you want to delete “${idea.title}” and all of its saved answers?`,
      )
    )
      return;

    const nextState = removeIdea(stateRef.current, idea.id);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    } catch {
      setFormError("The idea could not be deleted from this browser. Check storage and try again.");
      setStorageError(
        "Browser storage failed. Check your browser's storage access and available space.",
      );
      return;
    }

    commitState(nextState);
    if (activeId === idea.id) {
      setActiveId("");
      setDraftAnswer("");
      setReviewDraft({});
      setScreen("dashboard");
    }
    setFormError("");
  }

  function startIdea() {
    if (!seed.trim()) {
      setFormError("Write a few words about the problem or your idea to continue.");
      return;
    }
    if (!canCreateIdea(state)) {
      setFormError(
        "You have reached the three-idea limit. Your saved ideas are still available.",
      );
      return;
    }
    setFormError("");
    if (state.profile?.verified) {
      const idea = newIdea(seed);
      commitState((current) => ({ ...current, ideas: [...current.ideas, idea] }));
      setActiveId(idea.id);
      setDraftAnswer("");
      setReviewDraft({});
      setMentorMessage(
        "We’ll develop your idea in your own words, one practical question at a time.",
      );
      setScreen("intake");
    } else {
      setScreen("details");
    }
  }

  function submitDetails(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const digits = normalizeDigits(mobile).replace(/\D/g, "");
    const identityDigits = normalizeDigits(nationalId).replace(/\D/g, "");
    if (!firstName.trim() || !lastName.trim()) {
      setFormError("Enter your first and last name.");
      return;
    }
    if (identityDigits.length < 6 || identityDigits.length > 20) {
      setFormError("The national ID must contain between 6 and 20 digits.");
      return;
    }
    if (digits.length < 8 || digits.length > 15) {
      setFormError("The mobile number must contain between 8 and 15 digits.");
      return;
    }
    setMaskedMobile(
      `${digits.slice(0, 2)}••••••${digits.slice(-2)}`,
    );
    setFormError("");
    setScreen("verify");
  }

  function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{4,8}$/.test(normalizeDigits(code))) {
      setFormError("Enter a 4–8 digit number to continue.");
      return;
    }
    const idea = newIdea(seed);
    commitState((current) => ({
      ...current,
      schemaVersion: SCHEMA_VERSION,
      profile: {
        name: `${firstName.trim()} ${lastName.trim()}`,
        verified: true,
      },
      ideas: [...current.ideas, idea],
    }));
    setActiveId(idea.id);
    setMentorMessage(
      "Thanks for starting with what you noticed. We’ll keep your words as written and take one practical question at a time.",
    );
    setNationalId("");
    setMobile("");
    setMaskedMobile("");
    setCode("");
    setDraftAnswer("");
    setReviewDraft({});
    setFormError("");
    setScreen("intake");
  }

  async function answerCurrent(
    stage: "initial" | "development",
    override?: string,
  ) {
    if (!activeIdea || busyRef.current) return;
    const storedPending = activeIdea.pendingTurn?.stage === stage
      ? activeIdea.pendingTurn
      : undefined;
    const pending = storedPending
      ? {
          ...storedPending,
          question: isEnglishText(storedPending.question)
            ? storedPending.question
            : getQuestion(activeIdea, stage).question,
        }
      : undefined;
    const answerText = (override ?? draftAnswer).trim();
    if (!pending && !answerText) {
      setFormError(
        "Write a short answer, or choose “I’m not sure yet” to continue.",
      );
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setFormError("");
    try {
      let updated = activeIdea;
      let turn = pending;
      if (!turn) {
        const questionData = getQuestion(activeIdea, stage);
        const index =
      stage === "initial"
        ? (activeIdea.intakeIndex ?? 0)
        : (activeIdea.developmentIndex ?? 0);
        const axes = axesForStage(stage);
        const currentAxis = axes[index];
        if (!currentAxis) {
          setFormError("This stage is complete.");
          return;
        }
        const previous = activeIdea.answers.find(
          (item) => item.section === currentAxis.section,
        );
        const answer: Answer = {
          section: currentAxis.section,
          question: questionData.question,
          answer: answerText,
          createdAt: new Date().toISOString(),
        };
        updated = {
          ...activeIdea,
          answers: previous
            ? activeIdea.answers.map((item) =>
                item.section === answer.section ? answer : item,
              )
            : [...activeIdea.answers, answer],
          draftAnswer: "",
        };
        updated = awardToken(
          updated,
          `Thoughtful progress: ${currentAxis.section.toLowerCase()}`,
          `${stage}-${index}`,
          2,
        );

        const editing = activeIdea.editingProgress;
        if (editing?.stage === stage && editing.index > index) {
          if (stage === "initial") updated.intakeIndex = editing.index;
          else updated.developmentIndex = editing.index;
          updated.editingProgress = undefined;
          setDraftAnswer("");
          const savedIdea = saveIdeaImmediately(updated);
          if (savedIdea) announceNewToken(activeIdea, savedIdea);
          return;
        }

        turn = {
          stage,
          index,
          section: currentAxis.section,
          question: questionData.question,
          answer: answerText,
        };
        updated.pendingTurn = turn;
        updated.editingProgress = undefined;
        const savedAnswer = saveIdeaImmediately(updated);
        if (!savedAnswer) return;
        announceNewToken(activeIdea, savedAnswer);
        updated = savedAnswer;
        setDraftAnswer("");
      }

      if (!turn) return;
      const axes = axesForStage(stage);
      const answeredSections = updated.answers
        .filter((answer) => findAxis(answer.section, stage))
        .map((answer) => answer.section);
      const skippedSections = updated.skippedSections?.[stage] ?? [];
      const remainingSections = axes
        .slice(turn.index + 1)
        .filter(
          (axis) =>
            !answeredSections.includes(axis.section) &&
            !skippedSections.includes(axis.section),
        )
        .map((axis) => axis.section);
      const history = updated.answers
        .filter((answer) => answer.section !== turn.section)
        .map((answer) => ({
          answer,
          axis: findAxis(answer.section),
        }))
        .filter(
          (entry): entry is { answer: Answer; axis: NonNullable<typeof entry.axis> } =>
            Boolean(entry.axis),
        )
        .sort(
          (left, right) =>
            Date.parse(left.answer.createdAt) -
            Date.parse(right.answer.createdAt),
        )
        .slice(-4)
        .map(({ answer, axis }) => ({
          stage: intakeQuestions.some((item) => item.section === axis.section)
            ? ("initial" as const)
            : ("development" as const),
          section: answer.section,
          question: axis.question.slice(0, 300),
          answer: answer.answer.slice(0, 500),
          createdAt: answer.createdAt,
        }));
      const interviewRequest: InterviewRequest = {
        seed: updated.seed,
        stage,
        section: turn.section,
        index: turn.index,
        question: turn.question,
        answer: turn.answer,
        answeredSections,
        skippedSections,
        remainingSections,
        history,
      };

      let response: Response;
      try {
        response = await fetch("/api/mentor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(interviewRequest),
        });
      } catch {
        setMentorMessage("Your answer is saved.");
        setFormError(
          "The connection to the mentor service was lost. Your answer is saved; please try again.",
        );
        return;
      }
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        setMentorMessage("Your answer is saved.");
        setFormError(
          "The mentor service response could not be read. Your answer is saved; please try again.",
        );
        return;
      }
      if (
        !response.ok ||
        !payload ||
        typeof payload !== "object" ||
        !("mode" in payload) ||
        (payload.mode !== "provider" && payload.mode !== "demo") ||
        !validateInterviewDecision(payload, interviewRequest)
      ) {
        setMentorMessage("Your answer is saved.");
        setFormError(mentorFailureMessage(payload));
        return;
      }

      const decision = payload;
      const nextIndex = decision.stageComplete
        ? axes.length
        : axes.findIndex((axis) => axis.section === decision.nextSection);
      const completedIdea: Idea = {
        ...updated,
        ...(stage === "initial"
          ? { intakeIndex: nextIndex }
          : { developmentIndex: nextIndex }),
        skippedSections: {
          ...updated.skippedSections,
          [stage]: [...new Set([...skippedSections, ...decision.coveredSections])],
        },
        mentorNextQuestion: decision.stageComplete
          ? undefined
          : {
              stage,
              index: nextIndex,
              section: decision.nextSection!,
              text: decision.nextQuestion!,
            },
        pendingTurn: undefined,
        editingProgress: undefined,
      };
      const finalIdea =
        stage === "development" && decision.stageComplete
          ? awardToken(
              completedIdea,
              "Mentor development completed",
              "development-complete",
              5,
            )
          : completedIdea;
      const savedFinalIdea = saveIdeaImmediately(finalIdea);
      if (!savedFinalIdea) {
        setFormError("Your answer is saved, but the next step could not be saved. Please try again.");
        return;
      }
      announceNewToken(activeIdea, savedFinalIdea);
      setMentorMessage(decision.mentorMessage.slice(0, 120));
      setDraftAnswer("");
      setFormError("");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function confirmInitial() {
    if (!activeIdea) return;
    let updated: Idea = {
      ...activeIdea,
      stage: "initial" as Stage,
      status: "initial",
      intakeSummary:
        reviewDraft.summary ||
        activeIdea.intakeSummary ||
      `${activeIdea.seed}\n\n${activeIdea.answers.map((answer) => `${displaySection(answer.section)}: ${answer.answer}`).join("\n\n")}`,
    };
    updated = awardToken(
      updated,
      "Initial registration confirmed",
      "initial-complete",
      5,
    );
    announceNewToken(activeIdea, updated);
    updateIdea(updated);
    setScreen("dashboard");
  }

  function beginDevelopment(idea: Idea) {
    setActiveId(idea.id);
    setDraftAnswer(idea.draftAnswer ?? "");
    if (idea.status === "initial")
      updateIdea({ ...idea, status: "in-development", stage: "development" });
    setMentorMessage(
      "Let’s make your idea more practical by separating what you have observed from what still needs to be tested.",
    );
    setScreen("develop");
  }
  function editAnswer(idea: Idea, answer: Answer) {
    const intakeIndex = intakeQuestions.findIndex(
      (question) => question.section === answer.section,
    );
    const developmentIndex = developmentQuestions.findIndex(
      (question) => question.section === answer.section,
    );
    const editingInitial = intakeIndex >= 0;
    const stage = editingInitial ? "initial" : "development";
    updateIdea({
      ...idea,
      ...(editingInitial ? { intakeIndex } : { developmentIndex }),
      editingProgress: {
        stage,
        index:
          stage === "initial"
            ? (idea.intakeIndex ?? 0)
            : (idea.developmentIndex ?? 0),
      },
      draftAnswer: answer.answer,
      pendingTurn:
        idea.pendingTurn?.section === answer.section
          ? undefined
          : idea.pendingTurn,
    });
    setActiveId(idea.id);
    setDraftAnswer(answer.answer);
    setScreen(editingInitial ? "intake" : "develop");
  }

  function beginReview(idea: Idea) {
    const fields = createProposal(idea);
    setReviewDraft({ ...fields, ...idea.proposal });
    setActiveId(idea.id);
    updateIdea({ ...idea, stage: "review" });
    setScreen("review");
  }

  function saveProposal(idea: Idea) {
    updateIdea({
      ...idea,
      title: reviewDraft.title?.trim().slice(0, 80) || idea.title,
      proposal: reviewDraft,
      stage: "review",
    });
  }

  function submitProposal(mode: "now" | "later") {
    if (!activeIdea) return;
    let saved: Idea = {
      ...activeIdea,
      title: reviewDraft.title?.trim().slice(0, 80) || activeIdea.title,
      proposal: reviewDraft,
      stage: "review",
    };
    saved = awardToken(saved, "Proposal reviewed", "proposal-review", 5);
    announceNewToken(activeIdea, saved);
    const updated = mode === "now" ? submitNow(saved) : deferSubmission(saved);
    updateIdea(updated);
    setScreen(mode === "now" ? "submitted" : "dashboard");
  }

  function createProposal(idea: Idea) {
    const answers = Object.fromEntries(
      idea.answers.map((answer) => [answer.section, answer.answer]),
    );
    const get = (...sections: string[]) =>
      sections
        .map((section) => answers[section])
        .filter(Boolean)
        .join(" ") || "Not yet explored with the participant.";
    return {
      title: idea.title,
      summary: idea.intakeSummary || idea.seed,
      problem: get("The problem", "Evidence", "What is known"),
      beneficiaries: get("People affected", "Stakeholders"),
      solution: get("Your idea", "Solution"),
      impact: get("Outcomes"),
      evidence: get("Evidence", "What is known"),
      feasibility: get("Feasibility", "Your connection"),
      pilot: get("Pilot", "Delivery"),
      measurement: get("Outcomes"),
      risks: get("Inclusion and risk", "Stakeholders"),
      openQuestions: get("Next actions", "Evidence"),
    };
  }

  function routeToIdea(idea: Idea) {
    setActiveId(idea.id);
    if (idea.status === "submitted") setScreen("submitted");
    else if (idea.status === "awaiting-confirmation") beginReview(idea);
    else if (idea.status === "initial") setScreen("intake");
    else if ((idea.developmentIndex ?? 0) < developmentQuestions.length)
      beginDevelopment(idea);
    else beginReview(idea);
  }

  const totalIdeas = state.ideas.length;
  const activeIdeas = state.ideas.filter((idea) => idea.status !== "submitted");
  const averageProgress = totalIdeas
    ? Math.round(
        state.ideas.reduce((sum, idea) => sum + getProgress(idea), 0) /
          totalIdeas,
      )
    : 0;
  const profileInitials =
    state.profile?.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] ?? "")
      .join("")
      .toUpperCase() || "J";
  const currentQuestion = activeIdea
    ? getQuestion(activeIdea, "initial")
    : intakeQuestions[0];
  const devQuestion = activeIdea
    ? getQuestion(activeIdea, "development")
    : developmentQuestions[0];
  const initialIndex = activeIdea?.intakeIndex ?? 0;
  const devIndex = activeIdea?.developmentIndex ?? 0;
  const pendingAnswer = activeIdea?.pendingTurn
    ? activeIdea.answers.find(
        (answer) => answer.section === activeIdea.pendingTurn?.section,
      )
    : undefined;
  const totalTokens =
    activeIdea?.tokens.reduce((sum, token) => sum + token.amount, 0) ?? 0;
  const remainingHours = activeIdea?.confirmationDeadlineAt
    ? Math.max(
        0,
        Math.ceil(
          (Date.parse(activeIdea.confirmationDeadlineAt) - now) / 3_600_000,
        ),
      )
    : 0;

  useEffect(() => {
    if (
      screen === "review" &&
      activeIdea?.status === "submitted" &&
      activeIdea.autoSubmitted
    )
      setScreen("submitted");
  }, [activeIdea, screen]);

  if (!ready)
    return (
      <main className="loading-screen" aria-label="Loading Javaneh">
        <span className="loading-mark">
          <Sprout size={24} />
        </span>
        <span>Getting your idea space ready…</span>
      </main>
    );

  return (
    <main
      className={`app-shell${screen === "home" ? " landing-shell" : screen === "intake" ? " intake-shell" : screen === "dashboard" ? " dashboard-shell" : ["details", "verify", "develop", "review", "submitted"].includes(screen) ? " glass-shell" : ""}`}
    >
      <header
        className={`topbar${screen === "home" || screen === "intake" ? " landing-topbar" : ""}`}
      >
        <button
          className={`brand${screen === "home" || screen === "intake" ? " landing-brand" : ""}`}
          onClick={() => setScreen("home")}
          aria-label="Javaneh home"
        >
          <span
            className={`brand-mark${screen === "home" || screen === "intake" ? " landing-brand-mark" : ""}`}
          >
            {screen === "home" || screen === "intake" ? (
              <Sprout size={38} strokeWidth={1.8} aria-hidden="true" />
            ) : (
              <Flower2 size={22} strokeWidth={1.8} />
            )}
          </span>
          <span className="brand-copy">
            <span className="brand-name">
              Javaneh{screen !== "home" && <span className="brand-period">.</span>}
            </span>
            {(screen === "home" || screen === "intake") && (
              <>
                <span className="brand-subtitle">National Social Innovation Event</span>
                <span className="landing-demo-badge">Local demo</span>
              </>
            )}
          </span>
        </button>
        {screen === "home" || screen === "intake" ? (
          <>
            <nav className="landing-nav" aria-label="Main navigation">
              <a
                className={screen === "home" ? "is-active" : ""}
                href={screen === "home" ? "#about" : "#intake-stage"}
              >
                About
              </a>
              <a
                className={screen === "intake" ? "is-active" : ""}
                href={screen === "home" ? "#how-it-works" : "#intake-conversation"}
              >
                How It Works
              </a>
              <a href={screen === "home" ? "#benefits" : "#intake-tokens"}>
                Benefits
              </a>
              <a href={screen === "home" ? "#faq" : "#intake-faq"}>FAQ</a>
            </nav>
            <div className="landing-actions">
              <button
                className="landing-signin"
                onClick={() => setScreen("dashboard")}
              >
                <BookOpenText size={17} aria-hidden="true" />
                <span>My Ideas</span>
              </button>
              <button
                className="landing-signup"
                onClick={() => {
                  if (screen === "home") {
                    document.getElementById("idea-seed")?.focus();
                  } else {
                    document.getElementById("initial-answer")?.focus();
                  }
                }}
              >
                {screen === "home" ? "Start an Idea" : "Continue"}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          </>
        ) : (
          <div className="topbar-right">
            <span className="local-chip">
              <span className="status-dot" />
              Local demo
            </span>
            {state.profile?.verified && (
              <button
                className="text-button"
                onClick={() => setScreen("dashboard")}
              >
                <BookOpenText size={17} /> My ideas
              </button>
            )}
          </div>
        )}
      </header>

      <div className={`notice-strip${screen === "intake" ? " intake-hidden" : ""}`}>
        <ShieldCheck size={15} />
        <span>{labels.localNotice}</span>
      </div>
      {storageError && (
        <p className="storage-error" role="alert">
          <CircleHelp size={16} />
          <span>{storageError}</span>
        </p>
      )}
      <div
        className={`token-reward-slot${screen === "home" && !tokenNotice ? " landing-token-slot" : ""}`}
      >
        {tokenNotice && (
          <div className="token-reward" aria-live="polite" aria-atomic="true">
            <Sparkles size={15} aria-hidden="true" />
            <span>{tokenNotice}</span>
          </div>
        )}
      </div>
      <span className="sr-only" aria-live="polite">
        {activeIdea
          ? `${formatNumber(totalTokens)} tokens earned for this idea.`
          : ""}
      </span>

      {screen === "home" && (
        <section className="home-view">
          <div className="home-heading landing-heading" id="about">
            <h1>
              Javaneh
              <Sprout className="landing-title-sprout" size={40} strokeWidth={2} aria-hidden="true" />
            </h1>
            <p className="landing-subtitle">
              National <em>Social Innovation</em> Event
            </p>
            <p className="home-intro landing-intro">
              Share your ideas. Build a better tomorrow together.
            </p>
          </div>
          <div className="composer-wrap landing-composer" id="how-it-works">
            <div className="landing-entry-row">
              <span className="landing-idea-icon">
                <Lightbulb size={42} strokeWidth={1.7} aria-hidden="true" />
              </span>
              <span className="landing-entry-divider" aria-hidden="true" />
              <div className="landing-input-wrap">
                <label className="sr-only" htmlFor="idea-seed">
                  Describe your idea in your own words
                </label>
                <textarea
                  id="idea-seed"
                  className="seed-input landing-seed-input"
                  placeholder="Write your idea here..."
                  value={seed}
                  onChange={(event) => {
                    setSeed(event.target.value);
                    setFormError("");
                  }}
                  rows={1}
                  maxLength={1200}
                  dir="auto"
                  aria-describedby="seed-hint seed-error"
                />
              </div>
              <button
                className="primary-button composer-action landing-submit"
                onClick={startIdea}
                disabled={!seed.trim() || !canCreateIdea(state)}
                aria-label="Start developing your idea"
              >
                <ArrowRight size={30} strokeWidth={1.8} aria-hidden="true" />
              </button>
            </div>
            <div className="composer-meta landing-composer-meta">
              <span id="seed-hint">
                <Info size={16} aria-hidden="true" />
                Share your idea and take the first step toward innovation
              </span>
              {seed && <span>{formatNumber(seed.length)}/1,200</span>}
            </div>
            {formError && (
              <p className="inline-error" id="seed-error" role="alert">
                {formError}
              </p>
            )}
            {!formError && (
              <p className="sr-only" id="seed-error">
                Describe a community problem or idea. Maximum 1,200 characters.
              </p>
            )}
            {!canCreateIdea(state) && (
              <p className="capacity-note">
                This browser has reached its limit. Open one of your saved ideas to continue.
              </p>
            )}
          </div>
          <div className="landing-benefits" id="benefits">
            <div className="landing-benefit">
              <Users size={27} strokeWidth={2.2} aria-hidden="true" />
              <span>Open to Everyone</span>
            </div>
            <div className="landing-benefit">
              <Star size={27} strokeWidth={2.2} aria-hidden="true" />
              <span>Earn Tokens</span>
            </div>
            <div className="landing-benefit">
              <Check size={27} strokeWidth={2.2} aria-hidden="true" />
              <span>Track Progress</span>
            </div>
            <div className="landing-benefit">
              <Sprout size={27} strokeWidth={2.2} aria-hidden="true" />
              <span>Make an Impact</span>
            </div>
          </div>
          <a className="landing-scroll" href="#faq" aria-label="Scroll to frequently asked questions">
            <ChevronDown size={20} aria-hidden="true" />
          </a>
          <section className="landing-faq" id="faq" aria-labelledby="landing-faq-title">
            <p className="landing-faq-kicker">A good idea can start small</p>
            <h2 id="landing-faq-title">Frequently asked questions</h2>
            <details>
              <summary>Where is my idea saved?</summary>
              <p>
                Your ideas and answers are saved only in this browser. They are
                not synced across devices or sent to event organizers.
              </p>
            </details>
            <details>
              <summary>Does my idea need to be complete?</summary>
              <p>
                No. Start with a problem you have noticed; you can shape the
                idea step by step with practical questions.
              </p>
            </details>
          </section>
        </section>
      )}

      {screen === "details" && (
        <section className="form-view narrow-view details-view">
          <button className="back-link" onClick={() => setScreen("home")}>
            <ArrowLeft size={16} /> Back to your idea
          </button>
          <div className="eyebrow">
            <span className="eyebrow-line" />
            Before you begin
          </div>
          <h1>
            A little about <em>you.</em>
          </h1>
          <p className="form-intro">
            Your name identifies your profile in this browser. Your mobile
            number and national ID are requested only for this demo step.
          </p>
          <div className="privacy-panel">
            <ShieldCheck size={19} />
            <p>
              <b>Privacy reminder</b>
              <br />
              No SMS is sent, and no identity service is contacted. Your
              national ID and mobile number are not saved or sent and are
              discarded after this step. Only your name and verification status
              remain in this browser.
            </p>
          </div>
          <form className="details-form" onSubmit={submitDetails} noValidate>
            <div className="field-row">
              <label>
                First name
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                  dir="auto"
                  required
                />
              </label>
              <label>
                Last name
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                  dir="auto"
                  required
                />
              </label>
            </div>
            <label>
              National ID
              <input
                value={nationalId}
                onChange={(e) =>
                  setNationalId(
                    normalizeDigits(e.target.value).replace(/\D/g, ""),
                  )
                }
                inputMode="numeric"
                autoComplete="off"
                dir="ltr"
                required
                minLength={6}
                maxLength={24}
              />
            </label>
            <label>
              Mobile number
              <input
                value={mobile}
                onChange={(e) =>
                  setMobile(normalizeDigits(e.target.value).replace(/\D/g, ""))
                }
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
                required
              />
            </label>
            {formError && (
              <p className="inline-error" role="alert">
                {formError}
              </p>
            )}
            <button className="primary-button" type="submit">
              Continue <ArrowRight size={18} />
            </button>
          </form>
        </section>
      )}

      {screen === "verify" && (
        <section className="form-view narrow-view verify-view">
          <button
            className="back-link"
            onClick={() => {
              setScreen("details");
              setFormError("");
            }}
          >
            <ArrowLeft size={16} /> Back to your details
          </button>
          <div className="step-icon">
            <ShieldCheck size={24} />
          </div>
          <div className="eyebrow">
            <span className="eyebrow-line" />
            Demo verification
          </div>
          <h1>
            Continue with any code <em>you choose.</em>
          </h1>
          <p className="form-intro">
            No real text message will be sent. This is a demo code; enter any 4–8 digit number to continue.
          </p>
          <div className="masked-line">
            Mobile number <bdi dir="ltr">{maskedMobile}</bdi>
          </div>
          <form className="details-form" onSubmit={verifyCode} noValidate>
            <label htmlFor="verification-code">
              Verification code
              <input
                id="verification-code"
                value={code}
                onChange={(e) =>
                  setCode(normalizeDigits(e.target.value).replace(/\D/g, "").slice(0, 8))
                }
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="For example, 1234"
                dir="ltr"
                required
              />
            </label>
            {formError && (
              <p className="inline-error" role="alert">
                {formError}
              </p>
            )}
            <button className="primary-button" type="submit">
              Continue <ArrowRight size={18} />
            </button>
          </form>
        </section>
      )}

      {screen === "intake" && activeIdea && (
        <section className="journey-view intake-view">
          <button className="back-link intake-exit" onClick={() => setScreen("dashboard")}>
            <ArrowLeft size={16} /> Save and exit
          </button>
          <div className="journey-head intake-head" id="intake-stage">
            <div>
              <div className="eyebrow intake-eyebrow">
                <span className="eyebrow-line" />
                Stage 1 · Initial intake
              </div>
              <h1>
                Let’s <em>shape</em> your idea.
              </h1>
              <p className="intake-intro">
                A great idea can make a difference. Tell us about your idea in your own words.
              </p>
            </div>
            <span className="step-count">
              {formatNumber(Math.min(initialIndex + 1, 5))} <span>/ 5</span>
            </span>
          </div>
          <div
            className="progress-track"
            role="progressbar"
            aria-label="Initial intake progress"
            aria-valuemin={0}
            aria-valuemax={5}
            aria-valuenow={Math.min(initialIndex, 5)}
          >
            <span
              style={{ width: `${Math.min((initialIndex / 5) * 100, 100)}%` }}
            />
          </div>
          <div className="mentor-layout intake-layout">
            <div className="mentor-main intake-main" id="intake-conversation">
              <div className="mentor-label intake-mentor-label">
                <span className="mentor-avatar">
                  <Lightbulb size={26} strokeWidth={1.8} aria-hidden="true" />
                </span>
                <span>Idea conversation</span>
                <span className="intake-start-badge">Start here</span>
              </div>
              <div className="mentor-message intake-mentor-message" aria-live="polite">
                {!busy && <Sparkles size={16} aria-hidden="true" />}
                {busy ? (
                  <span className="thinking">
                    <i />
                    <i />
                    <i /> Preparing the next question
                  </span>
                ) : (
                  mentorMessage.slice(0, 120)
                )}
              </div>
              <div className="question-card">
                <div className="intake-question-heading">
                  <span className="intake-question-icon">
                    <CircleHelp size={25} aria-hidden="true" />
                  </span>
                  <div>
                    <span className="question-kicker">
                      {initialIndex < 5
                        ? displaySection(currentQuestion.section)
                        : "Ready to review"}
                    </span>
                    <h2>
                      {initialIndex < 5
                        ? currentQuestion.question
                        : "Your initial summary is ready."}
                    </h2>
                  </div>
                </div>
                {initialIndex < 5 &&
                activeIdea.pendingTurn?.stage === "initial" ? (
                  <div className="pending-answer">
                    <p className="review-hint">
                      Your answer is saved:
                    </p>
                    <p dir="auto">
                      <bdi>{activeIdea.pendingTurn.answer}</bdi>
                    </p>
                    {formError && (
                      <p className="inline-error" role="alert">
                        {formError}
                      </p>
                    )}
                    <button
                      className="primary-button"
                      onClick={() => answerCurrent("initial")}
                      disabled={busy}
                    >
                      Try again <ArrowRight size={18} />
                    </button>
                    {pendingAnswer && (
                      <button
                        className="text-button"
                        onClick={() => editAnswer(activeIdea, pendingAnswer)}
                        disabled={busy}
                      >
                        Edit answer
                      </button>
                    )}
                  </div>
                ) : initialIndex < 5 ? (
                  <>
                    <label className="sr-only" htmlFor="initial-answer">
                      Your answer
                    </label>
                    <textarea
                      id="initial-answer"
                      value={draftAnswer || activeIdea.draftAnswer || ""}
                      onChange={(e) => {
                        setDraftAnswer(e.target.value);
                        updateIdea({
                          ...activeIdea,
                          draftAnswer: e.target.value,
                        });
                      }}
                      rows={4}
                      maxLength={1500}
                      dir="auto"
                      placeholder="Take your time. A few honest sentences are enough."
                    />
                    <div className="answer-tools">
                      <button
                        className="subtle-button"
                        onClick={() =>
                          answerCurrent(
                            "initial",
                            "I’m not sure yet. I’d like to learn more before deciding.",
                          )
                        }
                      >
                        I’m not sure yet <CircleHelp size={15} />
                      </button>
                      <span>
                        {formatNumber((draftAnswer || activeIdea.draftAnswer || "").length)}
                        /1,500
                      </span>
                    </div>
                    {formError && (
                      <p className="inline-error" role="alert">
                        {formError}
                      </p>
                    )}
                    <button
                      className="primary-button"
                      onClick={() => answerCurrent("initial")}
                      disabled={busy}
                    >
                      Save answer <ArrowRight size={18} />
                    </button>
                  </>
                ) : (
                  <>
                    <p className="review-hint">
                      Review and edit this summary before confirming your initial intake.
                    </p>
                    <textarea
                      value={
                        reviewDraft.summary ??
                        displayIntakeSummary(activeIdea)
                      }
                      onChange={(e) =>
                        setReviewDraft({
                          ...reviewDraft,
                          summary: e.target.value,
                        })
                      }
                      rows={8}
                      aria-label="Edit your initial idea summary"
                      dir="auto"
                    />
                    {formError && (
                      <p className="inline-error" role="alert">
                        {formError}
                      </p>
                    )}
                    <button className="primary-button" onClick={confirmInitial}>
                      Confirm initial intake <Check size={18} />
                    </button>
                  </>
                )}
              </div>
            </div>
            <aside className="journey-side intake-side">
              <div className="intake-starting-point">
                <div className="intake-starting-icon">
                  <Sprout size={24} aria-hidden="true" />
                </div>
                <div className="intake-starting-copy">
                  <div className="side-section-title">
                    <span>Your starting point</span>
                  </div>
                  {seedEditOpen ? (
                    <form
                      className="intake-seed-edit"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const nextSeed = seedEditDraft.trim();
                        if (!nextSeed) {
                          setFormError("Your starting idea cannot be empty.");
                          return;
                        }
                        const title = nextSeed
                          .replace(/\s+/g, " ")
                          .slice(0, 48)
                          .replace(/[.!?]$/, "") || "Untitled idea";
                        updateIdea({ ...activeIdea, seed: nextSeed, title });
                        setSeedEditOpen(false);
                        setFormError("");
                      }}
                    >
                      <label className="sr-only" htmlFor="starting-point-edit">
                        Edit your starting idea
                      </label>
                      <textarea
                        id="starting-point-edit"
                        value={seedEditDraft}
                        onChange={(event) => {
                          setSeedEditDraft(event.target.value);
                          setFormError("");
                        }}
                        maxLength={1200}
                        rows={3}
                        required
                        dir="auto"
                      />
                      {formError && (
                        <p className="inline-error" role="alert">
                          {formError}
                        </p>
                      )}
                      <div className="intake-seed-edit-actions">
                        <button
                          className="subtle-button"
                          type="button"
                          onClick={() => {
                            setSeedEditOpen(false);
                            setFormError("");
                          }}
                        >
                          Cancel
                        </button>
                        <button className="primary-button" type="submit">
                          Save idea
                        </button>
                      </div>
                    </form>
                  ) : (
                    <p className="seed-quote">
                      “<bdi dir="auto">{activeIdea.seed}</bdi>”
                    </p>
                  )}
                </div>
                {!seedEditOpen && (
                  <button
                    className="intake-edit-seed"
                    aria-label="Edit your starting idea"
                    onClick={() => {
                      setSeedEditDraft(activeIdea.seed);
                      setSeedEditOpen(true);
                      setFormError("");
                    }}
                  >
                    <Pencil size={20} aria-hidden="true" />
                  </button>
                )}
              </div>
              <div className="side-divider" />
              <div className="side-section-title">
                <span>Initial intake progress</span>
                <span>{formatNumber(Math.min(initialIndex, 5))}/5</span>
              </div>
              <div className="step-list">
                {intakeQuestions.map((item, index) => (
                  <div
                    className={`step-item ${index < initialIndex ? "done" : index === initialIndex ? "current" : ""}`}
                    key={item.section}
                  >
                    <span className="step-indicator">
                      {index < initialIndex ? (
                        <Check size={12} />
                      ) : (
                        formatNumber(index + 1)
                      )}
                    </span>
                    <span>{displaySection(item.section)}</span>
                  </div>
                ))}
              </div>
              <div className="token-mini intake-token-mini" id="intake-tokens">
                <span className="token-glyph"><Sparkles size={16} aria-hidden="true" /></span>
                <span>
                  <b>{formatNumber(totalTokens)} tokens</b>
                  <small>Tokens are a demo-only score.</small>
                </span>
              </div>
              <div className="answer-history">
                {activeIdea.answers
                  .filter((answer) =>
                    intakeQuestions.some(
                      (question) => question.section === answer.section,
                    ),
                  )
                  .map((answer) => (
                    <div className="answer-history-row" key={answer.section}>
                      <span>{displaySection(answer.section)}</span>
                      <button
                        className="text-button"
                        onClick={() => editAnswer(activeIdea, answer)}
                        aria-label={`Edit your answer about ${displaySection(answer.section)}`}
                      >
                        Edit
                      </button>
                    </div>
                  ))}
              </div>
              <details className="intake-privacy" id="intake-faq">
                <summary>How is my idea saved?</summary>
                <p>{labels.localNotice}</p>
              </details>
            </aside>
          </div>
        </section>
      )}

      {screen === "dashboard" && (
        <section className="dashboard-view">
          <aside className="dashboard-sidebar" aria-label="Workspace navigation">
            <button
              className="dashboard-sidebar-brand"
              onClick={() => setScreen("home")}
              aria-label="Javaneh home"
            >
              <span className="dashboard-sidebar-mark">
                <Sprout size={38} aria-hidden="true" />
              </span>
              <b>Javaneh</b>
              <span>National Social<br />Innovation Event</span>
            </button>
            <nav className="dashboard-nav" aria-label="Workspace">
              <button
                className="active"
                onClick={() =>
                  document.getElementById("workspace-top")?.scrollIntoView({
                    behavior: "smooth",
                  })
                }
              >
                <House size={18} aria-hidden="true" /> Workspace
              </button>
              <button
                onClick={() =>
                  document.getElementById("ideas-list")?.scrollIntoView({
                    behavior: "smooth",
                  })
                }
              >
                <FolderOpen size={18} aria-hidden="true" /> My Ideas
              </button>
              <button
                onClick={() =>
                  document.getElementById("token-history")?.scrollIntoView({
                    behavior: "smooth",
                  })
                }
              >
                <Gift size={18} aria-hidden="true" /> Rewards
              </button>
              <button
                type="button"
                disabled
                title="Community features are not available in this local demo."
              >
                <Users size={18} aria-hidden="true" /> Community
              </button>
              <a href="#workspace-faq">
                <CircleHelp size={18} aria-hidden="true" /> FAQ
              </a>
            </nav>
            <div className="dashboard-sidebar-promo">
              <Sprout size={23} aria-hidden="true" />
              <b>Grow your ideas.</b>
              <span>Make an impact.</span>
            </div>
          </aside>

          <div className="dashboard-main-content" id="workspace-top">
            <div className="dashboard-utility">
              <span className="dashboard-local-state">
                <span className="status-dot" />
                Saved in this browser
              </span>
              <span
                className="dashboard-bell"
                aria-label="Notifications are not configured"
              >
                <Bell size={19} aria-hidden="true" />
              </span>
              <span
                className="dashboard-avatar"
                aria-label={state.profile?.name || "Javaneh profile"}
              >
                {profileInitials}
              </span>
            </div>

            <div className="dashboard-hero">
              <div className="dashboard-head">
                <div>
                  <div className="eyebrow dashboard-eyebrow">
                    <span className="eyebrow-line" />
                    Your Workspace
                  </div>
                  <h1>
                    {state.profile?.name ? (
                      <>
                        Welcome,{" "}
                        <bdi dir="auto">{state.profile.name.split(" ")[0]}</bdi>.
                      </>
                    ) : (
                      <>Welcome, <em>innovator.</em></>
                    )}
                  </h1>
                  <p className="form-intro">
                    Your work is saved in this browser. Pick up where you left off.
                  </p>
                </div>
              </div>
              <div className="dashboard-hero-art" aria-hidden="true">
                <span className="dashboard-orbit dashboard-orbit-one" />
                <span className="dashboard-orbit dashboard-orbit-two" />
                <span className="dashboard-orb">
                  <Sprout size={76} strokeWidth={1.5} />
                </span>
                <span className="dashboard-soil" />
              </div>
            </div>

            <div className="dashboard-summary">
              <article className="dashboard-stat-card idea-stat-card">
                <span className="dashboard-stat-icon">
                  <Lightbulb size={22} aria-hidden="true" />
                </span>
                <div className="dashboard-stat-copy">
                  <b>{formatNumber(activeIdeas.length)} <small>/ 3</small></b>
                  <span>Ideas in progress</span>
                  <small>
                    {formatNumber(Math.max(0, 3 - totalIdeas))} more{" "}
                    {3 - totalIdeas === 1 ? "idea" : "ideas"} available
                  </small>
                </div>
                <span className="dashboard-sparkline" aria-hidden="true" />
                <a href="#ideas-list" aria-label="View your ideas">
                  <ArrowRight size={14} aria-hidden="true" />
                </a>
              </article>
              <article className="dashboard-stat-card token-stat-card">
                <span className="dashboard-stat-icon">
                  <Database size={22} aria-hidden="true" />
                </span>
                <div className="dashboard-stat-copy">
                  <b>{formatNumber(tokenTotal)}</b>
                  <span>Tokens earned</span>
                  <small>Demo-only score · Keep going!</small>
                </div>
                <BarChart3 className="dashboard-stat-chart" size={35} aria-hidden="true" />
              </article>
              <article className="dashboard-stat-card progress-stat-card">
                <span className="dashboard-stat-icon">
                  <Star size={22} aria-hidden="true" />
                </span>
                <div className="dashboard-stat-copy">
                  <span>Your progress</span>
                  <b>
                    {formatNumber(Math.round(averageProgress / 10))}{" "}
                    <small>/ 10 points</small>
                  </b>
                  <span
                    className="dashboard-progress-track"
                    role="progressbar"
                    aria-label="Average idea progress"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={averageProgress}
                  >
                    <i style={{ width: `${averageProgress}%` }} />
                  </span>
                </div>
              </article>
              <button
                className="dashboard-stat-card dashboard-new-idea-card"
                onClick={() => {
                  setScreen("home");
                  setSeed("");
                }}
                disabled={!canCreateIdea(state)}
              >
                <span className="dashboard-add-icon">
                  <Plus size={26} aria-hidden="true" />
                </span>
                <span className="dashboard-new-idea-copy">
                  <b>Start a new idea</b>
                  <small>Turn your inspiration into an impactful idea.</small>
                </span>
                <span className="dashboard-circle-arrow">
                  <ArrowRight size={16} aria-hidden="true" />
                </span>
              </button>
            </div>
          {formError && (
            <p className="inline-error" role="alert">
              {formError}
            </p>
          )}
          <div className="dashboard-content-grid">
            <section className="dashboard-ideas-panel" id="ideas-list">
              <div className="ideas-header dashboard-ideas-header">
                <div className="dashboard-ideas-title">
                  <FolderOpen size={24} aria-hidden="true" />
                  <div>
                    <h2>Your Ideas</h2>
                    <span>
                      {formatNumber(totalIdeas)}{" "}
                      {totalIdeas === 1 ? "idea" : "ideas"} saved on this device
                    </span>
                  </div>
                </div>
                <details className="dashboard-saved-details" id="workspace-faq">
                  <summary>
                    Saved in this browser <ChevronDown size={15} aria-hidden="true" />
                  </summary>
                  <p>{labels.localNotice}</p>
                </details>
              </div>
          {totalIdeas === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">
                <Sprout size={24} />
              </span>
              <h3>Your first idea is waiting.</h3>
              <p>
                Start with something you have noticed. Your idea does not need to be complete.
              </p>
              <button
                className="primary-button"
                onClick={() => setScreen("home")}
              >
                Write an idea <ArrowRight size={18} />
              </button>
            </div>
          ) : (
            <div className="idea-list">
              {state.ideas.map((idea, index) => (
                <article className="idea-row" key={idea.id}>
                  <div className="idea-number">{formatNumber(index + 1).padStart(2, "0")}</div>
                  <div className="idea-content">
                    <div className="idea-title-line">
                      <h3><bdi dir="auto">{idea.title}</bdi></h3>
                      <span className={`status-pill status-${idea.status}`}>
                        {idea.status === "submitted" && <Check size={12} />}
                        {labels.statuses[idea.status]}
                      </span>
                    </div>
                    <p className="idea-seed"><bdi dir="auto">{idea.seed}</bdi></p>
                    <div className="idea-meta">
                      <span>
                        <Clock3 size={14} />
                        Updated: {formatDate(idea.updatedAt)}
                      </span>
                      <span>
                        <Sparkles size={14} />
                        {formatNumber(idea.tokens.reduce(
                          (sum, item) => sum + item.amount,
                          0,
                        ))}{" "}
                        tokens
                      </span>
                      <span>
                        <span
                          className="progress-mini"
                          role="progressbar"
                          aria-label={`Progress for ${idea.title}`}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={getProgress(idea)}
                        >
                          <i style={{ width: `${getProgress(idea)}%` }} />
                        </span>
                        {formatNumber(getProgress(idea))}% complete
                      </span>
                    </div>
                    <div className="idea-progress-track">
                      <i style={{ width: `${getProgress(idea)}%` }} />
                    </div>
                    <details
                      className="token-history"
                      id={index === 0 ? "token-history" : undefined}
                    >
                      <summary>Token history ({formatNumber(idea.tokens.length)})</summary>
                      {idea.tokens.length ? (
                        <ul>
                          {idea.tokens.map((token) => (
                            <li key={token.dedupeKey}>
                              <span>{displayTokenReason(token.reason)}</span>
                              <b>+{formatNumber(token.amount)}</b>
                              <time className="token-date" dateTime={token.createdAt}>
                                {formatDate(token.createdAt)}
                              </time>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p>No tokens earned yet. You earn tokens for each thoughtful answer.</p>
                      )}
                    </details>
                  </div>
                  <div className="idea-actions">
                    {idea.status === "submitted" ? (
                      <button
                        className="secondary-button"
                        onClick={() => {
                          setActiveId(idea.id);
                          setScreen("submitted");
                        }}
                      >
                        View proposal <FileText size={16} />
                      </button>
                    ) : idea.status === "awaiting-confirmation" ? (
                      <button
                        className="secondary-button"
                        onClick={() => beginReview(idea)}
                      >
                        Return to review <ArrowRight size={16} />
                      </button>
                    ) : (
                      <button
                        className="secondary-button"
                        onClick={() => routeToIdea(idea)}
                      >
                        {idea.status === "initial"
                          ? (idea.intakeIndex ?? 0) < 5
                            ? "Continue initial intake"
                            : "Review initial intake"
                          : (idea.developmentIndex ?? 0) < 10
                            ? "Continue developing your idea"
                            : "Continue your idea journey"}
                        <ArrowRight size={16} />
                      </button>
                    )}
                    <button
                      className="delete-idea-button"
                      onClick={() => deleteIdea(idea)}
                      aria-label={`Delete idea ${idea.title}`}
                    >
                      Delete idea <Trash2 size={16} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
          {totalIdeas === 3 && (
            <p className="limit-note">
              <LockKeyhole size={15} />
              You have reached the three-idea limit. Your existing work remains available in this browser.
            </p>
          )}
            </section>
            <aside className="dashboard-mentor-card">
              <div className="dashboard-mentor-heading">
                <Sparkles size={26} aria-hidden="true" />
                <div>
                  <h2>Your Mentor</h2>
                  <span>Guided idea development</span>
                </div>
              </div>
              <p>
                Get thoughtful, step-by-step guidance as you shape and develop
                your idea.
              </p>
              <button
                className="dashboard-mentor-action"
                onClick={() => {
                  if (activeIdeas.length) {
                    routeToIdea(activeIdeas[0]);
                  } else {
                    setScreen("home");
                    setSeed("");
                  }
                }}
                disabled={!activeIdeas.length && !canCreateIdea(state)}
              >
                <MessageCircle size={18} aria-hidden="true" />
                <span>
                  {activeIdeas.length ? "Continue with Mentor" : "Start with Mentor"}
                </span>
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </aside>
          </div>
          {(storageError || tokenNotice) && (
            <div
              className={`dashboard-feedback${storageError ? " is-warning" : ""}`}
              role={storageError ? "alert" : "status"}
            >
              {storageError ? (
                <ShieldCheck size={18} aria-hidden="true" />
              ) : (
                <Sparkles size={18} aria-hidden="true" />
              )}
              <span>{storageError || tokenNotice}</span>
              <a href="#workspace-faq">
                Learn more <ArrowUpRight size={15} aria-hidden="true" />
              </a>
            </div>
          )}
          <p className="dashboard-score-note">
            Tokens are a demo-only score and are not an official event judging score.
          </p>
          </div>
        </section>
      )}

      {screen === "develop" && activeIdea && (
        <section className="journey-view develop-view">
          <button className="back-link" onClick={() => setScreen("dashboard")}>
            <ArrowLeft size={16} /> Save and exit
          </button>
          <div className="journey-head">
            <div>
              <div className="eyebrow">
                <span className="eyebrow-line" />
                Stage 2 · Idea development
              </div>
              <h1>
                Make your idea <em>practical.</em>
              </h1>
            </div>
            <span className="step-count">
              {formatNumber(Math.min(devIndex + 1, 10))} <span>/ 10</span>
            </span>
          </div>
          <div
            className="progress-track"
            role="progressbar"
            aria-label="Idea development progress"
            aria-valuemin={0}
            aria-valuemax={10}
            aria-valuenow={Math.min(devIndex, 10)}
          >
            <span
              style={{ width: `${Math.min((devIndex / 10) * 100, 100)}%` }}
            />
          </div>
          <div className="mentor-layout">
            <div className="mentor-main">
              <div className="mentor-label">
                <span className="mentor-avatar">
                  <Sparkles size={16} />
                </span>
                <span>Idea conversation</span>
              </div>
              <div className="mentor-message" aria-live="polite">
                {busy ? (
                  <span className="thinking">
                    <i />
                    <i />
                    <i /> Preparing the next question
                  </span>
                ) : (
                  mentorMessage.slice(0, 120)
                )}
              </div>
              <div className="question-card">
                <span className="question-kicker">
                  {devIndex < 10 ? displaySection(devQuestion.section) : "Proposal ready"}
                </span>
                <h2>
                  {devIndex < 10
                    ? devQuestion.question
                    : "You have a thoughtful foundation for your proposal."}
                </h2>
                {devIndex < 10 &&
                activeIdea.pendingTurn?.stage === "development" ? (
                  <div className="pending-answer">
                    <p className="review-hint">
                      Your answer is saved:
                    </p>
                    <p dir="auto">
                      <bdi>{activeIdea.pendingTurn.answer}</bdi>
                    </p>
                    {formError && (
                      <p className="inline-error" role="alert">
                        {formError}
                      </p>
                    )}
                    <button
                      className="primary-button"
                      onClick={() => answerCurrent("development")}
                      disabled={busy}
                    >
                      Try again <ArrowRight size={18} />
                    </button>
                    {pendingAnswer && (
                      <button
                        className="text-button"
                        onClick={() => editAnswer(activeIdea, pendingAnswer)}
                        disabled={busy}
                      >
                        Edit answer
                      </button>
                    )}
                  </div>
                ) : devIndex < 10 ? (
                  <>
                    <label className="sr-only" htmlFor="development-answer">
                      Your answer
                    </label>
                    <textarea
                      id="development-answer"
                      value={draftAnswer || activeIdea.draftAnswer || ""}
                      onChange={(e) => {
                        setDraftAnswer(e.target.value);
                        updateIdea({
                          ...activeIdea,
                          draftAnswer: e.target.value,
                        });
                      }}
                      rows={4}
                      maxLength={1500}
                      dir="auto"
                      placeholder="Share what you know, or note what you still need to explore."
                    />
                    <div className="answer-tools">
                      <button
                        className="subtle-button"
                        onClick={() =>
                          answerCurrent(
                            "development",
                            "I’m not sure yet. I’ll ask the people affected what would work for them.",
                          )
                        }
                      >
                        I’m not sure yet / This won’t work for me <CircleHelp size={15} />
                      </button>
                      <span>
                        {formatNumber((draftAnswer || activeIdea.draftAnswer || "").length)}
                        /1,500
                      </span>
                    </div>
                    {formError && (
                      <p className="inline-error" role="alert">
                        {formError}
                      </p>
                    )}
                    <button
                      className="primary-button"
                      onClick={() => answerCurrent("development")}
                      disabled={busy}
                    >
                      Save answer <ArrowRight size={18} />
                    </button>
                    <button
                      className="text-button proposal-shortcut"
                      onClick={() => beginReview(activeIdea)}
                    >
                      Build a proposal from current information <ChevronRight size={15} />
                    </button>
                  </>
                ) : (
                  <>
                    <p className="review-hint">
                      You can return to any section and add more information whenever you learn something new.
                    </p>
                    <button
                      className="primary-button"
                      onClick={() => beginReview(activeIdea)}
                    >
                      Review proposal <FileText size={18} />
                    </button>
                  </>
                )}
              </div>
            </div>
            <aside className="journey-side">
              <div className="side-section-title">
                <span>Idea in progress</span>
                <Lightbulb size={16} />
              </div>
              <p className="seed-quote">“<bdi dir="auto">{activeIdea.seed}</bdi>”</p>
              <div className="side-divider" />
              <div className="side-section-title">
                <span>Idea development guide</span>
                <span>{formatNumber(Math.min(devIndex, 10))}/10</span>
              </div>
              <div className="step-list">
                {developmentQuestions.map((item, index) => (
                  <div
                    className={`step-item ${index < devIndex ? "done" : index === devIndex ? "current" : ""}`}
                    key={item.section}
                  >
                    <span className="step-indicator">
                      {index < devIndex ? (
                        <Check size={12} />
                      ) : (
                        formatNumber(index + 1)
                      )}
                    </span>
                    <span>{displaySection(item.section)}</span>
                  </div>
                ))}
              </div>
              <div className="token-mini">
                <span className="token-glyph"><Sparkles size={16} aria-hidden="true" /></span>
                <span>
                  <b>{formatNumber(totalTokens)} tokens</b>
                  <small>2 per thoughtful answer · 5 for completing each stage</small>
                </span>
              </div>
              <div className="answer-history">
                {activeIdea.answers.map((answer) => (
                  <div className="answer-history-row" key={answer.section}>
                    <span>{displaySection(answer.section)}</span>
                    <button
                      className="text-button"
                      onClick={() => editAnswer(activeIdea, answer)}
                      aria-label={`Edit your answer about ${displaySection(answer.section)}`}
                    >
                      Edit
                    </button>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>
      )}

      {screen === "review" && activeIdea && (
        <section className="review-view">
          <button className="back-link" onClick={() => setScreen("dashboard")}>
            <ArrowLeft size={16} /> Save and exit
          </button>
          <div className="eyebrow">
            <span className="eyebrow-line" />
            Final review
          </div>
          <h1>
            Your idea, <em>clear and considered.</em>
          </h1>
          <p className="form-intro">
            This draft is based on your answers. “Not explored yet” marks
            questions that are still open. Edit any section before choosing
            what to do next.
          </p>
          <div className="review-origin">
            <span>
              <Users size={16} />
              Based on information you provided
            </span>
            <p>
              Starting idea: “<bdi dir="auto">{activeIdea.seed}</bdi>”
            </p>
          </div>
          <div className="proposal-grid">
            {[
              ["title", "Proposal title"],
              ["summary", "Short summary"],
              ["problem", "Problem and evidence"],
              ["beneficiaries", "People who benefit"],
              ["solution", "Proposed solution"],
              ["impact", "Expected social impact"],
              ["evidence", "Evidence and assumptions"],
              ["feasibility", "Feasibility and resources"],
              ["pilot", "Pilot and next steps"],
              ["measurement", "Measurement"],
              ["risks", "Risks and mitigations"],
              ["openQuestions", "Open questions"],
            ].map(([key, title]) => (
              <label className="proposal-field" key={key}>
                {title}
                <textarea
                  value={displayProposalText(reviewDraft[key] ?? "")}
                  onChange={(e) =>
                    setReviewDraft({ ...reviewDraft, [key]: e.target.value })
                  }
                  dir="auto"
                  rows={
                    key === "summary" || key === "problem" || key === "solution"
                      ? 3
                      : 2
                  }
                />
              </label>
            ))}
          </div>
          <div className="proposal-attribution">
            <Sparkles size={16} />
            <span>
              Javaneh organized your answers. The information comes from what
              you wrote; no statistics, partnerships, or outcomes were invented.
            </span>
          </div>
          {activeIdea.status === "awaiting-confirmation" &&
            activeIdea.confirmationDeadlineAt && (
              <div className="deadline-callout">
                <Clock3 size={18} />
                <div>
                  <b>
                    Review deadline: {formatDate(activeIdea.confirmationDeadlineAt)}
                  </b>
                  <span>
                    {formatNumber(remainingHours)}{" "}
                    {remainingHours === 1 ? "hour" : "hours"} remaining. If you
                    do not confirm or edit by then, the proposal will be marked
                    as submitted in this browser the next time you open the app
                    after the deadline.
                  </span>
                </div>
              </div>
            )}
          <div className="submit-actions">
            <button
              className="secondary-button"
              onClick={() => {
                saveProposal(activeIdea);
                setScreen("dashboard");
              }}
            >
              Save and return <ArrowLeft size={16} />
            </button>
            <button
              className="secondary-button"
              onClick={() => submitProposal("later")}
            >
              Submit with a 72-hour review period <Clock3 size={16} />
            </button>
            <button
              className="primary-button"
              onClick={() => submitProposal("now")}
            >
              Confirm and submit now <Send size={17} />
            </button>
          </div>
          <p className="local-limit-note">
            This demo saves submissions only in this browser; nothing is sent
            to event organizers. The 72-hour deadline is exact. There is no
            background timer, so expiration is checked while the app is open or
            the next time it loads.
          </p>
        </section>
      )}

      {screen === "submitted" && activeIdea && (
        <section className="success-view">
          <div className="success-icon">
            <BadgeCheck size={32} />
          </div>
          <div className="eyebrow">
            <span className="eyebrow-line" />
            Proposal submitted
          </div>
          <h1>
            {activeIdea.autoSubmitted
              ? "Your review period has ended."
              : <>Your proposal is <em>submitted.</em></>}
          </h1>
          <p className="success-copy">
            {activeIdea.autoSubmitted
              ? "After the deadline, your proposal status changed to submitted in this browser when you reopened the app."
              : "Your proposal and its submission time are saved in this browser."}
          </p>
          <div className="submitted-card">
            <div>
              <span>Idea</span>
              <b><bdi dir="auto">{activeIdea.title}</bdi></b>
            </div>
            <div>
              <span>Submitted</span>
              <b>
                {activeIdea.submittedAt
                  ? formatDate(activeIdea.submittedAt)
                  : "Saved in this browser"}
              </b>
            </div>
            <div>
              <span>Tokens earned</span>
              <b>
                {formatNumber(activeIdea.tokens.reduce(
                  (sum, entry) => sum + entry.amount,
                  0,
                ))}{" "}
                tokens <small>· Demo-only score</small>
              </b>
            </div>
          </div>
          <div className="submitted-proposal">
            <h2><bdi dir="auto">{activeIdea.proposal.title || activeIdea.title}</bdi></h2>
            {Object.entries(activeIdea.proposal)
              .filter(([key, value]) => key !== "title" && value.trim())
              .map(([key, value]) => (
                <section key={key}>
                  <h3>{proposalLabels[key] ?? key}</h3>
                  <p><bdi dir="auto">{displayProposalText(value)}</bdi></p>
                </section>
              ))}
          </div>
          <button
            className="primary-button"
            onClick={() => setScreen("dashboard")}
          >
            Back to my ideas <ArrowLeft size={17} />
          </button>
          <p className="local-limit-note">
            This proposal is saved only in this browser and is not sent to event organizers.
          </p>
        </section>
      )}

      <footer className="app-footer">
        <span>
          <Flower2 size={15} /> Javaneh · Grow ideas for social innovation
        </span>
        <button onClick={() => setScreen("dashboard")}>
          <BookOpenText size={14} /> My ideas <ArrowRight size={13} />
        </button>
        <span>Your information is saved only in this browser.</span>
      </footer>
    </main>
  );
}
