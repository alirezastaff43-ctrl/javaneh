export const STRUCTURED_STORAGE_KEY = "javaneh-structured-registration-v1";

export const REGISTRATION_STEPS = [
  "intro",
  "education",
  "contact",
  "problem",
  "place",
  "better",
  "action",
  "refine",
  "outcomes",
  "groups",
  "axis",
  "title",
  "extra",
  "review",
] as const;

export type RegistrationStep = (typeof REGISTRATION_STEPS)[number];
export type RegistrationStatus = "draft" | "submitted";

export type StructuredRegistrationData = {
  education: string;
  educationOther: string;
  fullName: string;
  email: string;
  province: string;
  city: string;
  cityOther: string;
  problem: string;
  place: string;
  placeOther: string;
  better: string;
  action: string;
  refine: "more" | "keep" | "";
  outcomes: string[];
  outcomeOther: string;
  groups: string[];
  groupOther: string;
  axis: string;
  axisMulti: string[];
  title: string;
  titleDeferred: boolean;
  field: string;
  audience: string;
  audienceOther: string;
  news: boolean;
};

export type StructuredRegistration = {
  id: string;
  status: RegistrationStatus;
  step: RegistrationStep;
  data: StructuredRegistrationData;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
};

export const PROVINCES = [
  "آذربایجان شرقی", "آذربایجان غربی", "اردبیل", "اصفهان", "البرز", "ایلام", "بوشهر", "تهران",
  "چهارمحال و بختیاری", "خراسان جنوبی", "خراسان رضوی", "خراسان شمالی", "خوزستان", "زنجان", "سمنان",
  "سیستان و بلوچستان", "فارس", "قزوین", "قم", "کردستان", "کرمان", "کرمانشاه", "کهگیلویه و بویراحمد",
  "گلستان", "گیلان", "لرستان", "مازندران", "مرکزی", "هرمزگان", "همدان", "یزد",
] as const;

