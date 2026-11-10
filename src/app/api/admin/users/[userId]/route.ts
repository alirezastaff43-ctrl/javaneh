import { Prisma, UserRoleCode } from "@prisma/client";
import { z } from "zod";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import {
  adminForbiddenResponse,
  adminUnauthorizedResponse,
  getAdminActor,
  hasPermission,
  writeAdminAudit,
} from "@/lib/admin-auth";
import { hasSameOrigin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const editableRoles = Object.values(UserRoleCode) as [UserRoleCode, ...UserRoleCode[]];
const updateSchema = z.object({
  status: z.enum(["active", "suspended"]).optional(),
  roles: z.array(z.enum(editableRoles)).max(editableRoles.length).refine(
    (roles) => new Set(roles).size === roles.length,
  ).optional(),
}).strict().refine((value) => value.status !== undefined || value.roles !== undefined);
const MAX_BODY_BYTES = 4_096;

async function readBoundedBody(request: Request): Promise<string | null> {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) return null;
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const limited = await enforceApiRateLimit(request);
  if (limited) return limited;
  if (!hasSameOrigin(request))
    return Response.json(
      { code: "invalid_origin", error: "درخواست قابل تأیید نیست." },
      { status: 403 },
    );
  const actor = await getAdminActor(request);
  if (!actor) return adminUnauthorizedResponse();
  if (!hasPermission(actor, "users.status")) return adminForbiddenResponse();
  const { userId } = await context.params;
  if (!z.string().uuid().safeParse(userId).success)
    return Response.json({ code: "invalid_user", error: "کاربر معتبر نیست." }, { status: 400 });

  let input: z.infer<typeof updateSchema>;
  try {
    const body = await readBoundedBody(request);
    if (body === null)
      return Response.json(
        { code: "request_too_large", error: "حجم درخواست از حد مجاز بیشتر است." },
        { status: 413 },
      );
    input = updateSchema.parse(JSON.parse(body));
  } catch {
    return Response.json({ code: "invalid_update", error: "تغییر درخواستی معتبر نیست." }, { status: 400 });
  }
  const owner = actor.roles.includes("platform_owner");
  if (input.roles !== undefined && !hasPermission(actor, "users.roles"))
    return adminForbiddenResponse();
  if (!owner && input.status === undefined)
    return adminForbiddenResponse();
  if (userId === actor.id && input.status === "suspended")
    return Response.json(
      { code: "self_suspend_denied", error: "نمی‌توانید حساب خودتان را غیرفعال کنید." },
      { status: 409 },
    );
  if (input.roles?.includes("platform_owner") && !owner)
    return adminForbiddenResponse();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, status: true, roles: { select: { role: true } } },
      });
      if (!target) return null;

      const desiredRoles = input.roles;
      if (
        !owner &&
        target.roles.some(({ role }) => role === "platform_owner")
      )
        return { conflict: "owner_protected" as const };
      if (input.status === "suspended" && target.status === "active" &&
        target.roles.some(({ role }) => role === "platform_owner")) {
        const otherActiveOwners = await tx.userRole.count({
          where: {
            role: "platform_owner",
            userId: { not: userId },
            user: { status: "active" },
          },
        });
        if (otherActiveOwners === 0)
          return { conflict: "last_owner" as const };
      }
      if (desiredRoles) {
        const currentlyOwner = target.roles.some(({ role }) => role === "platform_owner");
        const remainsOwner = desiredRoles.includes("platform_owner");
        if (currentlyOwner && !remainsOwner) {
          const otherActiveOwners = await tx.userRole.count({
            where: {
              role: "platform_owner",
              userId: { not: userId },
              user: { status: "active" },
            },
          });
          if (otherActiveOwners === 0)
            return { conflict: "last_owner" as const };
        }
        await tx.userRole.deleteMany({ where: { userId } });
        if (desiredRoles.length)
          await tx.userRole.createMany({
            data: desiredRoles.map((role) => ({
              userId,
              role,
              assignedBy: actor.id,
            })),
          });
      }

      const updated = input.status
        ? await tx.user.update({
            where: { id: userId },
            data: { status: input.status },
            select: { id: true, status: true },
          })
        : { id: target.id, status: target.status };
      await writeAdminAudit(tx, {
        actorUserId: actor.id,
        subjectUserId: userId,
        action: desiredRoles ? "admin.user.roles_changed" : "admin.user.status_changed",
        entityType: "user",
        entityId: userId,
        metadata: {
          ...(input.status ? { previousStatus: target.status, status: input.status } : {}),
          ...(desiredRoles
            ? {
                previousRoles: target.roles.map(({ role }) => role),
                roles: desiredRoles,
              }
            : {}),
        },
      });
      return {
        user: {
          id: updated.id,
          status: updated.status,
          roles: desiredRoles ?? target.roles.map(({ role }) => role),
        },
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (!result)
      return Response.json({ code: "user_not_found", error: "کاربر پیدا نشد." }, { status: 404 });
    if ("conflict" in result)
      return Response.json(
        {
          code: result.conflict === "last_owner" ? "last_owner_required" : "owner_protected",
          error: result.conflict === "last_owner"
            ? "سامانه باید دست‌کم یک مالک فعال داشته باشد."
            : "تغییر حساب مالک فقط توسط مالک سامانه مجاز است.",
        },
        { status: 409 },
      );
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    )
      return Response.json(
        { code: "admin_update_conflict", error: "تغییر هم‌زمان انجام شد؛ دوباره تلاش کنید." },
        { status: 409 },
      );
    console.error("[admin] user update failed", error instanceof Error ? error.name : "unknown");
    return Response.json(
      { code: "admin_update_failed", error: "تغییر کاربر انجام نشد." },
      { status: 503 },
    );
  }
}
