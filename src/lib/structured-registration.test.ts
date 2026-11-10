import { describe, expect, it } from "vitest";
import {
  BENEFICIARY_GROUPS,
  OUTCOMES,
  REGISTRATION_STEPS,
  countWords,
  emptyRegistrationData,
  isGeneralAction,
  normalizeRegistrationStore,
  validateRegistrationStep,
  visibleRegistrationSteps,
} from "./structured-registration";
import { WORKBOOKS, validateWorkbookPage } from "./workbook-forms";

describe("structured registration rules", () => {
  it("counts Persian and Latin digits as words in Persian descriptions", () => {
    expect(countWords("در سال ۱۴۰۴ و 2026 این مشکل را دیدم و تجربه کردم")).toBe(12);
    expect(countWords(" ")).toBe(0);
  });

  it("allows short problem answers to be clarified by the mentor", () => {
    const data = emptyRegistrationData();
    data.problem = "این مشکل را بارها در محله دیده‌ام و هنوز برای آن راهکار مشخصی پیدا نشده است";
    expect(validateRegistrationStep("problem", data)).toBe("");
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

  it("migrates submitted registrations into the first available workbook", () => {
    const [registration] = normalizeRegistrationStore([{
      id: "submitted-1",
      status: "submitted",
      step: "review",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }]);

    expect(registration.activeFlow).toBe("dashboard");
    expect(registration.workbooks.C.status).toBe("available");
    expect(registration.workbooks.P.status).toBe("locked");
  });

  it("only unlocks each workbook after the previous one is submitted", () => {
    const [registration] = normalizeRegistrationStore([{
      id: "submitted-2",
      status: "submitted",
      step: "review",
      workbooks: {
        C: { status: "submitted", step: "C05", answers: {} },
        P: { status: "submitted", step: "P09", answers: {} },
        S: { status: "available", step: "S01", answers: {} },
        E: { status: "submitted", step: "E09", answers: {} },
      },
    }]);

    expect(registration.workbooks.C.status).toBe("submitted");
    expect(registration.workbooks.P.status).toBe("submitted");
    expect(registration.workbooks.S.status).toBe("available");
    expect(registration.workbooks.E.status).toBe("locked");
  });

  it("normalizes persisted workbook list answers", () => {
    const [registration] = normalizeRegistrationStore([{
      id: "workbook-answers",
      status: "submitted",
      step: "review",
      workbooks: {
        C: {
          status: "draft",
          step: "C02",
          answers: {
            stake: ["families", 123],
            pGroups: [{ text: "گروه محلی", detail: "نیاز و محدودیت", choice: "در دسترس است" }],
            ignored: { nested: true },
          },
        },
      },
    }]);

    expect(registration.workbooks.C.answers.stake).toEqual(["families"]);
    expect(registration.workbooks.C.answers.pGroups).toEqual([
      { text: "گروه محلی", detail: "نیاز و محدودیت", choice: "در دسترس است" },
    ]);
    expect(registration.workbooks.C.answers.ignored).toEqual({});
  });

  it("defines every page from the sample and validates required workbook fields", () => {
    expect(REGISTRATION_STEPS).toHaveLength(14);
    expect(Object.fromEntries(
      Object.entries(WORKBOOKS).map(([flow, workbook]) => [flow, workbook.pages.length]),
    )).toEqual({ C: 5, P: 9, S: 9, E: 9 });
    expect(Object.fromEntries(
      Object.entries(WORKBOOKS).map(([flow, workbook]) => [flow, workbook.pages.map((page) => page.id)]),
    )).toEqual({
      C: ["C01", "C02", "C03", "C04", "C05"],
      P: ["P01", "P02", "P03", "P04", "P05", "P06", "P07", "P08", "P09"],
      S: ["S01", "S02", "S03", "S04", "S05", "S06", "S07", "S08", "S09"],
      E: ["E01", "E02", "E03", "E04", "E05", "E06", "E07", "E08", "E09"],
    });
    expect(Object.values(WORKBOOKS).flatMap((workbook) => workbook.pages)).toHaveLength(32);
    expect(validateWorkbookPage(WORKBOOKS.P.pages[2], {})).toContain("پاسخ");
    expect(validateWorkbookPage(WORKBOOKS.C.pages[1], { stake: [] })).toContain("گزینه");
    expect(validateWorkbookPage(WORKBOOKS.C.pages[1], {
      stake: ["unknown", "families"],
    })).toContain("به‌تنهایی");
    expect(validateWorkbookPage(WORKBOOKS.S.pages[2], {
      sSteps: [
        { text: "مرحلهٔ اول", detail: "", choice: "" },
        { text: "مرحلهٔ دوم", detail: "", choice: "" },
      ],
    })).toContain("حداقل");
  });
});