export const CITIES: Record<string, string[]> = {
  "آذربایجان شرقی": ["تبریز", "مراغه", "مرند", "میانه", "اهر", "بناب", "سراب", "شبستر", "عجب‌شیر", "آذرشهر", "هشترود", "ملکان", "جلفا", "کلیبر"],
  "آذربایجان غربی": ["ارومیه", "خوی", "مهاباد", "میاندوآب", "بوکان", "سلماس", "نقده", "پیرانشهر", "سردشت", "ماکو", "تکاب", "شاهین‌دژ", "اشنویه"],
  اردبیل: ["اردبیل", "پارس‌آباد", "مشگین‌شهر", "خلخال", "گرمی", "بیله‌سوار", "نمین", "نیر", "سرعین"],
  اصفهان: ["اصفهان", "کاشان", "خمینی‌شهر", "نجف‌آباد", "شاهین‌شهر", "شهرضا", "فولادشهر", "مبارکه", "آران و بیدگل", "گلپایگان", "زرین‌شهر", "فلاورجان", "نطنز", "اردستان", "نایین", "خوانسار", "سمیرم", "دهاقان"],
  البرز: ["کرج", "فردیس", "نظرآباد", "هشتگرد", "محمدشهر", "ماهدشت", "کمال‌شهر", "اشتهارد", "طالقان"],
  ایلام: ["ایلام", "دهلران", "ایوان", "آبدانان", "دره‌شهر", "مهران", "سرابله", "ارکواز", "بدره"],
  بوشهر: ["بوشهر", "برازجان", "بندر گناوه", "بندر کنگان", "خورموج", "بندر دیلم", "جم", "عسلویه", "اهرم", "بندر دیر"],
  تهران: ["تهران", "اسلامشهر", "شهریار", "قدس", "ملارد", "پاکدشت", "ورامین", "قرچک", "رباط‌کریم", "نسیم‌شهر", "پردیس", "دماوند", "رودهن", "بومهن", "پیشوا", "فیروزکوه"],
  "چهارمحال و بختیاری": ["شهرکرد", "بروجن", "فارسان", "لردگان", "فرخ‌شهر", "اردل", "چلگرد", "سامان", "بن", "شلمزار"],
  "خراسان جنوبی": ["بیرجند", "قائن", "فردوس", "طبس", "نهبندان", "سربیشه", "بشرویه", "اسدیه", "سرایان", "خوسف"],
  "خراسان رضوی": ["مشهد", "نیشابور", "سبزوار", "تربت حیدریه", "قوچان", "کاشمر", "تربت جام", "گناباد", "چناران", "تایباد", "سرخس", "فریمان", "بردسکن", "خواف", "درگز"],
  "خراسان شمالی": ["بجنورد", "شیروان", "اسفراین", "جاجرم", "آشخانه", "فاروج", "گرمه", "راز"],
  خوزستان: ["اهواز", "دزفول", "آبادان", "بندر ماهشهر", "اندیمشک", "خرمشهر", "بهبهان", "ایذه", "شوشتر", "مسجدسلیمان", "شوش", "رامهرمز", "بندر امام خمینی", "سوسنگرد", "باغملک", "هندیجان", "امیدیه"],
  زنجان: ["زنجان", "ابهر", "خرمدره", "قیدار", "هیدج", "آب‌بر", "ماهنشان", "زرین‌آباد", "سلطانیه"],
  سمنان: ["سمنان", "شاهرود", "دامغان", "گرمسار", "مهدی‌شهر", "ایوانکی", "آرادان", "سرخه", "میامی"],
  "سیستان و بلوچستان": ["زاهدان", "زابل", "چابهار", "ایرانشهر", "سراوان", "خاش", "کنارک", "نیک‌شهر", "راسک", "زهک", "میرجاوه", "فنوج"],
  فارس: ["شیراز", "مرودشت", "جهرم", "فسا", "کازرون", "صدرا", "داراب", "فیروزآباد", "لار", "آباده", "نورآباد", "اقلید", "نی‌ریز", "استهبان", "لامرد", "گراش"],
  قزوین: ["قزوین", "الوند", "تاکستان", "آبیک", "بوئین‌زهرا", "محمدیه", "اقبالیه", "آوج"],
  قم: ["قم", "جعفریه", "کهک", "سلفچگان", "دستجرد", "قنوات"],
  کردستان: ["سنندج", "سقز", "مریوان", "بانه", "قروه", "بیجار", "کامیاران", "دیواندره", "دهگلان", "سروآباد"],
  کرمان: ["کرمان", "سیرجان", "رفسنجان", "جیرفت", "بم", "زرند", "کهنوج", "شهربابک", "بافت", "بردسیر", "راور", "کوهبنان", "عنبرآباد", "منوجان", "انار"],
  کرمانشاه: ["کرمانشاه", "اسلام‌آباد غرب", "کنگاور", "هرسین", "صحنه", "سنقر", "جوانرود", "پاوه", "قصر شیرین", "سرپل ذهاب", "گیلانغرب", "روانسر"],
  "کهگیلویه و بویراحمد": ["یاسوج", "دوگنبدان", "دهدشت", "لیکک", "سی‌سخت", "باشت", "چرام", "لنده"],
  گلستان: ["گرگان", "گنبد کاووس", "علی‌آباد کتول", "بندر ترکمن", "آزادشهر", "کردکوی", "آق‌قلا", "مینودشت", "کلاله", "بندر گز", "گمیشان", "رامیان"],
  گیلان: ["رشت", "بندر انزلی", "لاهیجان", "لنگرود", "هشتپر", "آستارا", "رودسر", "صومعه‌سرا", "آستانه اشرفیه", "فومن", "رودبار", "ماسال", "املش", "شفت", "رضوانشهر", "سیاهکل"],
  لرستان: ["خرم‌آباد", "بروجرد", "دورود", "کوهدشت", "الیگودرز", "نورآباد", "ازنا", "الشتر", "پل‌دختر"],
  مازندران: ["ساری", "بابل", "آمل", "قائم‌شهر", "بهشهر", "چالوس", "نکا", "بابلسر", "تنکابن", "نوشهر", "نور", "محمودآباد", "رامسر", "جویبار", "فریدونکنار", "پل سفید"],
  مرکزی: ["اراک", "ساوه", "خمین", "محلات", "دلیجان", "شازند", "تفرش", "آشتیان", "کمیجان", "فرمهین", "مامونیه", "خنداب"],
  هرمزگان: ["بندرعباس", "میناب", "قشم", "بندر لنگه", "کیش", "دهبارز", "حاجی‌آباد", "بستک", "جاسک", "پارسیان", "بندر خمیر", "سیریک"],
  همدان: ["همدان", "ملایر", "نهاوند", "تویسرکان", "اسدآباد", "کبودرآهنگ", "بهار", "رزن", "لالجین", "فامنین"],
  یزد: ["یزد", "میبد", "اردکان", "بافق", "مهریز", "ابرکوه", "تفت", "اشکذر", "هرات", "بهاباد", "زارچ"],
};

