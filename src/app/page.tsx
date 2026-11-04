"use client";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BookOpenText,
  Check,
  ChevronDown,
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
  isPersianText,
  normalizeDigits,
} from "@/lib/locale";
import {
  applyDeadlineTransitions,
  awardToken,
  canCreateIdea,
  developmentProgressIndex,
  deferSubmission,
  emptyState,
  hasCompletedDevelopment,
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
  developmentOpeningQuestion,
  findAxis,
  questionContextForAxis,
  validateInterviewDecision,
  INTAKE_AXES as intakeQuestions,
  DEVELOPMENT_AXES as developmentQuestions,
  type InterviewRequest,
} from "@/lib/interviewer";
import { isValidOpeningQuestion } from "@/lib/opening-question";

type Screen =
  | "home"
  | "details"
  | "verify"
  | "intake"
  | "initial-confirmed"
  | "dashboard"
  | "develop"
  | "review"
  | "submitted";
const labels = {
  statuses: {
    initial: "تازه‌شروع‌شده",
    "in-development": "در حال توسعه",
    "awaiting-confirmation": "در انتظار تأیید",
    submitted: "ارسال‌شده",
  },
  localNotice:
    "ایده‌ها و پاسخ‌های شما فقط در فضای ذخیره‌سازی همین مرورگر نگهداری می‌شوند و بین دستگاه‌ها همگام‌سازی نمی‌شوند. پاک‌کردن داده‌های مرورگر ممکن است آن‌ها را برای همیشه حذف کند.",
};

function mentorFailureMessage(payload: unknown): string {
  if (payload && typeof payload === "object" && "code" in payload) {
    switch (payload.code) {
      case "provider_rate_limited":
        return "راهنمای هوشمند موقتاً مشغول است. پاسخ شما ذخیره شده؛ کمی صبر کنید و دوباره تلاش کنید.";
      case "provider_timeout":
        return "آماده‌کردن پرسش بعدی بیش از حد طول کشید. پاسخ شما ذخیره شده؛ دوباره تلاش کنید.";
      case "provider_unavailable":
        return "راهنمای هوشمند موقتاً در دسترس نیست. پاسخ شما ذخیره شده؛ کمی بعد دوباره تلاش کنید.";
      case "provider_authentication":
      case "provider_configuration":
        return "تنظیمات راهنمای هوشمند نیاز به بررسی دارد. پاسخ شما ذخیره شده است.";
      case "provider_request_rejected":
        return "راهنمای هوشمند نتوانست درخواست را بپذیرد. پاسخ شما ذخیره شده و تنظیمات سرویس باید بررسی شود.";
      case "provider_invalid_response":
        return "پرسش بعدی آماده نشد. پاسخ شما ذخیره شده؛ دوباره تلاش کنید.";
    }
  }
  if (payload && typeof payload === "object" && "error" in payload) {
    if (typeof payload.error === "string" && isPersianText(payload.error))
      return payload.error;
  }
  return "پرسش بعدی آماده نشد. پاسخ شما ذخیره شده؛ دوباره تلاش کنید.";
}

const sectionLabels: Record<string, string> = {
  "The problem": "مسئله",
  "People affected": "افراد درگیر",
  "What is known": "دانسته‌ها",
  "Your idea": "ایدهٔ تو",
  "Your connection": "ارتباط تو با مسئله",
  Evidence: "شواهد",
  Stakeholders: "افراد و گروه‌های مرتبط",
  "Root causes": "ریشه‌های مسئله",
  Solution: "راهکار",
  Feasibility: "امکان‌پذیری",
  Pilot: "اجرای آزمایشی",
  Outcomes: "نتایج",
  "Inclusion and risk": "مشارکت و خطرها",
  Delivery: "اجرا",
  "Next actions": "گام‌های بعدی",
};

const proposalLabels: Record<string, string> = {
  summary: "خلاصهٔ کوتاه",
  problem: "مسئله و شواهد",
  beneficiaries: "افراد بهره‌مند",
  solution: "راهکار پیشنهادی",
  impact: "تأثیر اجتماعی مورد انتظار",
  evidence: "شواهد و فرض‌ها",
  feasibility: "امکان‌پذیری و منابع",
  pilot: "اجرای آزمایشی و گام‌های بعدی",
  measurement: "سنجش نتایج",
  risks: "خطرها و راه‌های کاهش آن‌ها",
  openQuestions: "پرسش‌های بی‌پاسخ",
};

function displaySection(section: string) {
  const knownSection = Object.keys(sectionLabels).find(
    (label) => label.toLowerCase() === section.toLowerCase(),
  );
  return knownSection
    ? sectionLabels[knownSection]
    : isPersianText(section)
      ? section
      : "بخش دیگر";
}

function displayTokenReason(reason: string) {
  const knownReasons: Record<string, string> = {
    "Initial registration confirmed": "ثبت اولیهٔ ایده تأیید شد",
    "Mentor development completed": "توسعهٔ ایده کامل شد",
    "Proposal reviewed": "پیشنهاد بازبینی شد",
  };
  if (knownReasons[reason]) return knownReasons[reason];
  const prefix = "Thoughtful progress: ";
  return reason.startsWith(prefix)
    ? "پیشرفت در گفت‌وگوی ایده"
    : isPersianText(reason)
      ? reason
      : "پیشرفت در مسیر پرورش ایده";
}

function displayProposalText(value: string) {
  return value === "Not yet explored with the participant." ||
    value ===
      "\u0627\u06cc\u0646\u0020\u0645\u0648\u0631\u062f\u0020\u0647\u0646\u0648\u0632\u0020\u0628\u0631\u0631\u0633\u06cc\u0020\u0646\u0634\u062f\u0647\u0020\u0627\u0633\u062a\u002e"
    ? "هنوز بررسی نشده است."
    : value;
}

