import { describe, expect, it } from "vitest";
import {
  BENEFICIARY_GROUPS,
  OUTCOMES,
  countWords,
  emptyRegistrationData,
  isGeneralAction,
  normalizeRegistrationStore,
  validateRegistrationStep,
  visibleRegistrationSteps,
} from "./structured-registration";

describe("structured registration rules", () => {
  it("counts Persian and Latin digits as words in Persian descriptions", () => {
    expect(countWords("در سال ۱۴۰۴ و 2026 این مشکل را دیدم و تجربه کردم")).toBe(12);
    expect(countWords(" ")).toBe(0);
  });

  it("requires twenty words for the problem description", () => {
    const data = emptyRegistrationData();
    data.problem = "این مشکل را بارها در محله دیده‌ام و هنوز برای آن راهکار مشخصی پیدا نشده است";
    expect(validateRegistrationStep("problem", data)).toContain("۲۰ واژه");
    data.problem = `${data.problem} و این هم چند واژهٔ دیگر برای رسیدن به حداقل لازم`;
    expect(validateRegistrationStep("problem", data)).toBe("");
  });

  it("shows review and beneficiary steps only when their conditions match", () => {
    const data = emptyRegistrationData();
    expect(visibleRegistrationSteps(data)).not.toContain("refine");
    expect(visibleRegistrationSteps(data)).not.toContain("groups");
    data.action = "فرهنگ‌سازی باید انجام شود";
    data.outcomes = [OUTCOMES[5]];
    expect(visibleRegistrationSteps(data)).toContain("refine");
    expect(visibleRegistrationSteps(data)).toContain("groups");
    expect(isGeneralAction("مسئولان رسیدگی کنند" )).toBe(true);
    expect(isGeneralAction("فروشگاه‌ها غذای سالم را اهدا کنند")).toBe(false);
  });

  it("enforces exclusive unsure choices, limits, and other descriptions", () => {
    const data = emptyRegistrationData();
    data.outcomes = [OUTCOMES[7], OUTCOMES[0]];
    expect(validateRegistrationStep("outcomes", data)).toContain("به‌تنهایی");
    data.outcomes = [OUTCOMES[6]];
    expect(validateRegistrationStep("outcomes", data)).toContain("نتیجهٔ دیگر");
    data.outcomeOther = "کاهش زمان انتظار";
    expect(validateRegistrationStep("outcomes", data)).toBe("");
    data.groups = [BENEFICIARY_GROUPS[8], BENEFICIARY_GROUPS[0]];
    expect(validateRegistrationStep("groups", data)).toContain("به‌تنهایی");
  });

  it("keeps registration data separate and normalizes only allowed fields", () => {
    const records = normalizeRegistrationStore([{
      id: "draft-1",
      status: "draft",
      step: "contact",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      data: { fullName: "نام نمونه", nationalId: "1234567890", mobile: "09120000000" },
    }]);

    expect(records).toHaveLength(1);
    expect(records[0].data.fullName).toBe("نام نمونه");
    expect(records[0].data).not.toHaveProperty("nationalId");
    expect(records[0].data).not.toHaveProperty("mobile");
    expect(records[0].step).toBe("contact");
  });
});