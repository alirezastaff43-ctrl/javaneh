import type { WorkbookFlow } from "./structured-registration";

export type WorkbookOption = {
  value: string;
  label: string;
  detailLabel?: string;
  exclusive?: boolean;
};

type WorkbookFieldBase = { key: string };

export type WorkbookField =
  | (WorkbookFieldBase & { type: "long"; label: string; required?: boolean })
  | (WorkbookFieldBase & {
      type: "single";
      label: string;
      options: readonly WorkbookOption[];
      required?: boolean;
      noteLabel?: string;
    })
  | (WorkbookFieldBase & {
      type: "multiple";
      label: string;
      options: readonly WorkbookOption[];
      required?: boolean;
      minimum?: number;
      maximum?: number;
      noteLabel?: string;
    })
  | (WorkbookFieldBase & {
      type: "boxes";
      labels: readonly string[];
      unsureLabel?: string;
      required?: boolean;
    })
  | (WorkbookFieldBase & {
      type: "list";
      label: string;
      addLabel: string;
      minimum?: number;
      maximum?: number;
      initial?: number;
      secondLabel?: string;
      title?: string;
      choices?: readonly string[];
      noneOptions?: readonly string[];
    });

export type WorkbookPage = {
  id: string;
  title: string;
  question: string;
  kind: "intro" | "questions" | "summary";
  guide?: string;
  nextLabel?: string;
  fields?: readonly WorkbookField[];
};

export type WorkbookDefinition = {
  title: string;
  pages: readonly WorkbookPage[];
};

const option = (value: string, label: string, extra: Partial<WorkbookOption> = {}): WorkbookOption => ({
  value,
  label,
  ...extra,
});
const long = (key: string, label: string): WorkbookField => ({ type: "long", key, label, required: true });
const boxes = (key: string, labels: readonly string[], unsureLabel?: string): WorkbookField => ({
  type: "boxes",
  key,
  labels,
  unsureLabel,
  required: !unsureLabel,
});
const list = (
  key: string,
  label: string,
  addLabel: string,
  options: Partial<Extract<WorkbookField, { type: "list" }>> = {},
): WorkbookField => ({ type: "list", key, label, addLabel, ...options });
const startPage = (
  id: string,
  title: string,
  question: string,
  guide: string,
): WorkbookPage => ({
  id,
  title,
  question,
  guide: `${guide} به پرسش‌ها دقیق و تا جای ممکن کامل پاسخ دهید؛ پرسش‌های بعدی بر اساس پاسخ‌های شما طراحی می‌شوند. پاسخ‌های کامل و مرتبط پس از تأیید مشاور هوشمند جوانه امتیاز تکمیلی می‌گیرند.`,
  kind: "intro",
  nextLabel: "شروع",
});
const endPage = (
  id: string,
  title: string,
  question: string,
  guide: string,
  nextLabel: string,
): WorkbookPage => ({ id, title, question, guide, kind: "summary", nextLabel });
const questionPage = (
  id: string,
  title: string,
  question: string,
  fields: readonly WorkbookField[],
  extra: Partial<Omit<WorkbookPage, "id" | "title" | "question" | "fields" | "kind">> = {},
): WorkbookPage => ({ id, title, question, fields, kind: "questions", ...extra });

