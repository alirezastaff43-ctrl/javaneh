import { NextResponse } from "next/server";
import { configuredMaxRequestsPerMinute } from "@/lib/api-rate-limit";
import { getApprovedProviderUrl } from "@/lib/internal-provider-url";
import { getProviderConfiguration } from "@/lib/provider";
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
      const aiProvider = getProviderConfiguration();
      const speechApiUrl = process.env.BINAVIRA_API_BASE_URL?.trim() ?? "";
      const speechFilesUrl = process.env.BINAVIRA_FILES_BASE_URL?.trim() ?? "";
      const speechToken = process.env.BINAVIRA_API_TOKEN?.trim() ?? "";
      if (
        configuredMaxRequestsPerMinute() === null ||
        otpSecret.length < 32 ||
        otpSecret.toLowerCase().includes("replace-with") ||
        !smsKey ||
        !getApprovedProviderUrl(smsUrl) ||
        !("configuration" in aiProvider) ||
        !speechToken ||
        !getApprovedProviderUrl(speechApiUrl) ||
        !getApprovedProviderUrl(speechFilesUrl)
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