import { describe, expect, it } from "vitest";
import {
  adminSectionsForRoles,
  hasAdminPermission,
  type AdminRole,
} from "./admin-permissions";

const roles: AdminRole[] = [
  "platform_owner",
  "registration_manager",
  "support",
  "read_only",
  "analyst",
];

describe("admin role permissions", () => {
  it.each(roles)("limits %s to its assigned UI sections and API capabilities", (role) => {
    const expected = {
      platform_owner: {
        sections: ["overview", "registrations", "users", "audit"],
        permissions: [
          "registrations.export",
          "registrations.personal",
          "users.personal",
          "users.roles",
          "users.status",
          "audit.view",
        ],
      },
      registration_manager: {
        sections: ["overview", "registrations"],
        permissions: ["registrations.export"],
      },
      support: {
        sections: ["overview", "users"],
        permissions: ["users.status"],
      },
      read_only: {
        sections: ["overview", "registrations"],
        permissions: [],
      },
      analyst: {
        sections: ["overview", "registrations"],
        permissions: [],
      },
    }[role];

    expect(adminSectionsForRoles([role])).toEqual(expected.sections);
    for (const permission of [
      "registrations.export",
      "registrations.personal",
      "users.personal",
      "users.roles",
      "users.status",
      "audit.view",
    ] as const)
      expect(hasAdminPermission([role], permission)).toBe(
        (expected.permissions as readonly string[]).includes(permission),
      );
  });

  it("does not grant admin access to a role-less user", () => {
    expect(adminSectionsForRoles([])).toEqual([]);
    expect(hasAdminPermission([], "overview.view")).toBe(false);
  });
});
