import { getAdminActor, adminForbiddenResponse, adminUnauthorizedResponse, hasPermission } from "@/lib/admin-auth";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limited = await enforceApiRateLimit(request);
  if (limited) return limited;
  const actor = await getAdminActor(request);
  if (!actor) return adminUnauthorizedResponse();
  if (!hasPermission(actor, "overview.view")) return adminForbiddenResponse();
  const now = new Date();
  const since7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const since30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  try {
    const [users, activeUsers, newUsers7Days, registrations, submitted, recentSubmissions, ideas] =
      await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { status: "active" } }),
        prisma.user.count({ where: { createdAt: { gte: since7Days } } }),
        prisma.structuredRegistration.count(),
        prisma.structuredRegistration.count({ where: { status: "submitted" } }),
        prisma.structuredRegistration.count({
          where: { status: "submitted", submittedAt: { gte: since30Days } },
        }),
        prisma.legacyIdea.count(),
      ]);

    return Response.json({
      users,
      activeUsers,
      newUsers7Days,
      registrations,
      submitted,
      drafts: registrations - submitted,
      recentSubmissions,
      legacyIdeas: ideas,
      generatedAt: now.toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[admin] overview failed", error instanceof Error ? error.name : "unknown");
    return Response.json(
      { code: "admin_data_unavailable", error: "گزارش‌ها موقتاً در دسترس نیستند." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
