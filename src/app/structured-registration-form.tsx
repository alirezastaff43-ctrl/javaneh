"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Clock3, Eye, FileText } from "lucide-react";
import {
  AXES,
  AUDIENCES,
  BENEFICIARY_GROUPS,
  CITIES,
  EDUCATION_LEVELS,
  OUTCOMES,
  PLACES,
  PROVINCES,
  STEP_TITLES,
  countWords,
  validateRegistrationStep,
  visibleRegistrationSteps,
  type RegistrationStep,
  type StructuredRegistration,
  type StructuredRegistrationData,
} from "@/lib/structured-registration";

type Props = {
  registration: StructuredRegistration;
  storageError: string;
  onChange: (registration: StructuredRegistration) => void;
  onBack: () => void;
  onSubmit: (registration: StructuredRegistration) => void;
};

const otherOutcome = OUTCOMES[6];
const unsureOutcome = OUTCOMES[7];
const otherGroup = BENEFICIARY_GROUPS[7];
const unsureGroup = BENEFICIARY_GROUPS[8];

export default function StructuredRegistrationForm({
  registration,
  storageError,
  onChange,
  onBack,
  onSubmit,
}: Props) {
  const [error, setError] = useState("");
  const [showExample, setShowExample] = useState(false);
  const [acceptedLocalSave, setAcceptedLocalSave] = useState(false);
  const data = registration.data;
  const steps = visibleRegistrationSteps(data);
  const currentStep = steps.includes(registration.step) ? registration.step : "review";
  const stepIndex = steps.indexOf(currentStep);

  function updateData(patch: Partial<StructuredRegistrationData>) {
    setError("");
    onChange({
      ...registration,
      data: { ...data, ...patch },
      updatedAt: new Date().toISOString(),
    });
  }

  function goNext(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (currentStep !== "review") {
      const validation = validateRegistrationStep(currentStep, data);
      if (validation) {
        setError(validation);
        return;
      }
    } else if (!acceptedLocalSave) {
      setError("برای ثبت محلی، تأیید ذخیره‌شدن پاسخ‌ها در همین مرورگر را انتخاب کنید.");
      return;
    }

    setError("");
    if (currentStep === "review") {
      onSubmit({ ...registration, updatedAt: new Date().toISOString() });
      return;
    }
    const next = steps[stepIndex + 1];
    if (next) onChange({ ...registration, step: next, updatedAt: new Date().toISOString() });
  }

  function goBack() {
    setError("");
    if (stepIndex <= 0) {
      onBack();
      return;
    }
    onChange({
      ...registration,
      step: steps[stepIndex - 1],
      updatedAt: new Date().toISOString(),
    });
  }

  function skipStep() {
    const skippedData: Partial<StructuredRegistrationData> =
      currentStep === "title"
        ? { title: "", titleDeferred: true }
        : currentStep === "extra"
          ? { field: "", audience: "", audienceOther: "", news: false }
          : currentStep === "education"
            ? { education: "", educationOther: "" }
            : currentStep === "groups"
              ? { groups: [], groupOther: "" }
              : {};
    const next = steps[stepIndex + 1];
    setError("");
    onChange({
      ...registration,
      data: { ...data, ...skippedData },
      ...(next ? { step: next } : {}),
      updatedAt: new Date().toISOString(),
    });
  }

  function toggleList(
    key: "outcomes" | "groups" | "axisMulti",
    value: string,
    limit: number,
    exclusive?: string,
  ) {
    const current = data[key];
    if (current.includes(value)) {
      updateData({ [key]: current.filter((item) => item !== value) });
      return;
    }
    if (exclusive === value) {
      updateData({ [key]: [value] });
      return;
    }
    const next = current.filter((item) => item !== exclusive);
    if (next.length >= limit) {
      setError(`حداکثر ${limit} گزینه را انتخاب کنید.`);
      return;
    }
    updateData({ [key]: [...next, value] });
  }

  function radioOptions(
    name: string,
    options: readonly string[],
    value: string,
    onSelect: (option: string) => void,
  ) {
    return (
      <div className="structured-options" role="radiogroup" aria-label={name}>
        {options.map((option) => (
          <label className="structured-choice" key={option}>
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => onSelect(option)}
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
    );
  }

  function checkboxOptions(
    name: string,
    options: readonly string[],
    values: string[],
    onToggle: (option: string) => void,
  ) {
    return (
      <div className="structured-options" role="group" aria-label={name}>
        {options.map((option) => (
          <label className="structured-choice" key={option}>
            <input
              type="checkbox"
              checked={values.includes(option)}
              onChange={() => onToggle(option)}
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
    );
  }

  function textArea(
    id: string,
    label: string,
    value: string,
    onValue: (value: string) => void,
    rows = 5,
    describedBy?: string,
  ) {
    return (
      <label className="structured-field" htmlFor={id}>
        <span>{label}</span>
        <textarea
          id={id}
          value={value}
          onChange={(event) => onValue(event.target.value)}
          rows={rows}
          maxLength={4000}
          dir="auto"
          aria-describedby={describedBy}
        />
      </label>
    );
  }

  function fieldInput(
    id: string,
    label: string,
    value: string,
    onValue: (value: string) => void,
    options: { type?: string; maxLength?: number; optional?: boolean; autoComplete?: string } = {},
  ) {
    return (
      <label className="structured-field" htmlFor={id}>
        <span>
          {label}{options.optional && <small> (اختیاری)</small>}
        </span>
        <input
          id={id}
          type={options.type ?? "text"}
          value={value}
          onChange={(event) => onValue(event.target.value)}
          maxLength={options.maxLength ?? 300}
          autoComplete={options.autoComplete}
          dir={options.type === "email" ? "ltr" : "auto"}
        />
      </label>
    );
  }

  function reviewRows(): Array<[string, string]> {
    const city = data.city === "سایر" ? data.cityOther : data.city;
    const education = data.education === "مورد دیگر" ? data.educationOther : data.education;
    const outcomeValues = data.outcomes.map((item) => item === otherOutcome ? `${item}: ${data.outcomeOther}` : item);
    const groupValues = data.groups.map((item) => item === otherGroup ? `${item}: ${data.groupOther}` : item);
    const axisValue = data.axis === "چند محور" ? data.axisMulti.join("، ") : data.axis;
    return [
      ["مقطع تحصیلی", education || "پاسخ نداده‌ام"],
      ["نام و نام خانوادگی", data.fullName],
      ["ایمیل", data.email || "وارد نشده"],
      ["استان و شهر", [data.province, city].filter(Boolean).join("، ")],
      ["مسئله یا اتفاق", data.problem],
      ["محل مشاهده", data.place === "جای دیگری" ? `${data.place}: ${data.placeOther}` : data.place],
      ["تصویر وضعیت بهتر", data.better],
      ["اقدام پیشنهادی", data.action],
      ["پیامدها", outcomeValues.join("، ")],
      ...(data.groups.length ? [["گروه‌های بهره‌مند", groupValues.join("، ")] as [string, string]] : []),
      ["محور", axisValue],
      ["عنوان ایده", data.title.trim() || "بعداً مشخص می‌کنم"],
      ["زمینهٔ تحصیل یا فعالیت", data.field || "وارد نشده"],
      ["گروه مخاطب", data.audience === "مورد دیگر" ? data.audienceOther : data.audience || "وارد نشده"],
      ["خبرهای آینده", data.news ? "تمایل دارم" : "تمایلی اعلام نشده"],
    ];
  }

  function editStep(step: RegistrationStep) {
    const index = steps.indexOf(step);
    if (index >= 0) {
      setAcceptedLocalSave(false);
      setError("");
      onChange({ ...registration, step, updatedAt: new Date().toISOString() });
    }
  }

  const progress = Math.round(((stepIndex + 1) / steps.length) * 100);

  return (
    <section className="form-view structured-view" aria-labelledby="structured-title">
      <button className="back-link" type="button" onClick={goBack}>
        <ArrowLeft size={16} aria-hidden="true" />
        {currentStep === "intro" ? "بازگشت به صفحهٔ نخست" : "مرحلهٔ قبل"}
      </button>

      {registration.status === "submitted" ? (
        <div className="structured-success" role="status">
          <span className="step-icon"><Check size={25} aria-hidden="true" /></span>
          <div className="eyebrow"><span className="eyebrow-line" />ثبت محلی انجام شد</div>
          <h1 id="structured-title">پاسخ‌ها در این مرورگر ذخیره شدند</h1>
          <p className="form-intro">
            این ثبت فقط در فضای ذخیره‌سازی همین مرورگر قرار دارد و برای برگزارکننده ارسال یا با حسابی همگام نشده است.
          </p>
          <button className="primary-button" type="button" onClick={onBack}>بازگشت به صفحهٔ نخست</button>
        </div>
      ) : (
        <>
          <div className="eyebrow"><span className="eyebrow-line" />فرم اولیهٔ ثبت ایده</div>
          <div className="structured-heading-row">
            <div>
              <h1 id="structured-title">{STEP_TITLES[currentStep]}</h1>
              {currentStep === "intro" ? (
                <p className="form-intro">
                  با چند پاسخ کوتاه، ایده‌تان را ساختاریافته ثبت کنید. پاسخ‌ها پیش‌نویس می‌شوند و پیش از تأیید نهایی در همین مرورگر می‌مانند.
                </p>
              ) : (
                <p className="form-intro">پاسخ‌هایتان با رفت‌وبرگشت حفظ می‌شوند و می‌توانید در مرور نهایی آن‌ها را ویرایش کنید.</p>
              )}
            </div>
            <span className="step-count" aria-label={`مرحله ${stepIndex + 1} از ${steps.length}`}>
              {new Intl.NumberFormat("fa-IR").format(stepIndex + 1)} <span>از {new Intl.NumberFormat("fa-IR").format(steps.length)}</span>
            </span>
          </div>
          <div
            className="progress-track structured-progress"
            role="progressbar"
            aria-label="پیشرفت فرم"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          ><span style={{ width: `${progress}%` }} /></div>

          {currentStep === "intro" && (
            <div className="structured-step-content">
              <div className="structured-time"><Clock3 size={17} aria-hidden="true" /> زمان تقریبی: ۵ تا ۷ دقیقه</div>
              <p>در این فرم مسئله‌ای را که دیده‌اید، تغییر پیشنهادی و پیامدهای مورد انتظار را با واژه‌های خودتان می‌نویسید. هیچ محوری از پیش انتخاب نشده و عنوان را هم خودتان تعیین می‌کنید.</p>
              <p className="structured-muted">اطلاعات فرم در مرورگر شما ذخیره می‌شود؛ با پاک‌شدن داده‌های مرورگر ممکن است برای همیشه از دست برود.</p>
            </div>
          )}

          {currentStep === "education" && (
            <div className="structured-step-content">
              <p>آخرین مقطع تحصیلی یا مقطعی که اکنون در آن درس می‌خوانید چیست؟ این پاسخ اختیاری است.</p>
              {radioOptions("مقطع تحصیلی", EDUCATION_LEVELS, data.education, (education) => updateData({ education, educationOther: "" }))}
              {data.education === "مورد دیگر" && fieldInput("education-other", "مقطع تحصیلی دیگر", data.educationOther, (educationOther) => updateData({ educationOther }))}
            </div>
          )}

          {currentStep === "contact" && (
            <div className="structured-step-content">
              <p>نام و محل سکونت برای نگهداری این ثبت در همین مرورگر استفاده می‌شود. شمارهٔ تلفن یا کد ملی دریافت نمی‌کنیم.</p>
              <div className="structured-fields">
                {fieldInput("registration-name", "نام و نام خانوادگی", data.fullName, (fullName) => updateData({ fullName }), { maxLength: 80, autoComplete: "name" })}
                {fieldInput("registration-email", "نشانی ایمیل", data.email, (email) => updateData({ email }), { type: "email", maxLength: 120, optional: true, autoComplete: "email" })}
                <label className="structured-field" htmlFor="registration-province">
                  <span>استان محل سکونت</span>
                  <select id="registration-province" value={data.province} onChange={(event) => updateData({ province: event.target.value, city: "", cityOther: "" })}>
                    <option value="">انتخاب استان</option>
                    {PROVINCES.map((province) => <option key={province}>{province}</option>)}
                  </select>
                </label>
                <label className="structured-field" htmlFor="registration-city">
                  <span>شهر محل سکونت</span>
                  <select id="registration-city" value={data.city} disabled={!data.province} onChange={(event) => updateData({ city: event.target.value, cityOther: "" })}>
                    <option value="">{data.province ? "انتخاب شهر" : "ابتدا استان را انتخاب کنید"}</option>
                    {(CITIES[data.province] ?? []).map((city) => <option key={city}>{city}</option>)}
                    {data.province && <option>سایر</option>}
                  </select>
                </label>
                {data.city === "سایر" && fieldInput("registration-city-other", "نام شهر", data.cityOther, (cityOther) => updateData({ cityOther }))}
              </div>
            </div>
          )}

          {currentStep === "problem" && (
            <div className="structured-step-content">
              <p>یک نمونهٔ واقعی از چیزی که خودتان دیده‌اید یا تجربه کرده‌اید تعریف کنید. لازم نیست رسمی یا تخصصی بنویسید؛ همان‌طور بنویسید که برای دوستی تعریف می‌کنید.</p>
              {textArea("registration-problem", "چه مسئله‌ای را می‌توان بهتر کرد؟", data.problem, (problem) => updateData({ problem }), 7, "problem-guide problem-count")}
              <div className="structured-field-hint" id="problem-guide">برای نمونه: هر روز مقدار زیادی غذای سالم در محل کار دور ریخته می‌شود. یا بسیاری از سالمندان محله برای کارهای اینترنتی روزمره به کمک دسترسی ندارند.</div>
              <div className="structured-field-hint" id="problem-count" aria-live="polite">{new Intl.NumberFormat("fa-IR").format(countWords(data.problem))} واژه از ۲۰ واژهٔ لازم</div>
            </div>
          )}

          {currentStep === "place" && (
            <div className="structured-step-content">
              <p>این مسئله را بیشتر در چه محیطی مشاهده کرده‌اید؟</p>
              {radioOptions("محل مشاهدهٔ مسئله", PLACES, data.place, (place) => updateData({ place, placeOther: "" }))}
              {data.place === "جای دیگری" && fieldInput("registration-place-other", "کجا؟", data.placeOther, (placeOther) => updateData({ placeOther }))}
            </div>
          )}

          {currentStep === "better" && (
            <div className="structured-step-content">
              <p>فرض کنید این مسئله بهتر شده است. مهم‌ترین تغییری که مردم واقعاً متوجه آن می‌شوند چیست؟</p>
              {textArea("registration-better", "تصویر وضعیت بهتر", data.better, (better) => updateData({ better }), 5)}
              <button className="subtle-button structured-example-button" type="button" onClick={() => setShowExample(!showExample)} aria-expanded={showExample}>
                <Eye size={16} aria-hidden="true" /> {showExample ? "بستن مثال" : "مشاهدهٔ مثال"}
              </button>
              {showExample && <p className="structured-example">مثلاً دورریز غذا کاهش می‌یابد و غذای باقی‌مانده در زمان مناسب به افراد نیازمند می‌رسد.</p>}
            </div>
          )}

          {currentStep === "action" && (
            <div className="structured-step-content">
              <p>به‌نظر شما چه فرد، گروه یا مجموعه‌ای باید چه کاری را متفاوت انجام دهد تا این مسئله بهتر شود؟</p>
              {textArea("registration-action", "تغییر یا اقدام پیشنهادی", data.action, (action) => updateData({ action }), 5)}
              <button className="subtle-button structured-example-button" type="button" onClick={() => setShowExample(!showExample)} aria-expanded={showExample}>
                <Eye size={16} aria-hidden="true" /> {showExample ? "بستن مثال" : "مشاهدهٔ مثال"}
              </button>
              {showExample && <p className="structured-example">مثلاً فروشگاه‌ها مواد غذایی نزدیک به تاریخ انقضا را در بخش مشخصی با تخفیف عرضه کنند تا پیش از خراب‌شدن مصرف شوند.</p>}
            </div>
          )}

          {currentStep === "refine" && (
            <div className="structured-step-content">
              <p>از توضیحتان مشخص است چه کسی باید چه کاری را نسبت به امروز متفاوت انجام دهد؟ پاسخ فعلی بدون تغییر باقی می‌ماند، مگر اینکه خودتان ویرایشش کنید.</p>
              {radioOptions("مرور پاسخ پیشنهادی", ["کمی دقیق‌ترش می‌کنم", "با همین پاسخ ادامه می‌دهم"], data.refine === "more" ? "کمی دقیق‌ترش می‌کنم" : data.refine === "keep" ? "با همین پاسخ ادامه می‌دهم" : "", (value) => updateData({ refine: value === "کمی دقیق‌ترش می‌کنم" ? "more" : "keep" }))}
              {data.refine === "more" && textArea("registration-action-refine", "پاسخ پیشنهادی؛ در صورت تمایل ویرایش کنید", data.action, (action) => updateData({ action }), 5)}
            </div>
          )}

          {currentStep === "outcomes" && (
            <div className="structured-step-content">
              <p>در صورت اجرای پیشنهاد، چه نتایجی انتظار می‌رود؟ یک تا سه گزینه انتخاب کنید.</p>
              {checkboxOptions("پیامدهای پیشنهاد", OUTCOMES, data.outcomes, (outcome) => toggleList("outcomes", outcome, 3, unsureOutcome))}
              {data.outcomes.includes(otherOutcome) && fieldInput("registration-outcome-other", "چه نتیجهٔ دیگری؟", data.outcomeOther, (outcomeOther) => updateData({ outcomeOther }))}
            </div>
          )}

          {currentStep === "groups" && (
            <div className="structured-step-content">
              <p>این پیشنهاد بیشتر به چه کسانی کمک می‌کند؟ حداکثر سه گزینه؛ پاسخ‌دادن اختیاری است.</p>
              {checkboxOptions("گروه‌های بهره‌مند", BENEFICIARY_GROUPS, data.groups, (group) => toggleList("groups", group, 3, unsureGroup))}
              {data.groups.includes(otherGroup) && fieldInput("registration-group-other", "کدام گروه؟", data.groupOther, (groupOther) => updateData({ groupOther }))}
            </div>
          )}

          {currentStep === "axis" && (
            <div className="structured-step-content">
              <p>به‌نظر شما پیشنهادتان بیشتر با کدام محور رویداد ارتباط دارد؟ هیچ محوری از پیش انتخاب نشده است.</p>
              {radioOptions("محور ایده", [...AXES, "به چند محور مربوط است", "مطمئن نیستم"], data.axis === "چند محور" ? "به چند محور مربوط است" : data.axis === "مطمئن نیستم" ? data.axis : data.axis, (axis) => updateData({ axis: axis === "به چند محور مربوط است" ? "چند محور" : axis }))}
              {data.axis === "چند محور" && (
                <fieldset className="structured-axis-multi">
                  <legend>محورهای مرتبط را انتخاب کنید</legend>
                  {checkboxOptions("محورهای مرتبط", AXES, data.axisMulti, (axis) => toggleList("axisMulti", axis, AXES.length))}
                </fieldset>
              )}
            </div>
          )}

          {currentStep === "title" && (
            <div className="structured-step-content">
              <p>چه عنوانی برای ایدهٔ خود انتخاب می‌کنید؟ عنوان را خودتان می‌نویسید و می‌توانید تعیین آن را به بعد موکول کنید.</p>
              {fieldInput("registration-title", "عنوان ایده", data.title, (title) => updateData({ title, titleDeferred: false }), { maxLength: 120, optional: true })}
            </div>
          )}

          {currentStep === "extra" && (
            <div className="structured-step-content">
              <p>این اطلاعات اختیاری است و روی پاسخ‌های ایده اثری ندارد.</p>
              <div className="structured-fields">
                {fieldInput("registration-field", "زمینهٔ تحصیل یا فعالیت", data.field, (field) => updateData({ field }), { maxLength: 120, optional: true })}
                <fieldset className="structured-fieldset">
                  <legend>گروه مخاطب <small>(اختیاری)</small></legend>
                  {radioOptions("گروه مخاطب", AUDIENCES, data.audience, (audience) => updateData({ audience, audienceOther: "" }))}
                  {data.audience === "مورد دیگر" && fieldInput("registration-audience-other", "کدام؟", data.audienceOther, (audienceOther) => updateData({ audienceOther }))}
                </fieldset>
                <label className="structured-choice structured-news">
                  <input type="checkbox" checked={data.news} onChange={(event) => updateData({ news: event.target.checked })} />
                  <span>تمایل دارم خبر برنامه‌های آینده را دریافت کنم</span>
                </label>
              </div>
            </div>
          )}

          {currentStep === "review" && (
            <div className="structured-step-content">
              <p>پاسخ‌ها را مرور کنید. با انتخاب «ویرایش» به همان مرحله برمی‌گردید.</p>
              <dl className="structured-review-list">
                {reviewRows().map(([label, value]) => {
                  const stepForLabel: Partial<Record<string, RegistrationStep>> = {
                    "مقطع تحصیلی": "education", "نام و نام خانوادگی": "contact", "ایمیل": "contact", "استان و شهر": "contact",
                    "مسئله یا اتفاق": "problem", "محل مشاهده": "place", "تصویر وضعیت بهتر": "better", "اقدام پیشنهادی": "action",
                    "پیامدها": "outcomes", "گروه‌های بهره‌مند": "groups", "محور": "axis", "عنوان ایده": "title",
                    "زمینهٔ تحصیل یا فعالیت": "extra", "گروه مخاطب": "extra", "خبرهای آینده": "extra",
                  };
                  const editTarget = stepForLabel[label];
                  return (
                    <div className="structured-review-row" key={label}>
                      <dt>{label}</dt>
                      <dd dir="auto">{value || "—"}</dd>
                      {editTarget && steps.includes(editTarget) && (
                        <button className="text-button" type="button" onClick={() => editStep(editTarget)}>ویرایش</button>
                      )}
                    </div>
                  );
                })}
              </dl>
              <p className="structured-terms-note">متن شرایط رویداد در این نسخه مقصد واقعی ندارد؛ پیوند ساختگی نمایش داده نمی‌شود.</p>
              <label className="structured-choice structured-consent">
                <input type="checkbox" checked={acceptedLocalSave} onChange={(event) => { setAcceptedLocalSave(event.target.checked); setError(""); }} />
                <span>پاسخ‌ها را مرور کرده‌ام و با ذخیرهٔ آن‌ها در همین مرورگر موافقم.</span>
              </label>
            </div>
          )}

          {storageError && <p className="inline-error" role="alert">{storageError}</p>}
          {error && <p className="inline-error" id="structured-error" role="alert">{error}</p>}
          <form className="structured-actions" onSubmit={goNext} noValidate>
            {(["education", "groups", "title", "extra"] as RegistrationStep[]).includes(currentStep) && (
              <button className="subtle-button" type="button" onClick={skipStep}>ردکردن این مرحله</button>
            )}
            <button className="primary-button" type="submit">
              {currentStep === "review" ? <><Check size={17} aria-hidden="true" /> ثبت در همین مرورگر</> : <>ادامه <ArrowRight size={17} aria-hidden="true" /></>}
            </button>
          </form>
          {currentStep === "intro" && <p className="structured-draft-note"><FileText size={15} aria-hidden="true" /> پیش‌نویس به‌صورت خودکار و محلی ذخیره می‌شود.</p>}
        </>
      )}
    </section>
  );
}