import { describe, expect, it } from "vitest";
import {
  applyDeadlineTransitions,
  awardToken,
  canCreateIdea,
  developmentProgressIndex,
  deferSubmission,
  emptyState,
  hasCompletedDevelopment,
  nleoveIdea,
  submitNow,
  type Idea,
} from "./domain";
import { formatDate } from "./locale";
import { DEVELOPMENT_AXES } from "./interviewer";

const idea = (overrides: Partial<Idea> = {}): Idea => ({
  id: "idea-1",
  title: "Community garden",
  seed: "A shared garden",
  status: "initial",
  stage: "initial",
  answers: [],
  proposal: {},
  tokens: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("demo domain rules", () => {
  it("blocks idea four", () => {
    expect(
      canCreateIdea({
        ...emptyState(),
        ideas: [idea(), idea({ id: "2" }), idea({ id: "3" })],
      }),
    ).toBe(false);
  });

  it("counts structured-registration slots against the existing three-item limit", () => {
    const state = { ...emptyState(), ideas: [idea(), idea({ id: "2" })] };
    expect(canCreateIdea(state)).toBe(true);
    expect(canCreateIdea(state, 1)).toBe(false);
    expect(canCreateIdea(emptyState(), 3)).toBe(false);
  });

  it("unlocks review only when every development axis has a non-empty answer", () => {
    for (let count = 0; count < DEVELOPMENT_AXES.length; count += 1) {
      const partial = idea({
        answers: DEVELOPMENT_AXES.slice(0, count).map((axis) => ({
          section: axis.section,
          question: axis.question,
          answer: "پاسخ",
          createdAt: "2026-01-01T00:00:00.000Z",
        })),
        developmentIndex: DEVELOPMENT_AXES.length,
      });

      expect(hasCompletedDevelopment(partial)).toBe(false);
      expect(developmentProgressIndex(partial)).toBe(count);
    }

    const legacyWithGap = idea({
      answers: [DEVELOPMENT_AXES[0], DEVELOPMENT_AXES[2]].map((axis) => ({
        section: axis.section,
        question: axis.question,
        answer: "پاسخ ذخیره‌شده",
        createdAt: "2026-01-01T00:00:00.000Z",
      })),
      developmentIndex: DEVELOPMENT_AXES.length,
    });
    expect(developmentProgressIndex(legacyWithGap)).toBe(1);
    expect(hasCompletedDevelopment(legacyWithGap)).toBe(false);
    expect(legacyWithGap.answers).toHaveLength(2);

    expect(
      hasCompletedDevelopment(
        idea({
          answers: [
            {
              section: "The problem",
              question: "پرسش ثبت اولیه",
              answer: "پاسخ ثبت اولیه",
              createdAt: "2026-01-01T00:00:00.000Z",
            },
          ],
        }),
      ),
    ).toBe(false);

    const complete = idea({
      answers: DEVELOPMENT_AXES.map((axis) => ({
        section: axis.section,
        question: axis.question,
        answer: "هنوز مطمئن نیستم.",
        createdAt: "2026-01-01T00:00:00.000Z",
      })),
    });
    expect(hasCompletedDevelopment(complete)).toBe(true);
    expect(developmentProgressIndex(complete)).toBe(DEVELOPMENT_AXES.length);
    expect(
      hasCompletedDevelopment({
        ...complete,
        answers: complete.answers.map((answer) =>
          answer.section === DEVELOPMENT_AXES[5].section
            ? { ...answer, answer: "   " }
            : answer,
        ),
      }),
    ).toBe(false);
  });

  it("removes only the selected idea and preserves the remaining local state", () => {
    const state = {
      ...emptyState(),
      profile: { name: "Demo", verified: true },
      ideas: [idea(), idea({ id: "idea-2" }), idea({ id: "idea-3" })],
    };

    expect(removeIdea(state, "idea-2")).toEqual({
      ...state,
      ideas: [state.ideas[0], state.ideas[2]],
    });
    expect(removeIdea(state, "unknown")).toEqual(state);
  });xr-1", 5).tttat(nfirmationDeadlineAt: "not-a-date",
          updatedAt: "also-not-a-date",
        }),
      ],
    });
    expect(invalidDeadline.ideas[0].status).toBe("in-development");
    expect(invalidDeadline.ideas[0].updatedAt).toBe("1970-01-01T00:00:00.000Z");
  });

  it("restores dynamic turns and pending answers while accepting older saved questions", () => {
    const restored = normalizeState({
      schemaVersion: 1,
      ideas: [
        idea({
          intakeIndex: 2,
          mentorNextQuestion: {
            stage: "initial",
            index: 2,
            section: "What is known",
            text: "دربارهٔ علت این مسئله چه چیزی را می‌دانید؟",
            questionContext:
              "جداکردن دانسته‌ها از پرسش‌های بی‌پاسخ کمک می‌کند مسیر بررسی روشن شود.",
          },
          pendingTurn: {
            stage: "initial",
            index: 2,
            section: "What is known",
            question: "دربارهٔ علت این مسئله چه چیزی را می‌دانید؟",
            answer: "هنوز مطمئن نیستم.",
            questionContext:
              "لازم نیست از همین حالا پاسخ قطعی داشته باشی؛ مسیر بررسی را پیدا می‌کنیم.",
          },
          skippedSections: {
            initial: ["People affected", "Not an axis"],
          },
        }),
      ],
    }).ideas[0];

    expect(restored.mentorNextQuestion).toEqual({
      stage: "initial",
      index: 2,
      section: "What is known",
      text: "دربارهٔ علت این مسئله چه چیزی را می‌دانید؟",
      questionContext:
        "جداکردن دانسته‌ها از پرسش‌های بی‌پاسخ کمک می‌کند مسیر بررسی روشن شود.",
    });
    expect(restored.pendingTurn?.answer).toBe("هنوز مطمئن نیستم.");
    expect(restored.pendingTurn?.questionContext).toContain("پاسخ قطعی");
    expect(restored.skippedSections?.initial).toEqual(["People affected"]);

    const oldData = normalizeState({
      schemaVersion: 1,
      ideas: [
        idea({
          mentorNextQuestion: {
            stage: "initial",
            index: 1,
            text: "چه کسانی با این مسئله روبه‌رو هستند؟",
          },
        }),
      ],
    }).ideas[0];
    expect(oldData.mentorNextQuestion?.section).toBe("People affected");
    expect(oldData.mentorNextQuestion).not.toHaveProperty("questionContext");
  });

  it("drops invalid saved question explanations without discarding valid questions", () => {
    const restored = normalizeState({
      schemaVersion: 1,
      ideas: [
        idea({
          mentorNextQuestion: {
            stage: "initial",
            index: 1,
            section: "People affected",
            text: "چه کسانی با این مسئله روبه‌رو هستند؟",
            questionContext: "A non-Persian explanation.",
          },
        }),
      ],
    }).ideas[0];

    expect(restored.mentorNextQuestion?.text).toBe(
      "چه کسانی با این مسئله روبه‌رو هستند؟",
    );
    expect(restored.mentorNextQuestion).not.toHaveProperty("questionContext");
  });

  it("drops dynamic question and pending turn metadata with invalid axis indexes", () => {
    const restored = normalizeState({
      schemaVersion: 1,
      ideas: [
        idea({
          mentorNextQuestion: {
            stage: "initial",
            index: 2,
            section: "Your idea",
            text: "چه چیزی را بررسی می‌کنید؟",
          },
          pendingTurn: {
            stage: "development",
            index: 1,
            section: "Evidence",
            question: "چه نمونه‌ای را دیده‌اید؟",
            answer: "یک نمونه.",
          },
        }),
      ],
    }).ideas[0];

    expect(restored).not.toHaveProperty("mentorNextQuestion");
    expect(restored).not.toHaveProperty("pendingTurn");
  });

  it("transitions a deferred review at exactly 72 hours", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const deferred = deferSubmission(idea(), now);
    const storedDeadline = deferred.confirmationDeadlineAt;
    expect(
      new Date(deferred.confirmationDeadlineAt!).getTime() - now.getTime(),
    ).toBe(72 * 60 * 60 * 1000);
      expect(formatDate(storedDeadline!)).toMatch(/۱۴۰۴/);
    expect(deferred.confirmationDeadlineAt).toBe(storedDeadline);
    const restored = normalizeState({
      schemaVersion: 1,
      ideas: [{ ...deferred, proposal: { summary: "پیشنهاد قابل ویرایش" } }],
    }).ideas[0];
    expect(restored.confirmationDeadlineAt).toBe(storedDeadline);
    expect(restored.proposal.summary).toBe("پیشنهاد قابل ویرایش");
    expect(
      applyDeadlineTransitions(
        { ...emptyState(), ideas: [restored] },
        new Date(new Date(storedDeadline!).getTime() - 1),
      ).ideas[0].status,
    ).toBe("awaiting-confirmation");
    expect(
      applyDeadlineTransitions(
        { ...emptyState(), ideas: [restored] },
        new Date(storedDeadline!),
      ).ideas[0].autoSubmitted,
    ).toBe(true);
    expect(submitNow(deferred, now).status).toBe("submitted");
  });
});