export const WORKBOOKS: Record<WorkbookFlow, WorkbookDefinition> = {
  C: {
    title: "فرم تکمیل کارویژه اول",
    pages: [
      startPage(
        "C01",
        "شروع تکمیل ایده",
        "بیایید ایدهٔ شما را یک گام جلوتر ببریم.",
        "پیشنهاد شما قبلاً ثبت شده است. در این بخش چند سؤال کوتاه مطرح می‌شود تا ایده برای بررسی دقیق‌تر روشن‌تر شود. لازم نیست همهٔ پاسخ‌ها را هم‌زمان تکمیل کنید؛ می‌توانید در هر مرحله ذخیره کنید و بعداً بازگردید.",
      ),
      questionPage("C02", "ذینفعان موثر", "این مسئله بیش از همه بر کدام افراد یا گروه‌ها اثر می‌گذارد؟", [{
        type: "multiple",
        key: "stake",
        label: "گروه‌های اثرپذیر",
        required: true,
        minimum: 1,
        options: [
          option("families", "خانواده‌ها"), option("kids", "کودکان و نوجوانان"),
          option("youth", "جوانان"), option("elderly", "سالمندان"),
          option("workers", "شاغلان"), option("jobless", "بیکاران"),
          option("producers", "تولیدکنندگان یا کسب‌وکارهای کوچک"),
          option("residents", "ساکنان یک محله یا منطقه"),
          option("other", "گروه دیگری", { detailLabel: "کدام؟" }),
          option("unknown", "هنوز دقیق نمی‌دانم", { exclusive: true }),
        ],
      }], { guide: "اگر چند گروه با مسئله درگیرند، مهم‌ترین گروه‌ها را انتخاب کنید." }),
      questionPage("C03", "نقش مردم", "مردم یا گروه‌های اجتماعی در این پیشنهاد چه نقشی خواهند داشت؟", [{
        type: "multiple",
        key: "roles",
        label: "نقش مردم",
        required: true,
        minimum: 1,
        options: [
          option("use", "استفاده از راهکار"), option("run", "اجرای بخشی از کار"),
          option("volunteer", "کمک داوطلبانه"), option("share", "به‌اشتراک‌گذاری منابع یا مهارت"),
          option("info", "تولید یا انتقال اطلاعات"), option("decide", "تصمیم‌گیری یا نظارت محلی"),
          option("support", "حمایت از دیگران"),
          option("other", "نقش دیگری", { detailLabel: "کدام؟" }),
          option("unsure", "هنوز مطمئن نیستم", { exclusive: true }),
        ],
      }], {
        guide: "مشخص کنید مردم فقط استفاده‌کنندهٔ راهکارند یا قرار است اقدامی انجام دهند، به یکدیگر کمک کنند، در تصمیم‌گیری نقش داشته باشند یا بخشی از اجرا را پیش ببرند.",
      }),
      questionPage("C04", "نمونه‌ها و تجربه‌های قبلی", "آیا نمونه یا تجربه‌ای مشابه این پیشنهاد می‌شناسید؟", [{
        type: "single",
        key: "prior",
        label: "نمونه‌های مشابه",
        required: true,
        options: [
          option("mine", "بله، خودم تجربه یا اجرا کرده‌ام"),
          option("others", "بله، نمونه‌ای از دیگران دیده‌ام"),
          option("vague", "چیزهایی شبیه آن دیده‌ام ولی دقیق نمی‌دانم"),
          option("no", "نه، نمونه‌ای نمی‌شناسم"),
        ],
      }], { guide: "نیازی به جست‌وجوی مفصل نیست؛ اگر نمونه‌ای می‌شناسید، گزینهٔ نزدیک‌تر را انتخاب کنید." }),
      questionPage("C05", "مرحلهٔ فعلی ایده", "پیشنهاد شما در حال حاضر در چه مرحله‌ای قرار دارد؟", [{
        type: "single",
        key: "stage",
        label: "مرحلهٔ فعلی ایده",
        required: true,
        options: [
          option("thought", "فقط یک فکر اولیه است"),
          option("looked", "کمی درباره‌اش بررسی کرده‌ام"),
          option("draft", "جزئیات یا نمونهٔ اولیه‌ای آماده کرده‌ام"),
          option("tried", "در مقیاس کوچک امتحانش کرده‌ام"),
          option("running", "در حال حاضر اجرا می‌شود"),
        ],
      }], {
        guide: "با انتخاب «ثبت پاسخ»، کارویژهٔ شما تکمیل می‌شود.",
        nextLabel: "ثبت پاسخ",
      }),
    ],
  },
  P: {
    title: "فرم کارویژه دوم: شناخت و اعتبارسنجی مسئله",
    pages: [
      startPage("P01", "شروع کارویژهٔ دوم", "تا اینجا پروژه پیشرفت خوبی داشته است. در این مرحله، مسئله را دقیق‌تر بررسی می‌کنیم.",
        "در این مرحله قرار نیست درستی راهکار خود را اثبات کنید. ابتدا می‌خواهیم روشن شود مسئله برای چه کسانی، در چه موقعیتی و به چه دلیل اهمیت دارد. می‌توانید پاسخ‌ها را در چند نوبت تکمیل کنید."),
      questionPage("P02", "شواهد و ابهام‌ها", "چه مشاهده‌ها، تجربه‌ها، گفت‌وگوها یا منابعی وجود و اهمیت مسئله را پشتیبانی می‌کنند؟", [{
        type: "multiple", key: "pEvidence", label: "شواهد", required: true, minimum: 1,
        options: [
          option("own", "مشاهده یا تجربهٔ شخصی", { detailLabel: "توضیح" }),
          option("talk", "گفت‌وگو با افراد درگیر", { detailLabel: "توضیح" }),
          option("stats", "آمار یا گزارش", { detailLabel: "توضیح" }),
          option("news", "خبر یا محتوای رسانه‌ای", { detailLabel: "توضیح" }),
          option("case", "نمونهٔ اجرایی", { detailLabel: "توضیح" }),
          option("guess", "برداشت اولیه و نیازمند بررسی", { detailLabel: "توضیح" }),
        ],
      }], {
        guide: "برای هر مورد مشخص کنید که مشاهدهٔ شخصی، گفتهٔ یک فرد درگیر، آمار یا گزارش است، یا هنوز صرفاً یک برداشت اولیه محسوب می‌شود.",
      }),
      questionPage("P03", "تعریف دقیق مسئله", "مسئله را در یک یا دو جمله، با اشاره به وضعیت نامطلوب، جامعهٔ درگیر و زمینهٔ وقوع آن صورت‌بندی کنید.", [
        long("pProblem", "تعریف مسئله"),
      ], {
        guide: "توضیح دهید چه وضعیت نامطلوبی، برای چه افرادی و در چه موقعیتی رخ می‌دهد.",
      }),
      questionPage("P04", "جامعه درگیر و نیاز واقعی", "افراد یا گروه‌های درگیر با مسئله با چه نیازها، محدودیت‌ها یا پیامدهایی مواجه‌اند؟", [
        list("pGroups", "گروه", "افزودن گروه دیگر"),
      ], {
        guide: "به تجربه‌ها، گفت‌وگوها یا مشاهده‌های مرتبط اشاره کنید؛ ارائهٔ تعداد دقیق در این مرحله ضروری نیست.",
      }),
      questionPage("P05", "عوامل مؤثر", "چه عواملی در شکل‌گیری یا تداوم مسئله نقش دارند؟", [
        list("pFactors", "عامل", "افزودن عامل", {
          maximum: 5,
          choices: ["این عامل را می‌شود با این ایده تغییر داد", "این عامل مهم است ولی فعلاً خارج از دسترس ماست", "هنوز مطمئن نیستم"],
        }),
      ], { guide: "عوامل می‌توانند اقتصادی، رفتاری، فرهنگی، قانونی، سازمانی یا مرتبط با کمبود اطلاعات و امکانات باشند." }),
      questionPage("P06", "ظرفیت‌های مردمی و موانع", "چه ظرفیت‌های فردی و جمعی برای مواجهه با مسئله وجود دارد و چه موانعی استفاده از آن‌ها را محدود می‌کند؟", [
        boxes("pCap", ["ظرفیت‌های موجود", "موانع"], "هنوز نمی‌دانم"),
      ], {
        guide: "به مهارت‌ها، روابط محلی، گروه‌های مردمی، مکان‌ها، امکانات و تجربه‌های موجود توجه کنید. سپس توضیح دهید چه موانعی استفاده از این ظرفیت‌ها را محدود می‌کنند.",
      }),
      questionPage("P07", "راه‌های موجود", "چه راهکارها یا اقداماتی برای مواجهه با مسئله وجود دارد و چه خلأ یا محدودیتی در آن‌ها باقی مانده است؟", [
        list("pWays", "نمونه یا پیوند", "افزودن نمونه", { noneOptions: ["نمونه‌ای نمی‌شناسم"] }),
      ], { guide: "می‌توانید از تجربهٔ محل زندگی یا کار، خبرها، وب‌سایت‌ها یا گفت‌وگو با افراد استفاده کنید. انجام پژوهش مفصل ضروری نیست." }),
      questionPage("P08", "وجه تمایز", "به‌نظر شما مهم‌ترین تفاوت این پیشنهاد با راهکارهای معمول یا موجود چیست؟", [
        long("pDiff", "وجه تمایز"),
      ], {
        guide: "اگر هنوز مطمئن نیستید، می‌توانید توضیح دهید که تفاوت این پیشنهاد نیازمند بررسی بیشتر است.",
      }),
      endPage("P09", "جمع‌بندی کارویژهٔ دوم", "تبریک! مرحلهٔ شناخت مسئله تکمیل شد",
        "پیش از ثبت، خلاصهٔ مسئله، جامعهٔ درگیر، عوامل مهم، ظرفیت‌ها، راهکارهای موجود و شواهد را مرور کنید. اگر موضوعی هنوز روشن نیست، به‌جای حدس‌زدن آن را به‌عنوان ابهام ثبت کنید.",
        "ثبت و ادامه"),
    ],
  },
  S: {
    title: "فرم کارویژه سوم: طراحی راهکار نوآوری اجتماعی",
    pages: [
      startPage("S01", "شروع کارویژهٔ سوم", "اکنون راهکار خود را با توجه به شناخت دقیق‌تر مسئله بازطراحی کنید.",
        "ممکن است پس از شناخت مسئله، بخشی از ایدهٔ اولیهٔ شما تغییر کرده باشد. این تغییر نشانهٔ ضعف نیست؛ بلکه نشان می‌دهد ایده در حال بهبود است."),
      questionPage("S02", "هدف و تغییر مطلوب", "هدف مشخص راهکار و تغییر اجتماعی مورد انتظار برای جامعه هدف چیست؟", [
        long("sGoal", "هدف و تغییر مطلوب"),
      ], {
        guide: "تغییر مورد انتظار را به نشانه‌ای قابل مشاهده در زندگی جامعهٔ هدف پیوند دهید.",
      }),
      questionPage("S03", "سازوکار راهکار", "اجزا و مراحل اصلی راهکار چیست و این سازوکار از چه طریقی به کاهش مسئله کمک می‌کند؟", [
        list("sSteps", "مرحله", "افزودن مرحله", { initial: 3, minimum: 3, maximum: 6 }),
      ], { guide: "از آغاز تا رسیدن به نتیجه، سه تا شش گام اصلی را بنویسید. ارائهٔ برنامهٔ اجرایی کامل در این مرحله ضروری نیست." }),
      questionPage("S04", "مشارکت مردم", "شیوه ورود، نقش، انگیزه و استمرار مشارکت مردم در راهکار چگونه طراحی شده است؟", [
        boxes("sPeople", ["نقش", "شیوهٔ ورود", "انگیزه", "مانع"]),
      ], {
        guide: "نقش مردم، انگیزهٔ آن‌ها، منفعتی که دریافت می‌کنند و عواملی را که ممکن است مانع مشارکت شوند توضیح دهید.",
      }),
      questionPage("S05", "ذی‌نفعان مؤثر", "ذینفعان موثر بر تحقق راهکار چه کسانی هستند و نقش، منفعت و مسئولیت هرکدام چیست؟", [
        list("sStake", "ذی‌نفع", "افزودن ذی‌نفع", { initial: 2, minimum: 2 }),
      ], { guide: "برای هر ذی‌نفع توضیح دهید چه نقشی دارد، چه موضوعی برای او مهم است و چه نوع همکاری از او انتظار می‌رود." }),
      questionPage("S06", "نوآوری", "وجه نوآورانه این راهکار نسبت به روش‌های معمول چیست؟", [
        boxes("sNew", ["وجه نوآورانه"], "نیازمند بررسی بیشتر"),
      ], { guide: "جدیدبودن فقط به معنای ساخت یک ابزار یا برنامهٔ کاربردی نیست. تفاوت می‌تواند در نقش مردم، شیوهٔ همکاری، گروه هدف، مدل دسترسی یا ترکیب تازهٔ ظرفیت‌های موجود باشد." }),
      questionPage("S07", "منطق اثرگذاری", "رابطه میان فعالیت‌های اصلی، خروجی‌های مستقیم، تغییرات رفتاری یا توانمندی و پیامد اجتماعی مورد انتظار چیست؟", [
        boxes("sLogic", ["فعالیت", "خروجی", "تغییر", "نتیجه"]),
      ], { guide: "رابطه میان اقدام‌ها، خروجی مستقیم آن‌ها و تغییری را که برای مردم ایجاد می‌شود، مرحله‌به‌مرحله توضیح دهید." }),
      questionPage("S08", "فرض‌ها و پیامدهای ناخواسته", "راهکار به چه فرضیات و شرایطی وابسته است و چه پیامدهای ناخواسته‌ای ممکن است ایجاد کند؟", [
        list("sAssume", "فرض", "افزودن فرض", { title: "فرضیات کلیدی" }),
        list("sSide", "پیامد ناخواسته", "افزودن پیامد", {
          title: "پیامدهای ناخواسته",
          noneOptions: ["موردی به ذهنم نمی‌رسد"],
        }),
      ]),
      endPage("S09", "جمع‌بندی کارویژهٔ سوم", "عالی! مدل راهکار آماده شد.",
        "خلاصهٔ هدف، سازوکار، نقش مردم، ذی‌نفعان، تفاوت و منطق اثرگذاری راهکار را مرور کنید.",
        "ثبت کارویژهٔ سوم و ادامه"),
    ],
  },
  E: {
    title: "فرم کارویژه چهارم: امکان‌سنجی و مدل اجرای اولیه",
    pages: [
      startPage("E01", "شروع کارویژهٔ چهارم", "بررسی کنیم این راهکار چگونه می‌تواند در عمل آزموده شود.",
        "قرار نیست از ابتدا همهٔ جزئیات قطعی باشند. می‌خواهیم مشخص شود برای یک شروع محدود به چه چیزهایی نیاز دارید و مهم‌ترین ریسک‌ها کدام‌اند."),
      questionPage("E02", "پذیرش اجتماعی", "جامعه هدف و مشارکت‌کنندگان چه انگیزه و ظرفیتی برای پذیرش راهکار دارند و موانع مشارکت آن‌ها چیست؟", [
        boxes("eAccept", ["انگیزه", "امکان مشارکت", "مانع"]),
      ]),
      questionPage("E03", "اقدامات و منابع", "برای آغاز اجرای محدود راهکار چه اقدامات و منابع انسانی، مالی و غیرمالی موردنیاز است؟", [
        list("eActs", "اقدام", "افزودن اقدام", {
          initial: 3,
          minimum: 3,
          choices: ["در دسترس است", "قابل‌دسترسی است", "هنوز مشخص نیست", "دسترسی به آن دشوار است"],
        }),
        list("eRes", "منبع", "افزودن منبع", {
          choices: ["در دسترس است", "قابل‌دسترسی است", "هنوز مشخص نیست", "دسترسی به آن دشوار است"],
        }),
      ], { guide: "نیروی انسانی، زمان، منابع مالی، فضا، تجهیزات، مهارت‌ها و ارتباطات لازم را در حد اطلاعات فعلی خود بنویسید." }),
      questionPage("E04", "همکاری‌ها و الزامات", "چه همکاری‌های نهادی، مجوزها یا الزامات حقوقی و سازمانی بر اجرای راهکار اثر می‌گذارند؟", [
        list("eCoop", "همکاری یا الزام", "افزودن مورد", {
          noneOptions: ["در شروع به مورد خاصی نیاز ندارد", "هنوز نمی‌دانم"],
        }),
      ], { guide: "اگر قانون، مجوز، دسترسی سازمانی یا تصمیم یک نهاد بر اجرا اثر می‌گذارد، آن را در این بخش توضیح دهید." }),
      questionPage("E05", "فناوری و زیرساخت", "چه ابزارها، فناوری‌ها یا زیرساخت‌هایی برای اجرای راهکار لازم است و دسترسی به آن‌ها چقدر امکان‌پذیر است؟", [{
        type: "single",
        key: "eTech",
        label: "فناوری و زیرساخت",
        required: true,
        options: [
          option("none", "به فناوری خاصی نیاز ندارد"),
          option("existing", "از ابزارهای موجود استفاده می‌کند"),
          option("new", "به توسعهٔ ابزار جدید نیاز دارد"),
          option("unknown", "هنوز مشخص نیست"),
        ],
        noteLabel: "توضیح",
      }], { guide: "اگر راهکار به فناوری خاصی وابسته نیست، همان را مشخص کنید. استفاده از پیام‌رسان یا وب‌سایت به‌تنهایی راهکار را فناوری‌محور نمی‌کند." }),
      questionPage("E06", "ریسک و ملاحظات اخلاقی", "راهکار چه ریسک‌های اجتماعی، اخلاقی یا اجرایی دارد و چگونه می‌توان آن‌ها را کاهش داد؟", [
        list("eRisk", "ریسک", "افزودن ریسک", {
          secondLabel: "اقدام کاهنده",
          noneOptions: ["ریسک مشخصی پیدا نکرده‌ام و نیاز به بررسی بیشتر دارم"],
        }),
      ], { guide: "به حریم خصوصی، کرامت افراد، تبعیض، دسترسی نابرابر، سوءاستفاده یا وابستگی ناخواسته توجه کنید." }),
      questionPage("E07", "پایداری منابع", "منابع لازم برای استمرار راهکار چگونه تأمین می‌شود و چه چیزی پایداری آن را تهدید می‌کند؟", [{
        type: "multiple",
        key: "eSustain",
        label: "منابع پایداری",
        required: true,
        minimum: 1,
        options: [
          option("income", "درآمد حاصل از خدمت یا محصول", { detailLabel: "توضیح" }),
          option("sponsor", "حمایت نهاد یا حامی مالی", { detailLabel: "توضیح" }),
          option("volunteer", "مشارکت داوطلبانه", { detailLabel: "توضیح" }),
          option("members", "حق عضویت یا مشارکت کاربران", { detailLabel: "توضیح" }),
          option("mix", "ترکیبی از منابع", { detailLabel: "توضیح" }),
          option("other", "منبع دیگری", { detailLabel: "توضیح" }),
          option("unknown", "هنوز مشخص نیست", { exclusive: true }),
        ],
      }], { guide: "لازم نیست راهکار سودآور باشد؛ اما باید روشن شود زمان، نیروی انسانی و هزینه‌های ادامهٔ فعالیت از چه منابعی تأمین می‌شود." }),
      questionPage("E08", "آزمون اولیه و سنجش موفقیت", "محدودهٔ اجرای آزمایشی، فرضیات قابل‌آزمون و شاخص‌های موفقیت اولیه را مشخص کنید.", [
        boxes("eTest", ["محل یا جامعهٔ آزمون", "مدت تقریبی", "اقدامات اصلی", "فرضیات"]),
        list("eKpi", "شاخص", "افزودن شاخص", { maximum: 5 }),
      ], {
        guide: "مشخص کنید آزمون در کجا، با چه افرادی، در چه مدت، با چه اقداماتی و بر اساس چه فرض‌ها و نشانه‌های موفقیت انجام می‌شود تا بتوان دربارهٔ ادامهٔ راهکار تصمیم گرفت. شاخص موفقیت باید روشن و قابل بررسی باشد و با تغییر مورد انتظار ارتباط داشته باشد.",
      }),
      endPage("E09", "جمع‌بندی نهایی", "ایدهٔ شما برای ارزیابی نهایی آماده شد.",
        "خلاصهٔ راهکار، منابع، همکاری‌ها، ریسک‌ها و برنامهٔ آزمون اولیه را مرور کنید.",
        "ثبت نهایی"),
    ],
  },
};

