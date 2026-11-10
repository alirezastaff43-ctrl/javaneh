import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isClearlyInvalidAnswer,
  recordInvalidFormAnswer,
} from "./form-answer-validation";

describe("form answer validation", () => {
  beforeEach(() => {
    let attempts = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      attempts += 1;
      const locked = attempts > 3;
      return Response.json({
        locked,
        lockedUntil: locked ? Date.now() + 12 * 60 * 60 * 1000 : 0,
        attemptsRemaining: Math.max(0, 3 - attempts),
      });
    }));
  });

  afterEach(() => vi.unstubAllGlobals());

  it("recognizes obvious nonsense without rejecting short meaningful answers", () => {
    expect(isClearlyInvalidAnswer("هههههههههه")).toBe(true);
    expect(isClearlyInvalidAnswer("asdf qwerty")).toBe(true);
    expect(isClearlyInvalidAnswer("این وضعیت را در محله دیده‌ام")).toBe(false);
    expect(isClearlyInvalidAnswer("هنوز نمی‌دانم")).toBe(false);
  });

  it("allows three invalid submissions and locks for 12 hours on the fourth", async () => {
    expect(await recordInvalidFormAnswer("پاسخ را اصلاح کنید.")).toMatchObject({
      valid: false,
      locked: false,
      message: expect.stringContaining("فرصت باقی‌مانده: 2"),
    });
    const second = await recordInvalidFormAnswer("پاسخ را اصلاح کنید.");
    expect(second.valid ? false : second.locked).toBe(false);
    const third = await recordInvalidFormAnswer("پاسخ را اصلاح کنید.");
    expect(third.valid ? false : third.locked).toBe(false);
    const locked = await recordInvalidFormAnswer("پاسخ را اصلاح کنید.");
    expect(locked).toMatchObject({ valid: false, locked: true });
    if (locked.valid) throw new Error("The fourth invalid answer must lock the form.");
    expect(locked.message).toContain("۱۲ ساعت");
  });
});
