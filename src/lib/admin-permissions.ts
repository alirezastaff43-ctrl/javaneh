export type AdminRole =
  | "platform_owner"
  | "registration_manager"
  | "support"
  | "analyst"
  | "read_only";

export type AdminPermission =
  | "overview.view"
  | "registrations.view"
  | "registrations.export"
  | "registrations.personal"
  | "users.view"
  | "users.personal"
  | "users.status"
  | "users.roles"
  | "audit.view";
export type AdminSection = "overview" | "registrations" | "users" | "audit";

const rolePermissions: Record<AdminRole, readonly AdminPermission[]> = {
  platform_owner: [
    "overview.view",
    "registrations.view",
    "registrations.export",
    "registrations.personal",
    "users.view",
    "users.personal",
    "users.status",
    "users.roles",
    "audit.view",
  ],
  registration_manager: [
    "overview.view",
    "registrations.view",
    "registrations.export",
  ],
  support: ["overview.view", "users.view", "users.status"],
  analyst: ["overview.view", "registrations.view"],
  read_only: ["overview.view", "registrations.view"],
};

export function hasAdminPermission(
  roles: readonly AdminRole[],
  permission: AdminPermission,
): boolean {
  return roles.some((role) => rolePermissions[role]?.includes(permission));
}

export function adminSectionsForRoles(roles: readonly AdminRole[]): AdminSection[] {
  if (roles.length === 0) return [];
  const sections: AdminSection[] = ["overview"];
  if (hasAdminPermission(roles, "registrations.view")) sections.push("registrations");
  if (hasAdminPermission(roles, "users.view")) sections.push("users");
  if (hasAdminPermission(roles, "audit.view")) sections.push("audit");
  return sections;
}
