import { isPersianText } from "./locale";
import { redactPersonalData } from "./privacy";

export type InterviewStage = "initial" | "development";

export const INTAKE_AXES = [
  {
    section: "The problem",
    question: "کدام بخش از این مسئله را خودت دیده‌ای؟",
    focusTerms: ["مسئله", "دیده‌ای"],
  },
  {
    section: "People affected",
    question: "این مسئله بیشتر روی زندگی چه کسانی اثر می‌گذارد؟",
    focusTerms: ["چه کسانی", "اثر"],
  },
  {
    section: "What is known",
    question: "به نظرت چه چیزی باعث ادامهٔ این مسئله شده است؟",
    focusTerms: ["چه چیزی", "ادامه", "علت"],
  },
  {
    section: "Your idea",
    question: "دوست داری برای روبه‌روشدن با این مسئله چه راهکاری را امتحان کنی؟",
    focusTerms: ["راهکار", "امتحان"],
  },
  {
    section: "Your connection",
    question: "چه چیزی باعث شده به این مسئله توجه کنی؟",
    focusTerms: ["چه چیزی", "توجه"],
  },
] as const;

export const DEVELOPMENT_AXES = [
  {
    section: "Evidence",
    label: "شواهد",
    question: "چه نمونه‌ای از این مسئله در ذهنت مانده است؟",
    focusTerms: ["نمونه"],
  },
  {
    section: "Stakeholders",
    label: "افراد و گروه‌های مرتبط",
    question: "چه کسانی باید پیش از طراحی راهکار شنیده شوند؟",
    focusTerms: ["چه کسانی", "شنیده"],
  },
  {
    section: "Root causes",
    label: "ریشه‌های مسئله",
    question: "به نظرت چرا این مسئله همچنان ادامه دارد؟",
    focusTerms: ["چرا", "ادامه"],
  },
  {
    section: "Solution",
    label: "راهکار",
    question: "راهکارت برای افراد درگیر چه تجربه‌ای می‌سازد؟",
    focusTerms: ["راهکار", "تجربه"],
  },
  {
    section: "Feasibility",
    label: "امکان‌پذیری",
    question: "چه چیزی می‌تواند اجرای ایده را برایت دشوار کند؟",
    focusTerms: ["اجرای", "دشوار"],
  },
  {
    section: "Pilot",
    label: "اجرای آزمایشی",
    question: "کوچک‌ترین آزمونی که می‌توانی برای ایده‌ات انجام دهی چیست؟",
    focusTerms: ["آزمون"],
  },
  {
    section: "Outcomes",
    label: "نتایج",
    question: "چه نشانه‌ای به تو می‌گوید ایده مفید بوده است؟",
    focusTerms: ["چه نشانه", "مفید"],
  },
  {
    section: "Inclusion and risk",
    label: "مشارکت و خطرها",
    question: "چه پیامد ناخواسته‌ای را بهتر است از قبل در نظر بگیریم؟",
    focusTerms: ["پیامد", "ناخواسته"],
  },
  {
    section: "Delivery",
    label: "اجرا",
    question: "نخستین گامی که می‌توانی برداری چیست؟",
    focusTerms: ["نخستین گام"],
  },
  {
    section: "Next actions",
    label: "گام‌های بعدی",
    question: "کدام پرسش بی‌پاسخ را می‌خواهی اول بررسی کنی؟",
    focusTerms: ["پرسش", "بررسی"],
  },
] as const;

export type InterviewAxis =
  | (typeof INTAKE_AXES)[number]
  | (typeof DEVELOPMENT_AXES)[number];

export type InterviewHistoryItem = {
  stage: InterviewStage;
  section: string;
  question: string;
  answer: string;
  createdAt: string;
};

export type InterviewRequest = {
  seed: string;
  stage: InterviewStage;
  section: string;
  index: number;
  question: string;
  answer: string;
  answeredSections: string[];
  skippedSections: string[];
  remainingSections: string[];
  history: InterviewHistoryItem[];
};

export function developmentOpeningQuestion(
  seed: string,
  answers: Array<Pick<InterviewHistoryItem, "section" | "answer">>,
): { text: string; questionContext: string } {
  const relevantAnswers = answers.filter(({ section, answer }) =>
    INTAKE_AXES.some((axis) => axis.section === section) && answer.trim(),
  );
  const latestAnswer = relevantAnswers.at(-1)?.answer.trim();
  const safeAnswer = latestAnswer ? redactPersonalData(latestAnswer) : "";
  const quote =
    safeAnswer &&
    !safeAnswer.includes("[personal information removed]") &&
    !/[؟?]/u.test(safeAnswer)
      ? safeAnswer.slice(0, 60)
      : "";
  const safeSeed = redactPersonalData(seed.trim());
  const quoteSeed =
    !latestAnswer &&
    safeSeed.length > 0 &&
    safeSeed.length <= 60 &&
    !safeSeed.includes("[personal information removed]") &&
    !/[؟?]/u.test(safeSeed);

  return {
    text: quote
      ? `نوشتی «${quote}». در ارتباط با این حرف، چه نمونه‌ای از این مسئله در ذهنت مانده است؟`
      : quoteSeed
        ? `با توجه به ایدهٔ آغازینت «${safeSeed}»، چه نمونه‌ای از این مسئله در ذهنت مانده است؟`
        : "با توجه به توضیحی که دربارهٔ ایده‌ات دادی، چه نمونه‌ای از این مسئله در ذهنت مانده است؟",
    questionContext:
      "از گفته‌های ثبت اولیه‌ات شروع می‌کنیم تا مسئله را با یک نمونهٔ واقعی روشن‌تر کنیم؛ اگر نمونه‌ای نداری، می‌توانی بگویی هنوز بررسی نکرده‌ای.",
  };
}

