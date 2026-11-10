import type { Idea } from "@/lib/domain";
import type { StructuredRegistration } from "@/lib/structured-registration";
import type { loadUserData } from "@/lib/user-data";

type UserData = Awaited<ReturnType<typeof loadUserData>>;

function answerText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "بله" : "خیر";
  return JSON.stringify(value);
}

function ideaContext(idea: Idea) {
  const statuses: Record<Idea["status"], string> = {
    initial: "تازه‌شروع‌شده",
    "in-development": "در حال توسعه",
    "awaiting-confirmation": "در انتظار تأیید",
    submitted: "ارسال‌شده",
  };
  const answers = idea.answers.map(({ section, question, answer }) => ({
    question: `${section}: ${question}`,
    answer,
  }));
  if (idea.draftAnswer?.trim())
    answers.push({ question: "پاسخ پیش‌نویس", answer: idea.draftAnswer });
  if (idea.pendingTurn?.answer.trim())
    answers.push({
      question: idea.pendingTurn.question,
      answer: idea.pendingTurn.answer,
    });
  return {
    title: idea.title,
    seed: idea.seed,
    status: statuses[idea.status],
    answers,
    proposal: Object.entries(idea.proposal).map(([section, text]) => ({
      section,
      text,
    })),
  };
}

function registrationContext(registration: StructuredRegistration) {
  const privateFields = new Set(["fullName", "email"]);
  const answers = Object.entries(registration.data)
    .filter(([key]) => !privateFields.has(key))
    .map(([question, answer]) => ({
      question: `فرم ثبت‌نام: ${question}`,
      answer: answerText(answer),
    }))
    .filter((entry) => entry.answer.trim());

  for (const [flow, workbook] of Object.entries(registration.workbooks)) {
    for (const [key, value] of Object.entries(workbook.answers)) {
      const text = answerText(value);
      if (text.trim())
        answers.push({
          question: `کاربرگ ${flow}، ${key}`,
          answer: text,
        });
    }
    for (const [page, followup] of Object.entries(workbook.followups)) {
      if (followup.sourceAnswer.trim())
        answers.push({
          question: `کاربرگ ${flow}، پاسخ اولیه ${page}`,
          answer: followup.sourceAnswer,
        });
      followup.answers.forEach((answer, index) => {
        if (answer.trim())
          answers.push({
            question: followup.questions[index] ?? `پرسش تکمیلی ${index + 1}`,
            answer,
          });
          if (followup.draft.trim())
            answers.push({
              question: `پیش‌نویس پاسخ تکمیلی ${page}`,
              answer: followup.draft,
            });
      });
    }
  }

  const data = registration.data;
  const seed = [data.problem, data.place, data.placeOther, data.better, data.action]
    .filter(Boolean)
    .join("\n");
  return {
    title: data.title || "ایدهٔ ثبت‌شده",
    seed,
    status: registration.status === "submitted" ? "ثبت نهایی‌شده" : "پیش‌نویس",
    answers,
    proposal: [] as Array<{ section: string; text: string }>,
  };
}

export function buildMentorContext(data: UserData) {
  return [
    ...data.state.ideas.map(ideaContext),
    ...data.registrations.map(registrationContext),
  ];
}
