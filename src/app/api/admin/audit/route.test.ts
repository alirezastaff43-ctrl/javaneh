import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminRole } from "@/lib/admin-permissions";
import { getAdminActor } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { GET } from "./route";

vi.mock("@/lib/admin-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin-auth")>();
  return { ...actual, getAdminActor: vi.fn() };
});
vi.mock("@/lib/prisma", () => ({
  prisma: { auditEvent: { count: vi.fn(), findMany: vi.fn() } },
}));

const actor = (role: AdminRole) => ({
  id: "00000000-0000-4000-8000-000000000001",
  mobile: "+989121234567",
  fullName: null,
  roles: [role],
});

describe("admin audit API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is restricted to owners", async () => {
    for (const role of [
      "registration_manager",
      "support",
      "read_only",
      "analyst",
    ] as const) {
      vi.mocked(getAdminActor).mockResolvedValue(actor(role));
      expect((await GET(new Request("http://localhost/api/admin/audit"))).status).toBe(403);
    }
    expect(prisma.auditEvent.findMany).not.toHaveBeenCalled();
  });

  it("returns owner audit records with masked actor and subject identities", async () => {
    vi.mocked(getAdminActor).mockResolvedValue(actor("platform_owner"));
    vi.mocked(prisma.auditEvent.count).mockResolvedValue(1);
    vi.mocked(prisma.auditEvent.findMany).mockResolvedValue([{
      id: "event-id",
      action: "admin.user.roles_changed",
      entityType: "user",
      entityId: "user-id",
      occurredAt: new Date("2026-01-01T00:00:00Z"),
      metadata: { roles: ["support"] },
      actor: { mobile: "+989121234567" },
      subject: { mobile: "+989121111111" },
    }] as never);
    const response = await GET(new Request("http://localhost/api/admin/audit"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.events[0].actor).not.toBe("+989121234567");
    expect(body.events[0].subject).not.toBe("+989121111111");
  });
});