export type InterviewDecision = {
  mentorMessage: string;
  stageComplete: boolean;
  coveredSections: string[];
  nextSection: string | null;
  nextQuestion: string | null;
  questionContext: string | null;
};

export function axesForStage(stage: InterviewStage): readonly InterviewAxis[] {
  return stage === "initial" ? INTAKE_AXES : DEVELOPMENT_AXES;
}

export function findAxis(
  section: string,
  stage?: InterviewStage,
): InterviewAxis | undefined {
  const axes = stage ? axesForStage(stage) : [...INTAKE_AXES, ...DEVELOPMENT_AXES];
  return axes.find((axis) => axis.section === section);
}

function normalizedQuestion(question: string) {
  return question.toLocaleLowerCase("fa").replace(/[\s؟?.,؛;:!]+/g, "");
}

export function isValidInterviewQuestion(
  question: string,
  axis: InterviewAxis,
  previousQuestions: string[],
): boolean {
  const trimmed = question.trim();
  if (
    !trimmed ||
    trimmed.length > 600 ||
    !isPersianText(trimmed) ||
    (trimmed.match(/[؟?]/g) ?? []).length !== 1 ||
    (
      trimmed.match(
        /(?<![\p{L}\u200c])(?:چه|چرا|چطور|چگونه|کدام|آیا)(?![\p{L}\u200c])/gu,
      ) ?? []
    ).length > 1 ||
    !axis.focusTerms.some((term) =>
      trimmed.toLocaleLowerCase("fa").includes(term),
    )
  )
    return false;
  const normalized = normalizedQuestion(trimmed);
  return !previousQuestions.some(
    (previous) => normalizedQuestion(previous.trim()) === normalized,
  );
}

export function validateInterviewDecision(
  value: unknown,
  request: InterviewRequest,
): value is InterviewDecision {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<InterviewDecision>;
  if (
    typeof result.mentorMessage !== "string" ||
    result.mentorMessage.trim().length === 0 ||
    result.mentorMessage.length > 240 ||
    !isPersianText(result.mentorMessage) ||
    typeof result.stageComplete !== "boolean" ||
    !Array.isArray(result.coveredSections) ||
    result.coveredSections.some((section) => typeof section !== "string") ||
    new Set(result.coveredSections).size !== result.coveredSections.length ||
    result.coveredSections.some(
      (section) => !request.remainingSections.includes(section),
    )
  )
    return false;

  if (
    request.stage === "development" &&
    (request.skippedSections.length > 0 ||
      result.coveredSections.length > 0 ||
      DEVELOPMENT_AXES.slice(0, request.index).some(
        (axis) => !request.answeredSections.includes(axis.section),
      ) ||
      (result.stageComplete &&
        !DEVELOPMENT_AXES.every((axis) =>
          request.answeredSections.includes(axis.section),
        )))
  )
    return false;

  const uncoveredSections = request.remainingSections.filter(
    (section) => !result.coveredSections?.includes(section),
  );
  if (result.stageComplete) {
    return (
      result.nextSection === null &&
      result.nextQuestion === null &&
      result.questionContext === null &&
      uncoveredSections.length === 0
    );
  }

  if (
    uncoveredSections.length === 0 ||
    typeof result.nextSection !== "string" ||
    !uncoveredSections.includes(result.nextSection) ||
    typeof result.nextQuestion !== "string" ||
    typeof result.questionContext !== "string" ||
    result.questionContext.trim().length === 0 ||
    result.questionContext.length > 360 ||
    !isPersianText(result.questionContext) ||
    /[؟?]/u.test(result.questionContext)
  )
    return false;

  const axis = findAxis(result.nextSection, request.stage);
  if (!axis) return false;
  const nextPosition = request.remainingSections.indexOf(result.nextSection);
  if (
    request.stage === "development" &&
    result.nextSection !== request.remainingSections[0]
  )
    return false;
  if (
    request.remainingSections
      .slice(0, nextPosition)
      .some((section) => !result.coveredSections?.includes(section))
  )
    return false;
  return isValidInterviewQuestion(result.nextQuestion, axis, [
    request.question,
    ...request.history.map((item) => item.question),
  ]);
}

