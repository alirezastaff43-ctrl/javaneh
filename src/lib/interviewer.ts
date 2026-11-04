import { isPersianText } from "./locale";

export type InterviewStage = "initial" | "development";

export const INTAKE_AXES = [
  {
    section: "The problem",
    label: "مسئله",
    question: "چه مسئلهٔ مشخصی توجهت را جلب کرده و این مسئله کجا یا چه زمانی رخ می‌دهد؟",
    focusTerms: ["مسئله", "کجا", "زمانی"],
  },
  {
    section: "People affected",
    label: "افراد درگیر",
    question: "چه کسانی از این مسئله تأثیر می‌گیرند و این موضوع چه اثری بر زندگی روزمره‌شان دارد؟",
    focusTerms: ["چه کسانی", "تأثیر", "روزمره"],
  },
  {
    section: "What is known",
    label: "دانسته‌ها",
    question: "دربارهٔ علت این مسئله، کارهایی که دیگران امتحان کرده‌اند و چیزهایی که هنوز روشن نیست چه می‌دانی؟",
    focusTerms: ["علت", "امتحان", "روشن نیست"],
  },
  {
    section: "Your idea",
    label: "ایدهٔ تو",
    question: "دوست داری چه راهکاری را امتحان کنی و فکر می‌کنی چطور می‌تواند کمک‌کننده باشد؟",
    focusTerms: ["راهکار", "امتحان", "کمک"],
  },
  {
    section: "Your connection",
    label: "ارتباط تو با مسئله",
    question: "چه چیزی باعث شده شخصاً به این مسئله علاقه‌مند شوی یا با آن ارتباط داشته باشی؟",
    focusTerms: ["شخصاً", "علاقه‌مند", "ارتباط"],
  },
] as const;

export const DEVELOPMENT_AXES = [
  {
    section: "Evidence",
    label: "شواهد",
    question: "می‌توانی نمونه‌ای مشخص بگویی، توضیح بدهی این اتفاق هر چند وقت یک‌بار رخ می‌دهد و بگویی چه چیزی هنوز باید بررسی شود؟",
    focusTerms: ["نمونه", "چند وقت", "بررسی"],
  },
  {
    section: "Stakeholders",
    label: "افراد و گروه‌های مرتبط",
    question: "چه کسانی بهتر است در شکل‌دادن به این ایده مشارکت کنند و ممکن است ناخواسته کسی نادیده گرفته شود یا آسیب ببیند؟",
    focusTerms: ["چه کسانی", "مشارکت", "آسیب"],
  },
  {
    section: "Root causes",
    label: "ریشه‌های مسئله",
    question: "به نظرت چرا این مسئله همچنان ادامه دارد و مردم اکنون برای روبه‌روشدن با آن چه می‌کنند؟",
    focusTerms: ["چرا", "مسئله", "ادامه"],
  },
  {
    section: "Solution",
    label: "راهکار",
    question: "از نخستین برخورد تا تغییری که امیدوار به ایجاد آن هستی، افراد چه تجربه‌ای خواهند داشت؟",
    focusTerms: ["برخورد", "تغییر", "تجربه"],
  },
  {
    section: "Feasibility",
    label: "امکان‌پذیری",
    question: "به چه مهارت‌ها، مجوزها، همراهان یا منابعی نیاز داری و چه محدودیت‌هایی را باید در نظر بگیری؟",
    focusTerms: ["مهارت", "منابع", "محدودیت"],
  },
  {
    section: "Pilot",
    label: "اجرای آزمایشی",
    question: "کوچک‌ترین آزمون مفیدی که می‌توانی اجرا کنی چیست، با چه کسانی و کجا، تا بفهمی این راهکار مؤثر است یا نه؟",
    focusTerms: ["آزمون", "چه کسانی", "کجا", "مؤثر"],
  },
  {
    section: "Outcomes",
    label: "نتایج",
    question: "چه تغییر واقع‌بینانه‌ای را می‌توانی به‌زودی ببینی و چطور می‌توانی آن را اندازه‌گیری کنی؟",
    focusTerms: ["تغییر", "اندازه‌گیری"],
  },
  {
    section: "Inclusion and risk",
    label: "مشارکت و خطرها",
    question: "چه چیزی ممکن است به مشکل بخورد یا مشارکت را دشوار کند و چه اقدام عملی می‌تواند این خطر را کاهش دهد؟",
    focusTerms: ["خطر", "مشارکت", "دشوار", "کاهش"],
  },
  {
    section: "Delivery",
    label: "اجرا",
    question: "دو گام نخست چیست، چه کسی می‌تواند مسئولیت آن‌ها را بپذیرد و چه چیزی به ادامهٔ کار کمک می‌کند؟",
    focusTerms: ["گام", "مسئولیت", "ادامه"],
  },
  {
    section: "Next actions",
    label: "گام‌های بعدی",
    question: "مهم‌ترین پرسشی که هنوز بی‌پاسخ مانده چیست و چه گام مشخصی کمک می‌کند آن را بررسی کنی؟",
    focusTerms: ["پرسش", "گام", "بررسی"],
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
    result.mentorMessage.length > 120 ||
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
    result.nextSection !== uncoveredSections[0] ||
    typeof result.nextQuestion !== "string" ||
    typeof result.questionContext !== "string" ||
    result.questionContext.trim().length === 0 ||
    result.questionContext.length > 360 ||
    !isPersianText(result.questionContext) ||
    /[؟?]/u.test(result.questionContext)
  )
    return false;

  const axis = findAxis(result.nextSection, request.stage);
  if (!axis || result.mentorMessage.length > result.nextQuestion.length)
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
      mentorMessage: "ممنون از همراهی‌ات.",
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
  const nextQuestion =
    isUnsure || !canQuoteAnswer
      ? nextAxis.question
      : `گفتی «\u2068${answerQuote}\u2069»؛ ${nextAxis.question}`;
  const questionContext = [
    isUnsure ? "لازم نیست از همین حالا پاسخ قطعی داشته باشی." : "",
    questionContextForAxis(nextSection),
  ]
    .filter(Boolean)
    .join("؛ ");
  return {
    mentorMessage: "ممنون که این را با من در میان گذاشتی.",
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
