import { isEnglishText } from "./locale";

export type InterviewStage = "initial" | "development";

export const INTAKE_AXES = [
  {
    section: "The problem",
    label: "The problem",
    question: "What specific problem have you noticed, and where or when does it happen?",
    focusTerms: ["problem", "happen"],
  },
  {
    section: "People affected",
    label: "People affected",
    question: "Who is affected by this problem, and how does it affect their daily lives?",
    focusTerms: ["who", "affected", "daily lives"],
  },
  {
    section: "What is known",
    label: "What is known",
    question: "What do you know about why this happens, what others have tried, and what remains unclear?",
    focusTerms: ["know", "why", "unclear"],
  },
  {
    section: "Your idea",
    label: "Your idea",
    question: "What approach would you like to try, and how might it help?",
    focusTerms: ["approach", "try", "help"],
  },
  {
    section: "Your connection",
    label: "Your connection",
    question: "What has made you personally interested in or connected to this problem?",
    focusTerms: ["personally", "interested", "connected"],
  },
] as const;

export const DEVELOPMENT_AXES = [
  {
    section: "Evidence",
    label: "Evidence",
    question: "Can you share a specific example, say how often it happens, and note what still needs to be checked?",
    focusTerms: ["example", "often", "checked"],
  },
  {
    section: "Stakeholders",
    label: "Stakeholders",
    question: "Who should help shape this idea, and could anyone be unintentionally left out or harmed?",
    focusTerms: ["who", "help", "left out", "harmed"],
  },
  {
    section: "Root causes",
    label: "Root causes",
    question: "Why do you think this problem continues, and what are people doing about it now?",
    focusTerms: ["why", "problem", "continues"],
  },
  {
    section: "Solution",
    label: "Solution",
    question: "From first contact to the change you hope to make, what experience would someone have?",
    focusTerms: ["experience", "change"],
  },
  {
    section: "Feasibility",
    label: "Feasibility",
    question: "What skills, permissions, partners, or resources might you need, and what limits should you consider?",
    focusTerms: ["resources", "limits", "skills"],
  },
  {
    section: "Pilot",
    label: "Pilot",
    question: "What is the smallest useful test you could run, with whom and where, to learn whether this approach helps?",
    focusTerms: ["test", "whom", "where", "learn"],
  },
  {
    section: "Outcomes",
    label: "Outcomes",
    question: "What realistic change could you notice soon, and how might you measure it?",
    focusTerms: ["change", "measure"],
  },
  {
    section: "Inclusion and risk",
    label: "Inclusion and risk",
    question: "What could go wrong or make participation difficult, and what practical step could reduce that risk?",
    focusTerms: ["risk", "participation", "difficult"],
  },
  {
    section: "Delivery",
    label: "Delivery",
    question: "What are the first two steps, who could take responsibility, and what would help keep the work going?",
    focusTerms: ["steps", "responsibility", "work"],
  },
  {
    section: "Next actions",
    label: "Next actions",
    question: "What is the most important unanswered question, and what specific next step could help you explore it?",
    focusTerms: ["unanswered question", "next step", "explore"],
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
  return question.toLocaleLowerCase("en").replace(/[\s?.,;:!]+/g, "");
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
    !isEnglishText(trimmed) ||
    (trimmed.match(/\?/g) ?? []).length !== 1 ||
    !axis.focusTerms.some((term) =>
      trimmed.toLocaleLowerCase("en").includes(term),
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
    !isEnglishText(result.mentorMessage) ||
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
      uncoveredSections.length === 0
    );
  }

  if (
    uncoveredSections.length === 0 ||
    result.nextSection !== uncoveredSections[0] ||
    typeof result.nextQuestion !== "string"
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
      mentorMessage: "Thank you.",
      stageComplete: true,
      coveredSections: [],
      nextSection: null,
      nextQuestion: null,
    };
  }

  const nextAxis = findAxis(nextSection, request.stage);
  if (!nextAxis) throw new Error("Unknown interview section");
  const isUnsure = /\b(?:not sure|don't know|do not know|no idea)\b/i.test(
    request.answer,
  );
  const anchor = request.answer
    .trim()
    .replace(/\?/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 60);
  const nextQuestion =
    isUnsure || !isEnglishText(anchor)
      ? nextAxis.question
      : `You mentioned “${anchor}.” ${nextAxis.question}`;
  return {
    mentorMessage: "Thanks for sharing that.",
    stageComplete: false,
    coveredSections: [],
    nextSection,
    nextQuestion,
  };
}
