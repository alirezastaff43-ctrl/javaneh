import { NextResponse } from "next/server";
import {
  getAuthenticatedUser,
  hasSameOrigin,
  unauthorizedResponse,
} from "@/lib/auth";
import {
  loadUserData,
  normalizeIncomingData,
  saveUserData,
  SnapshotConflictError,
} from "@/lib/user-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_SNAPSHOT_BYTES = 1_000_000;

async function readBoundedBody(request: Request): Promise<string | null> {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_SNAPSHOT_BYTES)
    return null;
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_SNAPSHOT_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorizedResponse();
  try {
    return NextResponse.json(await loadUserData(user.id), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error(
      "[data] user data load failed",
      error instanceof Error ? error.name : "unknown",
    );
    return NextResponse.json(
      { code: "data_unavailable", error: "اطلاعات شما موقتاً بارگذاری نشد." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function PUT(request: Request) {
  if (!hasSameOrigin(request))
    return NextResponse.json({ error: "درخواست قابل تأیید نیست." }, { status: 403 });
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorizedResponse();

  let snapshot: ReturnType<typeof normalizeIncomingData>;
  try {
    const body = await readBoundedBody(request);
    if (body === null)
      return NextResponse.json(
        { code: "snapshot_too_large", error: "حجم اطلاعات از حد مجاز بیشتر است." },
        { status: 413 },
      );
    snapshot = normalizeIncomingData(JSON.parse(body));
  } catch {
    return NextResponse.json(
      { code: "invalid_snapshot", error: "اطلاعات ثبت‌شده معتبر نیست." },
      { status: 400 },
    );
  }

  try {
    const version = await saveUserData(user.id, snapshot);
    return NextResponse.json({ ok: true, version }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof SnapshotConflictError)
      return NextResponse.json(
        {
          code: "snapshot_conflict",
          error: "اطلاعات در دستگاه دیگری تغییر کرده است؛ صفحه را دوباره بارگذاری کنید.",
        },
        { status: 409 },
      );
    if (error instanceof Error && error.message === "ownership_conflict")
      return NextResponse.json(
        { code: "ownership_conflict", error: "دسترسی به این اطلاعات مجاز نیست." },
        { status: 403 },
      );
    console.error(
      "[data] user data save failed",
      error instanceof Error ? error.name : "unknown",
    );
    return NextResponse.json(
      { code: "data_save_failed", error: "ذخیرهٔ اطلاعات انجام نشد؛ دوباره تلاش کنید." },
      { status: 503 },
    );
  }
}
