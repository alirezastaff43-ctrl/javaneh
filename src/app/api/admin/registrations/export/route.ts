import {
  adminForbiddenResponse,
  adminUnauthorizedResponse,
  getAdminActor,
  hasPermission,
  recordAdminAudit,
  redactAdminValue,
} from "@/lib/admin-auth";
import { z } from "zod";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_EXPORT_ROWS = 5_000;
const statusSchema = z.enum(["draft", "submitted"]);

function csvCell(value: unknown): string {
  let text = value === null || value === undefined
    ? ""
    : typeof value === "string"
      ? value
      : JSON.stringify(value);
  if (/^[\s]*[=+\-@]/u.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  const limited = await enforceApiRateLimit(request);
  if (limited) return limited;
  const actor = await getAdminActor(request);
  if (!actor) return adminUnauthorizedResponse();
  if (!hasPermission(actor, "registrations.export")) return adminForbiddenResponse();
  const personalRequested = new URL(request.url).searchParams.get("personal") === "1";
  if (personalRequested && !hasPermission(actor, "registrations.personal"))
    return adminForbiddenResponse();
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim().slice(0, 100) ?? "";
  const statusValue = url.searchParams.get("status");
  const status = statusValue && statusValue !== "all"
    ? statusSchema.safeParse(statusValue)
    : null;
  if (statusValue && statusValue !== "all" && !status?.success)
    return Response.json(
      { code: "invalid_filter", error: "فیلتر خروجی معتبر نیست." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );

  try {
    const where = {
      ...(status?.success ? { status: status.data } : {}),
      ...(query
        ? {
            data: {
              path: ["title"],
              string_contains: query,
              mode: "insensitive" as const,
            },
          }
        : {}),
    };
    const registrations = await prisma.structuredRegistration.findMany({
      where,
      include: {
        user: { select: { mobile: true } },
        workbooks: { select: { flow: true, status: true, answers: true, followups: true } },
        scoreAwards: { select: { awardKey: true, amount: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: MAX_EXPORT_ROWS + 1,
    });
    if (registrations.length > MAX_EXPORT_ROWS)
      return Response.json(
        { code: "export_too_large", error: "برای خروجی بزرگ‌تر، ابتدا جست‌وجو را محدود کنید." },
        { status: 413, headers: { "Cache-Control": "no-store" } },
      );

    const includePersonal = personalRequested;
    await recordAdminAudit({
      actorUserId: actor.id,
      action: includePersonal ? "admin.registration.export_personal" : "admin.registration.export",
      entityType: "registration_collection",
      metadata: {
        rowCount: registrations.length,
        personalData: includePersonal,
        filtered: Boolean(query || statusValue),
      },
    });
    const rows = registrations.map((registration) => {
      const data = includePersonal ? registration.data : redactAdminValue(registration.data);
      const workbooks = includePersonal
        ? registration.workbooks
        : redactAdminValue(registration.workbooks);
      return [
        registration.id,
        registration.status,
        registration.createdAt.toISOString(),
        registration.submittedAt?.toISOString() ?? "",
        includePersonal ? registration.user.mobile : "",
        data,
        workbooks,
        registration.scoreAwards,
      ].map(csvCell).join(",");
    });
    const csv = [
      ["registration_id", "status", "created_at", "submitted_at", "mobile", "data", "workbooks", "score_awards"]
        .map(csvCell).join(","),
      ...rows,
    ].join("\r\n");
    return new Response(`\uFEFF${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="javaneh-registrations.csv"',
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[admin] registration export failed", error instanceof Error ? error.name : "unknown");
    return Response.json(
      { code: "admin_export_failed", error: "خروجی در حال حاضر آماده نشد." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