function displayIntakeSummary(idea: Idea) {
  const formattedAnswers = idea.answers
    .map((answer) => `${answer.question}\n${answer.answer}`)
    .join("\n\n");
  const generatedSummaries = new Set([
    `${idea.seed}\n\n${idea.answers.map((answer) => `${answer.section}: ${answer.answer}`).join("\n\n")}`,
    `${idea.seed}\n\n${idea.answers.map((answer) => `${displaySection(answer.section)}: ${answer.answer}`).join("\n\n")}`,
    `${idea.seed}\n\n${formattedAnswers}`,
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
  return `${idea.seed}\n\n${formattedAnswers}`;
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
      .replace(/[.!?؟]$/, "") || "ایدهٔ بدون عنوان";
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
      : getDevelopmentIndex(idea);
  const list = stage === "initial" ? intakeQuestions : developmentQuestions;
  const axis = list[Math.min(index, list.length - 1)];
  const defaultQuestionContext = questionContextForAxis(axis.section);
  const base = { ...axis, questionContext: defaultQuestionContext };
  const existing = idea.answers.find((item) => item.section === base.section);
  if (
    idea.pendingTurn?.stage === stage &&
    idea.pendingTurn.index === index &&
    idea.pendingTurn.section === base.section &&
    isPersianText(idea.pendingTurn.question)
  )
    return {
      ...base,
      question: idea.pendingTurn.question,
      questionContext:
        idea.pendingTurn.questionContext || defaultQuestionContext,
    };
  if (
    idea.mentorNextQuestion?.stage === stage &&
    idea.mentorNextQuestion.index === index &&
    (!idea.mentorNextQuestion.section ||
      idea.mentorNextQuestion.section === base.section) &&
    isPersianText(idea.mentorNextQuestion.text)
  ) {
    return {
      ...base,
      question: idea.mentorNextQuestion.text,
      questionContext:
        idea.mentorNextQuestion.questionContext || defaultQuestionContext,
    };
  }
  if (
    idea.editingProgress?.stage === stage &&
    idea.editingProgress.index === index &&
    existing &&
    isPersianText(existing.question)
  )
    return {
      ...base,
      question: existing.question,
      questionContext: defaultQuestionContext,
    };
  if (idea.draftAnswer) return base;
  return base;
}

function getDevelopmentIndex(idea: Idea) {
  if (idea.pendingTurn?.stage === "development")
    return idea.pendingTurn.index;
  if (idea.editingProgress?.stage === "development")
    return idea.developmentIndex ?? 0;
  return developmentProgressIndex(idea);
}

function getProgress(idea: Idea) {
  if (idea.status === "submitted" && hasCompletedDevelopment(idea)) return 100;
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
    "قدم‌به‌قدم همراهت هستم. لازم نیست از همین حالا پاسخ همهٔ پرسش‌ها را بدانی.",
  );
  const [mentorMode, setMentorMode] = useState<"demo" | "provider" | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [openingBusy, setOpeningBusy] = useState(false);
  const [openingAttempt, setOpeningAttempt] = useState(0);
  const openingRequestRef = useRef("");
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
        "فضای ذخیره‌سازی مرورگر در دسترس نیست یا داده‌های ذخیره‌شده خوانده نشدند. ممکن است تغییرات این نشست پس از بارگذاری دوباره از دست بروند.",
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
        "تغییرات در این مرورگر ذخیره نشدند و ممکن است پس از بارگذاری دوباره از دست بروند. دسترسی و فضای ذخیره‌سازی مرورگر را بررسی کنید.",
      );
    }
  }, [state, ready]);

  useEffect(() => {
    if (!ready || (screen !== "intake" && screen !== "develop")) return;
    let active = true;
    fetch("/api/mentor", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Mentor mode could not be checked");
        const payload: unknown = await response.json();
        if (
          payload &&
          typeof payload === "object" &&
          "mode" in payload &&
          (payload.mode === "demo" || payload.mode === "provider") &&
          active
        )
          setMentorMode(payload.mode);
      })
      .catch(() => {
        if (active)
          setFormError(
            "وضعیت گفت‌وگو مشخص نشد. پاسخ شما پیش از تلاش برای ادامه ذخیره خواهد شد.",
          );
      });
    return () => {
      active = false;
    };
  }, [screen, ready]);

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
              `\u2068+${formatNumber(entry.amount)}\u2069 توکن · ${displayTokenReason(entry.reason)}`,
          )
          .join("؛ "),
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

  const saveIdeaImmediately = useCallback((updated: Idea): Idea | null => {
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
      setFormError("پاسخ شما ذخیره نشد. فضای ذخیره‌سازی مرورگر را بررسی و دوباره تلاش کنید.");
      setStorageError(
        "ذخیره‌سازی مرورگر با خطا روبه‌رو شد. دسترسی و فضای ذخیره‌سازی مرورگر را بررسی کنید.",
      );
      return null;
    }
    stateRef.current = nextState;
    setState(nextState);
    return savedIdea;
  }, []);

  function deleteIdea(idea: Idea) {
    if (
      !window.confirm(
        `از حذف «${idea.title}» و همهٔ پاسخ‌های ذخیره‌شدهٔ آن مطمئن هستید؟`,
      )
    )
      return;

    const nextState = removeIdea(stateRef.current, idea.id);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    } catch {
      setFormError("ایده از مرورگر حذف نشد. فضای ذخیره‌سازی را بررسی و دوباره تلاش کنید.");
      setStorageError(
        "ذخیره‌سازی مرورگر با خطا روبه‌رو شد. دسترسی و فضای ذخیره‌سازی مرورگر را بررسی کنید.",
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
      setFormError("برای ادامه، چند کلمه دربارهٔ مسئله یا ایده‌تان بنویسید.");
      return;
    }
    if (!canCreateIdea(state)) {
      setFormError(
        "به سقف سه ایده رسیده‌اید. ایده‌های ذخیره‌شدهٔ شما همچنان در دسترس‌اند.",
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
      setMentorMode(null);
      setMentorMessage(
        "ایده‌تان را با همان واژه‌های خودتان و با پرسش‌هایی کاربردی، قدم‌به‌قدم پرورش می‌دهیم.",
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
      setFormError("نام و نام خانوادگی‌تان را وارد کنید.");
      return;
    }
    if (identityDigits.length < 6 || identityDigits.length > 20) {
      setFormError("کد ملی باید بین ۶ تا ۲۰ رقم داشته باشد.");
      return;
    }
    if (digits.length < 8 || digits.length > 15) {
      setFormError("شمارهٔ همراه باید بین ۸ تا ۱۵ رقم داشته باشد.");
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
      setFormError("برای ادامه، عددی ۴ تا ۸ رقمی وارد کنید.");
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
      "ممنون که از چیزی که دیده‌اید شروع کردید. نوشتهٔ شما را همان‌طور حفظ می‌کنیم و هر بار یک پرسش کاربردی می‌پرسیم.",
    );
    setNationalId("");
    setMobile("");
    setMaskedMobile("");
    setCode("");
    setDraftAnswer("");
    setReviewDraft({});
    setMentorMode(null);
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
          question: isPersianText(storedPending.question)
            ? storedPending.question
            : getQuestion(activeIdea, stage).question,
        }
      : undefined;
    const answerText = (override ?? draftAnswer).trim();
    if (!pending && !answerText) {
      setFormError(
        "پاسخی کوتاه بنویسید یا برای ادامه گزینهٔ «هنوز مطمئن نیستم» را انتخاب کنید.",
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
            : getDevelopmentIndex(activeIdea);
        const axes = axesForStage(stage);
        const currentAxis = axes[index];
        if (!currentAxis) {
          setFormError("این مرحله کامل شده است.");
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
          questionContext: questionData.questionContext,
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
      const skippedSections =
        stage === "development"
          ? []
          : (updated.skippedSections?.[stage] ?? []);
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
        .slice(-14)
        .map(({ answer, axis }) => ({
          stage: intakeQuestions.some((item) => item.section === axis.section)
            ? ("initial" as const)
            : ("development" as const),
          section: answer.section,
          question: answer.question.slice(0, 200),
          answer: answer.answer.slice(0, 200),
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
        setMentorMessage("پاسخت ذخیره شد.");
        setFormError(
          "ارتباط با راهنمای هوشمند قطع شد. پاسخ شما ذخیره شده؛ دوباره تلاش کنید.",
        );
        return;
      }
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        setMentorMessage("پاسخت ذخیره شد.");
        setFormError(
          "پاسخ راهنمای هوشمند خوانده نشد. پاسخ شما ذخیره شده؛ دوباره تلاش کنید.",
        );
        return;
      }
      const responseMode: "provider" | "demo" | null =
        payload &&
        typeof payload === "object" &&
        "mode" in payload &&
        (payload.mode === "provider" || payload.mode === "demo")
          ? payload.mode
          : null;
      if (
        !response.ok ||
        responseMode === null ||
        !validateInterviewDecision(payload, interviewRequest)
      ) {
        setMentorMessage("پاسخت ذخیره شد.");
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
          [stage]:
            stage === "development"
              ? []
              : [...new Set([...skippedSections, ...decision.coveredSections])],
        },
        mentorNextQuestion: decision.stageComplete
          ? undefined
          : {
              stage,
              index: nextIndex,
              section: decision.nextSection!,
              text: decision.nextQuestion!,
              questionContext: decision.questionContext!,
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
        setFormError("پاسخ شما ذخیره شده، اما گام بعدی ذخیره نشد. دوباره تلاش کنید.");
        return;
      }
      announceNewToken(activeIdea, savedFinalIdea);
      setMentorMode(responseMode);
      setMentorMessage(decision.mentorMessage.slice(0, 240));
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
      `${activeIdea.seed}\n\n${activeIdea.answers.map((answer) => `${answer.question}\n${answer.answer}`).join("\n\n")}`,
    };
    updated = awardToken(
      updated,
      "Initial registration confirmed",
      "initial-complete",
      5,
    );
    const savedIdea = saveIdeaImmediately(updated);
    if (!savedIdea) return;
    announceNewToken(activeIdea, savedIdea);
    setScreen("initial-confirmed");
  }

  function beginDevelopment(idea: Idea) {
    setActiveId(idea.id);
    setDraftAnswer(idea.draftAnswer ?? "");
    const developmentIndex = getDevelopmentIndex(idea);
    const shouldCreateOpeningQuestion =
      developmentIndex === 0 &&
      !idea.answers.some((answer) =>
        developmentQuestions.some((axis) => axis.section === answer.section),
      ) &&
      idea.mentorNextQuestion?.stage !== "development";
    const openingQuestion = shouldCreateOpeningQuestion
      ? developmentOpeningQuestion(idea.seed, idea.answers)
      : null;
    updateIdea({
      ...idea,
      status:
        idea.status === "initial" ||
        (idea.status === "awaiting-confirmation" &&
          !hasCompletedDevelopment(idea))
          ? "in-development"
          : idea.status,
      stage: "development",
      developmentIndex,
      ...(idea.status === "awaiting-confirmation" &&
      !hasCompletedDevelopment(idea)
        ? { confirmationDeadlineAt: undefined }
        : {}),
      ...(openingQuestion
        ? {
            mentorNextQuestion: {
              stage: "development",
              index: 0,
              section: developmentQuestions[0].section,
              ...openingQuestion,
            },
          }
        : {}),
    });
    setMentorMessage(
      "بیایید ایده‌تان را کاربردی‌تر کنیم و آنچه مشاهده کرده‌اید از مواردی که هنوز باید آزموده شوند جدا کنیم.",
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
    if (!hasCompletedDevelopment(idea)) {
      setActiveId(idea.id);
      setFormError(
        "برای بازبینی پرونده، ابتدا به هر ده پرسش مرحلهٔ توسعه پاسخ دهید.",
      );
      if (
        idea.status === "initial" &&
        (idea.intakeIndex ?? 0) < intakeQuestions.length
      )
        setScreen("intake");
      else beginDevelopment(idea);
      return;
    }
    const fields = createProposal(idea);
    setReviewDraft({ ...fields, ...idea.proposal });
    setActiveId(idea.id);
    const savedIdea = saveIdeaImmediately({ ...idea, stage: "review" });
    if (!savedIdea) return;
    setScreen("review");
  }

  function saveProposal(idea: Idea) {
    if (!hasCompletedDevelopment(idea)) return;
    saveIdeaImmediately({
      ...idea,
      title: reviewDraft.title?.trim().slice(0, 80) || idea.title,
      proposal: reviewDraft,
      stage: "review",
    });
  }

  function updateProposalField(idea: Idea, key: string, value: string) {
    if (!hasCompletedDevelopment(idea)) return;
    const nextDraft = { ...reviewDraft, [key]: value };
    setReviewDraft(nextDraft);
    saveIdeaImmediately({
      ...idea,
      title:
        key === "title"
          ? value.trim().slice(0, 80) || idea.title
          : idea.title,
      proposal: { ...idea.proposal, [key]: value },
      stage: "review",
    });
  }

  function submitProposal(mode: "now" | "later") {
    if (!activeIdea) return;
    if (!hasCompletedDevelopment(activeIdea)) {
      beginReview(activeIdea);
      return;
    }
    let saved: Idea = {
      ...activeIdea,
      title: reviewDraft.title?.trim().slice(0, 80) || activeIdea.title,
      proposal: reviewDraft,
      stage: "review",
    };
    saved = awardToken(saved, "Proposal reviewed", "proposal-review", 5);
    const updated = mode === "now" ? submitNow(saved) : deferSubmission(saved);
    const savedIdea = saveIdeaImmediately(updated);
    if (!savedIdea) return;
    announceNewToken(activeIdea, savedIdea);
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
    if (
      idea.status === "submitted" &&
      hasCompletedDevelopment(idea)
    )
      setScreen("submitted");
    else if (
      idea.status === "awaiting-confirmation" &&
      hasCompletedDevelopment(idea)
    )
      beginReview(idea);
    else if (
      idea.status === "initial" &&
      (idea.intakeIndex ?? 0) < intakeQuestions.length
    )
      setScreen("intake");
    else if (idea.stage === "review" && hasCompletedDevelopment(idea))
      beginReview(idea);
    else if (!hasCompletedDevelopment(idea)) beginDevelopment(idea);
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
    : {
        ...intakeQuestions[0],
        questionContext: questionContextForAxis(intakeQuestions[0].section),
      };
  const devQuestion = activeIdea
    ? getQuestion(activeIdea, "development")
    : {
        ...developmentQuestions[0],
        questionContext: questionContextForAxis(developmentQuestions[0].section),
      };
  const initialIndex = activeIdea?.intakeIndex ?? 0;
  const initialQuestionReady =
    initialIndex > 0 ||
    (activeIdea?.pendingTurn?.stage === "initial" &&
      activeIdea.pendingTurn.index === initialIndex &&
      activeIdea.pendingTurn.section === intakeQuestions[initialIndex]?.section &&
      isPersianText(activeIdea.pendingTurn.question)) ||
    (activeIdea?.mentorNextQuestion?.stage === "initial" &&
      activeIdea.mentorNextQuestion.index === initialIndex &&
      activeIdea.mentorNextQuestion.section ===
        intakeQuestions[initialIndex]?.section &&
      isPersianText(activeIdea.mentorNextQuestion.text)) ||
    (activeIdea?.editingProgress?.stage === "initial" &&
      activeIdea.editingProgress.index === initialIndex &&
      activeIdea.answers.some(
        (answer) => answer.section === intakeQuestions[initialIndex]?.section,
      ));

  useEffect(() => {
    if (
      !ready ||
      screen !== "intake" ||
      !activeIdea ||
      initialIndex !== 0 ||
      initialQuestionReady
    )
      return;

    const requestKey = `${activeIdea.id}:${activeIdea.seed}`;
    if (openingRequestRef.current === requestKey) return;
    openingRequestRef.current = requestKey;
    setOpeningBusy(true);
    setFormError("");

    void (async () => {
      try {
        const response = await fetch("/api/mentor/opening", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ seed: activeIdea.seed }),
        });
        let payload: unknown;
        try {
          payload = await response.json();
        } catch {
          throw new Error("opening_response_unreadable");
        }
        if (
          !response.ok ||
          !payload ||
          typeof payload !== "object" ||
          !("mode" in payload) ||
          (payload.mode !== "demo" && payload.mode !== "provider") ||
          !isValidOpeningQuestion(payload)
        ) {
          throw new Error(
            payload && typeof payload === "object"
              ? mentorFailureMessage(payload)
              : "opening_response_invalid",
          );
        }

        const currentIdea = stateRef.current.ideas.find(
          (idea) => idea.id === activeIdea.id,
        );
        if (!currentIdea || currentIdea.seed !== activeIdea.seed) return;
        const savedIdea = saveIdeaImmediately({
          ...currentIdea,
          mentorNextQuestion: {
            stage: "initial",
            index: 0,
            section: intakeQuestions[0].section,
            text: payload.question,
            questionContext: payload.questionContext,
          },
        });
        if (!savedIdea) return;
        setMentorMode(payload.mode);
        setMentorMessage(
          "از همان ایده‌ای که نوشتی شروع می‌کنیم؛ اگر لازم باشد، پرسش را با پاسخ‌هایت دقیق‌تر می‌کنیم.",
        );
      } catch (error) {
        setFormError(
          error instanceof Error &&
            error.message !== "opening_response_unreadable" &&
            error.message !== "opening_response_invalid"
            ? error.message
            : "پرسش آغازین آماده نشد؛ دوباره تلاش کنید. ایدهٔ شما ذخیره است.",
        );
        openingRequestRef.current = "";
      } finally {
        setOpeningBusy(false);
      }
    })();
  }, [
    activeIdea,
    initialIndex,
    initialQuestionReady,
    openingAttempt,
    ready,
    saveIdeaImmediately,
    screen,
  ]);

  const devIndex = activeIdea ? getDevelopmentIndex(activeIdea) : 0;
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
      <main className="loading-screen" aria-label="در حال آماده‌سازی جوانه">
        <span className="loading-mark">
          <Sprout size={24} />
        </span>
        <span>فضای ایدهٔ شما در حال آماده‌شدن است…</span>
      </main>
    );

  return (
    <main
      className={`app-shell${screen === "home" ? " landing-shell" : screen === "intake" ? " intake-shell" : screen === "dashboard" ? " dashboard-shell" : ["details", "verify", "develop", "review", "submitted", "initial-confirmed"].includes(screen) ? " glass-shell" : ""}`}
    >
      <header
        className={`topbar${screen === "home" || screen === "intake" ? " landing-topbar" : ""}`}
      >
        <button
          className={`brand${screen === "home" || screen === "intake" ? " landing-brand" : ""}`}
          onClick={() => setScreen("home")}
          aria-label="صفحهٔ اصلی جوانه"
        >
          {screen === "home" ? (
            <Image
              className="landing-logo"
              src="/javaneh-logo.png"
              alt="رویداد ملی نوآوری اجتماعی جوانه"
              width={2172}
              height={724}
              priority
            />
          ) : (
            <>
              <span
                className={`brand-mark${screen === "intake" ? " landing-brand-mark" : ""}`}
              >
                {screen === "intake" ? (
                  <Sprout size={38} strokeWidth={1.8} aria-hidden="true" />
                ) : (
                  <Flower2 size={22} strokeWidth={1.8} />
                )}
              </span>
              <span className="brand-copy">
                <span className="brand-name">
                  Javaneh<span className="brand-period">.</span>
                </span>
                {screen === "intake" && (
                  <span className="brand-subtitle">
                    رویداد ملی نوآوری اجتماعی
                  </span>
                )}
              </span>
            </>
          )}
        </button>
        {screen === "home" || screen === "intake" ? (
          <>
            <nav className="landing-nav" aria-label="پیمایش اصلی">
              <a
                className={screen === "home" ? "is-active" : ""}
                href={screen === "home" ? "#about" : "#intake-stage"}
              >
                دربارهٔ رویداد
              </a>
              <a
                className={screen === "intake" ? "is-active" : ""}
                href={screen === "home" ? "#how-it-works" : "#intake-conversation"}
              >
                روند کار
              </a>
              <a href={screen === "home" ? "#benefits" : "#intake-tokens"}>
                دستاوردها
              </a>
              <a href={screen === "home" ? "#faq" : "#intake-faq"}>پرسش‌های متداول</a>
            </nav>
            <div className="landing-actions">
              <button
                className="landing-signin"
                onClick={() => setScreen("dashboard")}
              >
                <BookOpenText size={17} aria-hidden="true" />
                <span>ایده‌های من</span>
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
                {screen === "home" ? "شروع یک ایده" : "ادامه"}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          </>
        ) : (
          <div className="topbar-right">
            {state.profile?.verified && (
              <button
                className="text-button"
                onClick={() => setScreen("dashboard")}
              >
                <BookOpenText size={17} /> ایده‌های من
              </button>
            )}
          </div>
        )}
      </header>

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
          ? `برای این ایده ${formatNumber(totalTokens)} توکن گرفته‌اید.`
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
              رویداد ملی <em>نوآوری اجتماعی</em>
            </p>
            <p className="home-intro landing-intro">
              ایده‌هایتان را به اشتراک بگذارید؛ فردایی بهتر را با هم بسازیم.
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
                  ایده‌تان را با واژه‌های خودتان توضیح دهید
                </label>
                <textarea
                  id="idea-seed"
                  className="seed-input landing-seed-input"
                  placeholder="ایده‌تان را اینجا بنویسید…"
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
            </div>
            <div
              className="landing-choice-actions"
              role="group"
              aria-label="انتخاب مسیر ایده"
            >
              <button
                type="button"
                className="primary-button landing-choice landing-choice-primary"
                onClick={startIdea}
                disabled={!seed.trim() || !canCreateIdea(state)}
              >
                <span className="landing-choice-icon">
                  <Sprout size={24} strokeWidth={1.8} aria-hidden="true" />
                </span>
                <span className="landing-choice-copy">
                  <b>پرورش ایده</b>
                  <small>قدم‌به‌قدم، با راهنمایی هوشمند</small>
                </span>
              </button>
              <button
                type="button"
                className="landing-choice landing-choice-secondary"
                disabled
                title="ثبت ایده به‌زودی فعال می‌شود."
              >
                <span className="landing-choice-icon">
                  <FileText size={22} strokeWidth={1.8} aria-hidden="true" />
                </span>
                <span className="landing-choice-copy">
                  <b>
                    ثبت ایده <span className="landing-choice-status">به‌زودی</span>
                  </b>
                  <small>ایده‌تان را برای رویداد ثبت کنید</small>
                </span>
              </button>
            </div>
            <div className="composer-meta landing-composer-meta">
              <span id="seed-hint">
                <Info size={16} aria-hidden="true" />
                ایده‌تان را بنویسید و نخستین گام را برای نوآوری بردارید
              </span>
              {seed && <span>{formatNumber(seed.length)}/{formatNumber(1200)}</span>}
            </div>
            {formError && (
              <p className="inline-error" id="seed-error" role="alert">
                {formError}
              </p>
            )}
            {!formError && (
              <p className="sr-only" id="seed-error">
                مسئله‌ای اجتماعی یا ایده‌تان را بنویسید. حداکثر ۱۲۰۰ نویسه.
              </p>
            )}
            {!canCreateIdea(state) && (
              <p className="capacity-note">
                به سقف ایده‌ها رسیده‌اید. برای ادامه یکی از ایده‌های ذخیره‌شده را باز کنید.
              </p>
            )}
          </div>
          <div className="landing-benefits" id="benefits">
            <div className="landing-benefit">
              <Users size={27} strokeWidth={2.2} aria-hidden="true" />
              <span>مشارکت برای همه</span>
            </div>
            <div className="landing-benefit">
              <Star size={27} strokeWidth={2.2} aria-hidden="true" />
              <span>کسب امتیاز</span>
            </div>
            <div className="landing-benefit">
              <Check size={27} strokeWidth={2.2} aria-hidden="true" />
              <span>پیگیری پیشرفت</span>
            </div>
            <div className="landing-benefit">
              <Sprout size={27} strokeWidth={2.2} aria-hidden="true" />
              <span>ایجاد تغییر</span>
            </div>
          </div>
          <a className="landing-scroll" href="#faq" aria-label="رفتن به پرسش‌های متداول">
            <ChevronDown size={20} aria-hidden="true" />
          </a>
          <section className="landing-faq" id="faq" aria-labelledby="landing-faq-title">
            <p className="landing-faq-kicker">هر ایدهٔ خوبی می‌تواند از قدمی کوچک آغاز شود</p>
            <h2 id="landing-faq-title">پرسش‌های متداول</h2>
            <details>
              <summary>ایدهٔ من کجا ذخیره می‌شود؟</summary>
              <p>
                {labels.localNotice} هیچ اطلاعاتی برای برگزارکنندگان رویداد ارسال نمی‌شود.
              </p>
            </details>
            <details>
              <summary>آیا ایده‌ام باید کامل باشد؟</summary>
              <p>
                خیر. با مسئله‌ای که دیده‌اید شروع کنید و ایده را با پرسش‌های کاربردی، قدم‌به‌قدم شکل دهید.
              </p>
            </details>
          </section>
        </section>
      )}

      {screen === "details" && (
        <section className="form-view narrow-view details-view">
          <button className="back-link" onClick={() => setScreen("home")}>
            <ArrowLeft size={16} /> بازگشت به ایده
          </button>
          <div className="eyebrow">
            <span className="eyebrow-line" />
            پیش از شروع
          </div>
          <h1>
            کمی دربارهٔ <em>شما</em>
          </h1>
          <p className="form-intro">
            نام شما نمایه‌تان را در همین مرورگر مشخص می‌کند. شمارهٔ همراه و کد ملی فقط برای گذر از این مرحله درخواست می‌شوند.
          </p>
          <div className="privacy-panel">
            <ShieldCheck size={19} />
            <p>
              <b>یادآوری حریم خصوصی</b>
              <br />
              پیامکی ارسال نمی‌شود و هیچ سرویس احراز هویتی فراخوانی نمی‌شود. کد ملی و شمارهٔ همراه شما ذخیره یا ارسال نمی‌شوند و پس از این مرحله کنار گذاشته می‌شوند. فقط نام و وضعیت عبور از این مرحله در همین مرورگر می‌ماند.
            </p>
          </div>
          <form className="details-form" onSubmit={submitDetails} noValidate>
            <div className="field-row">
              <label>
                نام
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                  dir="auto"
                  required
                />
              </label>
              <label>
                نام خانوادگی
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
              کد ملی
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
              شمارهٔ همراه
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
              ادامه <ArrowRight size={18} />
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
            <ArrowLeft size={16} /> بازگشت به اطلاعات
          </button>
          <div className="step-icon">
            <ShieldCheck size={24} />
          </div>
          <div className="eyebrow">
            <span className="eyebrow-line" />
            تأیید این مرحله
          </div>
          <h1>
            با کدی که <em>خودتان انتخاب می‌کنید</em> ادامه دهید
          </h1>
          <p className="form-intro">
            پیامک واقعی ارسال نمی‌شود. برای ادامه، هر عددی بین ۴ تا ۸ رقم وارد کنید؛ این کد هویت شما را تأیید نمی‌کند.
          </p>
          <div className="masked-line">
            شمارهٔ همراه <bdi dir="ltr">{maskedMobile}</bdi>
          </div>
          <form className="details-form" onSubmit={verifyCode} noValidate>
            <label htmlFor="verification-code">
              کد ادامه
              <input
                id="verification-code"
                value={code}
                onChange={(e) =>
                  setCode(normalizeDigits(e.target.value).replace(/\D/g, "").slice(0, 8))
                }
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="برای نمونه: ۱۲۳۴"
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
              ادامه <ArrowRight size={18} />
            </button>
          </form>
        </section>
      )}

      {screen === "intake" && activeIdea && (
        <section className="journey-view intake-view">
          <button className="back-link intake-exit" onClick={() => setScreen("dashboard")}>
            <ArrowLeft size={16} /> ذخیره و خروج
          </button>
          <div className="journey-head intake-head" id="intake-stage">
            <div>
              <div className="eyebrow intake-eyebrow">
                <span className="eyebrow-line" />
                گام ۱ · ثبت اولیه
              </div>
              <h1>
                بیایید ایده‌تان را <em>شکل بدهیم</em>
              </h1>
              <p className="intake-intro">
                یک ایدهٔ خوب می‌تواند تغییری ایجاد کند. ایده‌تان را با واژه‌های خودتان برایمان بنویسید.
              </p>
            </div>
            <span className="step-count">
              {formatNumber(Math.min(initialIndex + 1, 5))} <span>/ {formatNumber(5)}</span>
            </span>
          </div>
          <div
            className="progress-track"
            role="progressbar"
            aria-label="پیشرفت ثبت اولیه"
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
                <span>گفت‌وگو دربارهٔ ایده</span>
                {mentorMode === "demo" && (
                  <span className="mentor-mode-badge">حالت نمایشی</span>
                )}
                <span className="intake-start-badge">از اینجا شروع کنید</span>
              </div>
              <div className="mentor-message intake-mentor-message" aria-live="polite">
                {!busy && !openingBusy && <Sparkles size={16} aria-hidden="true" />}
                {busy || openingBusy ? (
                  <span className="thinking">
                    <i />
                    <i />
                    <i /> در حال آماده‌کردن پرسش متناسب با ایده‌ات
                  </span>
                ) : (
                  mentorMessage.slice(0, 240)
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
                        ? `پرسش ${formatNumber(initialIndex + 1)} از ${formatNumber(5)}`
                        : "آمادهٔ بازبینی"}
                    </span>
                    {initialIndex < 5 && initialQuestionReady && (
                      <p className="question-context">
                        {currentQuestion.questionContext}
                      </p>
                    )}
                    <h2 aria-live="polite" aria-atomic="true">
                      {initialIndex < 5
                        ? initialQuestionReady
                          ? currentQuestion.question
                          : openingBusy
                            ? "داریم نقطهٔ شروع ایده‌ات را بررسی می‌کنیم."
                            : "پرسش آغازین هنوز آماده نشده است."
                        : "خلاصهٔ اولیهٔ ایده آماده است."}
                    </h2>
                  </div>
                </div>
                {initialIndex < 5 && !initialQuestionReady ? (
                  <div className="pending-answer">
                    {formError && (
                      <p className="inline-error" role="alert">
                        {formError}
                      </p>
                    )}
                    {!openingBusy && (
                      <button
                        className="primary-button"
                        onClick={() => {
                          openingRequestRef.current = "";
                          setFormError("");
                          setOpeningAttempt((attempt) => attempt + 1);
                        }}
                      >
                        دوباره تلاش کنید <ArrowRight size={18} />
                      </button>
                    )}
                  </div>
                ) : initialIndex < 5 &&
                activeIdea.pendingTurn?.stage === "initial" ? (
                  <div className="pending-answer">
                    <p className="review-hint">
                      پاسخ شما ذخیره شده است:
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
                      تلاش دوباره <ArrowRight size={18} />
                    </button>
                    {pendingAnswer && (
                      <button
                        className="text-button"
                        onClick={() => editAnswer(activeIdea, pendingAnswer)}
                        disabled={busy}
                      >
                        ویرایش پاسخ
                      </button>
                    )}
                  </div>
                ) : initialIndex < 5 ? (
                  <>
                    <label className="sr-only" htmlFor="initial-answer">
                      پاسخ شما
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
                      placeholder="با آرامش بنویسید؛ چند جملهٔ صادقانه کافی است."
                    />
                    <div className="answer-tools">
                      <button
                        className="subtle-button"
                        onClick={() =>
                          answerCurrent(
                            "initial",
                            "هنوز مطمئن نیستم. پیش از تصمیم‌گیری می‌خواهم بیشتر بدانم.",
                          )
                        }
                      >
                        هنوز مطمئن نیستم <CircleHelp size={15} />
                      </button>
                      <span>
                        {formatNumber((draftAnswer || activeIdea.draftAnswer || "").length)}
                        /{formatNumber(1500)}
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
                      ثبت پاسخ <ArrowRight size={18} />
                    </button>
                  </>
                ) : (
                  <>
                    <p className="review-hint">
                      پیش از تأیید ثبت اولیه، این خلاصه را بررسی و ویرایش کنید.
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
                      aria-label="ویرایش خلاصهٔ اولیهٔ ایده"
                      dir="auto"
                    />
                    {formError && (
                      <p className="inline-error" role="alert">
                        {formError}
                      </p>
                    )}
                    <button className="primary-button" onClick={confirmInitial}>
                      تأیید ثبت اولیه <Check size={18} />
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
                    <span>نقطهٔ شروع شما</span>
                  </div>
                  {seedEditOpen ? (
                    <form
                      className="intake-seed-edit"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const nextSeed = seedEditDraft.trim();
                        if (!nextSeed) {
                          setFormError("ایدهٔ اولیه نمی‌تواند خالی باشد.");
                          return;
                        }
                        const title = nextSeed
                          .replace(/\s+/g, " ")
                          .slice(0, 48)
                          .replace(/[.!?؟]$/, "") || "ایدهٔ بدون عنوان";
                        updateIdea({
                          ...activeIdea,
                          seed: nextSeed,
                          title,
                          ...(activeIdea.intakeIndex === 0 &&
                          !activeIdea.pendingTurn &&
                          activeIdea.mentorNextQuestion?.stage === "initial" &&
                          activeIdea.mentorNextQuestion.index === 0
                            ? { mentorNextQuestion: undefined }
                            : {}),
                        });
                        setSeedEditOpen(false);
                        setFormError("");
                      }}
                    >
                      <label className="sr-only" htmlFor="starting-point-edit">
                        ویرایش ایدهٔ اولیه
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
                          انصراف
                        </button>
                        <button className="primary-button" type="submit">
                          ذخیرهٔ ایده
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
                    aria-label="ویرایش ایدهٔ اولیه"
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
                <span>پیشرفت ثبت اولیه</span>
                <span>{formatNumber(Math.min(initialIndex, 5))}/{formatNumber(5)}</span>
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
                    <span>پرسش {formatNumber(index + 1)}</span>
                  </div>
                ))}
              </div>
              <div className="token-mini intake-token-mini" id="intake-tokens">
                <span className="token-glyph"><Sparkles size={16} aria-hidden="true" /></span>
                <span>
                  <b>{formatNumber(totalTokens)} توکن</b>
                  <small>امتیاز مشارکت؛ غیررسمی</small>
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
                      <span>
                        پاسخ{" "}
                        {formatNumber(
                          intakeQuestions.findIndex(
                            (question) => question.section === answer.section,
                          ) + 1,
                        )}
                      </span>
                      <button
                        className="text-button"
                        onClick={() => editAnswer(activeIdea, answer)}
                        aria-label={`ویرایش پاسخ ${formatNumber(intakeQuestions.findIndex((question) => question.section === answer.section) + 1)}`}
                      >
                        ویرایش
                      </button>
                    </div>
                  ))}
              </div>
              <details className="intake-privacy" id="intake-faq">
                <summary>حریم خصوصی و نگهداری اطلاعات</summary>
                <p>{labels.localNotice} پاسخ‌ها برای راهنمای هوشمند پردازش می‌شوند و اطلاعات هویتی و شمارهٔ همراه پیش از ارسال حذف می‌شوند.</p>
              </details>
            </aside>
          </div>
        </section>
      )}

      {screen === "initial-confirmed" && activeIdea && (
        <section className="success-view">
          <div className="success-icon">
            <BadgeCheck size={32} aria-hidden="true" />
          </div>
          <div className="eyebrow">
            <span className="eyebrow-line" />
            ثبت اولیه تأیید شد
          </div>
          <h1>
            ایده‌تان برای ادامه <em>محفوظ است</em>
          </h1>
          <p className="success-copy">
            ثبت اولیهٔ شما کامل است و توسعهٔ بیشتر اختیاری است. می‌توانید همین حالا ادامه دهید یا بعداً از داشبورد برگردید.
          </p>
          <div className="submit-actions">
            <button
              className="primary-button"
              onClick={() => beginDevelopment(activeIdea)}
            >
              ادامهٔ پرورش ایده <ArrowRight size={17} />
            </button>
            <button
              className="secondary-button"
              onClick={() => setScreen("dashboard")}
            >
              بعداً از داشبورد ادامه می‌دهم <House size={17} />
            </button>
          </div>
        </section>
      )}

      {screen === "dashboard" && (
        <section className="dashboard-view">
          <aside className="dashboard-sidebar" aria-label="پیمایش فضای کار">
            <button
              className="dashboard-sidebar-brand"
              onClick={() => setScreen("home")}
              aria-label="صفحهٔ اصلی جوانه"
            >
              <span className="dashboard-sidebar-mark">
                <Sprout size={38} aria-hidden="true" />
              </span>
              <b>Javaneh</b>
              <span>رویداد ملی<br />نوآوری اجتماعی</span>
            </button>
            <nav className="dashboard-nav" aria-label="فضای کار">
              <button
                className="active"
                onClick={() =>
                  document.getElementById("workspace-top")?.scrollIntoView({
                    behavior: "smooth",
                  })
                }
              >
                <House size={18} aria-hidden="true" /> نمای کلی
              </button>
              <button
                onClick={() =>
                  document.getElementById("ideas-list")?.scrollIntoView({
                    behavior: "smooth",
                  })
                }
              >
                <FolderOpen size={18} aria-hidden="true" /> ایده‌های من
              </button>
              <button
                onClick={() =>
                  document.getElementById("token-history")?.scrollIntoView({
                    behavior: "smooth",
                  })
                }
              >
                <Gift size={18} aria-hidden="true" /> امتیازها
              </button>
              <button
                type="button"
                disabled
                title="امکانات جامعهٔ کاربری هنوز در دسترس نیستند."
              >
                <Users size={18} aria-hidden="true" /> جامعهٔ کاربری
              </button>
              <a href="#workspace-faq">
                <CircleHelp size={18} aria-hidden="true" /> پرسش‌های متداول
              </a>
            </nav>
            <div className="dashboard-sidebar-promo">
              <Sprout size={23} aria-hidden="true" />
              <b>ایده‌هایتان را پرورش دهید</b>
              <span>تغییری ماندگار بسازید</span>
            </div>
          </aside>

          <div className="dashboard-main-content" id="workspace-top">
            <div className="dashboard-utility">
              <span className="dashboard-local-state">
                <span className="status-dot" />
                فضای کار شما
              </span>
              <span
                className="dashboard-bell"
                aria-label="اعلان‌ها هنوز راه‌اندازی نشده‌اند"
              >
                <Bell size={19} aria-hidden="true" />
              </span>
              <span
                className="dashboard-avatar"
                aria-label={state.profile?.name || "نمایهٔ جوانه"}
              >
                {profileInitials}
              </span>
            </div>

            <div className="dashboard-hero">
              <div className="dashboard-head">
                <div>
                  <div className="eyebrow dashboard-eyebrow">
                    <span className="eyebrow-line" />
                    فضای کار شما
                  </div>
                  <h1>
                    {state.profile?.name ? (
                      <>
                        خوش آمدید،{" "}
                        <bdi dir="auto">{state.profile.name.split(" ")[0]}</bdi>.
                      </>
                    ) : (
                      <>خوش آمدید، <em>نوآور</em></>
                    )}
                  </h1>
                  <p className="form-intro">
                    از همان‌جایی که مانده‌اید ادامه دهید.
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
                  <b>{formatNumber(activeIdeas.length)} <small>/ {formatNumber(3)}</small></b>
                  <span>ایده‌های در حال پیشرفت</span>
                  <small>
                    {formatNumber(Math.max(0, 3 - totalIdeas))} ایدهٔ دیگر در دسترس
                  </small>
                </div>
                <span className="dashboard-sparkline" aria-hidden="true" />
                <a href="#ideas-list" aria-label="مشاهدهٔ ایده‌ها">
                  <ArrowRight size={14} aria-hidden="true" />
                </a>
              </article>
              <article className="dashboard-stat-card token-stat-card">
                <span className="dashboard-stat-icon">
                  <Database size={22} aria-hidden="true" />
                </span>
                <div className="dashboard-stat-copy">
                  <b>{formatNumber(tokenTotal)}</b>
                  <span>توکن‌های دریافت‌شده</span>
                  <small>قدم‌به‌قدم ادامه دهید</small>
                </div>
                <BarChart3 className="dashboard-stat-chart" size={35} aria-hidden="true" />
              </article>
              <article className="dashboard-stat-card progress-stat-card">
                <span className="dashboard-stat-icon">
                  <Star size={22} aria-hidden="true" />
                </span>
                <div className="dashboard-stat-copy">
                  <span>پیشرفت شما</span>
                  <b>
                    {formatNumber(Math.round(averageProgress / 10))}{" "}
                    <small>از ۱۰ امتیاز</small>
                  </b>
                  <span
                    className="dashboard-progress-track"
                    role="progressbar"
                    aria-label="میانگین پیشرفت ایده‌ها"
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
                  <b>شروع ایده‌ای تازه</b>
                  <small>جرقهٔ ذهنتان را به ایده‌ای اثرگذار تبدیل کنید.</small>
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
                    <h2>ایده‌های شما</h2>
                    <span>
                      {formatNumber(totalIdeas)} ایده در این دستگاه ذخیره شده
                    </span>
                  </div>
                </div>
                <details className="dashboard-saved-details" id="workspace-faq">
                  <summary>
                    محل نگهداری اطلاعات <ChevronDown size={15} aria-hidden="true" />
                  </summary>
                  <p>{labels.localNotice}</p>
                </details>
              </div>
          {totalIdeas === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">
                <Sprout size={24} />
              </span>
              <h3>ایدهٔ اول شما منتظر است</h3>
              <p>
                از چیزی که توجهتان را جلب کرده شروع کنید؛ لازم نیست ایده کامل باشد.
              </p>
              <button
                className="primary-button"
                onClick={() => setScreen("home")}
              >
                نوشتن یک ایده <ArrowRight size={18} />
              </button>
            </div>
          ) : (
            <div className="idea-list">
              {state.ideas.map((idea, index) => (
                <article className="idea-row" key={idea.id}>
                  <div className="idea-number">{formatNumber(index + 1).padStart(2, formatNumber(0))}</div>
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
                        به‌روزرسانی: {formatDate(idea.updatedAt)}
                      </span>
                      <span>
                        <Sparkles size={14} />
                        {formatNumber(idea.tokens.reduce(
                          (sum, item) => sum + item.amount,
                          0,
                        ))}{" "}
                        توکن
                      </span>
                      <span>
                        <span
                          className="progress-mini"
                          role="progressbar"
                          aria-label={`پیشرفت ایدهٔ ${idea.title}`}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={getProgress(idea)}
                        >
                          <i style={{ width: `${getProgress(idea)}%` }} />
                        </span>
                        {formatNumber(getProgress(idea))}٪ تکمیل‌شده
                      </span>
                    </div>
                    <div className="idea-progress-track">
                      <i style={{ width: `${getProgress(idea)}%` }} />
                    </div>
                    <details
                      className="token-history"
                      id={index === 0 ? "token-history" : undefined}
                    >
                      <summary>تاریخچهٔ توکن‌ها ({formatNumber(idea.tokens.length)})</summary>
                      {idea.tokens.length ? (
                        <ul>
                          {idea.tokens.map((token) => (
                            <li key={token.dedupeKey}>
                              <span>{displayTokenReason(token.reason)}</span>
                              <bdi dir="ltr">+{formatNumber(token.amount)}</bdi>
                              <time className="token-date" dateTime={token.createdAt}>
                                {formatDate(token.createdAt)}
                              </time>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p>هنوز توکنی دریافت نکرده‌اید. با هر پاسخ سنجیده توکن می‌گیرید.</p>
                      )}
                    </details>
                  </div>
                  <div className="idea-actions">
                    {idea.status === "submitted" &&
                    hasCompletedDevelopment(idea) ? (
                      <button
                        className="secondary-button"
                        onClick={() => {
                          setActiveId(idea.id);
                          setScreen("submitted");
                        }}
                      >
                        مشاهدهٔ پیشنهاد <FileText size={16} />
                      </button>
                    ) : idea.status === "submitted" ? (
                      <button
                        className="secondary-button"
                        onClick={() => routeToIdea(idea)}
                      >
                        ادامهٔ توسعهٔ ایده <ArrowRight size={16} />
                      </button>
                    ) : idea.status === "awaiting-confirmation" &&
                      hasCompletedDevelopment(idea) ? (
                      <button
                        className="secondary-button"
                        onClick={() => beginReview(idea)}
                      >
                        بازگشت به بازبینی <ArrowRight size={16} />
                      </button>
                    ) : idea.status === "awaiting-confirmation" ? (
                      <button
                        className="secondary-button"
                        onClick={() => routeToIdea(idea)}
                      >
                        ادامهٔ توسعهٔ ایده <ArrowRight size={16} />
                      </button>
                    ) : (
                      <button
                        className="secondary-button"
                        onClick={() => routeToIdea(idea)}
                      >
                        {idea.status === "initial"
                          ? (idea.intakeIndex ?? 0) < 5
                            ? "ادامهٔ ثبت اولیه"
                            : "پرورش بیشتر ایده"
                          : !hasCompletedDevelopment(idea)
                            ? "ادامهٔ توسعهٔ ایده"
                            : "ادامهٔ مسیر ایده"}
                        <ArrowRight size={16} />
                      </button>
                    )}
                    <button
                      className="delete-idea-button"
                      onClick={() => deleteIdea(idea)}
                      aria-label={`حذف ایدهٔ ${idea.title}`}
                    >
                      حذف ایده <Trash2 size={16} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
          {totalIdeas === 3 && (
            <p className="limit-note">
              <LockKeyhole size={15} />
              به سقف سه ایده رسیده‌اید. ایده‌های موجود همچنان در این مرورگر در دسترس‌اند.
            </p>
          )}
            </section>
            <aside className="dashboard-mentor-card">
              <div className="dashboard-mentor-heading">
                <Sparkles size={26} aria-hidden="true" />
                <div>
                  <h2>راهنمای شما</h2>
                  <span>همراهی در پرورش ایده</span>
                </div>
              </div>
              <p>
                هنگام شکل‌دادن و توسعهٔ ایده، راهنمایی سنجیده و گام‌به‌گام بگیرید.
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
                  {activeIdeas.length ? "ادامه با راهنما" : "شروع با راهنما"}
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
                اطلاعات بیشتر <ArrowUpRight size={15} aria-hidden="true" />
              </a>
            </div>
          )}
          <p className="dashboard-score-note">
            توکن‌ها امتیاز مشارکت هستند و امتیاز رسمی داوری رویداد محسوب نمی‌شوند.
          </p>
          </div>
        </section>
      )}

      {screen === "develop" && activeIdea && (
        <section className="journey-view develop-view">
          <button className="back-link" onClick={() => setScreen("dashboard")}>
            <ArrowLeft size={16} /> ذخیره و خروج
          </button>
          <div className="journey-head">
            <div>
              <div className="eyebrow">
                <span className="eyebrow-line" />
                گام ۲ · توسعهٔ ایده
              </div>
              <h1>
                ایده‌تان را <em>کاربردی کنید</em>
              </h1>
            </div>
            <span className="step-count">
              {formatNumber(Math.min(devIndex + 1, 10))} <span>/ {formatNumber(10)}</span>
            </span>
          </div>
          <div
            className="progress-track"
            role="progressbar"
            aria-label="پیشرفت توسعهٔ ایده"
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
                <span>گفت‌وگو دربارهٔ ایده</span>
                {mentorMode === "demo" && (
                  <span className="mentor-mode-badge">حالت نمایشی</span>
                )}
              </div>
              <div className="mentor-message" aria-live="polite">
                {busy ? (
                  <span className="thinking">
                    <i />
                    <i />
                    <i /> در حال آماده‌کردن پرسش بعدی
                  </span>
                ) : (
                  mentorMessage.slice(0, 240)
                )}
              </div>
              <div className="question-card">
                <span className="question-kicker">
                  {devIndex < 10 ? displaySection(devQuestion.section) : "پیشنهاد آماده است"}
                </span>
                {devIndex < 10 && (
                  <p className="question-context">{devQuestion.questionContext}</p>
                )}
                <h2 aria-live="polite" aria-atomic="true">
                  {devIndex < 10
                    ? devQuestion.question
                    : "پایهٔ سنجیده‌ای برای پیشنهادتان آماده کرده‌اید."}
                </h2>
                {devIndex < 10 &&
                activeIdea.pendingTurn?.stage === "development" ? (
                  <div className="pending-answer">
                    <p className="review-hint">
                      پاسخ شما ذخیره شده است:
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
                      تلاش دوباره <ArrowRight size={18} />
                    </button>
                    {pendingAnswer && (
                      <button
                        className="text-button"
                        onClick={() => editAnswer(activeIdea, pendingAnswer)}
                        disabled={busy}
                      >
                        ویرایش پاسخ
                      </button>
                    )}
                  </div>
                ) : devIndex < 10 ? (
                  <>
                    <label className="sr-only" htmlFor="development-answer">
                      پاسخ شما
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
                      placeholder="آنچه می‌دانید بنویسید یا مشخص کنید چه چیزی را باید بیشتر بررسی کنید."
                    />
                    <div className="answer-tools">
                      <button
                        className="subtle-button"
                        onClick={() =>
                          answerCurrent(
                            "development",
                            "هنوز مطمئن نیستم. از افراد درگیر می‌پرسم چه چیزی برایشان مناسب است.",
                          )
                        }
                      >
                        هنوز مطمئن نیستم / این راهکار برای من مناسب نیست <CircleHelp size={15} />
                      </button>
                      <span>
                        {formatNumber((draftAnswer || activeIdea.draftAnswer || "").length)}
                        /{formatNumber(1500)}
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
                      ثبت پاسخ <ArrowRight size={18} />
                    </button>
                    <p className="review-hint">
                      پس از پاسخ به هر ده پرسش این مرحله، امکان بازبینی پرونده فعال می‌شود.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="review-hint">
                      هر زمان اطلاعات تازه‌ای به دست آوردید، می‌توانید به هر بخشی برگردید و آن را کامل‌تر کنید.
                    </p>
                    <button
                      className="primary-button"
                      onClick={() => beginReview(activeIdea)}
                    >
                      بازبینی پیشنهاد <FileText size={18} />
                    </button>
                  </>
                )}
              </div>
            </div>
            <aside className="journey-side">
              <div className="side-section-title">
                <span>ایدهٔ در حال پیشرفت</span>
                <Lightbulb size={16} />
              </div>
              <p className="seed-quote">“<bdi dir="auto">{activeIdea.seed}</bdi>”</p>
              <div className="side-divider" />
              <div className="side-section-title">
                <span>راهنمای توسعهٔ ایده</span>
                <span>{formatNumber(Math.min(devIndex, 10))}/{formatNumber(10)}</span>
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
                  <b>{formatNumber(totalTokens)} توکن</b>
                  <small>۲ توکن برای هر پاسخ سنجیده · ۵ توکن برای تکمیل هر گام</small>
                </span>
              </div>
              <div className="answer-history">
                {activeIdea.answers.map((answer) => (
                  <div className="answer-history-row" key={answer.section}>
                    <span>{displaySection(answer.section)}</span>
                    <button
                      className="text-button"
                      onClick={() => editAnswer(activeIdea, answer)}
                      aria-label={`ویرایش پاسخ شما دربارهٔ ${displaySection(answer.section)}`}
                    >
                      ویرایش
                    </button>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>
      )}

      {screen === "review" &&
        activeIdea &&
        hasCompletedDevelopment(activeIdea) && (
          <section className="review-view">
          <button className="back-link" onClick={() => setScreen("dashboard")}>
            <ArrowLeft size={16} /> ذخیره و خروج
          </button>
          <div className="eyebrow">
            <span className="eyebrow-line" />
            بازبینی نهایی
          </div>
          <h1>
            ایدهٔ شما، <em>روشن و سنجیده</em>
          </h1>
          <p className="form-intro">
            این پیش‌نویس بر پایهٔ پاسخ‌های شماست. عبارت «هنوز بررسی نشده است» بخش‌هایی را نشان می‌دهد که پرسش‌هایشان باز مانده‌اند. پیش از انتخاب گام بعدی، هر بخشی را ویرایش کنید.
          </p>
          <div className="review-origin">
            <span>
              <Users size={16} />
              بر پایهٔ اطلاعاتی که شما وارد کرده‌اید
            </span>
            <p>
              ایدهٔ اولیه: «<bdi dir="auto">{activeIdea.seed}</bdi>»
            </p>
          </div>
          <div className="proposal-grid">
            {[
              ["title", "عنوان پیشنهاد"],
              ["summary", "خلاصهٔ کوتاه"],
              ["problem", "مسئله و شواهد"],
              ["beneficiaries", "افراد بهره‌مند"],
              ["solution", "راهکار پیشنهادی"],
              ["impact", "تأثیر اجتماعی مورد انتظار"],
              ["evidence", "شواهد و فرض‌ها"],
              ["feasibility", "امکان‌پذیری و منابع"],
              ["pilot", "اجرای آزمایشی و گام‌های بعدی"],
              ["measurement", "سنجش نتایج"],
              ["risks", "خطرها و راه‌های کاهش آن‌ها"],
              ["openQuestions", "پرسش‌های بی‌پاسخ"],
            ].map(([key, title]) => (
              <label className="proposal-field" key={key}>
                {title}
                <textarea
                  value={displayProposalText(reviewDraft[key] ?? "")}
                  onChange={(e) =>
                    updateProposalField(activeIdea, key, e.target.value)
                  }
                  maxLength={key === "title" ? 80 : 3000}
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
              جوانه پاسخ‌های شما را مرتب کرده است. اطلاعات از نوشته‌های خودتان می‌آیند؛ هیچ آمار، همکاری یا نتیجه‌ای ساخته نشده است.
            </span>
          </div>
          {activeIdea.status === "awaiting-confirmation" &&
            activeIdea.confirmationDeadlineAt && (
              <div className="deadline-callout">
                <Clock3 size={18} />
                <div>
                  <b>
                    مهلت بازبینی: {formatDate(activeIdea.confirmationDeadlineAt)}
                  </b>
                  <span>
                    {formatNumber(remainingHours)}{" "}
                    ساعت باقی مانده است. اگر تا آن زمان پیشنهاد را تأیید یا ویرایش نکنید، پس از پایان مهلت و در نخستین باری که برنامه را باز کنید، وضعیت آن در همین مرورگر «ارسال‌شده» می‌شود.
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
              ذخیره و بازگشت <ArrowLeft size={16} />
            </button>
            <button
              className="secondary-button"
              onClick={() => submitProposal("later")}
            >
              ثبت با مهلت بازبینی ۷۲ ساعته <Clock3 size={16} />
            </button>
            <button
              className="primary-button"
              onClick={() => submitProposal("now")}
            >
              تأیید و ثبت نهایی <Send size={17} />
            </button>
          </div>
          <p className="local-limit-note">
            این نسخه پیشنهاد را فقط در همین مرورگر نگه می‌دارد و چیزی برای برگزارکنندگان ارسال نمی‌کند. مهلت ۷۲ ساعته دقیق است؛ چون زمان‌سنجی در پس‌زمینه انجام نمی‌شود، پایان مهلت هنگام بازبودن برنامه یا در بارگذاری بعدی بررسی می‌شود.
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
            پیشنهاد ثبت شد
          </div>
          <h1>
            {activeIdea.autoSubmitted
              ? "مهلت بازبینی شما به پایان رسیده است."
              : <>پیشنهاد شما <em>ثبت شده است</em></>}
          </h1>
          <p className="success-copy">
            {activeIdea.autoSubmitted
              ? "پس از پایان مهلت، با بازکردن دوبارهٔ برنامه وضعیت پیشنهاد در همین مرورگر به «ثبت‌شده» تغییر کرد."
              : "پیشنهاد و زمان ثبت آن در همین مرورگر ذخیره شده‌اند."}
          </p>
          <div className="submitted-card">
            <div>
              <span>ایده</span>
              <b><bdi dir="auto">{activeIdea.title}</bdi></b>
            </div>
            <div>
              <span>زمان ثبت</span>
              <b>
                {activeIdea.submittedAt
                  ? formatDate(activeIdea.submittedAt)
                  : "ذخیره‌شده در این مرورگر"}
              </b>
            </div>
            <div>
              <span>توکن‌های دریافت‌شده</span>
              <b>
                {formatNumber(activeIdea.tokens.reduce(
                  (sum, entry) => sum + entry.amount,
                  0,
                ))}{" "}
                توکن <small>· امتیاز مشارکت و غیررسمی</small>
              </b>
            </div>
          </div>
          <div className="submitted-proposal">
            <h2><bdi dir="auto">{activeIdea.proposal.title || activeIdea.title}</bdi></h2>
            {Object.entries(activeIdea.proposal)
              .filter(([key, value]) => key !== "title" && value.trim())
              .map(([key, value]) => (
                <section key={key}>
                  <h3>{proposalLabels[key] ?? "بخش دیگر"}</h3>
                  <p><bdi dir="auto">{displayProposalText(value)}</bdi></p>
                </section>
              ))}
          </div>
          <button
            className="primary-button"
            onClick={() => setScreen("dashboard")}
          >
            بازگشت به ایده‌های من <ArrowLeft size={17} />
          </button>
          <p className="local-limit-note">
            این پیشنهاد فقط در همین مرورگر ذخیره شده و برای برگزارکنندگان رویداد ارسال نشده است.
          </p>
        </section>
      )}

      <footer className="app-footer">
        <span>
          <Flower2 size={15} /> جوانه · پرورش ایده برای نوآوری اجتماعی
        </span>
        <button onClick={() => setScreen("dashboard")}>
          <BookOpenText size={14} /> ایده‌های من <ArrowRight size={13} />
        </button>
      </footer>
    </main>
  );
}
