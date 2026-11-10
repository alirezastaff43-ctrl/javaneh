"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  classifyDemoText,
  type ModerationInput,
} from "./moderation";

const CHANGE_EVENT = "javaneh-form-validation-state-change";
const LOCK_MESSAGE =
  "به‌دلیل چند پاسخ نامعتبر، تکمیل فرم تا ۱۲ ساعت محدود شده است.";

export type FormLockState = {
  locked: boolean;
  lockedUntil: number;
};

export type AnswerValidationResult =
  | { valid: true }
  | { valid: false; message: string; locked: boolean };

let state: FormLockState = { locked: false, lockedUntil: 0 };
const SERVER_LOCK_SNAPSHOT = "false:0";

function publish(next: FormLockState) {
  state = next;
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event(CHANGE_EVENT));
}

export async function refreshFormLockState(): Promise<FormLockState> {
  try {
    const response = await fetch("/api/form-validation", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load form lock state");
    const payload: unknown = await response.json();
    if (
      !payload ||
      typeof payload !== "object" ||
      !("locked" in payload) ||
      typeof payload.locked !== "boolean" ||
      !("lockedUntil" in payload) ||
      typeof payload.lockedUntil !== "number"
    )
      throw new Error("Invalid form lock response");
    const next = { locked: payload.locked, lockedUntil: payload.lockedUntil };
    publish(next);
    return next;
  } catch (error) {
    console.error("Could not load server form lock state.", error);
    throw error;
  }
}

export function getFormLockState(): FormLockState {
  if (state.locked && state.lockedUntil <= Date.now()) {
    state = { locked: false, lockedUntil: 0 };
    return state;
  }
  return state;
}

export function useFormLockState(): FormLockState {
  const subscribe = (listener: () => void) => {
    if (typeof window === "undefined") return () => {};
    window.addEventListener(CHANGE_EVENT, listener);
    void refreshFormLockState().catch(() => undefined);
    return () => window.removeEventListener(CHANGE_EVENT, listener);
  };
  const snapshot = () => {
    const current = getFormLockState();
    return `${current.locked}:${current.lockedUntil}`;
  };
  const lockSnapshot = useSyncExternalStore(
    subscribe,
    snapshot,
    () => SERVER_LOCK_SNAPSHOT,
  );
  const [locked, lockedUntil = "0"] = lockSnapshot.split(":");

  useEffect(() => {
    const until = Number(lockedUntil);
    if (locked !== "true" || until <= Date.now()) return;
    const timer = window.setTimeout(
      () => void refreshFormLockState().catch(() => undefined),
      until - Date.now(),
    );
    return () => window.clearTimeout(timer);
  }, [locked, lockedUntil]);

  return { locked: locked === "true", lockedUntil: Number(lockedUntil) };
}

export async function recordInvalidFormAnswer(
  message: string,
): Promise<AnswerValidationResult> {
  try {
    const response = await fetch("/api/form-validation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "invalid" }),
    });
    const payload: unknown = await response.json();
    if (!response.ok || !payload || typeof payload !== "object")
      throw new Error("Could not record invalid form answer");
    if (
      !("locked" in payload) ||
      typeof payload.locked !== "boolean" ||
      !("lockedUntil" in payload) ||
      typeof payload.lockedUntil !== "number" ||
      !("attemptsRemaining" in payload) ||
      typeof payload.attemptsRemaining !== "number"
    )
      throw new Error("Invalid form lock response");
    publish({
      locked: payload.locked,
      lockedUntil: payload.lockedUntil,
    });
    if (payload.locked)
      return { valid: false, locked: true, message: LOCK_MESSAGE };
    return {
      valid: false,
      locked: false,
      message: `${message} ${
        payload.attemptsRemaining
          ? `تعداد فرصت باقی‌مانده: ${payload.attemptsRemaining}.`
          : "اگر پاسخ نامعتبر دیگری ثبت شود، تکمیل فرم تا ۱۲ ساعت محدود می‌شود."
      }`,
    };
  } catch (error) {
    console.error("Could not persist form validation state.", error);
    return {
      valid: false,
      locked: false,
      message: "وضعیت بررسی پاسخ در سرور ذخیره نشد؛ اتصال را بررسی و دوباره تلاش کنید.",
    };
  }
}

export async function validateAnswerRelevance(
  input: ModerationInput,
): Promise<AnswerValidationResult> {
  if (input.kind === "answer" && isClearlyInvalidAnswer(input.text))
    return recordInvalidFormAnswer(
      "این پاسخ نامعتبر یا بی‌معنا به نظر می‌رسد؛ لطفاً پاسخی روشن و مرتبط با سؤال بنویسید.",
    );

  let relevant: boolean;
  try {
    const response = await fetch("/api/mentor/moderate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(6000),
    });
    const payload: unknown = await response.json();
    if (response.status === 423) {
      const current = await refreshFormLockState();
      return {
        valid: false,
        locked: true,
        message: current.locked ? LOCK_MESSAGE : "تکمیل فرم موقتاً محدود شده است.",
      };
    }
    if (
      response.ok &&
      payload &&
      typeof payload === "object" &&
      "category" in payload &&
      (payload.category === "relevant" || payload.category === "off_topic")
    ) {
      relevant = payload.category === "relevant";
    } else {
      relevant = classifyDemoText(input).category !== "off_topic";
    }
  } catch (error) {
    console.error("Could not check form answer relevance; using local checks.", error);
    relevant = classifyDemoText(input).category !== "off_topic";
  }

  if (relevant) return { valid: true };
  return recordInvalidFormAnswer(
    "این پاسخ با سؤال یا موضوع ایده مرتبط نیست یا معنای روشنی ندارد؛ لطفاً آن را اصلاح کنید.",
  );
}

export function isClearlyInvalidAnswer(text: string): boolean {
  return text.split(/\r?\n/u).some((line) => {
    const normalized = line.trim().toLocaleLowerCase("fa").replace(/\s+/gu, " ");
    if (!normalized) return false;
    if (/^(.)\1{5,}$/u.test(normalized)) return true;
    const words = normalized.match(/[\p{L}\p{N}]+/gu) ?? [];
    if (words.length >= 5 && new Set(words).size === 1) return true;
    return /^(?:(?:asdf|qwerty|test|xxx|۱۲۳۴۵۶|123456)(?:\s+|$))+$/iu.test(normalized);
  });
}
