"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CircleHelp, Clock3, LoaderCircle } from "lucide-react";
import MentorGuidedTextarea, { type MentorGuidedTextareaHandle } from "./mentor-guided-textarea";
import { SpeechEnabledTextarea } from "./speech-input-control";
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
  awardStructuredPoints,
  countWords,
  structuredScore,
  validateRegistrationStep,
  visibleRegistrationSteps,
  type RegistrationStep,
  type StructuredRegistration,
  type StructuredRegistrationData,
  type WorkbookAnswerValue,
  type WorkbookAnswers,
  type WorkbookFollowup,
  type WorkbookFlow,
  type WorkbookListItem,
} from "@/lib/structured-registration";
import { formatNumber, isPersianText, toPersianDigits } from "@/lib/locale";
import {
  getFormLockState,
  validateAnswerRelevance,
} from "@/lib/form-answer-validation";
import {
  isMentorApiDisabled,
  resetMentorApiConnection,
  requestMentorApi,
  useMentorApiDisabled,
} from "@/lib/mentor-api";
import {
  WORKBOOKS,
  WORKBOOK_FLOW_ORDER,
  getWorkbookPage,
  getWorkbookPageIndex,
  readListItems,
  readStringArray,
  readStringRecord,
  readText,
  validateWorkbookPage,
  type WorkbookField,
  type WorkbookOption,
  type WorkbookPage,
} from "@/lib/workbook-forms";

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
const SCOREABLE_INITIAL_STEPS: RegistrationStep[] = [
  "problem", "place", "better", "action", "refine", "outcomes", "groups", "axis", "title",
];

function lockWorkbooks(
  workbooks: StructuredRegistration["workbooks"],
): StructuredRegistration["workbooks"] {
  return {
    C: { ...workbooks.C, status: "locked", step: "C01" },
    P: { ...workbooks.P, status: "locked", step: "P01" },
    S: { ...workbooks.S, status: "locked", step: "S01" },
    E: { ...workbooks.E, status: "locked", step: "E01" },
  };
}

function registrationMentorContext(
  registration: StructuredRegistration,
  currentStep?: RegistrationStep,
) {
  const { problem, place, placeOther, better, action, outcomes, groups, title } = registration.data;
  const entries = [
    ["مسئله", problem],
    ["محل", place === "جای دیگری" ? placeOther : place],
    ["وضعیت بهتر", better],
    ["اقدام", action],
    ["پیامدها", outcomes.join("، ")],
    ["گروه‌های بهره‌مند", groups.join("، ")],
    ["عنوان", title],
  ] as const;
  const contextOrder = ["problem", "place", "better", "action", "outcomes", "groups", "title"];
  const currentIndex = currentStep === "refine"
    ? contextOrder.indexOf("action") + 1
    : currentStep
      ? contextOrder.indexOf(currentStep)
      : entries.length;
  return JSON.stringify(entries
    .slice(0, currentIndex < 0 ? entries.length : currentIndex)
    .filter(([, answer]) => answer.trim())
    .map(([question, answer]) => ({ question, answer })));
}

