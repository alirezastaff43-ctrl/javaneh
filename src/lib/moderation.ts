export type ModerationCategory = "relevant" | "off_topic" | "restricted";

export type ModerationInput = {
  kind: "seed" | "answer";
  seed: string;
  question?: string;
  text: string;
};

export type ModerationResult = {
  category: ModerationCategory;
};

const restrictedTerms =
  /(?:سیاس(?:ی|ت)|حزب(?:ی)?|اپوز(?:یسیون|سیون)|برانداز(?:ی)?|سرنگون(?:ی)?|مخالف(?:ت)?\s+حکومت|ضد\s+حکومت|انتخابات|انقلاب|politic|opposition|overthrow|regime\s+change)/iu;
const socialTerms =
  /(?:اجتماع|جامعه|مردم|محله|تاب.?آور|پایداری|آموزش|سلامت|بهداشت|محیط.?زیست|پسماند|آب|انرژی|غذا|سالمند|کودک|معلول|اشتغال|بیکاری|فقر|مهاجر|مشارکت|تعاون|حمل.?ونقل|دسترسی|بحران|آسیب|خانواده|زنان|جوانان|روستا|شهر|همیار|داوطلب|social|community|resilien|education|health|environment|waste|employment|poverty|accessibility)/iu;
const uncertaintyPhrases =
  /(?:هنوز\s*(?:مطمئن|نمی.?دانم|نمی.?دونم)|نمی.?دانم|اطلاعی\s ندارم|not\s+sure|i\s+don.?t\s+know)/iu;

function normalizedWords(value: string): string[] {
  return (
    value
      .toLocaleLowerCase()
      .replace(/[\u064A\u0649]/gu, "ی")
      .replace(/\u0643/gu, "ک")
      .match(/[\p{L}\p{N}]{3,}/gu) ?? []
  );
}

function hasPersianText(value: string): boolean {
  return /[\u0600-\u06FF]/u.test(value);
}

export function classifyDemoText(input: ModerationInput): ModerationResult {
  const text = input.text.trim();
  if (restrictedTerms.test(text)) return { category: "restricted" };
  if (!hasPersianText(text) || /^(.)\1{5,}$/u.test(text))
    return { category: "off_topic" };

  if (input.kind === "seed")
    return {
      category: socialTerms.test(text) ? "relevant" : "off_topic",
    };

  if (uncertaintyPhrases.test(text)) return { category: "relevant" };
  const contextWords = new Set([
    ...normalizedWords(input.seed),
    ...normalizedWords(input.question ?? ""),
  ]);
  const answerWords = normalizedWords(text);
  const sharesContext = answerWords.some((word) => contextWords.has(word));
  const hasSocialContext = socialTerms.test(text);
  return {
    category:
      answerWords.length >= 2 && (sharesContext || hasSocialContext)
        ? "relevant"
        : "off_topic",
  };
}

export function moderationMessage(category: ModerationCategory): string {
  if (category === "restricted")
    return "این محتوا خارج از محدودیت‌های تعیین‌شده برای این رویداد است. لطفاً ایده یا پاسخ را با موضوع رویداد هماهنگ کنید.";
  if (category === "off_topic")
    return "این متن با محور نوآوری اجتماعی یا تاب‌آوری و پرسش فعلی مرتبط نیست. لطفاً آن را اصلاح کنید.";
  return "";
}