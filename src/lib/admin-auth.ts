import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { Prisma as PrismaNamespace, UserRoleCode } from "@prisma/client";
import { getAuthenticatedUser, type AuthenticatedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasAdminPermission, type AdminPermission } from "@/lib/admin-permissions";

export type AdminRole = UserRoleCode;
export { adminSectionsForRoles, hasAdminPermission } from "@/lib/admin-permissions";

export type AdminActor = AuthenticatedUser & {
  roles: AdminRole[];
};

export async function getAdminActor(request?: Request): Promise<AdminActor | null> {
  const user = await getAuthenticatedUser(request);
  if (!user) return null;
  const roleRows = await prisma.userRole.findMany({
    where: { userId: user.id },
    select: { role: true },
  });
  return { ...user, roles: roleRows.map(({ role }) => role) };
}

export function hasAdminRole(
  actor: AdminActor,
  allowed: readonly AdminRole[],
): boolean {
  return actor.roles.some((role) => allowed.includes(role));
}

export function hasPermission(actor: AdminActor, permission: AdminPermission) {
  return hasAdminPermission(actor.roles, permission);
}

export function adminForbiddenResponse() {
  return Response.json(
    { code: "admin_forbidden", error: "این عملیات برای نقش شما مجاز نیست." },
    { status: 403, headers: { "Cache-Control": "no-store" } },
  );
}

export function adminUnauthorizedResponse() {
  return Response.json(
    { code: "authentication_required", error: "برای ادامه ابتدا وارد شوید." },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
}

export type AdminAuditAction = {
  actorUserId: string | null;
  subjectUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonObject;
};

export async function writeAdminAudit(
  tx: PrismaNamespace.TransactionClient,
  event: AdminAuditAction,
) {
  await tx.auditEvent.create({
    data: {
      id: randomUUID(),
      actorUserId: event.actorUserId,
      subjectUserId: event.subjectUserId ?? null,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId ?? null,
      metadata: event.metadata ?? Prisma.JsonNull,
    },
  });
}

export async function recordAdminAudit(event: AdminAuditAction) {
  await prisma.$transaction((tx) => writeAdminAudit(tx, event));
}

export function maskMobile(mobile: string): string {
  const digits = mobile.replace(/\D/gu, "");
  return `••••••${digits.slice(-4)}`;
}

export function redactAdminValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value
      .replace(/[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu, "[حذف‌شده]")
      .replace(/[+]?\p{Nd}[\p{Nd}\s().-]*\p{Nd}/gu, (match) =>
        (match.match(/\p{Nd}/gu)?.length ?? 0) >= 6 ? "[حذف‌شده]" : match,
      );
  }
  if (Array.isArray(value)) return value.map(redactAdminValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !/^(?:full.?name|name|email|mobile|phone|national.?id|نام(?:.?خانوادگی)?|ایمیل|تلفن|موبایل|کد.?ملی|شماره.?همراه)$/iu.test(key))
      .map(([key, item]) => [key, redactAdminValue(item)]),
  );
}
