import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/login" || pathname === "/register") return NextResponse.next();

  const cookieName =
    process.env.NODE_ENV === "production"
      ? "__Host-javaneh_session"
      : "javaneh_session";
  if (request.cookies.has(cookieName)) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!api/|_next/|favicon.ico|.*\\..*).*)"],
};
