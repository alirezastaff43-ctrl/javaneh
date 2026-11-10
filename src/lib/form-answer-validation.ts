"use client";

import { useSyncExternalStore } from "react";
import {
  classifyDemoText,
  type ModerationInput,
} from "./moderation";

const STORAGE_KEY = "javaneh-form-validation-state";
const CHANGE_EVENT = "javaneh-form-validation-state-change";
const MAX_INVALID_ATTEMPTS = 3;
const LOCK_DURATION_MS = 12 * 60 * 60 * 1000;

type StoredState = {
  invalidAttempts: number;
  windowStartedAt: number;
  lockedUntil: number;
};

export type FormLockState = {
  locked: boolean;
  lockedUntil: number;
};

export type AnswerValidationResult =
  | { valid: true }
  | { valid: false; message: string; locked: boolean };

let memoryState: StoredState = { invalidAttempts: 0, windowStartedAt: 0, lockedUntil: 0 };
let cachedState: StoredState | null = null;
const SERVER_LOCK_SNAPSHOT = "false:0";

function readState(): StoredState {
  if (cachedState) return cachedState;
  if (typeof window === "undefined") return memoryState;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed === "object" &&
        "invalidAttempts" in parsed &&
        typeof parsed.invalidAttempts === "number" &&
        "windowStartedAt" in parsed &&
        typeof parsed.windowStartedAt === "number" &&
        "lockedUntil" in parsed &&
        typeof parsed.lockedUntil === "number"
      ) {
        memoryState = {
          invalidAttempts: Math.max(0, Math.floor(parsed.invalidAttempts)),
          windowStartedAt: Math.max(0, parsed.windowStartedAt),
          lockedUntil: Math.max(0, parsed.lockedUntil),
        };
      }
    }
  } catch (error) {
    console.error("Could not read form validation state.", error);
  }

  if (memoryState.lockedUntil > 0 && memoryState.lockedUntil <= Date.now())
    memoryState = { invalidAttempts: 0, windowStartedAt: 0, lockedUntil: 0 };
  if (
    memoryState.windowStartedAt > 0 &&
    Date.now() - memoryState.windowStartedAt >= LOCK_DURATION_MS
  )
    memoryState = { invalidAttempts: 0, windowStartedAt: 0, lockedUntil: 0 };
  cachedState = memoryState;
  return memoryState;
}

function saveState(next: StoredState): void {
  memoryState = next;
  cachedState = next;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    console.error("Could not persist form validation state.", error);
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function getFormLockState(): FormLockState {
  const { lockedUntil } = readState();
  return { locked: lockedUntil > Date.now(), lockedUntil };
}

export function useFormLockState(): FormLockState {
  const subscribe = (listener: () => void) => {
    if (typeof window === "undefined") return () => {};
    let expirationTimer: number | undefined;
    const scheduleExpiration = () => {
      window.clearTimeout(expirationTimer);
      const { lockedUntil } = getFormLockState();
      const delay = lockedUntil - Date.now();
      if (delay > 0) {
        expirationTimer = window.setTimeout(() => {
          cachedState = null;
          listener();
        }, delay);
      }
    };
    const handleChange = () => {
      cachedState = null;
      scheduleExpiration();
      listener();
    };
    window.addEventListener(CHANGE_EVENT, handleChange);
    window.addEventListener("storage", handleChange);
    scheduleExpiration();
    return () => {
      window.clearTimeout(expirationTimer);
      window.removeEventListener(CHANGE_EVENT, handleChange);
      window.removeEventListener("storage", handleChange);
    };
  };
  const snapshot = () => {
    const lockState = getFormLockState();
    return `${lockState.locked}:${lockState.lockedUntil}`;
  };
  const lockSnapshot = useSyncExternalStore(
    subscribe,
    snapshot,
    () => SERVER_LOCK_SNAPSHOT,
  );
  const [locked, lockedUntil = "0"] = lockSnapshot.split(":");
  return { locked: locked === "true", lockedUntil: Number(lockedUntil) };
}

export function recordInvalidFormAnswer(message: string): AnswerValidationResult {
  let current = readState();
  if (current.lockedUntil > Date.now()) {
    return {
      valid: false,
      locked: true,
      message: "به‌دلیل چند پاسخ نامعتبر، تکمیل فرم تا ۱۲ ساعت محدود شده است.",
    };
  }
  if (current.lockedUntil > 0) {
    current = { invalidAttempts: 0, windowStartedAt: 0, lockedUntil: 0 };
    saveState(current);
  }
  const now = Date.now();
  if (!current.windowStartedAt || now - current.windowStartedAt >= LOCK_DURATION_MS)
    current = { invalidAttempts: 0, windowStartedAt: now, lockedUntil: 0 };
  const invalidAttempts = current.invalidAttempts + 1;
  if (invalidAttempts > MAX_INVALID_ATTEMPTS) {
    const lockedUntil = now + LOCK_DURATION_MS;
    saveState({ invalidAttempts, windowStartedAt: current.windowStartedAt, lockedUntil });
    return {
      valid: false,
      locked: true,
      message: "بیش از سه پاسخ نامعتبر ثبت شد؛ تکمیل فرم تا ۱۲ ساعت محدود شده است.",
    };
  }

  saveState({ invalidAttempts, windowStartedAt: current.windowStartedAt, lockedUntil: 0 });
  const attemptsLeft = MAX_INVALID_ATTEMPTS - invalidAttempts;
  return {
    valid: false,
    locked: false,
    message: `${message} ${attemptsLeft ? `تعداد فرصت باقی‌مانده: ${attemptsLeft}.` : "اگر پاسخ نامعتبر دیگری ثبت شود، تکمیل فرم تا ۱۲ ساعت محدود می‌شود."}`,
  };
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