export const WORKBOOK_FLOW_ORDER: readonly WorkbookFlow[] = ["C", "P", "S", "E"];

export function getWorkbookPage(flow: WorkbookFlow, id: string): WorkbookPage {
  const definition = WORKBOOKS[flow];
  return definition.pages.find((page) => page.id === id) ?? definition.pages[0];
}

export function getWorkbookPageIndex(flow: WorkbookFlow, id: string): number {
  const index = WORKBOOKS[flow].pages.findIndex((page) => page.id === id);
  return index < 0 ? 0 : index;
}

export function validateWorkbookPage(
  page: WorkbookPage,
  answers: Record<string, unknown>,
): string {
  for (const field of page.fields ?? []) {
    if (field.type === "long") {
      if (field.required && !readText(answers[field.key]).trim()) return "این پاسخ را وارد کنید.";
      continue;
    }
    if (field.type === "single") {
      if (field.required && !field.options.some((item) => item.value === answers[field.key]))
        return "یک گزینه را انتخاب کنید.";
      continue;
    }
    if (field.type === "multiple") {
      const selected = readStringArray(answers[field.key]);
      if (field.required && selected.length < (field.minimum ?? 1))
        return "دست‌کم یک گزینه را انتخاب کنید.";
      if (selected.some((value) => !field.options.some((item) => item.value === value)))
        return "فقط گزینه‌های موجود را انتخاب کنید.";
      if (field.maximum && selected.length > field.maximum)
        return `حداکثر ${field.maximum} گزینه را انتخاب کنید.`;
      const exclusive = field.options.find((item) => item.exclusive);
      if (exclusive && selected.includes(exclusive.value) && selected.length > 1)
        return `گزینهٔ «${exclusive.label}» را به‌تنهایی انتخاب کنید.`;
      const details = readStringRecord(answers[`${field.key}Details`]);
      if (selected.some((value) => {
        const selectedOption = field.options.find((item) => item.value === value);
        return selectedOption?.detailLabel && !details[value]?.trim();
      })) return "توضیح گزینهٔ انتخاب‌شده را وارد کنید.";
      continue;
    }
    if (field.type === "boxes") {
      const unsure = Boolean(answers[`${field.key}Unsure`]);
      if (!unsure && field.required && field.labels.some((_, index) => !readText(answers[`${field.key}${index}`]).trim()))
        return "همهٔ کادرهای این بخش را تکمیل کنید یا گزینهٔ «هنوز نمی‌دانم» را انتخاب کنید.";
      continue;
    }
    const items = readListItems(answers[field.key]);
    const none = readStringArray(answers[`${field.key}None`]);
    if (!none.length && items.filter((item) => item.text.trim()).length < (field.minimum ?? 1))
      return "حداقل یک مورد را بنویسید یا گزینهٔ مربوط را انتخاب کنید.";
    if (field.maximum && items.filter((item) => item.text.trim()).length > field.maximum)
      return `حداکثر ${field.maximum} مورد وارد کنید.`;
  }
  return "";
}

export function readText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function readStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

export function readListItems(value: unknown): Array<{ text: string; detail: string; choice: string }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    return [{
      text: readText(row.text),
      detail: readText(row.detail),
      choice: readText(row.choice),
    }];
  });
}
