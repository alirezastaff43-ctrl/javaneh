import { describe, expect, it } from "vitest";
import {
  BENEFICIARY_GROUPS,
  OUTCOMES,
  REGISTRATION_STEPS,
  awardStructuredPoints,
  countWords,
  emptyRegistrationData,
  isGeneralAction,
  normalizeRegistrationStore,
  structuredScore,
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
    expect(records[0].scoreAwards).toEqual({});
  });

  it("normalizes and awards structured points without duplicate rewards", () => {
    const [registration] = normalizeRegistrationStore([{
      id: "scored-registration",
      status: "draft",
      step: "problem",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      scoreAwards: { "initial:problem:base": 2, invalid: 50, "workbook:E:E08:bonus": 1.5 },
    }]);

    expect(registration.scoreAwards).toEqual({ "initial:problem:base": 2 });
    const scored = awardStructuredPoints(registration, "initial:problem:bonus", 1);
    expect(structuredScore(scored)).toBe(3);
    expect(awardStructuredPoints(scored, "initial:problem:bonus", 5)).toEqual(scored);
    expect(structuredScore(awardStructuredPoints(scored, "initial:problem:base", 2))).toBe(3);
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

  it.each(["C", "P", "S", "E"] as const)(
    "starts workbook %s with precise-answer and mentor-score guidance",
    (flow) => {
      const pages = WORKBOOKS[flow].pages;
      expect(pages[0].kind).toBe("intro");
      expect(pages[0].guide).toContain("پرسش‌های بعدی بر اساس پاسخ‌های شما طراحی می‌شوند");
      expect(pages[0].guide).toContain("مشاور هوشمند جوانه امتیاز تکمیلی می‌گیرند");
      expect(pages.some((page) => Object.prototype.hasOwnProperty.call(page, "example"))).toBe(false);
    },
  );

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
            stakeNote: "توضیح قدیمی",
            pGroups: [{ text: "گروه محلی", detail: "نیاز و محدودیت", choice: "در دسترس است" }],
            ignored: { nested: true },
          },
        },
      },
    }]);

    expect(registration.workbooks.C.answers.stake).toEqual(["families"]);
    expect(registration.workbooks.C.answers.stakeNote).toBe("توضیح قدیمی");
    expect(registration.workbooks.C.answers.pGroups).toEqual([
      { text: "گروه محلی", detail: "نیاز و محدودیت", choice: "در دسترس است" },
    ]);
    expect(registration.workbooks.C.answers.ignored).toEqual({});
    expect(registration.workbooks.C.followups).toEqual({});
  });

  it("restores valid workbook follow-ups and ignores invalid or out-of-scope entries", () => {
    const [registration] = normalizeRegistrationStore([{
      id: "workbook-followups",
      status: "submitted",
      step: "review",
      workbooks: {
        C: {
          status: "submitted",
          step: "C03",
          answers: { stake: ["families"] },
          followups: {
            C02: {
              sourceAnswer: "خانواده‌ها",
              reply: "گفتی خانواده‌ها بیشترین اثر را می‌پذیرند.",
              questions: ["این اثر در چه موقعیتی پررنگ‌تر است؟", "چه نشانه‌ای آن را مشخص می‌کند؟"],
              answers: ["در رفت‌وآمد روزانه"],
              index: 1,
              draft: "",
            },
            C04: {
              sourceAnswer: "invalid",
              reply: "invalid",
              questions: [],
              answers: [],
              index: 0,
              draft: "",
            },
          },
        },
        P: {
          status: "submitted",
          step: "P03",
          answers: {},
          followups: {
            P02: {
              status: "needs-more",
              sourceAnswer: "مشاهدهٔ یک مانع در مسیر",
              reply: "یک جزئیات را روشن کنیم.",
              questions: ["این مانع برای چه کسانی مهم‌تر است؟"],
              answers: [],
              index: 0,
              draft: "",
            },
            P01: {
              status: "sufficient",
              sourceAnswer: "ignored",
              reply: "ignored",
              questions: [],
              answers: [],
              index: 0,
              draft: "",
            },
            P04: {
              status: null,
              sourceAnswer: "ignored",
              reply: "ignored",
              questions: [],
              answers: [],
              index: 0,
              draft: "",
            },
          },
        },
        S: {
          status: "submitted",
          step: "S04",
          answers: {},
          followups: {
            S03: {
              status: "sufficient",
              sourceAnswer: "سه مرحله مشخص شد",
              reply: "مراحل راهکار روشن است.",
              questions: [],
              answers: [],
              index: 0,
              draft: "",
            },
          },
        },
        E: {
          status: "draft",
          step: "E02",
          answers: {},
          followups: {
            E02: {
              status: "sufficient",
              sourceAnswer: "مشارکت‌کنندگان آمادگی دارند",
              reply: "پاسخ برای ادامه روشن است.",
              questions: [],
              answers: [],
              index: 0,
              draft: "",
            },
          },
        },
      },
    }]);

    expect(registration.workbooks.C.followups).toEqual({
      C02: {
        status: "needs-more",
        sourceAnswer: "خانواده‌ها",
        reply: "گفتی خانواده‌ها بیشترین اثر را می‌پذیرند.",
        questions: ["این اثر در چه موقعیتی پررنگ‌تر است؟", "چه نشانه‌ای آن را مشخص می‌کند؟"],
        answers: ["در رفت‌وآمد روزانه"],
        index: 1,
        draft: "",
      },
    });
    expect(registration.workbooks.P.followups).toMatchObject({
      P02: { status: "needs-more", sourceAnswer: "مشاهدهٔ یک مانع در مسیر" },
    });
    expect(registration.workbooks.P.followups).not.toHaveProperty("P01");
    expect(registration.workbooks.P.followups).not.toHaveProperty("P04");
    expect(registration.workbooks.S.followups.S03).toMatchObject({
      status: "sufficient",
      questions: [],
      sourceAnswer: "سه مرحله مشخص شد",
    });
    expect(registration.workbooks.E.followups.E02).toMatchObject({
      status: "sufficient",
      questions: [],
      sourceAnswer: "مشارکت‌کنندگان آمادگی دارند",
    });
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
    expect(WORKBOOKS.C.pages.slice(1).every((page) =>
      (page.fields ?? []).every((field) => !("noteLabel" in field)),
    )).toBe(true);
    expect(WORKBOOKS.C.pages[1].fields?.[0]).toMatchObject({
      options: expect.arrayContaining([
        expect.objectContaining({ value: "other", detailLabel: "کدام؟" }),
      ]),
    });
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