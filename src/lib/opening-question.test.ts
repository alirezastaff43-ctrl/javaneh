import { describe, expect, it } from "vitest";
import {
  createDemoOpeningQuestion,
  isValidOpeningQuestion,
} from "./opening-question";

describe("opening question", () => {
  it("uses the starting idea in the personalized demo prompt", () => {
    const seed = "چراغ پارک محله شب‌ها خاموش می‌ماند";
    const opening = createDemoOpeningQuestion(seed);

    expect(opening.question).toContain(seed);
    expect(opening.question).toMatch(/[؟?]/u);
    expect(opening.questionContext).toContain("برای نمونه");
    expect(isValidOpeningQuestion(opening)).toBe(true);
  });

  it("does not include identifying phone numbers from the starting idea", () => {
    const opening = createDemoOpeningQuestion(
      "برای حل مشکل پارک با شمارهٔ 09123456789 تماس می‌گیرم",
    );

    expect(opening.question).not.toContain("09123456789");
    expect(isValidOpeningQuestion(opening)).toBe(true);
  });

  it("rejects malformed, non-Persian, or multi-question output", () => {
    expect(
      isValidOpeningQuestion({
        question: "What is the problem?",
        questionContext: "برای نمونه، یک موقعیت را توضیح بده.",
      }),
    ).toBe(false);
    expect(
      isValidOpeningQuestion({
        question: "چه چیزی را دیده‌ای؟ چرا این مسئله مهم است؟",
        questionContext: "برای نمونه، یک موقعیت را توضیح بده.",
      }),
    ).toBe(false);
  });
});
