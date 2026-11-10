import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminRole } from "@/lib/admin-permissions";
import { getAdminActor, recordAdminAudit } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { GET } from "./route";

vi.mock("@/lib/admin-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin-auth")>();
  return {
    ...actual,
    getAdminActor: vi.fn(),
    recordAdminAudit: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    structuredRegistration: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

const actor = (role: AdminRole) => ({
  id: "00000000-0000-4000-8000-000000000001",
  mobile: "+989121234567",
  fullName: null,
  roles: [role],
});

function request(path: string) {
  return GET(new Request(`http://localhost/api/admin/registrations${path}`));
}

describe("admin registrations API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(["platform_owner", "registration_manager", "read_only", "analyst"] as const)(
    "allows %s to search and review non-contact data",
    async (role) => {
      vi.mocked(getAdminActor).mockResolvedValue(actor(role));
      vi.mocked(prisma.structuredRegistration.count).mockResolvedValue(1);
      vi.mocked(prisma.structuredRegistration.findMany).mockResolvedValue([{
        id: "00000000-0000-4000-8000-000000000002",
        status: "submitted",
        step: "complete",
        data: { title: "طرح محله", fullName: "نام خصوصی", email: "private@example.test" },
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-02T00:00:00Z"),
        submittedAt: new Date("2026-01-02T00:00:00Z"),
        user: { id: "00000000-0000-4000-8000-000000000003", mobile: "+989121234567" },
      }] as never);

      const response = await request("?q=طرح");
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.registrations[0].title).toBe("طرح محله");
      expect(body.registrations[0].owner.mobile).toContain("••••••");
      expect(JSON.stringify(body)).not.toContain("private@example.test");
      expect(recordAdminAudit).toHaveBeenCalledWith(expect.objectContaining({
        action: "admin.registration.search",
        actorUserId: actor(role).id,
      }));
    },
  );

  it("denies support access to registration content", async () => {
    vi.mocked(getAdminActor).mockResolvedValue(actor("support"));
    const response = await request("");
    expect(response.status).toBe(403);
    expect(prisma.structuredRegistration.findMany).not.toHaveBeenCalled();
  });

  it("returns forbidden for an authenticated user without an admin role", async () => {
    vi.mocked(getAdminActor).mockResolvedValue({
      ...actor("read_only"),
      roles: [],
    });
    const response = await request("");
    expect(response.status).toBe(403);
    expect(prisma.structuredRegistration.findMany).not.toHaveBeenCalled();
  });

  it("requires the owner role for personal data and audits explicit reveal", async () => {
    vi.mocked(getAdminActor).mockResolvedValue(actor("registration_manager"));
    expect((await request("?id=00000000-0000-4000-8000-000000000002&personal=1")).status).toBe(403);

    vi.mocked(getAdminActor).mockResolvedValue(actor("platform_owner"));
    vi.mocked(prisma.structuredRegistration.findUnique).mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000002",
      status: "submitted",
      step: "complete",
      activeFlow: "dashboard",
      data: { fullName: "نام خصوصی", email: "private@example.test" },
      workbooks: [],
      scoreAwards: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      submittedAt: new Date(),
      user: { id: "00000000-0000-4000-8000-000000000003", mobile: "+989121234567" },
    } as never);
    const response = await request("?id=00000000-0000-4000-8000-000000000002&personal=1");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.registration.data.email).toBe("private@example.test");
    expect(body.registration.owner.mobile).toBe("+989121234567");
    expect(recordAdminAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "admin.registration.personal_view",
      metadata: { personalData: true, filtered: false },
    }));
  });
});
