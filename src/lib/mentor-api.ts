"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "javaneh-mentor-api-state";
const CHANGE_EVENT = "javaneh-mentor-api-state-change";
const DISABLED_MESSAGE =
  "پس از دو بار تلاش، ارتباط با منتور برقرار نشد؛ پرسش‌های تکمیلی غیرفعال شدند. فرم ثابت را ادامه دهید.";
const RETRY_MESSAGE = "ارتباط با منتور برقرار نشد؛ لطفاً یک بار دیگر تلاش کنید.";

type MentorApiState = {
  failures: number;
  disabled: boolean;
};

export type MentorApiResult<T> =
  | { status: "success"; data: T }
  | { status: "retry"; message: string }
  | { status: "disabled"; message: string }
  | { status: "cancelled" };

type MentorResponseParser<T> = (payload: unknown) => T | null;

let state: MentorApiState | null = null;

function getState(): MentorApiState {
  if (state) return state;

  if (typeof window !== "undefined") {
    try {
      const saved = window.sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (
          parsed &&
          typeof parsed === "object" &&
          "failures" in parsed &&
          typeof parsed.failures === "number" &&
          "disabled" in parsed &&
          typeof parsed.disabled === "boolean"
        ) {
          state = { failures: parsed.failures, disabled: parsed.disabled };
        }
      }
    } catch (error) {
      console.error("Could not read mentor API session state.", error);
    }
  }

  state ??= { failures: 0, disabled: false };
  return state;
}

function saveState(nextState: MentorApiState) {
  state = nextState;
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  } catch (error) {
    console.error("Could not save mentor API session state.", error);
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function isMentorApiDisabled(): boolean {
  return getState().disabled;
}

export function resetMentorApiConnection(): void {
  saveState({ failures: 0, disabled: false });
}

export function useMentorApiDisabled(): boolean {
  return useSyncExternalStore(
    (listener) => {
      if (typeof window === "undefined") return () => {};
      window.addEventListener(CHANGE_EVENT, listener);
      return () => window.removeEventListener(CHANGE_EVENT, listener);
    },
    isMentorApiDisabled,
    () => false,
  );
}

export async function requestMentorApi<T>(
  body: unknown,
  parseResponse: MentorResponseParser<T>,
  signal?: AbortSignal,
): Promise<MentorApiResult<T>> {
  if (isMentorApiDisabled()) {
    return { status: "disabled", message: DISABLED_MESSAGE };
  }

  try {
    const response = await fetch("/api/mentor/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify(body),
    });
    const payload: unknown = await response.json();
    const data = response.ok ? parseResponse(payload) : null;
    if (data === null) throw new Error("Invalid mentor API response");

    const currentState = getState();
    if (currentState.disabled)
      return { status: "disabled", message: DISABLED_MESSAGE };
    if (currentState.failures > 0)
      saveState({ failures: 0, disabled: false });
    return { status: "success", data };
  } catch (error) {
    if (signal?.aborted || (error instanceof Error && error.name === "AbortError"))
      return { status: "cancelled" };

    const failures = getState().failures + 1;
    if (failures >= 2) {
      saveState({ failures, disabled: true });
      return { status: "disabled", message: DISABLED_MESSAGE };
    }

    saveState({ failures, disabled: false });
    return { status: "retry", message: RETRY_MESSAGE };
  }
}