export const AXES = [
  "بهینه‌سازی مصرف و کاهش اتلاف منابع با مشارکت مردم",
  "تقویت فرهنگ و کنش مردمی در حمایت از تولید داخلی",
  "توسعهٔ یاریگری و الگوهای همکاری مردمی در اقتصاد",
  "ارتقای تاب‌آوری اجتماعی در مواجهه با فشارهای اقتصادی",
  "نوآوری در ارتباطات، روایت و بسیج اجتماعی",
  "نوآوری در الگوهای توانمندسازی و حمایت از اقشار آسیب‌پذیر",
] as const;

export const OUTCOMES = [
  "کاهش هدررفت منابع، پول یا وقت",
  "کمک به تولیدکنندگان داخلی",
  "آسان‌ترشدن همیاری و کمک مردم به یکدیگر",
  "افزایش حمایت مردم از یکدیگر در فشارهای اقتصادی",
  "افزایش آگاهی، امید یا مشارکت مردم",
  "توانمندترشدن افراد و گروه‌های آسیب‌پذیر",
  "نتیجهٔ دیگر",
  "مطمئن نیستم",
] as const;

export const BENEFICIARY_GROUPS = [
  "خانواده‌های کم‌درآمد", "افراد بیکار یا فاقد درآمد پایدار", "زنان سرپرست خانوار", "سالمندان",
  "افراد دارای معلولیت", "کودکان و نوجوانان", "ساکنان مناطق محروم", "گروه دیگر", "هنوز دقیق نمی‌دانم",
] as const;

export const PLACES = [
  "خانه یا ساختمان", "محله، روستا یا شهر", "مدرسه یا دانشگاه", "محل کار", "اداره یا سازمان دولتی",
  "فضای مجازی", "جای دیگری", "مطمئن نیستم",
] as const;

export const EDUCATION_LEVELS = [
  "زیر دیپلم", "دیپلم", "کاردانی", "کارشناسی", "کارشناسی ارشد", "دکتری", "تحصیلات حوزوی",
  "مورد دیگر", "ترجیح می‌دهم پاسخ ندهم",
] as const;

export const AUDIENCES = [
  "شهروند علاقه‌مند", "دانش‌آموز یا دانشجو", "پژوهشگر یا استاد", "فعال اجتماعی یا فرهنگی",
  "عضو گروه مردمی یا سمن", "صاحب ایده یا کسب‌وکار", "متخصص یا شاغل حرفه‌ای", "مورد دیگر",
] as const;