export function createDemoDecision(
  request: InterviewRequest,
): InterviewDecision {
  const nextSection = request.remainingSections[0];
  if (!nextSection) {
    return {
      mentorMessage: isPersianText(request.seed)
        ? `ایدهٔ اولیه‌ات «${request.seed.trim().slice(0, 45)}${request.seed.trim().length > 45 ? "…" : ""}» و پاسخ‌هایت پایهٔ پیشنهاد هستند. حالا متن برای بازبینی آماده است و هر بخش را می‌توانی اصلاح کنی.`
        : "پیشنهاد بر پایهٔ پاسخ‌هایت آمادهٔ بازبینی است؛ می‌توانی متن را اصلاح کنی.",
      stageComplete: true,
      coveredSections: [],
      nextSection: null,
      nextQuestion: null,
      questionContext: null,
    };
  }

  const nextAxis = findAxis(nextSection, request.stage);
  if (!nextAxis) throw new Error("Unknown interview section");
  const isUnsure = /(?:مطمئن نیستم|نمی‌دانم|نمی دونم|نظری ندارم)/u.test(
    request.answer,
  );
  const answerQuote = request.answer.trim();
  const canQuoteAnswer =
    answerQuote.length <= 60 && !/[؟?]/u.test(answerQuote);
  const safeSeed = redactPersonalData(request.seed.trim())
    .replace(/[؟?]/gu, "")
    .replace(/\s+/gu, " ")
    .slice(0, 60)
    .trim();
  const nextQuestion = safeSeed
    ? `برای ایدهٔ «${safeSeed}»، ${nextAxis.question}`
    : nextAxis.question;
  const questionContext = [
    isUnsure ? "لازم نیست از همین حالا پاسخ قطعی داشته باشی." : "",
    safeSeed ? `در ارتباط با «${safeSeed}»،` : "",
    questionContextForAxis(nextSection),
    "برای نمونه، می‌توانی از یک موقعیت کوچک یا چیزی که خودت دیده‌ای شروع کنی.",
  ]
    .filter(Boolean)
    .join("؛ ");
  return {
    mentorMessage: canQuoteAnswer
      ? `نوشتی «${answerQuote}». اگر برداشتم دقیق نیست، می‌توانی اصلاحم کنی.`
      : "اگر درست فهمیدم، این نکته برایت مهم است؛ اگر برداشتم دقیق نیست، می‌توانی اصلاحم کنی.",
    stageComplete: false,
    coveredSections: [],
    nextSection,
    nextQuestion,
    questionContext,
  };
}

export function questionContextForAxis(section: string): string {
  const contexts: Record<string, string> = {
    "The problem": "شناخت موقعیت دقیق بروز مسئله کمک می‌کند دامنه‌اش را از برداشت کلی جدا کنیم",
    "People affected": "شناخت تجربهٔ افراد درگیر کمک می‌کند نیازهای واقعی و تفاوت تجربه‌هایشان را ببینیم",
    "What is known": "جداکردن دانسته‌ها از پرسش‌های بی‌پاسخ کمک می‌کند از تکرار راه‌های آزموده‌شده دور بمانیم",
    "Your idea": "روشن‌شدن سازوکار راهکار کمک می‌کند ببینیم ایده قرار است چگونه به مسئله پاسخ دهد",
    "Your connection": "شناخت انگیزه و ارتباط تو با موضوع کمک می‌کند نقطهٔ شروع و توانایی‌های خودت را در نظر بگیریم",
    Evidence: "نمونه‌های واقعی کمک می‌کنند مسئله را با شواهد قابل بررسی بسنجیم",
    Stakeholders: "شناخت افراد مرتبط کمک می‌کند دیدگاه‌های لازم و کسانی را که ممکن است نادیده بمانند پیدا کنیم",
    "Root causes": "بررسی علت‌های احتمالی کمک می‌کند میان نشانهٔ مسئله و ریشه‌های آن تفاوت بگذاریم",
    Solution: "روشن‌شدن تجربهٔ افراد از راهکار کمک می‌کند بفهمیم تغییر موردنظر در عمل چگونه رخ می‌دهد",
    Feasibility: "شناخت منابع و محدودیت‌ها کمک می‌کند گام بعدی با شرایط واقعی تناسب داشته باشد",
    Pilot: "یک آزمون کوچک کمک می‌کند پیش از صرف منابع بیشتر، فرض‌های اصلی ایده را بررسی کنیم",
    Outcomes: "مشخص‌کردن تغییر مورد انتظار کمک می‌کند بعداً ارزیابی کنیم آیا ایده اثر گذاشته است",
    "Inclusion and risk": "پیش‌بینی موانع و پیامدهای ناخواسته کمک می‌کند مشارکت امن‌تر و فراگیرتری طراحی کنیم",
    Delivery: "تبدیل ایده به گام‌های روشن کمک می‌کند شروع کار و مسئولیت‌ها واقع‌بینانه باشد",
    "Next actions": "انتخاب پرسش بی‌پاسخ و گام بعدی کمک می‌کند مسیر ادامهٔ کار روشن بماند",
  };
  const context = contexts[section];
  if (!context) throw new Error("Unknown interview section");
  return `${context}.`;
}
