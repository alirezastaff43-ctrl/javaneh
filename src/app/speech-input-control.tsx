"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, LoaderCircle, Square } from "lucide-react";

const MAX_AUDIO_BYTES = 50 * 1024 * 1024;

type SpeechState = "idle" | "recording" | "transcribing";

type SpeechInputControlProps = {
  onTranscript: (text: string) => void;
  onBusyChange: (busy: boolean) => void;
};

export default function SpeechInputControl({
  onTranscript,
  onBusyChange,
}: SpeechInputControlProps) {
  const [state, setState] = useState<SpeechState>("idle");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioSizeRef = useRef(0);
  const exceededSizeRef = useRef(false);
  const recordingErrorRef = useRef(false);

  useEffect(
    () => () => {
      const recorder = recorderRef.current;
      if (recorder) {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        if (recorder.state === "recording") recorder.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  async function transcribe(audio: Blob) {
    if (audio.size > MAX_AUDIO_BYTES) {
      setState("idle");
      setIsError(true);
      setMessage("حجم صدای ضبط‌شده بیشتر از ۵۰ مگابایت است.");
      onBusyChange(false);
      return;
    }
    if (!audio.size) {
      setState("idle");
      setIsError(true);
      setMessage("صدایی ضبط نشد؛ دوباره تلاش کنید.");
      onBusyChange(false);
      return;
    }

    setState("transcribing");
    setIsError(false);
    setMessage("در حال تبدیل گفتار به متن…");
    try {
      const formData = new FormData();
      const extension = audio.type.includes("mp4") ? "m4a" : "webm";
      formData.append("audio", audio, `idea-voice.${extension}`);
      const response = await fetch("/api/speech-to-text", {
        method: "POST",
        body: formData,
      });
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new Error("پاسخ سرویس گفتار به متن خوانده نشد.");
      }
      if (
        !response.ok ||
        !payload ||
        typeof payload !== "object" ||
        !("text" in payload) ||
        typeof payload.text !== "string" ||
        !payload.text.trim()
      ) {
        const error =
          payload &&
          typeof payload === "object" &&
          "error" in payload &&
          typeof payload.error === "string"
            ? payload.error
            : "گفتار به متن تبدیل نشد؛ دوباره تلاش کنید.";
        throw new Error(error);
      }
      onTranscript(payload.text.trim());
      setIsError(false);
      setMessage("متن گفتار به کادر ایده اضافه شد.");
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "ارتباط با سرویس گفتار به متن برقرار نشد.",
      );
    } finally {
      setState("idle");
      onBusyChange(false);
    }
  }

  async function toggleRecording() {
    if (state === "transcribing") return;
    setMessage("");
    setIsError(false);
    if (state === "recording") {
      recorderRef.current?.stop();
      return;
    }
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setIsError(true);
      setMessage("ضبط صدا در این مرورگر پشتیبانی نمی‌شود.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find(
        (type) => MediaRecorder.isTypeSupported(type),
      );
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      audioSizeRef.current = 0;
      exceededSizeRef.current = false;
      recordingErrorRef.current = false;
      recorder.ondataavailable = (event) => {
        if (!event.data.size) return;
        audioSizeRef.current += event.data.size;
        chunksRef.current.push(event.data);
        if (audioSizeRef.current > MAX_AUDIO_BYTES) {
          exceededSizeRef.current = true;
          recorder.stop();
        }
      };
      recorder.onerror = () => {
        recordingErrorRef.current = true;
        if (recorder.state === "recording") recorder.stop();
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        if (exceededSizeRef.current) {
          setState("idle");
          setIsError(true);
          setMessage("ضبط به سقف ۵۰ مگابایت رسید؛ صدای کوتاه‌تری ضبط کنید.");
          onBusyChange(false);
          return;
        }
        if (recordingErrorRef.current) {
          setState("idle");
          setIsError(true);
          setMessage("ضبط صدا ناموفق بود؛ دوباره تلاش کنید.");
          onBusyChange(false);
          return;
        }
        void transcribe(
          new Blob(chunksRef.current, {
            type: recorder.mimeType || "audio/webm",
          }),
        );
      };
      recorder.start(1000);
      setState("recording");
      setMessage("در حال ضبط؛ برای پایان، دکمهٔ میکروفون را بزنید.");
      onBusyChange(true);
    } catch (error) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setState("idle");
      setIsError(true);
      setMessage(
        error instanceof Error && error.name === "NotAllowedError"
          ? "دسترسی به میکروفون داده نشد. مجوز میکروفون مرورگر را بررسی کنید."
          : "میکروفون در دسترس نیست؛ اتصال و مجوز آن را بررسی کنید.",
      );
      onBusyChange(false);
    }
  }

  return (
    <div className="seed-speech-control">
      <button
        type="button"
        className={`seed-speech-button${state === "recording" ? " is-recording" : ""}`}
        onClick={() => void toggleRecording()}
        disabled={state === "transcribing"}
        aria-label={
          state === "recording" ? "پایان ضبط گفتار" : "شروع ضبط گفتار"
        }
        title={state === "recording" ? "پایان ضبط" : "گفتار به متن"}
      >
        {state === "transcribing" ? (
          <LoaderCircle className="seed-speech-spinner" size={19} aria-hidden="true" />
        ) : state === "recording" ? (
          <Square size={16} fill="currentColor" aria-hidden="true" />
        ) : (
          <Mic size={20} aria-hidden="true" />
        )}
      </button>
      {message && (
        <span
          className={`seed-speech-message${isError ? " is-error" : ""}`}
          role={isError ? "alert" : "status"}
          aria-live={isError ? "assertive" : "polite"}
        >
          {message}
        </span>
      )}
    </div>
  );
}

type SpeechEnabledTextareaProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  maxLength?: number;
  describedBy?: string;
  onBusyChange?: (busy: boolean) => void;
};

export function SpeechEnabledTextarea({
  id,
  label,
  value,
  onChange,
  rows = 5,
  maxLength = 4000,
  describedBy,
  onBusyChange,
}: SpeechEnabledTextareaProps) {
  const [speechBusy, setSpeechBusy] = useState(false);

  function appendTranscript(text: string) {
    const separator = value.trim() ? " " : "";
    onChange(`${value}${separator}${text}`.slice(0, maxLength));
  }

  function updateBusy(busy: boolean) {
    setSpeechBusy(busy);
    onBusyChange?.(busy);
  }

  return (
    <div className="structured-speech-field">
      <label className="structured-field" htmlFor={id}>
        <span>{label}</span>
        <div className="structured-speech-input">
          <textarea
            id={id}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            rows={rows}
            maxLength={maxLength}
            dir="auto"
            aria-describedby={describedBy}
          />
          <SpeechInputControl onTranscript={appendTranscript} onBusyChange={updateBusy} />
        </div>
      </label>
      {speechBusy && <span className="sr-only" role="status">در حال تبدیل گفتار به متن</span>}
    </div>
  );
}