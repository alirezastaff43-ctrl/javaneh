import { describe, expect, it } from "vitest";
import {
  axesForStage,
  createDemoDecision,
  validateInterviewDecision,
  type InterviewStage,
  type InterviewRequest,
} from "./interviewer";

describe("English interview questions", () => {
  it.each(["initial", "development"] as const)(
    "keeps every %s demo question valid and in English",
    (stage: InterviewStage) => {
      const axes = axesForStage(stage);
      for (const [index, axis] of axes.entries()) {
        const request: InterviewRequest = {
          seed: "A community issue",
          stage,
          section: axis.section,
          index,
          question: axis.question,
          answer: "I am not sure yet.",
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
        }
      }
    },
  );

  it("keeps English answers intact in the demo mentor's personalized follow-up", () => {
    const axes = axesForStage("initial");
    const request: InterviewRequest = {
      seed: "A community issue",
      stage: "initial",
      section: axes[0].section,
      index: 0,
      question: axes[0].question,
      answer: "The park light is broken at night",
      answeredSections: [axes[0].section],
      skippedSections: [],
      remainingSections: axes.slice(1).map((axis) => axis.section),
      history: [],
    };
    const decision = createDemoDecision(request);

    expect(decision.nextQuestion).toContain(
      "You mentioned “The park light is broken at night.”",
    );
    expect(validateInterviewDecision(decision, request)).toBe(true);
  });
});