export const STEP_TITLES: Record<RegistrationStep, string> = {
  intro: "شروع فرم", education: "مقطع تحصیلی", contact: "اطلاعات اصلی", problem: "مسئله یا اتفاق",
  place: "محل مشاهدهٔ مسئله", better: "تصویر وضعیت بهتر", action: "تغییر یا اقدام پیشنهادی",
  refine: "مرور پاسخ پیشنهادی", outcomes: "پیامدهای پیشنهاد", groups: "گروه‌های بهره‌مند",
  axis: "محور ایده", title: "عنوان ایده", extra: "اطلاعات تکمیلی", review: "مرور نهایی و ثبت محلی",
};

export function emptyRegistrationData(): StructuredRegistrationData {
  return {
    education: "", educationOther: "", fullName: "", email: "", province: "", city: "", cityOther: "",
    problem: "", place: "", placeOther: "", better: "", action: "", refine: "", outcomes: [],
    outcomeOther: "", groups: [], groupOther: "", axis: "", axisMulti: [], title: "", titleDeferred: false,
    field: "", audience: "", audienceOther: "", news: false,
  };
}

export function createStructuredDraft(now = new Date()): StructuredRegistration {
  const timestamp = now.toISOString();
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    status: "draft", step: "intro", data: emptyRegistrationData(), createdAt: timestamp, updatedAt: timestamp,
  };
}

const textFields = [
  "education", "educationOther", "fullName", "email", "province", "city", "cityOther", "problem", "place",
  "placeOther", "better", "action", "outcomeOther", "groupOther", "axis", "title", "field", "audience",
  "audienceOther",
] as const;

export function normalizeRegistrationData(value: unknown): StructuredRegistrationData {
  const data = emptyRegistrationData();
  if (!value || typeof value !== "object") return data;
  const source = value as Record<string, unknown>;
  for (const key of textFields) {
    if (typeof source[key] === "string")
      data[key] = source[key].slice(0, key === "problem" || key === "better" || key === "action" ? 4000 : 300);
  }
  if (source.refine === "more" || source.refine === "keep") data.refine = source.refine;
  for (const key of ["outcomes", "groups", "axisMulti"] as const) {
    if (Array.isArray(source[key]))
      data[key] = source[key]
        .filter((item): item is string => typeof item === "string")
        .slice(0, key === "axisMulti" ? AXES.length : 3);
  }
  data.titleDeferred = source.titleDeferred === true;
  data.news = source.news === true;
  return data;
}

export function normalizeRegistrationStore(value: unknown): StructuredRegistration[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): StructuredRegistration[] => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<StructuredRegistration>;
    if (typeof candidate.id !== "string" || !candidate.id) return [];
    const status = candidate.status === "submitted" ? "submitted" : "draft";
    const step = REGISTRATION_STEPS.includes(candidate.step as RegistrationStep)
      ? candidate.step as RegistrationStep
      : "intro";
    const validDate = (date: unknown) =>
      typeof date === "string" && Number.isFinite(Date.parse(date))
        ? new Date(date).toISOString()
        : new Date(0).toISOString();
    const normalized: StructuredRegistration = {
      id: candidate.id.slice(0, 100), status, step,
      data: normalizeRegistrationData(candidate.data),
      createdAt: validDate(candidate.createdAt), updatedAt: validDate(candidate.updatedAt),
    };
    if (status === "submitted") normalized.submittedAt = validDate(candidate.submittedAt);
    return [normalized];
  });
}

export function visibleRegistrationSteps(data: StructuredRegistrationData): RegistrationStep[] {
  return REGISTRATION_STEPS.filter((step) =>
    (step !== "refine" || isGeneralAction(data.action)) &&
    (step !== "groups" || data.outcomes.includes(OUTCOMES[5])),
  );
}

export function isGeneralAction(value: string): boolean {
  return /فرهنگ.?سازی|رسیدگی.{0,8}(?:شود|کنند)|حل.{0,5}شود|اقدام.{0,8}شود|توجه.{0,8}شود|آگاهی.?بخشی|حمایت.{0,5}شود|بهتر.{0,5}شود|باید کاری کنند/u.test(value);
}

