"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import StructuredRegistrationForm from "./structured-registration-form";
import SpeechInputControl from "./speech-input-control";
import {
  ArrowLeft,
  ArrowRight,
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
  X,
} from "lucide-react";
import {
  formatDate,
  formatNumber,
  isPersianText,
  normalizeDigits,
  toPersianDigits,
} from "@/lib/locale";
import {
  requestMentorApi,
  resetMentorApiConnection,
  useMentorApiDisabled,
} from "@/lib/mentor-api";
import { useFormLockState } from "@/lib/form-answer-validation";
import {
  applyDeadlineTransitions,
  canCreateIdea,
  emptyState,
  hasCompletedDevelopment,
  normalizeState,
  removeIdea,
  SCHEMA_VERSION,
  STORAGE_KEY,
  type AppState,
  type Idea,
} from "@/lib/domain";
import {
  STRUCTURED_STORAGE_KEY,
  structuredScore,
  createStructuredDraft,
  normalizeRegistrationStore,
  type StructuredRegistration,
} from "@/lib/structured-registration";
import {
  INTAKE_AXES as intakeQuestions,
  DEVELOPMENT_AXES as developmentQuestions,
} from "@/lib/interviewer";

type Screen =
  | "home"
  | "idea-mentor"
  | "structured"
  | "details"
  | "verify"
  | "dashboard";
type MentorChatMessage = {
  role: "user" | "assistant";
  content: string;
};
type MentorChatReveal = { messageIndex: number; visibleWords: number };

function mentorWords(message: string): string[] {
  return message.match(/\S+\s*/gu) ?? [];
}

type IdeaMentorStage =
  | "conversation"
  | "write-idea"
  | "confirm-registration"
  | "not-now";
function isIdeaMentorStage(stage: string | null): stage is IdeaMentorStage {
  return (
    stage === "conversation" ||
    stage === "write-idea" ||
    stage === "confirm-registration" ||
    stage === "not-now"
  );
}
function hasExplicitRegistrationConsent(message: string) {
  const normalized = message.replace(/\s+/gu, " ").trim();
  if (/نه|فعلاً|فعلا|شاید|مطمئن نیستم|بعداً|بعدا|بیشتر گفت‌وگو|بیشتر گفتگو/u.test(normalized))
    return false;
  return /^(?:بله|آره|اره|حتماً|حتما|باشه|موافقم)(?:\s|،|؛|$)|^(?:ثبتش کن|ایده(?:‌| )ام را ثبت|ایده(?:‌| )ام رو ثبت|می(?:‌| )خواهم ثبت|می(?:‌| )خوام ثبت)/u.test(
    normalized,
  );
}
const labels = {
  statuses: {
    initial: "تازه‌شروع‌شده",
    "in-development": "در حال توسعه",
    "awaiting-confirmation": "در انتظار تأیید",
    submitted: "ارسال‌شده",
  },
  privacyNotice:
    "برای حفظ حریم خصوصی، اطلاعات هویتی و شمارهٔ همراه پیش از پردازش پاسخ‌ها حذف می‌شوند.",
};

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

