import { NextResponse } from "next/server";

const BINAVIRA_API = "https://binavira.ir/api";
const BINAVIRA_FILES = "https://binavira.ir/files";
const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_AUDIO_BYTES + 1024 * 1024;
const MAX_PROCESSING_MS = 45_000;
const POLL_INTERVAL_MS = 1_000;

export const maxDuration = 60;

function failure(code: string, error: string, status: number) {
  return NextResponse.json({ code, error }, { status });
}

function providerFailure(status: number) {
  if (status === 400)
    return failure(
      "invalid_audio",
      "فایل صوتی قابل پردازش نیست؛ با صدای واضح دوباره ضبط کنید.",
      400,
    );
  if (status === 401 || status === 403)
    return failure(
      "speech_authentication",
      "اتصال گفتار به متن نیاز به بررسی توکن یا اعتبار حساب دارد.",
      502,
    );
  if (status === 429)
    return failure(
      "speech_rate_limited",
      "درخواست‌های گفتار به متن زیاد شده‌اند؛ کمی بعد دوباره تلاش کنید.",
      429,
    );
  return failure(
    "speech_unavailable",
    "سرویس گفتار به متن موقتاً پاسخ نداد؛ دوباره تلاش کنید.",
    502,
  );
}

async function readJson(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const payload: unknown = await response.json();
    return payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

async function readTranscript(response: Response): Promise<string | null> {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > 500_000) return null;
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > 500_000) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const text = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    text.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(text).trim();
}

async function transcribeLongAudio(jobId: string, token: string) {
  const deadline = Date.now() + MAX_PROCESSING_MS;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    let statusResponse: Response;
    try {
      statusResponse = await fetch(`${BINAVIRA_API}/stt/status`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ job_id: jobId }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      return failure(
        "speech_unavailable",
        "پیگیری تبدیل فایل صوتی ناموفق بود؛ دوباره تلاش کنید.",
        502,
      );
    }
    if (!statusResponse.ok) return providerFailure(statusResponse.status);

    const statusPayload = await readJson(statusResponse);
    if (statusPayload?.status === "failed")
      return failure(
        "transcription_failed",
        "تبدیل فایل صوتی انجام نشد؛ با ضبط کوتاه‌تر دوباره تلاش کنید.",
        422,
      );
    if (statusPayload?.status !== "completed") continue;

    let transcriptResponse: Response;
    try {
      transcriptResponse = await fetch(
        `${BINAVIRA_FILES}/stt-text/${encodeURIComponent(jobId)}.txt`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(10_000),
        },
      );
    } catch {
      return failure(
        "speech_unavailable",
        "دریافت متن تبدیل‌شده ناموفق بود؛ دوباره تلاش کنید.",
        502,
      );
    }
    if (!transcriptResponse.ok)
      return providerFailure(transcriptResponse.status);
    const text = await readTranscript(transcriptResponse);
    if (text === null)
      return failure(
        "transcription_too_large",
        "متن صوت طولانی است؛ لطفاً آن را کوتاه‌تر ضبط کنید.",
        413,
      );
    if (!text)
      return failure(
        "empty_transcription",
        "گفتاری تشخیص داده نشد؛ دوباره با صدای واضح ضبط کنید.",
        422,
      );
    return NextResponse.json({ text });
  }
  return failure(
    "transcription_timeout",
    "تبدیل فایل صوتی بیش از حد طول کشید؛ دوباره تلاش کنید.",
    504,
  );
}

export async function POST(request: Request) {
  const token = process.env.BINAVIRA_API_TOKEN?.trim();
  if (!token)
    return failure(
      "speech_not_configured",
      "توکن گفتار به متن تنظیم نشده است. آن را در فایل تنظیمات محیط وارد کنید.",
      503,
    );

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES)
    return failure(
      "audio_too_large",
      "حجم فایل صوتی باید کمتر از ۵۰ مگابایت باشد.",
      413,
    );

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return failure("invalid_audio", "فایل صوتی در درخواست پیدا نشد.", 400);
  }
  const audio = formData.get("audio");
  if (!(audio instanceof File) || audio.size === 0)
    return failure("invalid_audio", "یک فایل صوتی معتبر انتخاب کنید.", 400);
  if (audio.size > MAX_AUDIO_BYTES)
    return failure(
      "audio_too_large",
      "حجم فایل صوتی باید کمتر از ۵۰ مگابایت باشد.",
      413,
    );
  if (audio.type && !audio.type.startsWith("audio/"))
    return failure("invalid_audio", "قالب فایل صوتی پشتیبانی نمی‌شود.", 400);

  const upstreamForm = new FormData();
  upstreamForm.append("audio", audio, audio.name || "recording.webm");
  upstreamForm.append("source", "web");

  let upstream: Response;
  try {
    upstream = await fetch(`${BINAVIRA_API}/stt`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: upstreamForm,
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    return failure(
      "speech_unavailable",
      "ارتباط با سرویس گفتار به متن برقرار نشد؛ دوباره تلاش کنید.",
      502,
    );
  }
  if (!upstream.ok) return providerFailure(upstream.status);

  const payload = await readJson(upstream);
  if (typeof payload?.response === "string" && payload.response.trim())
    return NextResponse.json({ text: payload.response.trim() });
  if (typeof payload?.job_id === "string" && payload.job_id.trim())
    return transcribeLongAudio(payload.job_id.trim(), token);
  return failure(
    "invalid_speech_response",
    "پاسخ سرویس گفتار به متن قابل استفاده نبود.",
    502,
  );
}