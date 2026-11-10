"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { normalizeDigits, toPersianDigits } from "@/lib/locale";

type Props = { purpose: "signup" | "login" };

export default function AuthForm({ purpose }: Props) {
  const router = useRouter();
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [debugCode, setDebugCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retryAfter, setRetryAfter] = useState(0);

  useEffect(() => {
    let active = true;
    void fetch("/api/auth/session", { cache: "no-store" }).then((response) => {
      if (active && response.ok) router.replace("/");
    });
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (!retryAfter) return;
    const timer = window.setTimeout(
      () => setRetryAfter((remaining) => Math.max(0, remaining - 1)),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [retryAfter]);

  async function requestCode(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (busy || retryAfter > 0) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, purpose }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        if (response.status === 429) {
          const seconds = Number(response.headers.get("Retry-After"));
          if (Number.isFinite(seconds)) setRetryAfter(Math.max(1, seconds));
        }
        throw new Error(
          payload && typeof payload === "object" && "error" in payload &&
          typeof payload.error === "string"
            ? payload.error
            : "ارسال کد ممکن نشد؛ دوباره تلاش کنید.",
        );
      }
      setCodeSent(true);
      setCode("");
      setRetryAfter(60);
      setDebugCode(
        payload && typeof payload === "object" && "debugCode" in payload &&
        typeof payload.debugCode === "string"
          ? payload.debugCode
          : "",
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "ارسال کد ممکن نشد؛ اتصال را بررسی کنید.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, code, purpose }),
      });
      const payload: unknown = await response.json();
      if (!response.ok)
        throw new Error(
          payload && typeof payload === "object" && "error" in payload &&
          typeof payload.error === "string"
            ? payload.error
            : "کد تأیید معتبر نیست یا منقضی شده است.",
        );
      router.replace("/");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "تأیید شمارهٔ همراه انجام نشد.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-shell glass-shell auth-shell">
      <header className="topbar">
        <Link className="brand" href="/login" aria-label="جوانه">
          <Image
            className="brand-logo"
            src="/javaneh-logo.png"
            alt="رویداد ملی نوآوری اجتماعی جوانه"
            width={2172}
            height={724}
            priority
          />
        </Link>
      </header>
      <section className="form-view narrow-view details-view auth-view">
        <div className="step-icon"><ShieldCheck size={24} /></div>
        <div className="eyebrow">
          <span className="eyebrow-line" />
          {purpose === "signup" ? "ساخت حساب کاربری" : "ورود به حساب"}
        </div>
        <h1>
          {codeSent ? "تأیید شمارهٔ همراه" : purpose === "signup" ? "به جوانه خوش آمدید" : "دوباره خوش آمدید"}
        </h1>
        <p className="form-intro">
          {codeSent
            ? "کد یک‌بارمصرف پیامک‌شده را وارد کنید. این کد فقط چند دقیقه اعتبار دارد."
            : "برای ادامه، شمارهٔ همراه خود را وارد کنید. کد ملی دریافت یا ذخیره نمی‌شود."}
        </p>
        {!codeSent ? (
          <form className="details-form" onSubmit={requestCode} noValidate>
            <label htmlFor="auth-mobile">
              شمارهٔ همراه
              <input
                id="auth-mobile"
                value={toPersianDigits(mobile)}
                onChange={(event) =>
                  setMobile(normalizeDigits(event.target.value).replace(/\D/gu, "").slice(0, 13))
                }
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="۰۹۱۲۱۲۳۴۵۶۷"
                dir="ltr"
                required
                maxLength={16}
              />
            </label>
            {error && <p className="inline-error" role="alert">{error}</p>}
            <button className="primary-button" type="submit" disabled={busy || retryAfter > 0}>
              {busy ? "در حال ارسال…" : retryAfter > 0 ? `ارسال دوباره تا ${toPersianDigits(String(retryAfter))} ثانیه` : "ارسال کد پیامکی"}
              <ArrowLeft size={18} />
            </button>
          </form>
        ) : (
          <form className="details-form" onSubmit={verifyCode} noValidate>
            <p className="masked-line" dir="ltr">{toPersianDigits(mobile)}</p>
            <label htmlFor="auth-code">
              کد یک‌بارمصرف
              <input
                id="auth-code"
                value={toPersianDigits(code)}
                onChange={(event) =>
                  setCode(normalizeDigits(event.target.value).replace(/\D/gu, "").slice(0, 6))
                }
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="کد ۶ رقمی"
                dir="ltr"
                required
                minLength={6}
                maxLength={6}
              />
            </label>
            {debugCode && (
              <p className="auth-debug-code" role="status">
                کد آزمایشی محیط توسعه: <bdi dir="ltr">{toPersianDigits(debugCode)}</bdi>
              </p>
            )}
            {error && <p className="inline-error" role="alert">{error}</p>}
            <button className="primary-button" type="submit" disabled={busy || code.length !== 6}>
              {busy ? "در حال بررسی…" : "تأیید و ادامه"}
              <ArrowLeft size={18} />
            </button>
            <button
              className="text-button auth-resend"
              type="button"
              onClick={() => void requestCode()}
              disabled={busy || retryAfter > 0}
            >
              {retryAfter > 0
                ? `ارسال دوباره تا ${toPersianDigits(String(retryAfter))} ثانیه`
                : "ارسال دوبارهٔ کد"}
            </button>
            <button className="text-button auth-change-mobile" type="button" onClick={() => {
              setCodeSent(false);
              setCode("");
              setError("");
            }}>
              تغییر شمارهٔ همراه
            </button>
          </form>
        )}
        <p className="auth-switch">
          {purpose === "signup" ? "قبلاً حساب ساخته‌اید؟" : "حساب کاربری ندارید؟"}{" "}
          <Link href={purpose === "signup" ? "/login" : "/register"}>
            {purpose === "signup" ? "وارد شوید" : "ثبت‌نام کنید"}
          </Link>
        </p>
      </section>
    </main>
  );
}