function hasUnfinishedStructuredRegistration(registration: StructuredRegistration) {
  return registration.status === "draft" ||
    registration.activeFlow === "F" ||
    Object.values(registration.workbooks).some((workbook) => workbook.status !== "submitted");
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
  const [registrations, setRegistrations] = useState<StructuredRegistration[]>([]);
  const registrationsRef = useRef(registrations);
  const [activeRegistration, setActiveRegistration] = useState<StructuredRegistration | null>(null);
  const structuredReturnScreenRef = useRef<Screen>("home");
  function commitState(
    updater: AppState | ((current: AppState) => AppState),
  ) {
    const nextState =
      typeof updater === "function" ? updater(stateRef.current) : updater;
    stateRef.current = nextState;
    setState(nextState);
  }

  function commitRegistrations(nextRecords: StructuredRegistration[]) {
    registrationsRef.current = nextRecords;
    setRegistrations(nextRecords);
  }

  function persistRegistration(updated: StructuredRegistration) {
    const nextRecords = registrationsRef.current.some((item) => item.id === updated.id)
      ? registrationsRef.current.map((item) => item.id === updated.id ? updated : item)
      : [...registrationsRef.current, updated];
    commitRegistrations(nextRecords);
    setActiveRegistration(updated);
    try {
      localStorage.setItem(STRUCTURED_STORAGE_KEY, JSON.stringify(nextRecords));
      setStorageError("");
    } catch {
      setStorageError(
        "پیش‌نویس ثبت نشد؛ دوباره تلاش کنید.",
      );
    }
  }

  function submitRegistration(updated: StructuredRegistration): boolean {
    const submitted = {
      ...updated,
      status: "submitted" as const,
      activeFlow: "dashboard" as const,
      workbooks: {
        ...updated.workbooks,
        C: updated.workbooks.C.status === "locked"
          ? { ...updated.workbooks.C, status: "available" as const }
          : updated.workbooks.C,
      },
    };
    const nextRecords = registrationsRef.current.map((item) => item.id === submitted.id ? submitted : item);
    try {
      localStorage.setItem(STRUCTURED_STORAGE_KEY, JSON.stringify(nextRecords));
    } catch {
      setStorageError(
        "ثبت نهایی انجام نشد؛ دوباره تلاش کنید.",
      );
      return false;
    }
    commitRegistrations(nextRecords);
    setActiveRegistration(submitted);
    setStorageError("");
    return true;
  }

  function startStructuredRegistration(initialIdea: string) {
    structuredReturnScreenRef.current = "home";
    if (!canCreateIdea(stateRef.current, registrationsRef.current.length)) {
      setFormError("به سقف سه ثبت رسیده‌اید. ثبت‌های قبلی همچنان در دسترس‌اند.");
      return;
    }
    const created = createStructuredDraft();
    const draft = initialIdea.trim()
      ? {
          ...created,
          data: { ...created.data, problem: initialIdea.trim() },
        }
      : created;
    const nextRecords = [...registrationsRef.current, draft];
    commitRegistrations(nextRecords);
    setActiveRegistration(draft);
    setFormError("");
    try {
      localStorage.setItem(STRUCTURED_STORAGE_KEY, JSON.stringify(nextRecords));
      setStorageError("");
    } catch {
      setStorageError(
        "پیش‌نویس ثبت نشد؛ دوباره تلاش کنید.",
      );
    }
    setScreen("structured");
  }

  function openStructuredRegistration(registration: StructuredRegistration) {
    structuredReturnScreenRef.current = "dashboard";
    setActiveRegistration(registration);
    setScreen("structured");
  }
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState<Screen>("home");
  const signupDestinationRef = useRef<"idea-mentor" | null>(null);
  const [infoDialog, setInfoDialog] = useState<"mentor" | "about" | null>(null);
  const infoDialogTriggerRef = useRef<HTMLButtonElement>(null);
  const infoDialogRef = useRef<HTMLElement>(null);
  const infoDialogCloseRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!infoDialog) return;
    const trigger = infoDialogTriggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() =>
      infoDialogCloseRef.current?.focus(),
    );
    function handleDialogKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setInfoDialog(null);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = infoDialogRef.current?.querySelectorAll<HTMLElement>(
        "button:not(:disabled), a[href], [tabindex]:not([tabindex='-1'])",
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleDialogKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleDialogKeyDown);
      trigger?.focus();
    };
  }, [infoDialog]);
  const [seed, setSeed] = useState("");
  const [seedSpeechBusy, setSeedSpeechBusy] = useState(false);
  const seedInputRef = useRef<HTMLTextAreaElement>(null);
  const [formError, setFormError] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [mobile, setMobile] = useState("");
  const [maskedMobile, setMaskedMobile] = useState("");
  const [code, setCode] = useState("");
  const [mentorChatMessages, setMentorChatMessages] = useState<
    MentorChatMessage[]
  >([
    {
      role: "assistant",
      content:
        "سلام! من راهنمای همراهتم 🌱 هر پرسشی دربارهٔ ثبت ایده، مرحله‌های پرورش آن یا ایده‌هایی که ثبت کرده‌ای داری، راحت بپرس. با هم قدم‌به‌قدم جلو می‌رویم.",
    },
  ]);
  const [mentorChatDraft, setMentorChatDraft] = useState("");
  const [mentorChatBusy, setMentorChatBusy] = useState(false);
  const [mentorChatError, setMentorChatError] = useState("");
  const [mentorChatOpen, setMentorChatOpen] = useState(false);
  const [mentorChatReveal, setMentorChatReveal] = useState<MentorChatReveal | null>(null);
  const mentorChatBusyRef = useRef(false);
  const mentorChatEndRef = useRef<HTMLDivElement>(null);
  const mentorChatInputRef = useRef<HTMLTextAreaElement>(null);
  const [ideaMentorMessages, setIdeaMentorMessages] = useState<MentorChatMessage[]>([]);
  const [ideaMentorStage, setIdeaMentorStage] = useState<IdeaMentorStage>("conversation");
  const [ideaMentorIdea, setIdeaMentorIdea] = useState("");
  const [ideaMentorReassuranceOffered, setIdeaMentorReassuranceOffered] = useState(false);
  const [ideaMentorDraft, setIdeaMentorDraft] = useState("");
  const [ideaMentorBusy, setIdeaMentorBusy] = useState(false);
  const [ideaMentorError, setIdeaMentorError] = useState("");
  const mentorApiDisabled = useMentorApiDisabled();
  const formLockState = useFormLockState();
  const ideaMentorBusyRef = useRef(false);
  const ideaMentorEndRef = useRef<HTMLDivElement>(null);
  const ideaMentorInputRef = useRef<HTMLTextAreaElement>(null);
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
        "بارگذاری اطلاعات با مشکل روبه‌رو شد. صفحه را دوباره بارگذاری کنید.",
      );
    }
    try {
      const savedRegistrations = localStorage.getItem(STRUCTURED_STORAGE_KEY);
      const parsedRegistrations = savedRegistrations
        ? normalizeRegistrationStore(JSON.parse(savedRegistrations))
        : [];
      commitRegistrations(parsedRegistrations);
    } catch {
      setStorageError(
        "پیش‌نویس‌های ثبت ایده بارگذاری نشدند. دوباره تلاش کنید.",
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
        "تغییرات ثبت نشدند؛ دوباره تلاش کنید.",
      );
    }
  }, [state, ready]);

  useEffect(() => {
    mentorChatEndRef.current?.scrollIntoView({
      behavior: mentorChatReveal ? "auto" : "smooth",
      block: "end",
    });
  }, [mentorChatMessages, mentorChatBusy, mentorChatReveal]);

  useEffect(() => {
    if (!mentorChatOpen || !mentorChatReveal) return;
    const message = mentorChatMessages[mentorChatReveal.messageIndex];
    if (!message || message.role !== "assistant") return;
    const wordCount = mentorWords(toPersianDigits(message.content)).length;
    if (mentorChatReveal.visibleWords >= wordCount) return;

    const timer = window.setTimeout(() => {
      setMentorChatReveal((current) =>
        current?.messageIndex === mentorChatReveal.messageIndex
          ? { ...current, visibleWords: current.visibleWords + 1 }
          : current,
      );
    }, 55);
    return () => window.clearTimeout(timer);
  }, [mentorChatMessages, mentorChatOpen, mentorChatReveal]);

  useEffect(() => {
    ideaMentorEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [ideaMentorMessages, ideaMentorBusy]);

  useEffect(() => {
    if (!mentorChatOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    mentorChatInputRef.current?.focus();
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMentorChatOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [mentorChatOpen]);

  const tokenTotal = state.ideas.reduce(
    (sum, idea) =>
      sum + idea.tokens.reduce((total, entry) => total + entry.amount, 0),
    0,
  );

  function deleteIdea(idea: Idea) {
    if (
      !window.confirm(
        `از حذف «${idea.title}» و همهٔ پاسخ‌های آن مطمئن هستید؟`,
      )
    )
      return;

    const nextState = removeIdea(stateRef.current, idea.id);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    } catch {
      setFormError("ایده حذف نشد؛ دوباره تلاش کنید.");
      setStorageError(
        "حذف ایده با مشکل روبه‌رو شد؛ دوباره تلاش کنید.",
      );
      return;
    }

    commitState(nextState);
    setFormError("");
  }

  function deleteStructuredRegistration(
    registration: StructuredRegistration,
    title: string,
  ) {
    if (
      !window.confirm(
        `از حذف «${title}» و همهٔ پاسخ‌های آن مطمئن هستید؟`,
      )
    )
      return;

    const nextRecords = registrationsRef.current.filter(
      (item) => item.id !== registration.id,
    );
    try {
      localStorage.setItem(STRUCTURED_STORAGE_KEY, JSON.stringify(nextRecords));
    } catch {
      setFormError("ثبت حذف نشد؛ دوباره تلاش کنید.");
      setStorageError(
        "حذف ثبت با مشکل روبه‌رو شد؛ دوباره تلاش کنید.",
      );
      return;
    }

    commitRegistrations(nextRecords);
    if (activeRegistration?.id === registration.id) {
      setActiveRegistration(null);
      setScreen("dashboard");
    }
    setFormError("");
  }

  function appendSeedTranscript(transcript: string) {
    const currentText = seedInputRef.current?.value ?? seed;
    const current = currentText.trim();
    const separator = current ? "\n" : "";
    const remaining = Math.max(0, 600 - current.length - separator.length);
    const addition = transcript.trim();
    const nextSeed = `${current}${separator}${addition.slice(0, remaining)}`;
    setSeed(nextSeed);
    setFormError(remaining < addition.length ? "بخشی از متن گفتار به سقف ۶۰۰ نویسه رسید؛ متن را بازبینی کنید." : "");
    requestAnimationFrame(() => {
      const textarea = seedInputRef.current;
      if (!textarea) return;
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 240)}px`;
      textarea.style.overflowY = textarea.scrollHeight > 240 ? "auto" : "hidden";
      textarea.setSelectionRange(nextSeed.length, nextSeed.length);
    });
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
    if (signupDestinationRef.current !== "idea-mentor") {
      setScreen("home");
      return;
    }
    signupDestinationRef.current = null;
    commitState((current) => ({
      ...current,
      schemaVersion: SCHEMA_VERSION,
      profile: {
        name: `${firstName.trim()} ${lastName.trim()}`,
        verified: true,
      },
    }));
    setNationalId("");
    setMobile("");
    setMaskedMobile("");
    setCode("");
    setFormError("");
    startIdeaMentor();
  }

  async function sendMentorChatMessage(message = mentorChatDraft) {
    const content = message.trim();
    if (!content || mentorChatBusyRef.current) return;
    mentorChatBusyRef.current = true;
    setMentorChatBusy(true);
    setMentorChatError("");
    const registeredIdeas = [
      ...state.ideas.map((idea) => ({
        title: idea.title,
        seed: idea.seed.slice(0, 800),
        status: labels.statuses[idea.status],
        answers: idea.answers.slice(-5).map(({ question, answer }) => ({
          question: question.slice(0, 300),
          answer: answer.slice(0, 500),
        })),
        proposal: Object.entries(idea.proposal)
          .filter(([, value]) => value.trim())
          .slice(0, 4)
          .map(([section, text]) => ({ section, text: text.slice(0, 500) })),
      })),
      ...registrations.map(({ status, data }) => ({
        title: data.title || "ایدهٔ ثبت‌شده",
        seed: [data.problem, data.better].filter(Boolean).join("\n").slice(0, 800),
        status: status === "submitted" ? "ثبت نهایی‌شده" : "پیش‌نویس",
        answers: [
          { question: "چه اقدامی برای بهترشدن انجام می‌شود؟", answer: data.action },
          { question: "چه نتایجی انتظار می‌رود؟", answer: data.outcomes.join("، ") },
          { question: "چه کسانی از این ایده بهره‌مند می‌شوند؟", answer: data.groups.join("، ") },
          { question: "این ایده در چه حوزه‌ای است؟", answer: data.axis },
        ]
          .filter((answer) => answer.answer.trim())
          .slice(-5)
          .map(({ question, answer }) => ({
            question,
            answer: answer.slice(0, 500),
          })),
        proposal: [],
      })),
    ].slice(0, 3);
    try {
      const result = await requestMentorApi(
        {
          messages: [
            ...mentorChatMessages.slice(1).slice(-11),
            { role: "user", content },
          ],
          ideas: registeredIdeas,
        },
        (payload): string | null =>
          payload && typeof payload === "object" &&
          "reply" in payload && typeof payload.reply === "string"
            ? payload.reply
            : null,
      );
      if (result.status !== "success") {
        setMentorChatError(
          result.status === "cancelled" ? "درخواست منتور لغو شد." : result.message,
        );
        return;
      }
      const reply = result.data;
      setMentorChatMessages((current) => [
        ...current,
        { role: "user", content },
        { role: "assistant", content: reply },
      ]);
      setMentorChatReveal({
        messageIndex: mentorChatMessages.length + 1,
        visibleWords: 0,
      });
      setMentorChatDraft("");
    } catch (error) {
      setMentorChatError(
        error instanceof Error
          ? error.message
          : "ارتباط با منتور برقرار نشد. دوباره تلاش کن.",
      );
    } finally {
      mentorChatBusyRef.current = false;
      setMentorChatBusy(false);
    }
  }

  async function sendIdeaMentorMessage(
    message: string,
    history = ideaMentorMessages,
  ) {
    const content = message.trim();
    if (!content || ideaMentorBusyRef.current || ideaMentorStage === "not-now") return;
    ideaMentorBusyRef.current = true;
    setIdeaMentorBusy(true);
    setIdeaMentorError("");
    const messages = [...history, { role: "user" as const, content }];
    setIdeaMentorMessages(messages);

    try {
      const result = await requestMentorApi(
        {
          purpose: "idea-registration",
          messages: messages.slice(-12),
          ideas: [],
        },
        (payload): { reply: string; stage: string; idea: string } | null => {
          if (
            !payload || typeof payload !== "object" ||
            !("reply" in payload) || typeof payload.reply !== "string" ||
            !("stage" in payload) || typeof payload.stage !== "string" ||
            !["conversation", "write-idea", "confirm-registration", "not-now", "register"].includes(payload.stage)
          )
            return null;
          return {
            reply: payload.reply,
            stage: payload.stage,
            idea: "idea" in payload && typeof payload.idea === "string" ? payload.idea : "",
          };
        },
      );
      if (result.status === "disabled") {
        startStructuredRegistration(ideaMentorIdea || seed || content);
        return;
      }
      if (result.status === "retry") {
        setIdeaMentorDraft(content);
        setIdeaMentorError(result.message);
        return;
      }
      if (result.status === "cancelled") return;
      const { reply, stage, idea } = result.data;

      if (
        stage === "register" &&
        (!history.length ||
          ideaMentorStage !== "confirm-registration" ||
          !(idea || ideaMentorIdea) ||
          !hasExplicitRegistrationConsent(content))
      ) {
        throw new Error(
          "اگر مطمئنی که می‌خواهی ایده‌ات را ثبت کنی، روشن بگو؛ در غیر این صورت می‌توانیم بیشتر گفت‌وگو کنیم.",
        );
      }

      if (idea) setIdeaMentorIdea(idea);
      if (stage === "register") {
        startStructuredRegistration(idea || ideaMentorIdea || content);
        return;
      }
      if (!isIdeaMentorStage(stage))
        throw new Error("پاسخ منتور آماده نشد؛ کمی بعد دوباره تلاش کن.");
      if (
        stage === "confirm-registration" &&
        ideaMentorStage === "confirm-registration" &&
        /مطمئن\s*نیستم|گفت‌وگو|گفتگو/u.test(content)
      )
        setIdeaMentorReassuranceOffered(true);
      setIdeaMentorStage(stage);
      setIdeaMentorMessages((current) => [
        ...current,
        { role: "assistant", content: reply },
      ]);
      setIdeaMentorDraft("");
    } catch (error) {
      setIdeaMentorError(
        error instanceof Error
          ? error.message
          : "ارتباط با منتور برقرار نشد؛ دوباره تلاش کن.",
      );
    } finally {
      ideaMentorBusyRef.current = false;
      setIdeaMentorBusy(false);
    }
  }

  function startIdeaMentor() {
    const initialMessage = seed.trim();
    if (!initialMessage) {
      setFormError("برای شروع، چیزی از ایده یا چیزی که ذهنت را مشغول کرده بنویس.");
      return;
    }
    if (!canCreateIdea(stateRef.current, registrationsRef.current.length)) {
      setFormError("به سقف سه ثبت رسیده‌اید. ثبت‌های قبلی همچنان در دسترس‌اند.");
      return;
    }
    setFormError("");
    if (!stateRef.current.profile?.verified) {
      signupDestinationRef.current = "idea-mentor";
      setScreen("details");
      return;
    }
    signupDestinationRef.current = null;
    setIdeaMentorMessages([]);
    setIdeaMentorStage("conversation");
    setIdeaMentorIdea("");
    setIdeaMentorReassuranceOffered(false);
    setIdeaMentorDraft("");
    setScreen("idea-mentor");
    void sendIdeaMentorMessage(initialMessage, []);
  }

  const totalIdeas = state.ideas.length + registrations.length;
  const activeIdeas = state.ideas.filter((idea) => idea.status !== "submitted").length +
    registrations.filter(hasUnfinishedStructuredRegistration).length;
  const averageProgress = state.ideas.length
    ? Math.round(
        state.ideas.reduce((sum, idea) => sum + getProgress(idea), 0) /
          state.ideas.length,
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
  if (!ready)
    return (
      <main className="loading-screen" aria-label="در حال آماده‌سازی جوانه">
        <span className="loading-mark">
          <Sprout size={24} />
        </span>
        <span>فضای ایدهٔ شما در حال آماده‌شدن است…</span>
      </main>
    );

  if (formLockState.locked)
    return (
      <main className="loading-screen" role="alert">
        <span className="loading-mark">
          <LockKeyhole size={24} aria-hidden="true" />
        </span>
        <h1>تکمیل فرم موقتاً محدود شده است</h1>
        <p>پس از بیش از سه پاسخ نامعتبر، امکان تکمیل فرم تا ۱۲ ساعت متوقف می‌شود.</p>
        <p>
          زمان پایان محدودیت:{" "}
          {new Date(formLockState.lockedUntil).toLocaleString("fa-IR")}
        </p>
      </main>
    );

  return (
    <main
      className={`app-shell${screen === "home" ? " landing-shell" : screen === "dashboard" ? " dashboard-shell" : screen === "idea-mentor" ? " idea-mentor-shell" : ["details", "verify", "structured"].includes(screen) ? " glass-shell" : ""}`}
    >
      <header
        className={`topbar${screen === "home" ? " landing-topbar" : ""}`}
      >
        <button
          className={`brand${screen === "home" ? " landing-brand" : ""}`}
          onClick={() => setScreen("home")}
          aria-label="صفحهٔ اصلی جوانه"
        >
          <Image
            className={
              screen === "home"
                ? "landing-logo"
                : "brand-logo"
            }
            src="/javaneh-logo.png"
            alt="رویداد ملی نوآوری اجتماعی جوانه"
            width={2172}
            height={724}
            priority={screen === "home"}
          />
        </button>
        {screen === "home" ? (
          <>
            <nav className="landing-nav" aria-label="پیمایش اصلی">
              <a
                className={screen === "home" ? "is-active" : ""}
                href="#about"
              >
                رویداد
              </a>
              <button
                type="button"
                className="landing-nav-button"
                aria-haspopup="dialog"
                aria-expanded={infoDialog === "mentor"}
                onClick={(event) => {
                  infoDialogTriggerRef.current = event.currentTarget;
                  setInfoDialog("mentor");
                }}
              >
                منتور هوشمند
              </button>
              <button
                type="button"
                className="landing-nav-button"
                aria-haspopup="dialog"
                aria-expanded={infoDialog === "about"}
                onClick={(event) => {
                  infoDialogTriggerRef.current = event.currentTarget;
                  setInfoDialog("about");
                }}
              >
                درباره ما
              </button>
              <a href="#faq">پرسش‌های متداول</a>
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
                  document.getElementById("idea-seed")?.focus();
                }}
              >
                شروع یک ایده
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

      {infoDialog === "mentor" && (
        <div
          className="research-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setInfoDialog(null);
          }}
        >
          <section
            ref={infoDialogRef}
            className="research-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="research-dialog-title"
            aria-describedby="research-dialog-intro"
            dir="rtl"
          >
            <header className="research-dialog-header">
              <div className="research-dialog-brand">
                <span className="research-dialog-brand-icon" aria-hidden="true">
                  <BookOpenText size={18} />
                </span>
                <span>یادداشت پژوهشی منتور جوانه</span>
              </div>
              <button
                ref={infoDialogCloseRef}
                type="button"
                className="research-dialog-close"
                aria-label="بستن پشتوانهٔ علمی"
                onClick={() => setInfoDialog(null)}
              >
                <X size={19} aria-hidden="true" />
              </button>
            </header>

            <div className="research-dialog-content">
              <section className="research-hero">
                <div className="research-hero-copy">
                  <p className="research-eyebrow">از پژوهش تا همراهی در مسیر ایده</p>
                  <h1 id="research-dialog-title">
                    پشتوانهٔ علمی و پژوهشی
                    <span>منتور هوشمند جوانه</span>
                  </h1>
                  <p id="research-dialog-intro" className="research-hero-intro">
                    چارچوب این همراه هوشمند از تلفیق یافته‌های پژوهشی در منتورینگ،
                    تسهیلگری نوآوری، تفکر طراحی، کارآفرینی اجتماعی و توسعهٔ شایستگی‌های
                    نوآوری اجتماعی شکل گرفته است.
                  </p>
                </div>
                <div className="research-hero-index" aria-label="شش پژوهش علمی">
                  <span className="research-index-number">۰۶</span>
                  <span>پژوهش بین‌المللی</span>
                  <i aria-hidden="true" />
                  <small>یک چارچوب برای پرورش ایده</small>
                </div>
              </section>

              <div className="research-principles" aria-label="اصول همراهی منتور">
                <div className="research-principle">
                  <span>۰۱</span>
                  <b>پرسشگری هدفمند</b>
                  <small>روشن‌کردن مسئله و نیاز</small>
                </div>
                <div className="research-principle">
                  <span>۰۲</span>
                  <b>بازتعریف مسئله</b>
                  <small>دیدن پیوندها و ظرفیت‌ها</small>
                </div>
                <div className="research-principle">
                  <span>۰۳</span>
                  <b>همراهی متناسب</b>
                  <small>هماهنگ با بلوغ هر ایده</small>
                </div>
              </div>

              <section className="research-story" aria-labelledby="research-approach-title">
                <div className="research-section-heading">
                  <span className="research-section-mark" aria-hidden="true"><Sprout size={19} /></span>
                  <div>
                    <span>رویکرد طراحی</span>
                    <h2 id="research-approach-title">منتور، تسهیلگر رشد ایده است</h2>
                  </div>
                </div>
                <p>
                  منتور هوشمند جوانه صرفاً ابزار پرسش‌وپاسخ یا ثبت اطلاعات نیست؛
                  نقش آن تسهیلگری هوشمند برای توسعهٔ ایده است. با تکیه بر گوش‌دادن
                  فعال، تفکر انتقادی و سیستمی، پرسشگری هدفمند و شناسایی ظرفیت‌های
                  پنهان، تلاش می‌کند افراد را در تبدیل دغدغه‌ها و ایده‌های اولیه به
                  راه‌حل‌های اجتماعی منسجم همراهی کند.
                </p>
                <p>
                  مسیر گفت‌وگو با توجه به تفاوت تجربهٔ افراد و میزان شکل‌گرفتن هر ایده
                  تنظیم می‌شود. هدف، فراتر رفتن از جمع‌آوری ایده‌ها و فراهم‌کردن
                  فرصتی برای یادگیری، کشف، تفکر خلاق و پرورش آن‌هاست؛ فرد مشارکت‌کنندهٔ
                  اصلی در شکل‌گیری و تکامل ایدهٔ خود باقی می‌ماند.
                </p>
              </section>

              <section className="research-sources" aria-labelledby="research-sources-title">
                <div className="research-section-heading research-sources-heading">
                  <span className="research-section-mark research-section-mark-warm" aria-hidden="true">
                    <FileText size={18} />
                  </span>
                  <div>
                    <span>مطالعات مرجع</span>
                    <h2 id="research-sources-title">شش پژوهش در شکل‌گیری چارچوب</h2>
                  </div>
                  <small>منابع علمی و پژوهشی</small>
                </div>
                <div className="research-source-list">
                  <article className="research-source">
                    <span className="research-source-number">۰۱</span>
                    <div className="research-source-copy">
                      <h3>Development of a Competency Model for Facilitators in Design Thinking (2020)</h3>
                      <p>توسعهٔ مدل شایستگی برای تسهیلگران تفکر طراحی؛ پژوهشی دربارهٔ شناسایی و اولویت‌بندی مهارت‌ها و شایستگی‌های تسهیلگران حرفه‌ای.</p>
                      <a href="https://doi.org/10.22251/jlcci.2020.20.17.449" target="_blank" rel="noreferrer">
                        مشاهدهٔ مقاله و دسترسی به متن <ArrowUpRight size={15} aria-hidden="true" />
                      </a>
                    </div>
                  </article>
                  <article className="research-source">
                    <span className="research-source-number">۰۲</span>
                    <div className="research-source-copy">
                      <h3>Design Facilitation: A Critical Review of Conceptualisations and Constructs (2021)</h3>
                      <p>تسهیلگری طراحی: مرور انتقادی مفاهیم و سازه‌های نظری؛ مروری بر ۱۰۲ اثر پژوهشی برای تبیین ماهیت و مؤلفه‌های تسهیلگری طراحی.</p>
                      <a href="https://doi.org/10.1016/j.tsc.2021.100962" target="_blank" rel="noreferrer">
                        مشاهدهٔ مقاله <ArrowUpRight size={15} aria-hidden="true" />
                      </a>
                    </div>
                  </article>
                  <article className="research-source">
                    <span className="research-source-number">۰۳</span>
                    <div className="research-source-copy">
                      <h3>Taxonomy of Design Thinking Facilitation (2021)</h3>
                      <p>گونه‌شناسی تسهیلگری تفکر طراحی؛ پژوهشی دربارهٔ رویکردهای تسهیلگری و نقش مشارکت و همراهی در فرایند توسعهٔ نوآوری.</p>
                      <a href="https://findresearcher.sdu.dk/ws/files/189850446/caim.12451.pdf" target="_blank" rel="noreferrer">
                        دسترسی به نسخهٔ PDF مقاله <ArrowUpRight size={15} aria-hidden="true" />
                      </a>
                    </div>
                  </article>
                  <article className="research-source">
                    <span className="research-source-number">۰۴</span>
                    <div className="research-source-copy">
                      <h3>Enhancing Entrepreneurial Learning Through Mentoring: A Situational and Generic Mentor Role Taxonomy (2021)</h3>
                      <p>تقویت یادگیری کارآفرینانه از طریق منتورینگ؛ پژوهشی دربارهٔ نقش‌های متنوع منتور و ضرورت تطبیق شیوهٔ همراهی با نیازهای یادگیری افراد.</p>
                      <a href="https://doi.org/10.1108/JSBED-11-2019-0356" target="_blank" rel="noreferrer">
                        مشاهدهٔ مقاله <ArrowUpRight size={15} aria-hidden="true" />
                      </a>
                    </div>
                  </article>
                  <article className="research-source">
                    <span className="research-source-number">۰۵</span>
                    <div className="research-source-copy">
                      <h3>Social Entrepreneurship Education: A Conceptual Framework and Review (2021)</h3>
                      <p>آموزش کارآفرینی اجتماعی: چارچوب مفهومی و مرور پژوهش‌ها دربارهٔ توسعهٔ دانش، مهارت‌ها و شایستگی‌های موردنیاز.</p>
                      <a href="https://doi.org/10.1016/j.ijme.2021.100533" target="_blank" rel="noreferrer">
                        مشاهدهٔ مقاله <ArrowUpRight size={15} aria-hidden="true" />
                      </a>
                    </div>
                  </article>
                  <article className="research-source">
                    <span className="research-source-number">۰۶</span>
                    <div className="research-source-copy">
                      <h3>Exploring Team Roles for Social Innovation Labs: Toward a Competence-Based Role Self-Assessment Approach (2024)</h3>
                      <p>بررسی نقش‌های تیمی در آزمایشگاه‌های نوآوری اجتماعی؛ پژوهشی دربارهٔ شایستگی‌های تسهیلگر، سازنده، آینده‌نگر و مدیر در تیم‌های نوآوری اجتماعی.</p>
                      <a href="https://doi.org/10.1016/j.jengtecman.2024.101799" target="_blank" rel="noreferrer">
                        مشاهده و دریافت متن مقالهٔ دسترسی‌آزاد <ArrowUpRight size={15} aria-hidden="true" />
                      </a>
                    </div>
                  </article>
                </div>
              </section>

              <p className="research-dialog-footer">
                جوانه می‌کوشد بستری فراهم کند تا دغدغه‌ها و ایده‌های اولیه نیز فرصت
                بررسی، توسعه و تبدیل‌شدن به راه‌حل‌هایی با ارزش اجتماعی را پیدا کنند.
              </p>
            </div>
          </section>
        </div>
      )}

      {infoDialog === "about" && (
        <div
          className="research-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setInfoDialog(null);
          }}
        >
          <section
            ref={infoDialogRef}
            className="research-dialog about-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="about-dialog-title"
            aria-describedby="about-dialog-intro"
            dir="rtl"
          >
            <header className="research-dialog-header">
              <div className="research-dialog-brand">
                <span className="research-dialog-brand-icon" aria-hidden="true">
                  <Flower2 size={19} />
                </span>
                <span>رویداد ملی نوآوری اجتماعی جوانه</span>
              </div>
              <button
                ref={infoDialogCloseRef}
                type="button"
                className="research-dialog-close"
                aria-label="بستن دربارهٔ ما"
                onClick={() => setInfoDialog(null)}
              >
                <X size={19} aria-hidden="true" />
              </button>
            </header>

            <div className="research-dialog-content about-dialog-content">
              <section className="about-hero">
                <div className="about-hero-copy">
                  <p className="research-eyebrow">از یک مسئلهٔ مشترک تا راه‌حل‌های برخاسته از جامعه</p>
                  <h1 id="about-dialog-title">
                    وقتی مردم دست‌به‌کار می‌شوند،
                    <span>راه‌های تازه جوانه می‌زنند.</span>
                  </h1>
                  <p id="about-dialog-intro" className="research-hero-intro">
                    صندوق فناوری‌ها و نوآوری‌های اجتماعی جوانه، رویداد ملی نوآوری اجتماعی
                    جوانه را برای شناسایی و گردآوری ایده‌ها و راه‌حل‌های نوآورانه دربارهٔ
                    مسائل اولویت‌دار کشور طراحی کرده است؛ بستری برای دیده‌شدن ظرفیت مردم
                    در پاسخ‌دادن به مسئله‌های جامعه.
                  </p>
                </div>
                <div className="about-journey" aria-hidden="true">
                  <span className="about-journey-label">از مسئله</span>
                  <span className="about-journey-stem" />
                  <span className="about-journey-mark"><Sprout size={24} /></span>
                  <span className="about-journey-stem" />
                  <span className="about-journey-label">تا کنش جمعی</span>
                </div>
              </section>

              <section className="about-question" aria-labelledby="about-question-title">
                <div className="research-section-heading">
                  <span className="research-section-mark research-section-mark-warm" aria-hidden="true">
                    <Lightbulb size={19} />
                  </span>
                  <div>
                    <span>پرسش محوری دورهٔ نخست</span>
                    <h2 id="about-question-title">یک پرسش، هزار امکان برای پاسخ</h2>
                  </div>
                </div>
                <blockquote>
                  چه ایده‌ها و راه‌حل‌های نوآورانه‌ای می‌توانند ظرفیت مردم را برای کنش
                  مؤثر، جمعی و پایدار در مواجهه با جنگ اقتصادی فعال کنند؟
                </blockquote>
                <p>
                  این پرسش، چارچوب موضوعی نخستین دوره است؛ راه‌حل‌ها می‌توانند از دل
                  تجربه‌های محلی، همکاری‌های مردمی و نگاه‌های تازه به یک مسئله شکل بگیرند.
                </p>
              </section>

              <section className="about-approach" aria-labelledby="about-approach-title">
                <div className="research-section-heading">
                  <span className="research-section-mark" aria-hidden="true">
                    <Users size={19} />
                  </span>
                  <div>
                    <span>نگاه جوانه</span>
                    <h2 id="about-approach-title">نوآوری اجتماعی، فقط یک فناوری یا کسب‌وکار تازه نیست</h2>
                  </div>
                </div>
                <p>
                  پاسخ نوآورانه می‌تواند الگویی برای مشارکت و یاریگری، مداخله‌ای رفتاری،
                  ابتکاری فرهنگی یا رسانه‌ای، سازوکاری برای همکاری یا مدلی اجتماعی و
                  اقتصادی باشد. نقطهٔ آغاز، فهم مسئله و فعال‌کردن ظرفیت‌های واقعی مردم است.
                </p>
                <div className="about-audience-line">
                  <span>این میدان برای</span>
                  <b>صاحبان ایده</b>
                  <i />
                  <b>گروه‌های مردمی</b>
                  <i />
                  <b>متخصصان و دانشگاهیان</b>
                  <i />
                  <b>فعالان اجتماعی</b>
                  <span>گشوده است.</span>
                </div>
              </section>

              <section className="about-themes" aria-labelledby="about-themes-title">
                <div className="research-section-heading about-themes-heading">
                  <span className="research-section-mark" aria-hidden="true">
                    <Flower2 size={19} />
                  </span>
                  <div>
                    <span>شش پنجره به یک مسئلهٔ ملی</span>
                    <h2 id="about-themes-title">محورهای نوآوری در دورهٔ نخست</h2>
                  </div>
                  <small>ایده‌های بین‌محوری هم جا دارند</small>
                </div>
                <div className="about-theme-list">
                  <article className="about-theme">
                    <span>۰۱</span>
                    <div>
                      <h3>مصرف هوشمند، اتلاف کمتر</h3>
                      <p>مشارکت مردم برای مدیریت پایدار مصرف انرژی، آب، غذا و دیگر منابع.</p>
                    </div>
                  </article>
                  <article className="about-theme">
                    <span>۰۲</span>
                    <div>
                      <h3>فرهنگ حمایت از تولید داخلی</h3>
                      <p>الگوهای اجتماعی و فرهنگی برای حمایت آگاهانه و پایدار از تولید.</p>
                    </div>
                  </article>
                  <article className="about-theme">
                    <span>۰۳</span>
                    <div>
                      <h3>یاریگری و همکاری اقتصادی</h3>
                      <p>به‌اشتراک‌گذاری منابع، مهارت‌ها و توان جمعی برای پاسخ به نیازها.</p>
                    </div>
                  </article>
                  <article className="about-theme">
                    <span>۰۴</span>
                    <div>
                      <h3>تاب‌آوری اجتماعی</h3>
                      <p>تقویت پیوند، اعتماد و حمایت متقابل در برابر فشارهای اقتصادی.</p>
                    </div>
                  </article>
                  <article className="about-theme">
                    <span>۰۵</span>
                    <div>
                      <h3>روایت و بسیج اجتماعی</h3>
                      <p>ارتباطات و ابتکارهای رسانه‌ای برای آگاهی و کنش هدفمند و پایدار.</p>
                    </div>
                  </article>
                  <article className="about-theme">
                    <span>۰۶</span>
                    <div>
                      <h3>توانمندسازی اقشار آسیب‌پذیر</h3>
                      <p>راه‌حل‌هایی برای افزایش عاملیت و توان مواجهه با فشار اقتصادی.</p>
                    </div>
                  </article>
                </div>
              </section>

              <p className="research-dialog-footer about-dialog-footer">
                محورهای دوره، چارچوب مسئله‌اند؛ نه حصاری برای خلاقیت. ایده‌های تازه و
                بین‌محوری نیز می‌توانند به گفت‌وگو دربارهٔ راه‌حل‌های اجتماعی بیفزایند.
              </p>
            </div>
          </section>
        </div>
      )}

      {storageError && (
        <p className="storage-error" role="alert">
          <CircleHelp size={16} />
          <span>{storageError}</span>
        </p>
      )}
      {screen === "home" && (
        <section className="home-view">
          <div className="home-heading landing-heading" id="about">
            <h1>
              جـــــوانه
              <Sprout className="landing-title-sprout" size={40} strokeWidth={2} aria-hidden="true" />
            </h1>
            <p className="landing-subtitle">
              رویداد ملی <em>نوآوری اجتماعی</em>
            </p>
            <p className="home-intro landing-intro">
              ایده‌هایتان را به اشتراک بگذارید؛ فردایی بهتر را با هم بسازیم.
            </p>
          </div>
          <form
            className="composer-wrap landing-composer"
            id="how-it-works"
            onSubmit={(event) => {
              event.preventDefault();
              startIdeaMentor();
            }}
          >
            <div className="landing-entry-row">
              <span className="landing-idea-icon">
                <Lightbulb size={42} strokeWidth={1.7} aria-hidden="true" />
              </span>
              <span className="landing-entry-divider" aria-hidden="true" />
              <div className="landing-input-wrap">
                <label className="sr-only" htmlFor="idea-seed">
                  ایده یا مسئله‌ای را که در ذهنتان است با واژه‌های خودتان بنویسید
                </label>
                <textarea
                  id="idea-seed"
                  ref={seedInputRef}
                  className="seed-input landing-seed-input"
                  placeholder="ایده، مسئله یا چیزی را که ذهنتان را مشغول کرده بنویسید…"
                  value={seed}
                  onChange={(event) => {
                    const textarea = event.currentTarget;
                    textarea.style.height = "auto";
                    const maxHeight = 240;
                    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
                    textarea.style.overflowY =
                      textarea.scrollHeight > maxHeight ? "auto" : "hidden";
                    setSeed(event.target.value);
                    setFormError("");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      startIdeaMentor();
                    }
                  }}
                  rows={1}
                  maxLength={600}
                  dir="auto"
                  aria-describedby="seed-hint seed-error"
                />
                <button
                  type="submit"
                  className="landing-send-button"
                  disabled={
                    seedSpeechBusy ||
                    !seed.trim() ||
                    !canCreateIdea(state, registrations.length)
                  }
                  aria-label="ارسال ایده"
                  title="ارسال ایده"
                >
                  <Send size={19} aria-hidden="true" />
                </button>
                <SpeechInputControl
                  onTranscript={appendSeedTranscript}
                  onBusyChange={setSeedSpeechBusy}
                />
              </div>
            </div>
            <div className="composer-meta landing-composer-meta">
              <span id="seed-hint">
                <Info size={16} aria-hidden="true" />
                ایده، پرسش یا تجربه‌تان را بنویسید؛ با هم مسیر مناسب را پیدا می‌کنیم
              </span>
              <span>{formatNumber(seed.length)}/{formatNumber(600)}</span>
            </div>
            {formError && (
              <p className="inline-error" id="seed-error" role="alert">
                {formError}
              </p>
            )}
            {!formError && (
              <p className="sr-only" id="seed-error">
                مسئله‌ای اجتماعی یا ایده‌تان را بنویسید. حداکثر ۶۰۰ نویسه.
              </p>
            )}
            {!canCreateIdea(state, registrations.length) && (
              <p className="capacity-note">
                به سقف سه ثبت رسیده‌اید. برای ادامه یکی از ثبت‌های قبلی را باز کنید.
              </p>
            )}
          </form>
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
              <summary>رویداد ملی نوآوری اجتماعی جوانه با چه هدفی برگزار می‌شود؟</summary>
              <p>
                این رویداد با هدف شناسایی، گردآوری و حمایت از ایده‌ها و راه‌حل‌های نوآورانه اجتماعی برگزار می‌شود. در نخستین دوره، تمرکز اصلی بر فعال‌سازی ظرفیت کنشگری مردم برای مواجهه با جنگ اقتصادی و تبدیل ظرفیت‌های پراکنده اجتماعی به کنش‌های مؤثر، جمعی و پایدار است.
              </p>
            </details>
            <details>
              <summary>چه کسانی می‌توانند در رویداد جوانه شرکت کنند؟</summary>
              <p>
                تمام افراد دارای ایده، متخصصان، دانشگاهیان، فعالان اجتماعی، گروه‌های مردمی، سازمان‌های مردم‌نهاد و سایر علاقه‌مندان به حل مسائل اجتماعی می‌توانند در این رویداد مشارکت کنند. هدف رویداد فراهم‌کردن بستری برای حضور طیف متنوعی از صاحبان ایده و تجربه است.
              </p>
            </details>
            <details>
              <summary>ایده‌های قابل پذیرش در رویداد باید چه ویژگی‌هایی داشته باشند؟</summary>
              <p>
                ایده‌ها باید با مسئله اصلی رویداد و محورهای شش‌گانه آن ارتباط داشته باشند و بتوانند به فعال‌سازی ظرفیت‌های مردمی برای مواجهه با فشارها و پیامدهای اقتصادی کمک کنند. ایده‌ها الزاماً نباید فناورانه، استارتاپی یا مبتنی بر راه‌اندازی کسب‌وکار باشند و می‌توانند در قالب الگوهای مشارکت، یاریگری، ابتکارات فرهنگی و رسانه‌ای، مداخلات رفتاری و مدل‌های اقتصادی و اجتماعی ارائه شوند.
              </p>
            </details>
            <details>
              <summary>ایده‌ها چگونه ارزیابی و داوری می‌شوند؟</summary>
              <p>
                ایده‌های دریافتی ابتدا از نظر انطباق با موضوع و محورهای رویداد بررسی می‌شوند و سپس در فرایندی تخصصی مورد ارزیابی قرار می‌گیرند. معیارهای ارزیابی شامل ارتباط با مسئله، نوآوری و تمایز، ظرفیت فعال‌سازی مشارکت مردم، امکان‌پذیری اولیه، ظرفیت اثرگذاری اجتماعی و قابلیت تداوم یا توسعه ایده است.
              </p>
            </details>
            <details>
              <summary>آیا ثبت یا انتخاب یک ایده به معنای تضمین حمایت مالی یا اجرای آن است؟</summary>
              <p>
                خیر. هدف رویداد شناسایی و گردآوری ایده‌های نوآورانه و فراهم‌کردن زمینه معرفی آن‌ها به دستگاه‌ها و نهادهای مرتبط برای بهره‌برداری احتمالی است. ثبت یا حتی انتخاب یک ایده، به‌خودی‌خود تعهدی برای خرید ایده، انعقاد قرارداد، مشارکت در اجرا یا پرداخت حق‌الزحمه ایجاد نمی‌کند. از صاحبان ایده‌های برتر در قالب جوایز رویداد تقدیر خواهد شد.
              </p>
            </details>
          </section>
        </section>
      )}

      {screen === "idea-mentor" && (
        <section className="journey-view idea-mentor-view">
          <div className="idea-mentor-heading">
            <div className="idea-mentor-heading-copy">
              <div className="eyebrow">
                <span className="eyebrow-line" />
                کارگاه ایده
              </div>
              <h1>از همین‌جا شروع کنیم</h1>
              <p>با هم فکر اولیه را به مسئله‌ای روشن‌تر تبدیل می‌کنیم.</p>
            </div>
            <button
              className="back-link"
              onClick={() => setScreen("home")}
              aria-label="بازگشت به صفحهٔ اصلی"
              title="بازگشت به صفحهٔ اصلی"
            >
              <ArrowLeft size={16} aria-hidden="true" />
              بازگشت
            </button>
          </div>
          <div className="idea-mentor-panel">
            <div className="mentor-chat-topline">
              <span className="mentor-chat-avatar" aria-hidden="true">
                <Sparkles size={20} />
              </span>
              <div className="mentor-chat-person">
                <b>همراه شما در مسیر ایده</b>
                <span><i /> گفت‌وگوی امروز</span>
              </div>
              <span className="mentor-chat-badge">
                <Sparkles size={14} /> راهنمای اجتماعی
              </span>
            </div>
            <div
              className="mentor-chat-thread idea-mentor-thread"
              role="log"
              aria-live="polite"
              aria-relevant="additions"
            >
              {ideaMentorMessages.map((message, index) => {
                const displayContent = message.role === "assistant"
                  ? toPersianDigits(message.content)
                  : message.content;
                return (
                  <div
                    className={`mentor-chat-row${message.role === "user" ? " is-user" : " is-mentor"}`}
                    key={`${message.role}-${index}`}
                  >
                    {message.role === "assistant" && (
                      <span className="mentor-chat-mini-avatar" aria-hidden="true">
                        <Sparkles size={13} />
                      </span>
                    )}
                    <p dir="auto"><bdi>{displayContent}</bdi></p>
                  </div>
                );
              })}
              {ideaMentorBusy && (
                <div className="mentor-chat-row is-mentor">
                  <span className="mentor-chat-mini-avatar" aria-hidden="true">
                    <Sparkles size={13} />
                  </span>
                  <p className="mentor-chat-typing" role="status">
                    <i /><i /><i />
                    <span className="sr-only">منتور در حال فکرکردن است</span>
                  </p>
                </div>
              )}
              <div ref={ideaMentorEndRef} />
            </div>
            {ideaMentorStage === "confirm-registration" && (
              <div className="mentor-chat-suggestions idea-mentor-actions">
                <button
                  type="button"
                  disabled={ideaMentorBusy || !ideaMentorIdea}
                  onClick={() => startStructuredRegistration(ideaMentorIdea)}
                >
                  بله، ادامهٔ ثبت ایده <ArrowLeft size={13} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  disabled={ideaMentorBusy}
                  onClick={() =>
                    void sendIdeaMentorMessage(
                      ideaMentorReassuranceOffered
                        ? "نه، فعلاً خودم به ایده‌ام فکر می‌کنم."
                        : "مطمئن نیستم؛ می‌خوام قبل از تصمیم برای ثبت، بیشتر دربارهٔ ایده‌ام با منتور گفت‌وگو کنم.",
                    )
                  }
                >
                  {ideaMentorReassuranceOffered
                    ? "نه، فعلاً خودم فکر می‌کنم"
                    : "فعلاً مطمئن نیستم؛ بیشتر گفت‌وگو کنیم"}
                  <ArrowLeft size={13} aria-hidden="true" />
                </button>
              </div>
            )}
            {ideaMentorStage === "not-now" && (
              <div className="mentor-chat-suggestions idea-mentor-actions">
                <span role="status">
                  گفت‌وگو فعلاً متوقف شده است؛ اگر نظرت عوض شد، می‌توانی ثبت ایده را ادامه بدهی.
                </span>
                <button
                  type="button"
                  disabled={ideaMentorBusy || !ideaMentorIdea}
                  onClick={() => startStructuredRegistration(ideaMentorIdea)}
                >
                  با این حال، ایده‌ام را ثبت می‌کنم
                  <ArrowLeft size={13} aria-hidden="true" />
                </button>
              </div>
            )}
            {ideaMentorError && (
              <div className="mentor-chat-error" role="alert">
                {ideaMentorError}
                {mentorApiDisabled && (
                  <button type="button" className="text-button" onClick={resetMentorApiConnection}>
                    تلاش دوباره برای اتصال
                  </button>
                )}
              </div>
            )}
            <form
              className="mentor-chat-composer"
              onSubmit={(event) => {
                event.preventDefault();
                void sendIdeaMentorMessage(ideaMentorDraft);
              }}
            >
              <textarea
                ref={ideaMentorInputRef}
                value={ideaMentorDraft}
                onChange={(event) => setIdeaMentorDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendIdeaMentorMessage(ideaMentorDraft);
                  }
                }}
                maxLength={1200}
                rows={2}
                placeholder={
                  ideaMentorStage === "not-now"
                    ? "گفت‌وگو فعلاً متوقف شده است"
                    : "هرچه به ذهنت می‌رسد بنویس…"
                }
                aria-label="پیام شما به منتور ثبت ایده"
                disabled={ideaMentorBusy || ideaMentorStage === "not-now"}
              />
              <button
                type="submit"
                disabled={
                  ideaMentorBusy ||
                  ideaMentorStage === "not-now" ||
                  !ideaMentorDraft.trim()
                }
                aria-label="ارسال پیام"
              >
                <Send size={18} aria-hidden="true" />
              </button>
              <span>
                {ideaMentorStage === "not-now"
                  ? "هر زمان آماده بودی، می‌توانی دوباره از صفحهٔ اصلی شروع کنی."
                  : "Enter برای ارسال · Shift + Enter برای خط بعد"}
              </span>
            </form>
            <p className="mentor-chat-footnote">
              <ShieldCheck size={14} aria-hidden="true" />
              برای پاسخ‌گویی، پیام‌ها به سرویس هوش مصنوعی فرستاده می‌شوند؛ اطلاعات
              هویتی و تماس را ننویس.
            </p>
          </div>
        </section>
      )}

      {screen === "structured" && activeRegistration && (
        <StructuredRegistrationForm
          registration={activeRegistration}
          storageError={storageError}
          onChange={persistRegistration}
          onBack={() => {
            setActiveRegistration(null);
            setScreen(structuredReturnScreenRef.current);
          }}
          onSubmit={(registration) => submitRegistration({
            ...registration,
            status: "submitted",
            activeFlow: "dashboard",
            submittedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })}
        />
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
            نام شما برای نمایش در نمایه استفاده می‌شود. شمارهٔ همراه و کد ملی فقط برای گذر از این مرحله درخواست می‌شوند.
          </p>
          <div className="privacy-panel">
            <ShieldCheck size={19} />
            <p>
              <b>یادآوری حریم خصوصی</b>
              <br />
              پیامکی ارسال نمی‌شود و هیچ سرویس احراز هویتی فراخوانی نمی‌شود. کد ملی و شمارهٔ همراه شما نگهداری یا ارسال نمی‌شوند و پس از این مرحله کنار گذاشته می‌شوند. فقط نام و وضعیت عبور از این مرحله برای ادامه استفاده می‌شود.
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
                value={toPersianDigits(nationalId)}
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
                value={toPersianDigits(mobile)}
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
            شمارهٔ همراه <bdi dir="ltr">{toPersianDigits(maskedMobile)}</bdi>
          </div>
          <form className="details-form" onSubmit={verifyCode} noValidate>
            <label htmlFor="verification-code">
              کد ادامه
              <input
                id="verification-code"
                value={toPersianDigits(code)}
                onChange={(e) =>
                  setCode(normalizeDigits(e.target.value).replace(/\D/g, "").slice(0, 8))
                }
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="کد ۴ رقمی"
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

      {screen === "dashboard" && (
        <section className="dashboard-view">
          <aside className="dashboard-sidebar" aria-label="پیمایش فضای کار">
            <button
              className="dashboard-sidebar-brand"
              onClick={() => setScreen("home")}
              aria-label="صفحهٔ اصلی جوانه"
            >
              <Image
                className="dashboard-sidebar-logo"
                src="/javaneh-logo.png"
                alt="رویداد ملی نوآوری اجتماعی جوانه"
                width={2172}
                height={724}
              />
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
              <button
                type="button"
                disabled
                title="پرسش‌های متداول در این بخش هنوز در دسترس نیستند."
              >
                <CircleHelp size={18} aria-hidden="true" /> پرسش‌های متداول
              </button>
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
            </div>

            <div className="dashboard-summary">
              <article className="dashboard-stat-card idea-stat-card">
                <span className="dashboard-stat-icon">
                  <Lightbulb size={22} aria-hidden="true" />
                </span>
                <div className="dashboard-stat-copy">
                  <b>{formatNumber(activeIdeas)} <small>/ {formatNumber(3)}</small></b>
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
                disabled={!canCreateIdea(state, registrations.length)}
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
                      {formatNumber(totalIdeas)} ایده در فهرست شما
                    </span>
                  </div>
                </div>
                <details className="dashboard-saved-details" id="workspace-faq">
                  <summary>
                    محل نگهداری اطلاعات <ChevronDown size={15} aria-hidden="true" />
                  </summary>
                  <p>{labels.privacyNotice}</p>
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
                        ثبت قدیمی
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
              {registrations.map((registration, index) => {
                const title = registration.data.title.trim() ||
                  registration.data.problem.trim().replace(/\s+/gu, " ").slice(0, 48) ||
                  "ایدهٔ تازه";
                const isUnfinished = hasUnfinishedStructuredRegistration(registration);
                return (
                  <article className="idea-row" key={`structured-${registration.id}`}>
                    <div className="idea-number">
                      {formatNumber(state.ideas.length + index + 1).padStart(2, formatNumber(0))}
                    </div>
                    <div className="idea-content">
                      <div className="idea-title-line">
                        <h3><bdi dir="auto">{title}</bdi></h3>
                        <span className={`status-pill ${isUnfinished ? "status-in-development" : "status-submitted"}`}>
                          {isUnfinished ? "در حال تکمیل" : "ثبت‌شده"}
                        </span>
                      </div>
                      <p className="idea-seed" dir="auto">
                        {registration.data.problem.trim() || "فرم اولیهٔ ثبت ایده"}
                      </p>
                      <div className="idea-meta">
                        <span>
                          <Clock3 size={14} />
                          به‌روزرسانی: {formatDate(registration.updatedAt)}
                        </span>
                        <span><FileText size={14} /> فرم ثبت ایده</span>
                        <span><Sparkles size={14} /> {formatNumber(structuredScore(registration))} امتیاز</span>
                      </div>
                    </div>
                    <div className="idea-actions">
                      <button
                        className="secondary-button"
                        onClick={() => openStructuredRegistration(registration)}
                      >
                        {isUnfinished ? "ادامهٔ ثبت ایده" : "مرور ثبت"}
                        <ArrowRight size={16} />
                      </button>
                      <button
                        className="delete-idea-button"
                        onClick={() => deleteStructuredRegistration(registration, title)}
                        aria-label={`حذف ایدهٔ ${title}`}
                      >
                        حذف ایده <Trash2 size={16} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          {!canCreateIdea(state, registrations.length) && (
            <p className="limit-note">
              <LockKeyhole size={15} />
              به سقف سه ثبت رسیده‌اید. ایده‌ها و ثبت‌های قبلی همچنان در دسترس‌اند.
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
                دربارهٔ ثبت ایده، قدم‌های بعدی یا هر ایده‌ای که در ذهنتان دارید، راحت و بی‌تکلف گفت‌وگو کنید.
              </p>
              <button
                className="dashboard-mentor-action"
                onClick={() => {
                  setMentorChatError("");
                  setMentorChatOpen(true);
                }}
              >
                <MessageCircle size={18} aria-hidden="true" />
                <span>گفت‌وگو با منتور</span>
                <ArrowLeft size={16} aria-hidden="true" />
              </button>
              <span className="dashboard-mentor-hint">
                دربارهٔ ایده‌هایت بپرس؛ منتور اینجاست تا با هم قدم بعدی را پیدا کنید.
              </span>
            </aside>
          </div>
          {storageError && (
            <div
              className="dashboard-feedback is-warning"
              role="alert"
            >
              <ShieldCheck size={18} aria-hidden="true" />
              <span>{storageError}</span>
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

      {screen === "dashboard" && mentorChatOpen && (
        <div
          className="mentor-chat-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setMentorChatOpen(false);
          }}
        >
          <section
            className="mentor-chat-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mentor-chat-title"
          >
            <div className="mentor-chat-topline">
              <span className="mentor-chat-avatar" aria-hidden="true">
                <Sparkles size={20} />
              </span>
              <div className="mentor-chat-person">
                <b id="mentor-chat-title">گفت‌وگو با منتور جوانه</b>
                <span><i /> همراه شما در مسیر ایده</span>
              </div>
              <span className="mentor-chat-badge">
                <Sparkles size={14} /> همراه هوشمند
              </span>
              <button
                type="button"
                className="mentor-chat-close"
                aria-label="بستن گفت‌وگو"
                onClick={() => setMentorChatOpen(false)}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="mentor-chat-thread" aria-live="polite">
              <div className="mentor-chat-date">گفت‌وگوی امروز</div>
              {mentorChatMessages.map((message, index) => {
                const displayContent = message.role === "assistant"
                  ? toPersianDigits(message.content)
                  : message.content;
                const isRevealing = message.role === "assistant" &&
                  mentorChatReveal?.messageIndex === index;
                const words = isRevealing ? mentorWords(displayContent) : [];
                const revealComplete = isRevealing &&
                  mentorChatReveal.visibleWords >= words.length;
                return (
                  <div
                    className={`mentor-chat-row${message.role === "user" ? " is-user" : " is-mentor"}`}
                    key={`${message.role}-${index}`}
                  >
                    {message.role === "assistant" && (
                      <span className="mentor-chat-mini-avatar" aria-hidden="true">
                        <Sparkles size={13} />
                      </span>
                    )}
                    <p dir="auto">
                      {isRevealing ? (
                        <>
                          <span aria-hidden="true">
                            {words.slice(0, mentorChatReveal.visibleWords).join("")}
                          </span>
                          {!revealComplete && <span className="mentor-chat-caret" aria-hidden="true" />}
                          {revealComplete && <span className="sr-only">{displayContent}</span>}
                        </>
                      ) : (
                        <bdi>{displayContent}</bdi>
                      )}
                    </p>
                  </div>
                );
              })}
              {mentorChatBusy && (
                <div className="mentor-chat-row is-mentor">
                  <span className="mentor-chat-mini-avatar" aria-hidden="true">
                    <Sparkles size={13} />
                  </span>
                  <p className="mentor-chat-typing">
                    <i /><i /><i /> منتورت دارد فکر می‌کند
                  </p>
                </div>
              )}
              <div ref={mentorChatEndRef} />
            </div>
            {mentorChatMessages.length === 1 && (
              <div className="mentor-chat-suggestions" aria-label="پیشنهاد برای شروع گفت‌وگو">
                <span>از این سؤال‌ها شروع کن</span>
                {[
                  "برای شروع ثبت ایده باید چه‌کار کنم؟",
                  "مرحله‌های پرورش ایده چه هستند؟",
                  "برای بهتر کردن ایده‌ام از کجا شروع کنم؟",
                ].map((prompt) => (
                  <button
                    type="button"
                    key={prompt}
                    onClick={() => setMentorChatDraft(prompt)}
                  >
                    {prompt} <ArrowLeft size={13} aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
            {mentorChatError && (
              <div className="mentor-chat-error" role="alert">
                {mentorChatError}
                {mentorApiDisabled && (
                  <button type="button" className="text-button" onClick={resetMentorApiConnection}>
                    تلاش دوباره برای اتصال
                  </button>
                )}
              </div>
            )}
            <form
              className="mentor-chat-composer"
              onSubmit={(event) => {
                event.preventDefault();
                void sendMentorChatMessage();
              }}
            >
              <textarea
                ref={mentorChatInputRef}
                value={mentorChatDraft}
                onChange={(event) => setMentorChatDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMentorChatMessage();
                  }
                }}
                maxLength={1200}
                rows={2}
                placeholder="هرچه دوست داری از منتورت بپرس…"
                  dir="rtl"
                disabled={mentorChatBusy}
              />
              <button
                type="submit"
                disabled={mentorChatBusy || !mentorChatDraft.trim()}
                aria-label="ارسال پیام"
              >
                <Send size={18} aria-hidden="true" />
              </button>
              <span>Enter برای ارسال · Shift + Enter برای خط بعد</span>
            </form>
            <p className="mentor-chat-footnote">
              <ShieldCheck size={14} aria-hidden="true" />
              برای پاسخ‌گویی، پیام و بخش‌های مرتبط ایده‌ها به سرویس هوش مصنوعی فرستاده می‌شود؛ اطلاعات هویتی و تماس را ننویس.
            </p>
          </section>
        </div>
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
