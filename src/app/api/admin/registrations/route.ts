import { z } from "zod";
import {
  adminForbiddenResponse,
  adminUnauthorizedResponse,
  getAdminActor,
  hasPermission,
  maskMobile,
  recordAdminAudit,
  redactAdminValue,
} from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pageSchema = z.coerce.number().int().min(1).max(100_000);
const statusSchema = z.enum(["draft", "submitted"]);
function getTitle(data: unknown): string {
  if (!data || typeof data !== "object" || Array.isArray(data)) return "";
  const title = "title" in data ? data.title : "";
  return typeof title === "string" ? title : "";
}

function noStore(payload: unknown, status = 200) {
  return Response.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const actor = await getAdminActor(request);
  if (!actor) return adminUnauthorizedResponse();
  if (!hasPermission(actor, "registrations.view")) return adminForbiddenResponse();

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (id && !z.string().uuid().safeParse(id).success)
    return noStore({ code: "invalid_registration", error: "شناسه ثبت معتبر نیست." }, 400);
  const query = url.searchParams.get("q")?.trim().slice(0, 100) ?? "";
  const statusValue = url.searchParams.get("status");
  const status = statusValue && statusValue !== "all"
    ? statusSchema.safeParse(statusValue)
    : null;
  const page = pageSchema.safeParse(url.searchParams.get("page") ?? "1");
  const includePersonalData = url.searchParams.get("personal") === "1";
  if ((statusValue && statusValue !== "all" && !status?.success) || !page.success)
    return noStore({ code: "invalid_filter", error: "فیلتر جست‌وجو معتبر نیست." }, 400);
  if (includePersonalData && (!id || !hasPermission(actor, "registrations.personal")))
    return adminForbiddenResponse();

  try {
    await recordAdminAudit({
      actorUserId: actor.id,
      action: id
        ? includePersonalData
          ? "admin.registration.personal_view"
          : "admin.registration.detail_view"
        : "admin.registration.search",
      entityType: id ? "registration" : "registration_collection",
      entityId: id,
      metadata: {
        personalData: Boolean(id && includePersonalData),
        filtered: Boolean(query || statusValue),
      },
    });

    if (id) {
      const registration = await prisma.structuredRegistration.findUnique({
        where: { id },
        include: {
          user: { select: { id: true, mobile: true } },
          workbooks: {
            select: { flow: true, status: true, step: true, answers: true, followups: true },
            orderBy: { flow: "asc" },
          },
          scoreAwards: { select: { awardKey: true, amount: true }, orderBy: { awardKey: "asc" } },
        },
      });
      if (!registration)
        return noStore({ code: "registration_not_found", error: "ثبت موردنظر پیدا نشد." }, 404);
      const data = includePersonalData
        ? registration.data
        : redactAdminValue(registration.data);
      const workbooks = includePersonalData
        ? registration.workbooks
        : redactAdminValue(registration.workbooks);
      return noStore({
        registration: {
          id: registration.id,
          status: registration.status,
          step: registration.step,
          activeFlow: registration.activeFlow,
          data,
          workbooks,
          scoreAwards: registration.scoreAwards,
          createdAt: registration.createdAt,
          updatedAt: registration.updatedAt,
          submittedAt: registration.submittedAt,
          owner: {
            id: registration.user.id,
            mobile: includePersonalData ? registration.user.mobile : maskMobile(registration.user.mobile),
          },
        },
      });
    }

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
    const take = 25;
    const [total, rows] = await Promise.all([
      prisma.structuredRegistration.count({ where }),
      prisma.structuredRegistration.findMany({
        where,
        select: {
          id: true,
          status: true,
          step: true,
          data: true,
          createdAt: true,
          updatedAt: true,
          submittedAt: true,
          user: { select: { id: true, mobile: true } },
        },
        orderBy: { updatedAt: "desc" },
        skip: (page.data - 1) * take,
        take,
      }),
    ]);
    return noStore({
      registrations: rows.map((row) => ({
        id: row.id,
        title: String(redactAdminValue(getTitle(row.data))),
        status: row.status,
        step: row.step,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        submittedAt: row.submittedAt,
        owner: {
          id: row.user.id,
          mobile: maskMobile(row.user.mobile),
        },
      })),
      page: page.data,
      pageSize: take,
      total,
    });
  } catch (error) {
    console.error("[admin] registration query failed", error instanceof Error ? error.name : "unknown");
    return noStore(
      { code: "admin_data_unavailable", error: "ثبت‌ها موقتاً در دسترس نیستند." },
      503,
    );
  }
}
