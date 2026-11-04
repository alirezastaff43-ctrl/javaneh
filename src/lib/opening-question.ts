import { isPersianText } from "./locale";
import { redactPersonalData } from "./privacy";

export type OpeningQuestion = {
  question: string;
  questionContext: string;
};

export function createDemoOpeningQuestion(seed: string): OpeningQuestion {
  const safeSeed =
    redactPersonalData(seed.trim())
      .replace(/[؟?]/gu, " ")
      .replace(/\s+/gu, " ")
      .slice(0, 160)
      .trim() || "ایدهٔ اولیه";

  return {
    question: `وقتی به «${safeSeed}» فکر می‌کنی، کدام موقعیت مشخص آن برایت مهم‌تر است؟`,
    questionContext:
      "برای نمونه، می‌توانی از زمان، مکان یا فردی بگویی که این مسئله را در تجربهٔ روزمره‌اش می‌بیند.",
  };
}

const GENERIC_IDEA_WORDS = new Set([
  "ایده",
  "ایدهٔ",
  "ایده‌ی",
  "من",
  "ما",
  "برای",
  "از",
  "به",
  "با",
  "در",
  "را",
  "و",
  "یا",
  "اما",
  "این",
  "آن",
  "یک",
  "که",
  "است",
  "هست",
  "شود",
  "شود",
  "کردن",
  "کرد",
  "می",
  "میخواهم",
  "می‌خواهم",
  "مسئله",
  "مشکل",
  "راهکار",
  "چیزی",
  "کدام",
  "چه",
  "چرا",
  "چطور",
  "چگونه",
  "موقعیت",
  "مشخص",
  "خودت",
  "خودم",
  "دیده",
  "دیدی",
  "دارم",
  "دارد",
  "خواهد",
  "بشود",
  "باید",
  "میشود",
  "می‌شود",
  "آنها",
  "آن‌ها",
  "اینکه",
  "این‌که",
]);

function ideaTerms(text: string): string[] {
  return text
    .normalize("NFKC")
    .replace(/[يى]/gu, "ی")
    .replace(/ك/gu, "ک")
    .replace(/[\u064B-\u065F\u0670]/gu, "")
    .replace(/[\u200c\u200d]/gu, "")
    .toLocaleLowerCase("fa")
    .match(/[\p{L}\p{N}]+/gu)
    ?.filter((term) => term.length >= 3 && !GENERIC_IDEA_WORDS.has(term)) ?? [];
}

export function hasIdeaSpecificDetail(question: string, seed: string): boolean {
  const questionWithoutQuotedIdea = question.replace(/«[^»]*»|["“”][^"“”]*["“”]/gu, " ");
  const questionWords = ideaTerms(questionWithoutQuotedIdea);
  const seedWords = ideaTerms(seed);
  if (seedWords.length === 0) return true;
  return seedWords.some((seedWord) =>
    questionWords.some(
      (questionWord) =>
        questionWord === seedWord ||
        (Math.min(questionWord.length, seedWord.length) >= 4 &&
          (questionWord.startsWith(seedWord) ||
            seedWord.startsWith(questionWord))),
    ),
  );
}

export function isValidOpeningQuestion(
  value: unknown,
  seed?: string,
): value is OpeningQuestion {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<OpeningQuestion>;
  const valid =
    typeof result.question === "string" &&
    result.question.trim().length > 0 &&
    result.question.length <= 600 &&
    isPersianText(result.question) &&
    (result.question.match(/[؟?]/gu) ?? []).length === 1 &&
    typeof result.questionContext === "string" &&
    result.questionContext.trim().length > 0 &&
    result.questionContext.length <= 360 &&
    isPersianText(result.questionContext) &&
    !/[؟?]/u.test(result.questionContext);
  if (!valid || typeof result.question !== "string") return false;
  return seed === undefined || hasIdeaSpecificDetail(result.question, seed);
}
