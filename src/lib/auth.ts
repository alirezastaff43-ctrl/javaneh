import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

export type AuthenticatedUser = {
  id: string;
  mobile: string;
  fullName: string | null;
};

export function sessionCookieName() {
  return process.env.NODE_ENV === "production"
    ? "__Host-javaneh_session"
    : "javaneh_session";
}

function sessionTokenFromHeader(cookieHeader: string | null): string | null {
  const name = sessionCookieName();
  for (const part of cookieHeader?.split(";") ?? []) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    const value = part.slice(separator + 1).trim();
    return value || null;
  }
  return null;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function getAuthenticatedUser(
  request?: Request,
): Promise<AuthenticatedUser | null> {
  let token: string | null;
  if (request) {
    token = sessionTokenFromHeader(request.headers.get("cookie"));
  } else {
    token = (await cookies()).get(sessionCookieName())?.value ?? null;
  }
  if (!token || !/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null;

  const tokenHash = hashToken(token);
  const session = await prisma.authSession.findUnique({
    where: { tokenHash },
    select: {
      userId: true,
      expiresAt: true,
      lastUsedAt: true,
      user: { select: { id: true, mobile: true, fullName: true, status: true } },
    },
  });
  if (!session) return null;
  const now = new Date();
  if (session.expiresAt <= now || session.user.status !== "active") {
    await prisma.authSession.deleteMany({ where: { tokenHash } });
    return null;
  }
  if (now.getTime() - session.lastUsedAt.getTime() >= 15 * 60 * 1000)
    await prisma.authSession.update({
      where: { tokenHash },
      data: { lastUsedAt: now },
    });

  return {
    id: session.user.id,
    mobile: session.user.mobile,
    fullName: session.user.fullName,
  };
}

export function unauthorizedResponse() {
  return NextResponse.json(
    { code: "authentication_required", error: "برای ادامه ابتدا وارد شوید." },
    { status: 401 },
  );
}

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function sessionTokenHash(token: string): string {
  return hashToken(token);
}

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(sessionCookieName(), token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(sessionCookieName(), "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export function sessionExpiry(now = new Date()): Date {
  return new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);
}

export function hasSameOrigin(request: Request): boolean {
  const originHeader = request.headers.get("origin");
  if (!originHeader || originHeader === "null") return false;
  try {
    const requestUrl = new URL(request.url);
    const host = request.headers.get("host")?.trim() || requestUrl.host;
    const forwardedProto = request.headers
      .get("x-forwarded-proto")
      ?.split(",")[0]
      ?.trim()
      .toLowerCase();
    const protocol = forwardedProto
      ? `${forwardedProto}:`
      : requestUrl.protocol;
    if (protocol !== "http:" && protocol !== "https:") return false;
    return new URL(originHeader).origin === new URL(`${protocol}//${host}`).origin;
  } catch {
    return false;
  }
}
