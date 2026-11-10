import { getAdminActor, adminForbiddenResponse, adminUnauthorizedResponse, hasPermission } from "@/lib/admin-auth";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { prisma } from "@/lib/prisma";
import { maskMobile } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limited = await enforceApiRateLimit(request);
  if (limited) return limited;
  const actor = await getAdminActor(request);
  if (!actor) return adminUnauthorizedResponse();
  if (!hasPermission(actor, "audit.view")) return adminForbiddenResponse();
  const pageValue = Number(new URL(request.url).searchParams.get("page") ?? "1");
  if (!Number.isSafeInteger(pageValue) || pageValue < 1 || pageValue > 100_000)
    return Response.json({ code: "invalid_page", error: "صفحه معتبر نیست." }, { status: 400 });

  try {
    const take = 50;
    const [total, events] = await Promise.all([
      prisma.auditEvent.count(),
      prisma.auditEvent.findMany({
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          occurredAt: true,
          metadata: true,
          actor: { select: { mobile: true } },
          subject: { select: { mobile: true } },
        },
        orderBy: { occurredAt: "desc" },
        skip: (pageValue - 1) * take,
        take,
      }),
    ]);
    return Response.json({
      events: events.map((event) => ({
        id: event.id,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        occurredAt: event.occurredAt,
        metadata: event.metadata,
        actor: event.actor ? maskMobile(event.actor.mobile) : "سامانه",
        subject: event.subject ? maskMobile(event.subject.mobile) : null,
      })),
      page: pageValue,
      pageSize: take,
      total,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[admin] audit query failed", error instanceof Error ? error.name : "unknown");
    return Response.json(
      { code: "audit_unavailable", error: "گزارش ممیزی در دسترس نیست." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
