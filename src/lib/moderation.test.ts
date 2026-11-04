import { describe, expect, it } from "vitest";
import { classifyDemoText, moderationMessage } from "./moderation";

describe("moderation demo fallback", () => {
  it("accepts social innovation and resilience seeds", () => {
    expect(
      classifyDemoText({
        kind: "seed",
        seed: "تاب‌آوری محله در زمان بحران",
        text: "تاب‌آوری محله در زمان بحران",
      }).category,
    ).toBe("relevant");
  });

  it("rejects unrelated seeds and political content", () => {
    expect(
      classifyDemoText({ kind: "seed", seed: "بازی فوتبال", text: "بازی فوتبال" })
        .category,
    ).toBe("off_topic");
    expect(
      classifyDemoText({
        kind: "seed",
        seed: "ایده‌ای حزبی برای انتخابات",
        text: "ایده‌ای حزبی برای انتخابات",
      }).category,
    ).toBe("restricted");
  });

  it("accepts contextual answers and allows a relevant uncertainty response", () => {
    expect(
      classifyDemoText({
        kind: "answer",
        seed: "دسترسی سالمندان به درمان",
        question: "چه کسانی با این مسئله روبه‌رو هستند؟",
        text: "سالمندان محله برای رفت‌وآمد مشکل دارند",
      }).category,
    ).toBe("relevant");
    expect(
      classifyDemoText({
        kind: "answer",
        seed: "دسترسی سالمندان به درمان",
        question: "چه کسانی با این مسئله روبه‌رو هستند؟",
        text: "هنوز مطمئن نیستم",
      }).category,
    ).toBe("relevant");
  });

  it("provides distinct Persian guidance for rejected content", () => {
    expect(moderationMessage("off_topic")).toContain("نوآوری اجتماعی یا تاب‌آوری");
    expect(moderationMessage("restricted")).toContain("محدودیت‌های تعیین‌شده");
  });
});