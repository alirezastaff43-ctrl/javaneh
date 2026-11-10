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
  prisma: { user: { count: vi.fn(), findMany: vi.fn() } },
}));

const userActor = (role: AdminRole) => ({
  id: "00000000-0000-4000-8000-000000000001",
  mobile: "+989121234567",
  fullName: null,
  roles: [role],
});

describe("admin users API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("allows support user lookup but always masks contact information", async () => {
    vi.mocked(getAdminActor).mockResolvedValue(userActor("support"));
    vi.mocked(prisma.user.count).mockResolvedValue(1);
    vi.mocked(prisma.user.findMany).mockResolvedValue([{
      id: "00000000-0000-4000-8000-000000000002",
      mobile: "+989121234567",
      fullName: "نام خصوصی",
      status: "active",
      mobileVerifiedAt: new Date(),
      createdAt: new Date(),
    }] as never);
    const response = await GET(new Request("http://localhost/api/admin/users"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.users[0].mobile).not.toBe("+989121234567");
    expect(body.users[0].fullName).toBeUndefined();
  });

  it("denies user lookup to read-only roles and personal reveal to support", async () => {
    vi.mocked(getAdminActor).mockResolvedValue(userActor("read_only"));
    expect((await GET(new Request("http://localhost/api/admin/users"))).status).toBe(403);
    vi.mocked(getAdminActor).mockResolvedValue(userActor("support"));
    expect((await GET(new Request("http://localhost/api/admin/users?reveal=1"))).status).toBe(403);
  });

  it("audits owner-only personal data reveal", async () => {
    vi.mocked(getAdminActor).mockResolvedValue(userActor("platform_owner"));
    vi.mocked(prisma.user.count).mockResolvedValue(1);
    vi.mocked(prisma.user.findMany).mockResolvedValue([{
      id: "00000000-0000-4000-8000-000000000002",
      mobile: "+989121234567",
      fullName: "نام خصوصی",
      status: "active",
      mobileVerifiedAt: new Date(),
      createdAt: new Date(),
      roles: [{ role: "registration_manager" }],
    }] as never);
    const response = await GET(new Request("http://localhost/api/admin/users?reveal=1"));
    const body = await response.json();
    expect(body.users[0].mobile).toBe("+989121234567");
    expect(body.users[0].fullName).toBe("نام خصوصی");
    expect(recordAdminAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "admin.user.personal_view",
      metadata: { searched: false, personalData: true },
    }));
  });
});
