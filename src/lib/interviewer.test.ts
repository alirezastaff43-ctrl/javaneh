import { describe, expect, it } from "vitest";
import {
  DEVELOPMENT_AXES,
  axesForStage,
  createDemoDecision,
  developmentOpeningQuestion,
  isValidInterviewQuestion,
  validateInterviewDecision,
  type InterviewStage,
  type InterviewRequest,
} from "./interviewer";

describe("Persian interview questions", () => {
  it.each(["initial", "development"] as const)(
    "keeps every %s fallback question valid and in Persian",
    (stage: InterviewStage) => {
      const axes = axesForStage(stage);
      for (const [index, axis] of axes.entries()) {
        const request: InterviewRequest = {
          seed: "A community issue",
          stage,
          section: axis.section,
          index,
          question: axis.question,
          answer: "هنوز مطمئن نیستم.",
          answeredSections: axes.slice(0, index + 1).map((item) => item.section),
          skippedSections: [],
          remainingSections: axes
            .slice(index + 1)
            .map((item) => item.section),
          history: [],
        };
        const decision = createDemoDecision(request);

        expect(validateInterviewDecision(decision, request)).toBe(true);
        if (request.remainingSections.length > 0) {
          expect(decision.nextQuestion).toContain(request.seed);
          expect(decision.nextQuestion).toContain(axes[index + 1].question);
          expect(decision.questionContext).toBeTruthy();
          expect(decision.questionContext).toMatch(/[آ-ی]/u);
          expect(decision.questionContext).not.toMatch(/[؟?]/u);
        } else {
          expect(decision.questionContext).toBeNull();
        }
      }
    },
  );

  it("personalizes the localized follow-up from the starting idea", () => {
    const axes = axesForStage("initial");
    const request: InterviewRequest = {
      seed: "A community issue",
      stage: "initial",
      section: axes[0].section,
      index: 0,
      question: axes[0].question,
      answer: "چراغ پارک شب‌ها خاموش می‌ماند",
      answeredSections: [axes[0].section],
      skippedSections: [],
      remainingSections: axes.slice(1).map((axis) => axis.section),
      history: [],
    };
    const decision = createDemoDecision(request);

    expect(decision.mentorMessage).toContain("چراغ پارک شب‌ها خاموش می‌ماند");
    expect(decision.nextQuestion).toContain(request.seed);
    expect(decision.questionContext).not.toContain("برای نمونه");
    expect(validateInterviewDecision(decision, request)).toBe(true);
  });

  it("awards mentor sufficiency only to detailed demo answers", () => {
    const axes = axesForStage("initial");
    const request: InterviewRequest = {
      seed: "A community issue",
      stage: "initial",
      section: axes[0].section,
      index: 0,
      question: axes[0].question,
      answer: "در مسیر مدرسه، چند بار دیدم که بچه‌ها از خیابان شلوغ عبور می‌کنند.",
      answeredSections: [axes[0].section],
      skippedSections: [],
      remainingSections: axes.slice(1).map((axis) => axis.section),
      history: [],
    };

    expect(createDemoDecision(request).answerSufficient).toBe(true);
    expect(createDemoDecision({ ...request, answer: "این مشکل مهم است." }).answerSufficient).toBe(false);
  });

  it("personalizes the first development question using the latest intake answer", () => {
    const opening = developmentOpeningQuestion("بهبود رفت‌وآمد", [
      { section: "The problem", answer: "پله‌های ورودی بازار برای سالمندان دشوار است." },
      { section: "Your idea", answer: "می‌خواهم مسیر امن‌تری را بررسی کنم." },
    ]);

    expect(opening.text).toContain("می‌خواهم مسیر امن‌تری را بررسی کنم");
    expect(opening.text).toContain(DEVELOPMENT_AXES[0].focusTerms[0]);
    expect(opening.text.match(/[؟?]/gu)).toHaveLength(1);
    expect(isValidInterviewQuestion(opening.text, DEVELOPMENT_AXES[0], [])).toBe(
      true,
    );
    expect(opening.questionContext).toContain("ثبت اولیه");
  });

  it("does not quote personal identifiers in the opening question", () => {
    const opening = developmentOpeningQuestion("ایده", [
      { section: "The problem", answer: "با شمارهٔ 09123456789 تماس گرفتم." },
    ]);

    expect(opening.text).not.toContain("09123456789");
    expect(opening.text).toContain("چه نمونه‌ای");
  });

  it("rejects a missing, non-Persian, or question-shaped explanation", () => {
    const axes = axesForStage("initial");
    const request: InterviewRequest = {
      seed: "A community issue",
      stage: "initial",
      section: axes[0].section,
      index: 0,
      question: axes[0].question,
      answer: "چراغ پارک شب‌ها خاموش می‌ماند",
      answeredSections: [axes[0].section],
      skippedSections: [],
      remainingSections: axes.slice(1).map((axis) => axis.section),
      history: [],
    };
    const decision = createDemoDecision(request);

    expect(
      validateInterviewDecision({ ...decision, questionContext: "" }, request),
    ).toBe(false);
    expect(
      validateInterviewDecision(
        { ...decision, questionContext: "This matters because of evidence." },
        request,
      ),
    ).toBe(false);
    expect(
      validateInterviewDecision(
        { ...decision, questionContext: "چرا این موضوع مهم است؟" },
        request,
      ),
    ).toBe(false);
  });

  it("accepts an adaptive axis selection only when skipped axes are covered", () => {
    const axes = axesForStage("initial");
    const request: InterviewRequest = {
      seed: "بهبود مسیر محله",
      stage: "initial",
      section: axes[1].section,
      index: 1,
      question: axes[1].question,
      answer: "افراد سالمند از پله‌های ورودی گفتند.",
      answeredSections: axes.slice(0, 2).map((axis) => axis.section),
      skippedSections: [],
      remainingSections: axes.slice(2).map((axis) => axis.section),
      history: [],
    };
    const decision = {
      mentorMessage: "نوشتی که سالمندان از پله‌های ورودی گفته‌اند.",
      answerSufficient: true,
      stageComplete: false,
      coveredSections: [axes[2].section],
      nextSection: axes[3].section,
      nextQuestion: "دوست داری چه راهکاری را برای این مسئله امتحان کنی؟",
      questionContext: "روشن‌شدن راهکار کمک می‌کند مسیر تغییر را بهتر ببینیم.",
    };

    expect(validateInterviewDecision(decision, request)).toBe(true);
    expect(
      validateInterviewDecision(
        { ...decision, coveredSections: [] },
        request,
      ),
    ).toBe(false);
  });

  it("requires a real completion signal without a fabricated follow-up", () => {
    const axes = axesForStage("initial");
    const request: InterviewRequest = {
      seed: "بهبود مسیر محله",
      stage: "initial",
      section: axes[4].section,
      index: 4,
      question: axes[4].question,
      answer: "در محله زندگی می‌کنم.",
      answeredSections: axes.map((axis) => axis.section),
      skippedSections: [],
      remainingSections: [],
      history: [],
    };
    const decision = createDemoDecision(request);

    expect(decision.stageComplete).toBe(true);
    expect(decision.nextQuestion).toBeNull();
    expect(decision.mentorMessage).toContain("بازبینی");
    expect(decision.mentorMessage).toContain(request.seed);
    expect(validateInterviewDecision(decision, request)).toBe(true);
    expect(
      validateInterviewDecision(
        { ...decision, nextQuestion: axes[0].question },
        request,
      ),
    ).toBe(false);
  });

  it("rejects multiple questions or repeated prompts", () => {
    const axis = axesForStage("development")[2];

    expect(
      isValidInterviewQuestion(
        "به نظرت چه چیزی باعث ادامه شده و چه کاری را امتحان کرده‌ای؟",
        axis,
        [],
      ),
    ).toBe(false);
    expect(
      isValidInterviewQuestion(axis.question, axis, [axis.question]),
    ).toBe(false);
  });

  it("requires every development axis to be answered in order without skips", () => {
    const axes = DEVELOPMENT_AXES;
    const request: InterviewRequest = {
      seed: "بهبود مسیر محله",
      stage: "development",
      section: axes[0].section,
      index: 0,
      question: axes[0].question,
      answer: "یک نمونه از مسیر دشوار دیده‌ام.",
      answeredSections: [axes[0].section],
      skippedSections: [],
      remainingSections: axes.slice(1).map((axis) => axis.section),
      history: [],
    };
    const decision = createDemoDecision(request);

    expect(validateInterviewDecision(decision, request)).toBe(true);
    expect(
      validateInterviewDecision(
        {
          ...decision,
          coveredSections: [axes[1].section],
          nextSection: axes[2].section,
          nextQuestion: axes[2].question,
        },
        request,
      ),
    ).toBe(false);
    expect(
      validateInterviewDecision(
        {
          ...decision,
          nextSection: axes[2].section,
          nextQuestion: axes[2].question,
        },
        request,
      ),
    ).toBe(false);
    expect(
      validateInterviewDecision(
        {
          ...decision,
          stageComplete: true,
          coveredSections: request.remainingSections,
          nextSection: null,
          nextQuestion: null,
          questionContext: null,
        },
        request,
      ),
    ).toBe(false);
  });
});
