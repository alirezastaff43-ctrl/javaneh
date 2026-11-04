import { describe, expect, it } from "vitest";
import {
  axesForStage,
  createDemoDecision,
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
          expect(decision.nextQuestion).toBe(
            axes[index + 1].question,
          );
          expect(decision.questionContext).toBeTruthy();
          expect(decision.questionContext).toMatch(/[آ-ی]/u);
          expect(decision.questionContext).not.toMatch(/[؟?]/u);
        } else {
          expect(decision.questionContext).toBeNull();
        }
      }
    },
  );

  it("keeps a participant's answer intact in the localized follow-up", () => {
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

    expect(decision.nextQuestion).toContain("چراغ پارک شب‌ها خاموش می‌ماند");
    expect(decision.questionContext).toContain("نیازهای واقعی");
    expect(validateInterviewDecision(decision, request)).toBe(true);
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
});