export function countWords(value: string): number {
  return value.match(/[\p{L}\p{N}]+/gu)?.length ?? 0;
}

export function validateRegistrationStep(
  step: RegistrationStep,
  data: StructuredRegistrationData,
): string {
  switch (step) {
    case "education":
      return data.education === "مورد دیگر" && !data.educationOther.trim()
        ? "مقطع تحصیلی دیگر را مشخص کنید."
        : "";
    case "contact": {
      if (!data.fullName.trim()) return "نام و نام خانوادگی را وارد کنید.";
      if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(data.email))
        return "نشانی ایمیل را به شکل درست وارد کنید یا خالی بگذارید.";
      if (!PROVINCES.includes(data.province as (typeof PROVINCES)[number]))
        return "استان محل سکونت را انتخاب کنید.";
      if (!data.city) return "شهر محل سکونت را انتخاب کنید.";
      if (data.city !== "سایر" && !CITIES[data.province]?.includes(data.city))
        return "شهر را از فهرست استان انتخاب کنید.";
      return data.city === "سایر" && !data.cityOther.trim() ? "نام شهر را بنویسید." : "";
    }
    case "problem":
      if (!data.problem.trim()) return "دربارهٔ مسئله‌ای که دیده‌اید بنویسید.";
      return countWords(data.problem) < 20 ? "پاسخ مسئله باید دست‌کم ۲۰ واژه داشته باشد." : "";
    case "place":
      if (!PLACES.includes(data.place as (typeof PLACES)[number])) return "محل مشاهدهٔ مسئله را انتخاب کنید.";
      return data.place === "جای دیگری" && !data.placeOther.trim() ? "محل دیگر را مشخص کنید." : "";
    case "better":
      return data.better.trim() ? "" : "تغییری را که در وضعیت بهتر دیده می‌شود بنویسید.";
    case "action":
      return data.action.trim() ? "" : "مشخص کنید چه کسی چه کاری را متفاوت انجام دهد.";
    case "refine":
      return data.refine ? "" : "یکی از دو گزینه را انتخاب کنید.";
    case "outcomes": {
      if (data.outcomes.length < 1 || data.outcomes.length > 3)
        return "یک تا سه پیامد را انتخاب کنید.";
      if (data.outcomes.includes(OUTCOMES[7]) && data.outcomes.length > 1)
        return "گزینهٔ «مطمئن نیستم» را به‌تنهایی انتخاب کنید.";
      return data.outcomes.includes(OUTCOMES[6]) && !data.outcomeOther.trim()
        ? "نتیجهٔ دیگر را توضیح دهید."
        : "";
    }
    case "groups":
      if (data.groups.length > 3) return "حداکثر سه گروه را انتخاب کنید.";
      if (data.groups.includes(BENEFICIARY_GROUPS[8]) && data.groups.length > 1)
        return "گزینهٔ «هنوز دقیق نمی‌دانم» را به‌تنهایی انتخاب کنید.";
      return data.groups.includes(BENEFICIARY_GROUPS[7]) && !data.groupOther.trim()
        ? "گروه دیگر را مشخص کنید."
        : "";
    case "extra":
      return data.audience === "مورد دیگر" && !data.audienceOther.trim()
        ? "گروه مخاطب دیگر را مشخص کنید."
        : "";
    case "axis":
      if (data.axis === "مطمئن نیستم") return "";
      if (data.axis === "چند محور")
        return data.axisMulti.length ? "" : "یک یا چند محور مرتبط را انتخاب کنید.";
      return AXES.includes(data.axis as (typeof AXES)[number]) ? "" : "یک محور را انتخاب کنید.";
    case "title":
      return data.title.trim() || data.titleDeferred
        ? ""
        : "عنوان را بنویسید یا آن را به بعد موکول کنید.";
    default:
      return "";
  }
}