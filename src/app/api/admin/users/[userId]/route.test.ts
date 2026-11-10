import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminRole } from "@/lib/admin-permissions";
import { getAdminActor, writeAdminAudit } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { PATCH } from "./route";

vi.mock("@/lib/admin-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin-auth")>();
  return {
    ...actual,
    getAdminActor: vi.fn(),
    writeAdminAudit: vi.fn(),
  };
});

const tx = {
  user: { findUnique: vi.fn(), update: vi.fn() },
  userRole: { count: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)),
  },
}));

const userActor = (role: AdminRole) => ({
  id: "00000000-0000-4000-8000-000000000001",
  mobile: "+989121234567",
  fullName: null,
  roles: [role],
});
const targetId = "00000000-0000-4000-8000-000000000002";

function patch(role: AdminRole, body: unknown) {
  vi.mocked(getAdminActor).mockResolvedValue(userActor(role));
  return PATCH(
    new Request(`http://localhost/api/admin/users/${targetId}`, {
      method: "PATCH",
      headers: { Origin: "http://localhost", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ userId: targetId }) },
  );
}

describe("admin user update API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.user.findUnique.mockResolvedValue({
      id: targetId,
      status: "active",
      roles: [{ role: "registration_manager" }],
    });
    tx.userRole.count.mockResolvedValue(1);
    tx.userRole.deleteMany.mockResolvedValue({ count: 1 });
    tx.userRole.createMany.mockResolvedValue({ count: 1 });
    tx.user.update.mockResolvedValue({ id: targetId, status: "suspended" });
  });

  it("allows support to change user status but not roles", async () => {
    expect((await patch("support", { roles: ["read_only"] })).status).toBe(403);
    const response = await patch("support", { status: "suspended" });
    expect(response.status).toBe(200);
    expect(writeAdminAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "admin.user.status_changed" }),
    );
  });

  it("requires same-origin writes", async () => {
    vi.mocked(getAdminActor).mockResolvedValue(userActor("platform_owner"));
    const response = await PATCH(
      new Request(`http://localhost/api/admin/users/${targetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "suspended" }),
      }),
      { params: Promise.resolve({ userId: targetId }) },
    );
    expect(response.status).toBe(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("protects the last active platform owner from role removal or suspension", async () => {
    tx.user.findUnique.mockResolvedValue({
      id: targetId,
      status: "active",
      roles: [{ role: "platform_owner" }],
    });
    tx.userRole.count.mockResolvedValue(0);

    expect((await patch("platform_owner", { roles: [] })).status).toBe(409);
    expect((await patch("platform_owner", { status: "suspended" })).status).toBe(409);
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it("audits owner role changes with previous and resulting role sets", async () => {
    const response = await patch("platform_owner", {
      roles: ["registration_manager", "read_only"],
    });
    expect(response.status).toBe(200);
    expect(writeAdminAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "admin.user.roles_changed",
        metadata: {
          previousRoles: ["registration_manager"],
          roles: ["registration_manager", "read_only"],
        },
      }),
    );
  });
});
