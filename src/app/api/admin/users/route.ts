import { z } from "zod";
import {
  adminForbiddenResponse,
  adminUnauthorizedResponse,
  getAdminActor,
  hasPermission,
  maskMobile,
  recordAdminAudit,
} from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { normalizeDigits } from "@/lib/locale";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const pageSchema = z.coerce.number().int().min(1).max(100_000);

export async function GET(request: Request) {
  const actor = await getAdminActor(request);
  if (!actor) return adminUnauthorizedResponse();
  if (!hasPermission(actor, "users.view")) return adminForbiddenResponse();

  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim().slice(0, 40) ?? "";
  const page = pageSchema.safeParse(url.searchParams.get("page") ?? "1");
  const reveal = url.searchParams.get("reveal") === "1";
  const owner = actor.roles.includes("platform_owner");
  if (!page.success || (query.length > 0 && query.length < 3))
    return Response.json(
      { code: "invalid_filter", error: "برای جست‌وجو دست‌کم ۳ نویسه وارد کنید." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  if (reveal && !hasPermission(actor, "users.personal")) return adminForbiddenResponse();

  try {
    await recordAdminAudit({
      actorUserId: actor.id,
      action: reveal ? "admin.user.personal_view" : "admin.user.search",
      entityType: "user_collection",
      metadata: { searched: Boolean(query), personalData: reveal },
    });
    const digits = normalizeDigits(query).replace(/[\s()-]/gu, "");
    const mobileQuery = digits.startsWith("09")
      ? `+98${digits.slice(1)}`
      : digits.startsWith("9") && digits.length <= 10
        ? `+98${digits}`
        : digits;
    const where = query
      ? { mobile: { contains: mobileQuery, mode: "insensitive" as const } }
      : {};
    const take = 25;
    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: {
          id: true,
          mobile: true,
          fullName: true,
          status: true,
          mobileVerifiedAt: true,
          createdAt: true,
          ...(owner ? { roles: { select: { role: true } } } : {}),
        },
        orderBy: { createdAt: "desc" },
        skip: (page.data - 1) * take,
        take,
      }),
    ]);

    return Response.json({
      users: users.map((user) => ({
        id: user.id,
        mobile: reveal && owner ? user.mobile : maskMobile(user.mobile),
        ...(reveal && owner ? { fullName: user.fullName } : {}),
        status: user.status,
        mobileVerified: Boolean(user.mobileVerifiedAt),
        createdAt: user.createdAt,
        ...("roles" in user
          ? { roles: user.roles.map(({ role }) => role) }
          : {}),
      })),
      page: page.data,
      pageSize: take,
      total,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[admin] user query failed", error instanceof Error ? error.name : "unknown");
    return Response.json(
      { code: "admin_data_unavailable", error: "کاربران موقتاً در دسترس نیستند." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
