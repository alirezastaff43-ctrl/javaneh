import { NextResponse } from "next/server";
import {
  clearSessionCookie,
  getAuthenticatedUser,
  hasSameOrigin,
  sessionCookieName,
  sessionTokenHash,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!hasSameOrigin(request))
    return NextResponse.json({ error: "درخواست قابل تأیید نیست." }, { status: 403 });

  const user = await getAuthenticatedUser(request);
  const token = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${sessionCookieName()}=`))
    ?.slice(sessionCookieName().length + 1);
  if (user && token)
    await prisma.authSession.deleteMany({
      where: { userId: user.id, tokenHash: sessionTokenHash(token) },
    });

  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
