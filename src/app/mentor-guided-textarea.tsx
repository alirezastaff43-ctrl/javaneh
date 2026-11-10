"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { formatNumber, toPersianDigits } from "@/lib/locale";
import { SpeechEnabledTextarea } from "./speech-input-control";

type MentorMessage = { role: "user" | "assistant"; content: string };
type MentorQuestion = { question: string; explanation: string };
type MentorGuidePreview = { reflection: string; guidance: string };

type FormReviewResponse = {
  reply: string;
  status: "needs-more" | "sufficient";
  questions: MentorQuestion[];
};

export type MentorGuidedTextareaHandle = {
  review: () => Promise<boolean>;
};

type Props = {
  id: string;
  label: string;
  question: string;
  guide: string;
  value: string;
  onChange: (value: string) => void;
  context: string;
  rows?: number;
  maxLength?: number;
  describedBy?: string;
};

const MentorGuidedTextarea = forwardRef<MentorGuidedTextareaHandle, Props>(
  function MentorGuidedTextarea({
    id,
    label,
    question,
    guide,
    value,
    onChange,
    context,
    rows = 5,
    maxLength = 4000,
    describedBy,
  }, ref) {
    const [status, setStatus] = useState<"idle" | "checking" | "needs-more" | "accepted" | "error">("idle");
    const [mentorReply, setMentorReply] = useState("");
    const [questions, setQuestions] = useState<MentorQuestion[]>([]);
    const [questionIndex, setQuestionIndex] = useState(0);
    const [followupAnswer, setFollowupAnswer] = useState("");
    const [batchAnswers, setBatchAnswers] = useState<string[]>([]);
    const [speechBusy, setSpeechBusy] = useState(false);
    const [error, setError] = useState("");
    const [guidePreview, setGuidePreview] = useState<MentorGuidePreview | null>(null);
    const [guideLoading, setGuideLoading] = useState(false);
    const guideRequestKey = useRef("");
    const guideContext = useRef(context);
    guideContext.current = context;

    const requestMentor = useCallback(async (messages: MentorMessage[], questionCount: number) => {
      setStatus("checking");
      setError("");
      try {
        const response = await fetch("/api/mentor/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ purpose: "form-guidance", questionCount, messages, ideas: [] }),
        });
        const payload: unknown = await response.json();
        if (
          !response.ok ||
          !payload ||
          typeof payload !== "object" ||
          !("reply" in payload) ||
          typeof payload.reply !== "string" ||
          !("status" in payload) ||
          (payload.status !== "needs-more" && payload.status !== "sufficient") ||
          !("questions" in payload) ||
          !Array.isArray(payload.questions) ||
          payload.questions.some((item) =>
            !item || typeof item !== "object" ||
            !("question" in item) || typeof item.question !== "string" ||
            !("explanation" in item) || typeof item.explanation !== "string",
          )
        ) {
          const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "پاسخ منتور دریافت نشد؛ دوباره تلاش کنید.";
          throw new Error(message);
        }
        const result = payload as FormReviewResponse;
        setMentorReply(result.reply);
        setQuestions(result.questions);
        setQuestionIndex(0);
        setFollowupAnswer("");
        setStatus(result.status === "sufficient" ? "accepted" : "needs-more");
        return result;
      } catch (requestError) {
        setStatus(messages.length > 1 ? "needs-more" : "error");
        setError(requestError instanceof Error ? requestError.message : "ارتباط با منتور برقرار نشد.");
        return null;
      }
    }, []);

    useEffect(() => {
      const requestKey = `${id}\u0000${question}\u0000${guide}`;
      if (guideRequestKey.current === requestKey) return;
      guideRequestKey.current = requestKey;

      const previousAnswers = guideContext.current.trim();
      if (!previousAnswers) {
        setGuidePreview({ reflection: "", guidance: guide });
        setGuideLoading(false);
        return;
      }

      let active = true;
      const controller = new AbortController();
      setGuidePreview(null);
      setGuideLoading(true);

      void (async () => {
        try {
          const response = await fetch("/api/mentor/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              purpose: "form-guidance-preview",
              messages: [{
                role: "user",
                content: JSON.stringify({ question, guide, previousAnswers }),
              }],
              ideas: [],
            }),
          });
          const payload: unknown = await response.json();
          if (
            !response.ok ||
            !payload ||
            typeof payload !== "object" ||
            !("reflection" in payload) ||
            typeof payload.reflection !== "string" ||
            !("guidance" in payload) ||
            typeof payload.guidance !== "string"
          )
            throw new Error("Invalid form guide response");
          if (active) setGuidePreview({ reflection: payload.reflection, guidance: payload.guidance });
        } catch {
          if (active) setGuidePreview(null);
        } finally {
          if (active) setGuideLoading(false);
        }
      })();

      return () => {
        active = false;
        controller.abort();
        if (guideRequestKey.current === requestKey) guideRequestKey.current = "";
      };
    }, [guide, id, question]);

    const review = useCallback(async () => {
      if (status === "accepted") return true;
      if (status === "needs-more" || status === "checking" || speechBusy) return false;
      const request = {
        question,
        guide,
        answer: value,
        previousAnswers: context,
      };
      const requestMessage = { role: "user" as const, content: JSON.stringify(request) };
      const result = await requestMentor([requestMessage], 1 + Math.floor(Math.random() * 3));
      if (!result) return false;
      if (result.status === "needs-more") {
        return false;
      }
      return true;
    }, [context, guide, question, requestMentor, speechBusy, status, value]);

    useImperativeHandle(ref, () => ({ review }), [review]);

    async function submitFollowup(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      const trimmedAnswer = followupAnswer.trim();
      if (!trimmedAnswer || speechBusy || status === "checking") return;
      const answers = [...batchAnswers, trimmedAnswer];
      if (questionIndex < questions.length - 1) {
        setBatchAnswers(answers);
        setQuestionIndex(questionIndex + 1);
        setFollowupAnswer("");
        return;
      }

      const suffix = answers.join("\n");
      onChange(`${value.trimEnd()}\n\nتوضیح تکمیلی: ${suffix}`.slice(0, maxLength));
      setMentorReply("توضیحات تکمیلی ثبت شد؛ حالا می‌توانی ادامه بدهی.");
      setStatus("accepted");
      setQuestions([]);
      setQuestionIndex(0);
      setFollowupAnswer("");
      setBatchAnswers([]);
    }

    function updateAnswer(nextValue: string) {
      onChange(nextValue);
      setStatus("idle");
      setMentorReply("");
      setQuestions([]);
      setQuestionIndex(0);
      setFollowupAnswer("");
      setBatchAnswers([]);
      setError("");
    }

    const currentQuestion = questions[questionIndex];

    return (
      <div className="mentor-guided-answer">
        <div className="mentor-guidance-note" aria-busy={guideLoading}>
          <span className="mentor-label">راهنمای منتور</span>
          {guidePreview?.reflection && (
            <div className="mentor-guidance-section">
              <span className="mentor-guidance-heading">برداشت من از حرف‌هایت</span>
              <p className="mentor-guidance-reflection">{toPersianDigits(guidePreview.reflection)}</p>
            </div>
          )}
          <div className="mentor-guidance-section">
            <span className="mentor-guidance-heading">در این سؤال توضیح بده</span>
            <p>{toPersianDigits(guidePreview?.guidance ?? guide)}</p>
          </div>
        </div>
        <SpeechEnabledTextarea
          id={id}
          label={label}
          value={value}
          onChange={updateAnswer}
          rows={rows}
          maxLength={maxLength}
          describedBy={describedBy}
          onBusyChange={setSpeechBusy}
        />
        {mentorReply && (
          <div className={`mentor-answer-feedback${status === "accepted" ? " is-accepted" : ""}`} role="status" aria-live="polite">
            <span className="mentor-label">منتور</span>
            <p>{toPersianDigits(mentorReply)}</p>
          </div>
        )}
        {status === "needs-more" && (
          <form className="mentor-followup" onSubmit={(event) => void submitFollowup(event)}>
            {currentQuestion && (
              <div className="mentor-followup-question">
                <p>{toPersianDigits(currentQuestion.question)}</p>
                <p className="mentor-followup-explanation">{toPersianDigits(currentQuestion.explanation)}</p>
                {questions.length > 1 && (
                  <span className="mentor-followup-count">
                    پرسش {formatNumber(questionIndex + 1)} از {formatNumber(questions.length)}
                  </span>
                )}
              </div>
            )}
            <SpeechEnabledTextarea
              id={`${id}-followup`}
              label="توضیح تکمیلی"
              value={followupAnswer}
              onChange={setFollowupAnswer}
              rows={3}
              maxLength={2000}
              onBusyChange={setSpeechBusy}
            />
            <button className="subtle-button" type="submit" disabled={!followupAnswer.trim() || speechBusy || status === "checking"}>
              {status === "checking" ? <LoaderCircle className="mentor-check-spinner" size={16} aria-hidden="true" /> : <ArrowRight size={16} aria-hidden="true" />}
              {questionIndex < questions.length - 1 ? "ثبت پاسخ و ادامه" : "پاسخ به منتور"}
            </button>
          </form>
        )}
        {status === "checking" && <p className="mentor-checking" role="status">منتور دارد پاسختان را بررسی می‌کند…</p>}
        {error && <p className="inline-error" role="alert">{error}</p>}
      </div>
    );
  },
);

MentorGuidedTextarea.displayName = "MentorGuidedTextarea";

export default MentorGuidedTextarea;