export default function StructuredRegistrationForm({
  registration,
  storageError,
  onChange,
  onBack,
  onSubmit,
}: Props) {
  const [error, setError] = useState("");
  const [acceptedReview, setAcceptedReview] = useState(false);
  const mentorDisabled = useMentorApiDisabled();
  const answerValidationBusy = useRef(false);
  const guidedAnswerRef = useRef<MentorGuidedTextareaHandle>(null);
  const data = registration.data;
  const steps = visibleRegistrationSteps(data);
  const currentStep = steps.includes(registration.step) ? registration.step : "review";
  const stepIndex = steps.indexOf(currentStep);
  const [WorkbookJourneyComponent] = useState(() => WorkbookJourney);

  if (registration.status === "submitted" && registration.activeFlow !== "F") {
    return (
      <WorkbookJourneyComponent
        registration={registration}
        storageError={storageError}
        onChange={onChange}
        onBack={onBack}
      />
    );
  }

  type WorkbookJourneyProps = Pick<Props, "registration" | "storageError" | "onChange" | "onBack">;

  function WorkbookJourney({
    registration,
    storageError,
    onChange,
    onBack,
  }: WorkbookJourneyProps) {
    const [error, setError] = useState("");
    const [followupBusy, setFollowupBusy] = useState(false);
    const [followupSpeechBusy, setFollowupSpeechBusy] = useState(false);
    const [followupRetry, setFollowupRetry] = useState(false);
    const mentorDisabled = useMentorApiDisabled();
    const answerValidationBusy = useRef(false);
    const currentRegistration = useRef(registration);
    currentRegistration.current = registration;
    const guidedAnswerRef = useRef<MentorGuidedTextareaHandle>(null);

    function update(patch: Partial<StructuredRegistration>) {
      const updated = {
        ...currentRegistration.current,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      currentRegistration.current = updated;
      onChange(updated);
      setError("");
      setFollowupRetry(false);
    }

    function startFlow(flow: WorkbookFlow) {
      const progress = registration.workbooks[flow];
      if (progress.status === "locked") return;
      const pages = WORKBOOKS[flow].pages;
      const startPage = progress.status === "submitted"
        ? pages[1]?.id ?? pages[0].id
        : progress.step;
      update({
        activeFlow: flow,
        workbooks: {
          ...registration.workbooks,
          [flow]: {
            ...progress,
            status: progress.status === "available" ? "draft" : progress.status,
            step: startPage,
          },
        },
      });
    }

    function editInitialForm() {
      update({ activeFlow: "F", step: "review" });
    }

    const activeFlow = registration.activeFlow;

    if (activeFlow !== "C" && activeFlow !== "P" && activeFlow !== "S" && activeFlow !== "E") {
      return (
        <section className="form-view structured-view" aria-labelledby="structured-title">
          <button className="back-link" type="button" onClick={onBack}>
            <ArrowLeft size={16} aria-hidden="true" /> بازگشت به صفحهٔ نخست
          </button>
          <div className="eyebrow"><span className="eyebrow-line" />ادامهٔ ثبت ایده</div>
          <h1 id="structured-title">{registration.data.title.trim() || "مسیر تکمیل ایده"}</h1>
          <p className="form-intro">
            ثبت اولیهٔ ایده تکمیل شده است. کارویژه‌ها را به‌ترتیب تکمیل کنید؛ پاسخ‌ها برای برگزارکننده ارسال نمی‌شوند. امتیاز فعلی: {formatNumber(structuredScore(registration))}
          </p>
          {mentorDisabled && (
            <div className="mentor-checking" role="status">
              پرسش‌های تکمیلی منتور غیرفعال‌اند؛ می‌توانید کارویژه‌ها را با فرم ثابت ادامه دهید.
              <button type="button" className="text-button" onClick={resetMentorApiConnection}>
                تلاش دوباره برای اتصال
              </button>
            </div>
          )}
          <div className="workbook-list">
            <article className="workbook-card">
              <div>
                <span className="workbook-state">تکمیل‌شده</span>
                <h2>فرم اولیهٔ ثبت ایده</h2>
              </div>
              <button type="button" className="subtle-button" onClick={editInitialForm}>ویرایش پاسخ‌ها</button>
            </article>
            {WORKBOOK_FLOW_ORDER.map((workbookFlow, index) => {
              const progress = registration.workbooks[workbookFlow];
              const locked = progress.status === "locked";
              const label = progress.status === "submitted"
                ? "تکمیل‌شده"
                : progress.status === "draft"
                  ? "در حال تکمیل"
                  : locked
                    ? `پس از ${index === 0 ? "ثبت اولیه" : WORKBOOKS[WORKBOOK_FLOW_ORDER[index - 1]].title}`
                    : "آمادهٔ شروع";
              const buttonLabel = progress.status === "submitted"
                ? "مرور و ویرایش"
                : progress.status === "draft"
                  ? "ادامهٔ کارویژه"
                  : "شروع کارویژه";
              return (
                <article className={`workbook-card${locked ? " is-locked" : ""}`} key={workbookFlow}>
                  <div>
                    <span className="workbook-state">{label}</span>
                    <h2>{WORKBOOKS[workbookFlow].title}</h2>
                    <p>{WORKBOOKS[workbookFlow].pages.length} گام</p>
                  </div>
                  <button
                    type="button"
                    className={locked ? "subtle-button" : "primary-button"}
                    onClick={() => startFlow(workbookFlow)}
                    disabled={locked}
                  >
                    {buttonLabel}
                  </button>
                </article>
              );
            })}
          </div>
          {storageError && <p className="inline-error" role="alert">{storageError}</p>}
        </section>
      );
    }

    const flow: WorkbookFlow = activeFlow;
    const progress = registration.workbooks[flow];
    const page = getWorkbookPage(flow, progress.step);
    const pageIndex = getWorkbookPageIndex(flow, page.id);
    const pages = WORKBOOKS[flow].pages;
    const progressPercent = Math.round(((pageIndex + 1) / pages.length) * 100);

    function recordPageScore(sufficient: boolean) {
      const current = currentRegistration.current;
      let scored = awardStructuredPoints(current, `workbook:${flow}:${page.id}:base`, 2);
      if (sufficient)
        scored = awardStructuredPoints(scored, `workbook:${flow}:${page.id}:bonus`, 1);
      if (scored !== current) update({ scoreAwards: scored.scoreAwards });
    }

    async function mentorApprovesFollowup(followup: WorkbookFollowup): Promise<boolean | null> {
      const answer = [
        `پاسخ اصلی: ${followup.sourceAnswer}`,
        ...followup.questions.map((question, index) =>
          `${question}\n${followup.answers[index] ?? ""}`,
        ),
      ].join("\n\n");
      const result = await requestMentorApi(
        {
            purpose: "workbook-followup",
            messages: [{
              role: "user",
              content: JSON.stringify({
                ideaContext: registrationMentorContext(currentRegistration.current).slice(0, 800),
                workbook: WORKBOOKS[flow].title,
                page: page.title,
                guide: page.guide,
                question: page.question,
                answer: answer.slice(0, 3000),
              }),
            }],
            ideas: [],
        },
        (payload): boolean | null => {
          if (
            !payload || typeof payload !== "object" ||
            !("status" in payload) ||
            (payload.status !== "needs-more" && payload.status !== "sufficient") ||
            !("questions" in payload) || !Array.isArray(payload.questions)
          )
            return null;
          return payload.status === "sufficient" && payload.questions.length === 0;
        },
      );
      if (result.status === "success") return result.data;
      if (result.status === "retry") {
        setFollowupRetry(true);
        setError(result.message);
      }
      return null;
    }

    function updateAnswers(key: string, value: WorkbookAnswerValue) {
      const latest = currentRegistration.current;
      const current = latest.workbooks[flow];
      const changed = JSON.stringify(current.answers[key]) !== JSON.stringify(value);
      const nextWorkbooks = { ...latest.workbooks };
      const followups = { ...current.followups };
      if (changed) delete followups[page.id];
      nextWorkbooks[flow] = {
        ...current,
        status: changed ? "draft" : current.status,
        answers: { ...current.answers, [key]: value },
        followups,
      };
      if (changed && current.status === "submitted") {
        const currentIndex = WORKBOOK_FLOW_ORDER.indexOf(flow);
        for (const laterFlow of WORKBOOK_FLOW_ORDER.slice(currentIndex + 1)) {
          nextWorkbooks[laterFlow] = {
            ...nextWorkbooks[laterFlow],
            status: "locked",
            step: WORKBOOKS[laterFlow].pages[0].id,
          };
        }
      }
      update({ workbooks: nextWorkbooks });
    }

    function updateFollowup(pageId: string, followup?: WorkbookFollowup): WorkbookProgress {
      const latest = currentRegistration.current;
      const current = latest.workbooks[flow];
      const nextFollowups = { ...current.followups };
      if (followup) nextFollowups[pageId] = followup;
      else delete nextFollowups[pageId];
      if (JSON.stringify(current.followups) === JSON.stringify(nextFollowups)) return current;

      const updatedProgress = {
        ...current,
        status: current.status === "submitted" || current.status === "available" ? "draft" : current.status,
        followups: nextFollowups,
      };
      const nextWorkbooks = { ...latest.workbooks, [flow]: updatedProgress };
      if (current.status === "submitted") {
        const currentIndex = WORKBOOK_FLOW_ORDER.indexOf(flow);
        for (const laterFlow of WORKBOOK_FLOW_ORDER.slice(currentIndex + 1)) {
          nextWorkbooks[laterFlow] = {
            ...nextWorkbooks[laterFlow],
            status: "locked",
            step: WORKBOOKS[laterFlow].pages[0].id,
          };
        }
      }
      update({ workbooks: nextWorkbooks });
      return updatedProgress;
    }

    function setStep(step: string) {
      update({
        workbooks: {
          ...registration.workbooks,
          [flow]: { ...progress, step },
        },
      });
    }

    function saveAndReturn() {
      if (followupSpeechBusy) return;
      update({
        activeFlow: "dashboard",
        workbooks: {
          ...registration.workbooks,
          [flow]: { ...progress, status: progress.status === "available" ? "draft" : progress.status },
        },
      });
    }

    function finishFlow(currentProgress = progress) {
      const nextWorkbooks = {
        ...currentRegistration.current.workbooks,
        [flow]: { ...currentProgress, status: "submitted" as const, step: page.id },
      };
      const currentIndex = WORKBOOK_FLOW_ORDER.indexOf(flow);
      const nextFlow = WORKBOOK_FLOW_ORDER[currentIndex + 1];
      if (nextFlow && nextWorkbooks[nextFlow].status === "locked") {
        nextWorkbooks[nextFlow] = { ...nextWorkbooks[nextFlow], status: "available" };
      }
      update({ activeFlow: "dashboard", workbooks: nextWorkbooks });
    }

    function advancePage(currentProgress = progress) {
      if (pageIndex === pages.length - 1) {
        finishFlow(currentProgress);
        return;
      }
      update({
        workbooks: {
          ...currentRegistration.current.workbooks,
          [flow]: { ...currentProgress, step: pages[pageIndex + 1].id },
        },
      });
    }

    async function goNext(event: React.FormEvent<HTMLFormElement>) {
      event.preventDefault();
      if (getFormLockState().locked) return;
      if (followupBusy || followupSpeechBusy || answerValidationBusy.current) return;
      if (page.kind === "questions") {
        const validation = validateWorkbookPage(page, progress.answers);
        if (validation) {
          setError(validation);
          return;
        }
        const answerText = workbookPageFreeText(page, progress.answers);
        if (answerText) {
          answerValidationBusy.current = true;
          const result = await validateAnswerRelevance({
            kind: "answer",
            seed: registration.data.problem.slice(0, 1200) || registration.data.title.slice(0, 1200),
            question: page.question.slice(0, 600),
            text: answerText,
          });
          answerValidationBusy.current = false;
          if (!result.valid) {
            setError(result.message);
            return;
          }
        }
        if (getFormLockState().locked) return;
        const guidedReady = await guidedAnswerRef.current?.review();
        if (guidedReady === false) return;
      }
      if (page.kind === "summary") {
        finishFlow();
        return;
      }
      if (page.kind !== "questions") {
        advancePage();
        return;
      }

      const sourceAnswer = workbookPageAnswer(page, progress.answers);
      if (isMentorApiDisabled()) {
        recordPageScore(false);
        advancePage();
        return;
      }
      const savedFollowup = progress.followups[page.id];
      if (savedFollowup?.sourceAnswer === sourceAnswer) {
        if (savedFollowup.status === "sufficient") {
          recordPageScore(true);
          advancePage();
          return;
        }
        if (savedFollowup.index === savedFollowup.questions.length) {
          setFollowupBusy(true);
          const sufficient = await mentorApprovesFollowup(savedFollowup);
          setFollowupBusy(false);
          if (sufficient === null && !isMentorApiDisabled()) return;
          recordPageScore(sufficient === true);
          advancePage();
          return;
        }
        const answer = savedFollowup.draft.trim();
        if (!answer) {
          setError("پاسخی بنویسید یا گزینهٔ «هنوز مطمئن نیستم» را انتخاب کنید.");
          return;
        }
        answerValidationBusy.current = true;
        const answerValidation = await validateAnswerRelevance({
          kind: "answer",
          seed: registration.data.problem.slice(0, 1200) || registration.data.title.slice(0, 1200),
          question: savedFollowup.questions[savedFollowup.index].slice(0, 600),
          text: answer.slice(0, 1500),
        });
        answerValidationBusy.current = false;
        if (!answerValidation.valid) {
          setError(answerValidation.message);
          return;
        }
        if (getFormLockState().locked) return;
        const completedFollowup = {
          ...savedFollowup,
          answers: [...savedFollowup.answers, answer],
          index: savedFollowup.index + 1,
          draft: "",
        };
        const updatedProgress = {
          ...progress,
          followups: { ...progress.followups, [page.id]: completedFollowup },
        };
        if (completedFollowup.index === completedFollowup.questions.length) {
          setFollowupBusy(true);
          const sufficient = await mentorApprovesFollowup(completedFollowup);
          setFollowupBusy(false);
          if (sufficient === null && !isMentorApiDisabled()) return;
          recordPageScore(sufficient === true);
          advancePage(updatedProgress);
        } else {
          update({ workbooks: { ...currentRegistration.current.workbooks, [flow]: updatedProgress } });
        }
        return;
      }

      setFollowupBusy(true);
      setFollowupRetry(false);
      setError("");
      const previousAnswers = pages
        .slice(Math.max(1, pageIndex - 3), pageIndex)
        .map((previousPage) => {
          const answers: Array<[string, string]> = (previousPage.fields ?? [])
            .flatMap((field) => formatFieldAnswers(field, progress.answers, false))
            .filter(([, answer]) => answer.trim())
            .map(([label, answer]) => [label, answer.slice(0, 250)]);
          const previousFollowup = progress.followups[previousPage.id];
          if (previousFollowup) {
            previousFollowup.questions.slice(0, previousFollowup.index).forEach((question, index) => {
              const answer = previousFollowup.answers[index];
              if (answer) answers.push([`پرسش تکمیلی: ${question}`, answer.slice(0, 250)]);
            });
          }
          return {
            title: previousPage.title,
            answers: answers.slice(-2),
          };
        })
        .filter(({ answers }) => answers.length > 0);
      const result = await requestMentorApi(
        {
            purpose: "workbook-followup",
            messages: [{
              role: "user",
              content: JSON.stringify({
                ideaContext: registrationMentorContext(registration).slice(0, 800),
                workbook: WORKBOOKS[flow].title,
                page: page.title,
                guide: page.guide,
                question: page.question,
                answer: sourceAnswer.slice(0, 1500),
                previousAnswers,
              }),
            }],
            ideas: [],
        },
        (payload): {
          status: "needs-more" | "sufficient";
          reply: string;
          questions: string[];
        } | null => {
          if (
            !payload || typeof payload !== "object" ||
            !("status" in payload) ||
            (payload.status !== "needs-more" && payload.status !== "sufficient") ||
            !("reply" in payload) || typeof payload.reply !== "string" ||
            !("questions" in payload) || !Array.isArray(payload.questions) ||
            (payload.status === "needs-more" && (payload.questions.length < 1 || payload.questions.length > 3)) ||
            (payload.status === "sufficient" && payload.questions.length !== 0) ||
            !isPersianText(payload.reply) || /[؟?]/u.test(payload.reply) ||
            payload.questions.some((question) =>
              typeof question !== "string" || question.length > 600 ||
              !isPersianText(question) || (question.match(/[؟?]/gu) ?? []).length !== 1 ||
              !/[؟?]$/u.test(question),
            ) ||
            new Set(payload.questions.map((question) =>
              (question as string).toLocaleLowerCase("fa").replace(/[\s؟?.,؛;:!]+/gu, ""),
            )).size !== payload.questions.length
          )
            return null;
          return {
            status: payload.status,
            reply: payload.reply,
            questions: payload.questions as string[],
          };
        },
      );

      if (result.status === "success") {
        const payload = result.data;
        const latest = currentRegistration.current;
        const latestProgress = latest.workbooks[flow];
        if (latest.activeFlow !== flow || workbookPageAnswer(page, latestProgress.answers) !== sourceAnswer) return;
        const updatedProgress = updateFollowup(page.id, {
          status: payload.status,
          sourceAnswer,
          reply: payload.reply,
          questions: payload.questions as string[],
          answers: [],
          index: 0,
          draft: "",
        });
        recordPageScore(payload.status === "sufficient");
        if (payload.status === "sufficient") advancePage(updatedProgress);
      } else if (result.status === "retry") {
        setFollowupRetry(true);
        setError(`پرسش‌های فرعی آماده نشدند. پاسخ اصلی ذخیره شده است؛ ${result.message}`);
      } else if (result.status === "disabled") {
        recordPageScore(false);
        advancePage();
      }
      setFollowupBusy(false);
    }

    function goPrevious() {
      if (followupBusy || followupSpeechBusy) return;
      setError("");
      if (pageIndex === 0) {
        update({ activeFlow: "dashboard" });
        return;
      }
      setStep(pages[pageIndex - 1].id);
    }

    function renderField(field: WorkbookField) {
      const value = progress.answers[field.key];
      if (field.type === "long") {
        return (
          <MentorGuidedTextarea
            key={field.key}
            ref={guidedAnswerRef}
            id={`workbook-${field.key}`}
            label={field.label}
            question={page.question}
            guide={page.guide ?? field.label}
            context={`${registrationMentorContext(registration)}\nپاسخ‌های قبلی این کارویژه: ${JSON.stringify(pages.slice(1, pageIndex).map((previousPage) => ({
              question: previousPage.question,
              answers: (previousPage.fields ?? []).flatMap((previousField) => formatFieldAnswers(previousField, progress.answers))
                .filter(([, answer]) => answer.trim()),
            })).filter(({ answers }) => answers.length > 0)).slice(0, 3000)}`}
            value={readText(value)}
            onChange={(answer) => updateAnswers(field.key, answer)}
            rows={5}
            maxLength={4000}
          />
        );
      }

      if (field.type === "single" || field.type === "multiple") {
        const selected = field.type === "single" ? readText(value) : readStringArray(value);
        const detailsKey = `${field.key}Details`;
        const details = readStringRecord(progress.answers[detailsKey]);
        const noteKey = `${field.key}Note`;
        const noteValue = readText(progress.answers[noteKey]);
        const toggleOption = (option: WorkbookOption) => {
          if (field.type === "single") {
            updateAnswers(field.key, selected === option.value ? "" : option.value);
            return;
          }
          const current = selected as string[];
          const next = current.includes(option.value)
            ? current.filter((item) => item !== option.value)
            : option.exclusive
              ? [option.value]
              : [...current.filter((item) => !field.options.find((itemOption) => itemOption.value === item)?.exclusive), option.value];
          if (field.maximum && next.length > field.maximum) {
            setError(`حداکثر ${formatNumber(field.maximum)} گزینه را انتخاب کنید.`);
            return;
          }
          updateAnswers(field.key, next);
        };
        return (
          <fieldset className="structured-fieldset workbook-choice-set" key={field.key}>
            <legend>{field.label}</legend>
            <div className="structured-options" role={field.type === "single" ? "radiogroup" : "group"} aria-label={field.label}>
              {field.options.map((option) => {
                const checked = field.type === "single"
                  ? selected === option.value
                  : (selected as string[]).includes(option.value);
                const inputId = `workbook-${field.key}-${option.value}`;
                return (
                  <div className="workbook-option" key={option.value}>
                    <label className="structured-choice" htmlFor={inputId}>
                      <input
                        id={inputId}
                        type={field.type === "single" ? "radio" : "checkbox"}
                        name={`workbook-${field.key}`}
                        checked={checked}
                        onChange={() => toggleOption(option)}
                      />
                      <span>{option.label}</span>
                    </label>
                    {checked && option.detailLabel && (
                      <label className="structured-field workbook-option-detail" htmlFor={`${inputId}-detail`}>
                        <span>{option.detailLabel}</span>
                        <input
                          id={`${inputId}-detail`}
                          value={details[option.value] ?? ""}
                          onChange={(event) => updateAnswers(detailsKey, {
                            ...details,
                            [option.value]: event.target.value,
                          })}
                          maxLength={500}
                          dir="auto"
                        />
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
            {field.noteLabel && (
              <SpeechEnabledTextarea
                id={`workbook-${noteKey}`}
                label={`${field.noteLabel} (اختیاری)`}
                value={noteValue}
                onChange={(answer) => updateAnswers(noteKey, answer)}
                rows={3}
                maxLength={2000}
              />
            )}
          </fieldset>
        );
      }

      if (field.type === "boxes") {
        const unsureKey = `${field.key}Unsure`;
        const unsure = Boolean(progress.answers[unsureKey]);
        return (
          <div className="workbook-boxes" key={field.key}>
            {field.labels.map((label, index) => {
              const key = `${field.key}${index}`;
              return (
                <SpeechEnabledTextarea
                  key={key}
                  id={`workbook-${key}`}
                  label={label}
                  value={readText(progress.answers[key])}
                  onChange={(answer) => updateAnswers(key, answer)}
                  rows={3}
                  maxLength={2000}
                />
              );
            })}
            {field.unsureLabel && (
              <label className="structured-choice">
                <input
                  type="checkbox"
                  checked={unsure}
                  onChange={(event) => updateAnswers(unsureKey, event.target.checked)}
                />
                <span>{field.unsureLabel}</span>
              </label>
            )}
          </div>
        );
      }

      const items = readListItems(value);
      const rows = items.length
        ? items
        : Array.from({ length: field.initial ?? 1 }, () => ({ text: "", detail: "", choice: "" }));
      const none = readStringArray(progress.answers[`${field.key}None`]);
      return (
        <div className="workbook-list-field" key={field.key}>
          {field.title && <p className="workbook-list-title">{field.title}</p>}
          {rows.map((item, index) => {
            const nextItems = (patch: Partial<WorkbookListItem>) => {
              const updated = rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row);
              updateAnswers(field.key, updated);
            };
            return (
              <div className="workbook-list-item" key={`${field.key}-${index}`}>
                <SpeechEnabledTextarea
                  id={`workbook-${field.key}-${index}`}
                  label={`${field.label} ${formatNumber(index + 1)}`}
                  value={item.text}
                  onChange={(answer) => nextItems({ text: answer })}
                  rows={3}
                  maxLength={2000}
                />
                {field.secondLabel && (
                  <SpeechEnabledTextarea
                    id={`workbook-${field.key}-${index}-detail`}
                    label={field.secondLabel}
                    value={item.detail}
                    onChange={(answer) => nextItems({ detail: answer })}
                    rows={3}
                    maxLength={2000}
                  />
                )}
                {field.choices && (
                  <fieldset className="structured-fieldset">
                    <legend>{field.label} {formatNumber(index + 1)}: وضعیت</legend>
                    <div className="structured-options">
                      {field.choices.map((choice) => (
                        <label className="structured-choice" key={choice}>
                          <input
                            type="radio"
                            name={`workbook-${field.key}-${index}-choice`}
                            checked={item.choice === choice}
                            onChange={() => nextItems({ choice })}
                          />
                          <span>{choice}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                )}
              </div>
            );
          })}
          {rows.length < (field.maximum ?? 50) && (
            <button
              type="button"
              className="subtle-button workbook-add-button"
              onClick={() => updateAnswers(field.key, [...rows, { text: "", detail: "", choice: "" }])}
            >
              {field.addLabel}
            </button>
          )}
          {!!field.noneOptions?.length && (
            <div className="structured-options">
              {field.noneOptions.map((noneOption) => (
                <label className="structured-choice" key={noneOption}>
                  <input
                    type="checkbox"
                    checked={none.includes(noneOption)}
                    onChange={() => updateAnswers(`${field.key}None`,
                      none.includes(noneOption) ? none.filter((item) => item !== noneOption) : [...none, noneOption])}
                  />
                  <span>{noneOption}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      );
    }

    const currentSourceAnswer = workbookPageAnswer(page, progress.answers);
    const savedPageFollowup = progress.followups[page.id];
    const activeFollowup = savedPageFollowup?.status === "needs-more" &&
      savedPageFollowup.sourceAnswer === currentSourceAnswer &&
      savedPageFollowup.index < savedPageFollowup.questions.length
      ? savedPageFollowup
      : undefined;

    function reviewRows() {
      return WORKBOOKS[flow].pages
        .filter((item) => item.kind === "questions")
        .map((item) => ({
          page: item,
          answers: [
            ...(item.fields ?? []).flatMap((field) => formatFieldAnswers(field, progress.answers, flow !== "C")),
            ...(progress.followups[item.id]?.questions ?? [])
              .map((question, index): [string, string] => [
                `پرسش تکمیلی: ${question}`,
                progress.followups[item.id].answers[index] ?? "",
              ]),
          ],
        }));
    }

    return (
      <section className="form-view structured-view" aria-labelledby="workbook-title">
        <button className="back-link" type="button" onClick={goPrevious} disabled={followupBusy || followupSpeechBusy}>
          <ArrowLeft size={16} aria-hidden="true" />
          {pageIndex === 0 ? "بازگشت به کارویژه‌ها" : "مرحلهٔ قبل"}
        </button>
        <div className="eyebrow"><span className="eyebrow-line" />{WORKBOOKS[flow].title}</div>
        <div className="structured-heading-row">
          <div>
            <h1 id="workbook-title">{page.title}</h1>
            <p className="form-intro">{page.question}</p>
          </div>
          <span className="step-count" aria-label={`گام ${formatNumber(pageIndex + 1)} از ${formatNumber(pages.length)}`}>
            {formatNumber(pageIndex + 1)}
            <span> از {formatNumber(pages.length)}</span>
          </span>
        </div>
        <div
          className="progress-track structured-progress"
          role="progressbar"
          aria-label="پیشرفت کارویژه"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPercent}
        >
          <span style={{ width: `${progressPercent}%` }} />
        </div>
        {mentorDisabled && (
          <div className="mentor-checking" role="status">
            ارتباط با منتور برقرار نشد؛ پرسش‌های تکمیلی غیرفعال‌اند و می‌توانید فرم ثابت را ادامه دهید.
            <button type="button" className="text-button" onClick={resetMentorApiConnection}>
              تلاش دوباره برای اتصال
            </button>
          </div>
        )}
        <div className="structured-step-content">
          {page.guide && <p>{page.guide}</p>}
          {page.kind === "questions" && (!activeFollowup || mentorDisabled) && (page.fields ?? []).map(renderField)}
          {activeFollowup && !mentorDisabled && (
            <section className="question-card workbook-followup-card" aria-label="پرسش تکمیلی">
              <div className="workbook-followup-reply" aria-live="polite">
                <span className="mentor-label">همراهی دربارهٔ ایده</span>
                <p>{toPersianDigits(activeFollowup.reply)}</p>
              </div>
              <div className="workbook-followup-heading">
                <CircleHelp size={22} aria-hidden="true" />
                <div>
                  <span className="question-kicker">
                    پرسش {formatNumber(activeFollowup.index + 1)} از {formatNumber(activeFollowup.questions.length)}
                  </span>
                  <h2 aria-live="polite" aria-atomic="true">{toPersianDigits(activeFollowup.questions[activeFollowup.index])}</h2>
                </div>
              </div>
              <p className="review-hint" dir="auto">پاسخ اصلی: {currentSourceAnswer}</p>
              <SpeechEnabledTextarea
                id={`workbook-followup-${page.id}`}
                label="پاسخ شما"
                value={activeFollowup.draft}
                onChange={(draft) => updateFollowup(page.id, { ...activeFollowup, draft })}
                rows={4}
                maxLength={1500}
                onBusyChange={setFollowupSpeechBusy}
              />
              <div className="answer-tools">
                <button
                  type="button"
                  className="subtle-button"
                  disabled={followupSpeechBusy}
                  onClick={() => updateFollowup(page.id, {
                    ...activeFollowup,
                    draft: "هنوز مطمئن نیستم. پیش از تصمیم‌گیری می‌خواهم بیشتر بدانم.",
                  })}
                >
                  هنوز مطمئن نیستم <CircleHelp size={15} aria-hidden="true" />
                </button>
                <span>{formatNumber(activeFollowup.draft.length)}/۱۵۰۰</span>
              </div>
              <button type="button" className="text-button" onClick={() => updateFollowup(page.id)} disabled={followupSpeechBusy}>
                ویرایش پاسخ اصلی
              </button>
            </section>
          )}
          {followupBusy && (
            <p className="workbook-followup-loading" role="status">
              <LoaderCircle size={16} aria-hidden="true" /> در حال آماده‌کردن پرسش بعدی
            </p>
          )}
          {page.kind === "summary" && (
            <div className="workbook-review">
              {reviewRows().map(({ page: answerPage, answers }) => (
                <section className="workbook-review-section" key={answerPage.id}>
                  <div className="workbook-review-heading">
                    <h2>{answerPage.title}</h2>
                    <button type="button" className="text-button" onClick={() => setStep(answerPage.id)}>ویرایش</button>
                  </div>
                  <dl className="structured-review-list">
                    {answers.map(([label, answer], index) => (
                      <div className="structured-review-row" key={`${answerPage.id}-${label}-${index}`}>
                        <dt>{label}</dt>
                        <dd dir="auto">{answer || "—"}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
            </div>
          )}
        </div>
        {storageError && <p className="inline-error" role="alert">{storageError}</p>}
        {error && <p className="inline-error" role="alert">{error}</p>}
        <form className="structured-actions workbook-actions" onSubmit={goNext} noValidate>
          {page.kind !== "summary" && (
            <button className="subtle-button" type="button" onClick={saveAndReturn} disabled={followupBusy || followupSpeechBusy}>ذخیره و بعداً ادامه می‌دهم</button>
          )}
          <button className="primary-button" type="submit" disabled={followupBusy || followupSpeechBusy}>
            {followupBusy
              ? "در حال آماده‌سازی"
              : followupRetry
                ? "تلاش دوباره"
                : activeFollowup
                  ? "ثبت پاسخ و ادامه"
                  : page.nextLabel ?? (pageIndex === pages.length - 1 ? "ثبت پاسخ" : "ادامه")}
            {page.kind !== "summary" && <ArrowRight size={17} aria-hidden="true" />}
          </button>
        </form>
        <p className="structured-draft-note">پاسخ‌های این کارویژه برای برگزارکننده ارسال نمی‌شوند.</p>
      </section>
    );
  }

  function formatFieldAnswers(
    field: WorkbookField,
    answers: WorkbookAnswers,
    includeNotes = true,
  ): Array<[string, string]> {
    const answer = answers[field.key];
    if (field.type === "long") return [[field.label, readText(answer)]];
    if (field.type === "single") {
      const selected = field.options.find((option) => option.value === answer);
      const note = includeNotes ? readText(answers[`${field.key}Note`]) : "";
      return [[field.label, [selected?.label, note].filter(Boolean).join(" — ")]];
    }
    if (field.type === "multiple") {
      const selected = readStringArray(answer);
      const details = readStringRecord(answers[`${field.key}Details`]);
      const note = includeNotes ? readText(answers[`${field.key}Note`]) : "";
      const summary = selected.map((value) => {
        const option = field.options.find((item) => item.value === value);
        return [option?.label ?? value, details[value]].filter(Boolean).join(": ");
      }).join("، ");
      return [[field.label, [summary, note].filter(Boolean).join(" — ")]];
    }
    if (field.type === "boxes") {
      if (answers[`${field.key}Unsure`]) return [[field.labels.join("، "), field.unsureLabel ?? "هنوز نمی‌دانم"]];
      return field.labels.map((label, index) => [label, readText(answers[`${field.key}${index}`])]);
    }
    const items = readListItems(answer)
      .filter((item) => item.text.trim())
      .map((item) => [item.text, item.detail, item.choice ? `(${item.choice})` : ""].filter(Boolean).join(" — "));
    const noneOptions = readStringArray(answers[`${field.key}None`]);
    return [[field.title ?? field.label, [...items, ...noneOptions].join("؛ ")]];
  }

  function workbookPageAnswer(page: WorkbookPage, answers: WorkbookAnswers): string {
    return (page.fields ?? [])
      .flatMap((field) => formatFieldAnswers(field, answers, false))
      .filter(([, answer]) => answer.trim())
      .map(([label, answer]) => `${label}: ${answer}`)
      .join("\n")
      .slice(0, 3000);
  }

  function workbookPageFreeText(page: WorkbookPage, answers: WorkbookAnswers): string {
    const text: string[] = [];
    for (const field of page.fields ?? []) {
      if (field.type === "long") {
        text.push(readText(answers[field.key]));
      } else if (field.type === "single") {
        if (field.noteLabel) text.push(readText(answers[`${field.key}Note`]));
      } else if (field.type === "multiple") {
        text.push(readText(answers[`${field.key}Note`]));
        const details = readStringRecord(answers[`${field.key}Details`]);
        for (const value of readStringArray(answers[field.key])) {
          text.push(details[value] ?? "");
        }
      } else if (field.type === "boxes") {
        if (!answers[`${field.key}Unsure`])
          field.labels.forEach((_, index) =>
            text.push(readText(answers[`${field.key}${index}`])),
          );
      } else {
        for (const item of readListItems(answers[field.key])) {
          text.push(item.text, item.detail);
        }
      }
    }
    return text.map((answer) => answer.trim()).filter(Boolean).join("\n").slice(0, 1500);
  }

  function updateData(patch: Partial<StructuredRegistrationData>) {
    setError("");
    const workbooks: StructuredRegistration["workbooks"] = registration.status === "submitted"
        ? lockWorkbooks(registration.workbooks)
        : registration.workbooks;
    onChange({
      ...registration,
      activeFlow: "F",
      workbooks,
      data: { ...data, ...patch },
      updatedAt: new Date().toISOString(),
    });
  }

  async function goNext(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (answerValidationBusy.current) return;
    if (getFormLockState().locked) return;
    let mentorApproved = false;
    if (currentStep !== "review") {
      const validation = validateRegistrationStep(currentStep, data);
      if (validation) {
        setError(validation);
        return;
      }
      const answerToValidate = (() => {
        switch (currentStep) {
          case "problem":
            return { kind: "seed" as const, question: "چه مسئله‌ای را می‌توان بهتر کرد؟", text: data.problem };
          case "better":
            return { kind: "answer" as const, question: "مهم‌ترین تغییر در وضعیت بهتر چیست؟", text: data.better };
          case "action":
            return { kind: "answer" as const, question: "چه کسی چه کاری را متفاوت انجام می‌دهد؟", text: data.action };
          case "outcomes":
            return data.outcomes.includes(otherOutcome)
              ? { kind: "answer" as const, question: "چه نتیجهٔ دیگری از پیشنهاد انتظار می‌رود؟", text: data.outcomeOther }
              : null;
          case "groups":
            return data.groups.includes(otherGroup)
              ? { kind: "answer" as const, question: "کدام گروه از پیشنهاد بهره‌مند می‌شود؟", text: data.groupOther }
              : null;
          case "title":
            return data.title.trim()
              ? { kind: "answer" as const, question: "عنوان ایده چیست؟", text: data.title }
              : null;
          default:
            return null;
        }
      })();
      if (answerToValidate?.text.trim()) {
        answerValidationBusy.current = true;
        const result = await validateAnswerRelevance({
          kind: answerToValidate.kind,
          seed: data.problem.slice(0, 1200),
          question: answerToValidate.question.slice(0, 600),
          text: answerToValidate.text.slice(0, 1500),
        });
        answerValidationBusy.current = false;
        if (!result.valid) {
          setError(result.message);
          return;
        }
      }
      if (getFormLockState().locked) return;
      const guidedReady = await guidedAnswerRef.current?.review();
      if (guidedReady === false) return;
      mentorApproved = guidedReady === true;
    } else if (!acceptedReview) {
      setError("برای ثبت نهایی، مرور پاسخ‌ها را تأیید کنید.");
      return;
    }
    if (getFormLockState().locked) return;

    setError("");
    if (currentStep === "review") {
      onSubmit({ ...registration, updatedAt: new Date().toISOString() });
      return;
    }
    const next = steps[stepIndex + 1];
    if (next) {
      let updated = { ...registration, step: next, updatedAt: new Date().toISOString() };
      if (SCOREABLE_INITIAL_STEPS.includes(currentStep)) {
        updated = awardStructuredPoints(updated, `initial:${currentStep}:base`, 2);
        if (mentorApproved)
          updated = awardStructuredPoints(updated, `initial:${currentStep}:bonus`, 1);
      }
      onChange(updated);
    }
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
    const workbooks = registration.status === "submitted"
      ? lockWorkbooks(registration.workbooks)
      : registration.workbooks;
    onChange({
      ...registration,
      activeFlow: "F",
      workbooks,
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
    guidance = "پاسختان را با جزئیات روشن و مرتبط با همین سؤال کامل کنید.",
    question = label,
  ) {
    return (
      <MentorGuidedTextarea
        ref={guidedAnswerRef}
        id={id}
        label={label}
        question={question}
        guide={guidance}
        value={value}
        onChange={onValue}
        context={registrationMentorContext(registration, currentStep)}
        rows={rows}
        maxLength={4000}
        describedBy={describedBy}
      />
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
              setAcceptedReview(false);
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

      <>
          <div className="eyebrow"><span className="eyebrow-line" />فرم اولیهٔ ثبت ایده</div>
          <div className="structured-heading-row">
            <div>
              <h1 id="structured-title">{STEP_TITLES[currentStep]}</h1>
              {currentStep === "intro" ? (
                <p className="form-intro">
                  به پرسش‌ها دقیق و کامل پاسخ دهید؛ پرسش‌های بعدی بر اساس پاسخ‌های شما طراحی می‌شوند. پاسخ‌های کامل و مرتبط پس از تأیید مشاور هوشمند جوانه امتیاز تکمیلی می‌گیرند.
                </p>
              ) : (
                <p className="form-intro">پاسخ‌هایتان با رفت‌وبرگشت حفظ می‌شوند و می‌توانید در مرور نهایی آن‌ها را ویرایش کنید.</p>
              )}
            </div>
            <span className="step-count" aria-label={`مرحله ${formatNumber(stepIndex + 1)} از ${formatNumber(steps.length)}`}>
              {formatNumber(stepIndex + 1)} <span>از {formatNumber(steps.length)}</span>
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

          {mentorDisabled && (
            <div className="mentor-checking" role="status">
              ارتباط با منتور برقرار نشد؛ پرسش‌های تکمیلی غیرفعال‌اند و می‌توانید فرم ثابت را ادامه دهید.
              <button type="button" className="text-button" onClick={resetMentorApiConnection}>
                تلاش دوباره برای اتصال
              </button>
            </div>
          )}
          {currentStep === "intro" && (
            <div className="structured-step-content">
              <div className="structured-time"><Clock3 size={17} aria-hidden="true" /> زمان تقریبی: ۵ تا ۷ دقیقه</div>
              <p>در این فرم مسئله‌ای را که دیده‌اید، تغییر پیشنهادی و پیامدهای مورد انتظار را با واژه‌های خودتان می‌نویسید. هیچ محوری از پیش انتخاب نشده و عنوان را هم خودتان تعیین می‌کنید.</p>
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
              <p>برای تکمیل این بخش، نام و محل سکونت را وارد کنید. شمارهٔ تلفن یا کد ملی دریافت نمی‌کنیم.</p>
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
              <p>مسئله‌ای را که خودتان دیده‌اید یا تجربه کرده‌اید با واژه‌های خودتان شرح دهید؛ لازم نیست رسمی یا تخصصی بنویسید.</p>
              {textArea("registration-problem", "چه مسئله‌ای را می‌توان بهتر کرد؟", data.problem, (problem) => updateData({ problem }), 7, "problem-guide problem-count", "یک موقعیت واقعی را توصیف کنید: چه اتفاقی می‌افتد، برای چه کسانی و در چه شرایطی؟")}
              <div className="structured-field-hint" id="problem-guide">روشن کنید چه اتفاقی می‌افتد، چه کسانی درگیرند و مسئله در چه شرایطی رخ می‌دهد.</div>
              <div className="structured-field-hint" id="problem-count" aria-live="polite">{formatNumber(countWords(data.problem))} واژه</div>
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
              {textArea("registration-better", "تصویر وضعیت بهتر", data.better, (better) => updateData({ better }), 5, undefined, "به تغییری فکر کنید که مردم بتوانند در زندگی روزمره ببینند؛ چه چیزی کمتر، بیشتر یا آسان‌تر می‌شود؟", "فرض کنید این مسئله بهتر شده است. مهم‌ترین تغییری که مردم واقعاً متوجه آن می‌شوند چیست؟")}
            </div>
          )}

          {currentStep === "action" && (
            <div className="structured-step-content">
              <p>به‌نظر شما چه فرد، گروه یا مجموعه‌ای باید چه کاری را متفاوت انجام دهد تا این مسئله بهتر شود؟</p>
              {textArea("registration-action", "تغییر یا اقدام پیشنهادی", data.action, (action) => updateData({ action }), 5, undefined, "مشخص کنید چه کسی قرار است چه کاری انجام دهد و این کار چطور به بهترشدن وضعیت کمک می‌کند.", "به‌نظر شما چه فرد، گروه یا مجموعه‌ای باید چه کاری را متفاوت انجام دهد تا این مسئله بهتر شود؟")}
            </div>
          )}

          {currentStep === "refine" && (
            <div className="structured-step-content">
              <p>از توضیحتان مشخص است چه کسی باید چه کاری را نسبت به امروز متفاوت انجام دهد؟ پاسخ فعلی بدون تغییر باقی می‌ماند، مگر اینکه خودتان ویرایشش کنید.</p>
              {radioOptions("مرور پاسخ پیشنهادی", ["کمی دقیق‌ترش می‌کنم", "با همین پاسخ ادامه می‌دهم"], data.refine === "more" ? "کمی دقیق‌ترش می‌کنم" : data.refine === "keep" ? "با همین پاسخ ادامه می‌دهم" : "", (value) => updateData({ refine: value === "کمی دقیق‌ترش می‌کنم" ? "more" : "keep" }))}
              {data.refine === "more" && textArea("registration-action-refine", "پاسخ پیشنهادی؛ در صورت تمایل ویرایش کنید", data.action, (action) => updateData({ action }), 5, undefined, "اگر پاسخ را ویرایش می‌کنید، روشن کنید چه کسی چه تغییری ایجاد می‌کند.", "از توضیحتان مشخص است چه کسی باید چه کاری را نسبت به امروز متفاوت انجام دهد؟")}
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
                <input type="checkbox" checked={acceptedReview} onChange={(event) => { setAcceptedReview(event.target.checked); setError(""); }} />
                <span>پاسخ‌ها را مرور کرده‌ام و ثبت نهایی را تأیید می‌کنم.</span>
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
              {currentStep === "review" ? <><Check size={17} aria-hidden="true" /> ثبت نهایی</> : <>ادامه <ArrowRight size={17} aria-hidden="true" /></>}
            </button>
          </form>
      </>
    </section>
  );
}