import { describe, expect, it } from "vitest";
import {
  isClearlyInvalidAnswer,
  recordInvalidFormAnswer,
} from "./form-answer-validation";

describe("form answer validation", () => {
  it("recognizes obvious nonsense without rejecting short meaningful answers", () => {
    expect(isClearlyInvalidAnswer("هههههههههه")).toBe(true);
    expect(isClearlyInvalidAnswer("asdf qwerty")).toBe(true);
    expect(isClearlyInvalidAnswer("این وضعیت را در محله دیده‌ام")).toBe(false);
    expect(isClearlyInvalidAnswer("هنوز نمی‌دانم")).toBe(false);
  });

  it("allows three invalid submissions and locks for 12 hours on the fourth", () => {
    expect(recordInvalidFormAnswer("پاسخ را اصلاح کنید.")).toMatchObject({
      valid: false,
      locked: false,
      message: expect.stringContaining("فرصت باقی‌مانده: 2"),
    });
    const second = recordInvalidFormAnswer("پاسخ را اصلاح کنید.");
    expect(second.valid ? false : second.locked).toBe(false);
    const third = recordInvalidFormAnswer("پاسخ را اصلاح کنید.");
    expect(third.valid ? false : third.locked).toBe(false);
    const locked = recordInvalidFormAnswer("پاسخ را اصلاح کنید.");
    expect(locked).toMatchObject({ valid: false, locked: true });
    if (locked.valid) throw new Error("The fourth invalid answer must lock the form.");
    expect(locked.message).toContain("۱۲ ساعت");
  });
});
