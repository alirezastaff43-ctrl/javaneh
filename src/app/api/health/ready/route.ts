import { NextResponse } from "next/server";
import { getApprovedProviderUrl } from "@/lib/internal-provider-url";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!process.env.DATABASE_URL)
    return NextResponse.json({ status: "not-ready" }, { status: 503 });

  try {
    await prisma.$queryRaw`SELECT 1`;
    if (process.env.NODE_ENV === "production") {
      const otpSecret = process.env.AUTH_OTP_SECRET?.trim() ?? "";
      const smsUrl = process.env.SMS_PROVIDER_URL?.trim() ?? "";
      const smsKey = process.env.SMS_PROVIDER_API_KEY?.trim() ?? "";
      if (
        otpSecret.length < 32 ||
        otpSecret.toLowerCase().includes("replace-with") ||
        !smsKey ||
        !getApprovedProviderUrl(smsUrl)
      )
        return NextResponse.json(
          { status: "not-ready", database: "ok", authentication: "not-configured" },
          { status: 503 },
        );
    }
    return NextResponse.json({ status: "ready", database: "ok" });
  } catch {
    return NextResponse.json({ status: "not-ready" }, { status: 503 });
  }
}