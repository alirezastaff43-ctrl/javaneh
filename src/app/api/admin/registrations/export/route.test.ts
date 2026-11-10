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
  prisma: { structuredRegistration: { findMany: vi.fn() } },
}));

const actor = (role: AdminRole) => ({
  id: "00000000-0000-4000-8000-000000000001",
  mobile: "+989121234567",
  fullName: null,
  roles: [role],
});

describe("admin registration export API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("allows registration managers a redacted export and audits it", async () => {
    vi.mocked(getAdminActor).mockResolvedValue(actor("registration_manager"));
    vi.mocked(prisma.structuredRegistration.findMany).mockResolvedValue([{
      id: "00000000-0000-4000-8000-000000000002",
      status: "submitted",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      submittedAt: new Date("2026-01-02T00:00:00Z"),
      data: { fullName: "نام خصوصی", answer: "تماس با ۰۹۱۲۱۲۳۴۵۶۷" },
      user: { mobile: "+989121234567" },
      workbooks: [],
      scoreAwards: [],
    }] as never);
    const response = await GET(new Request("http://localhost/api/admin/registrations/export"));
    const csv = await response.text();
    expect(response.status).toBe(200);
    expect(csv).not.toContain("نام خصوصی");
    expect(csv).not.toContain("+989121234567");
    expect(recordAdminAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "admin.registration.export",
      metadata: { rowCount: 1, personalData: false, filtered: false },
    }));
  });

  it("rejects personal export for managers and read-only users", async () => {
    vi.mocked(getAdminActor).mockResolvedValue(actor("registration_manager"));
    expect((await GET(new Request("http://localhost/api/admin/registrations/export?personal=1"))).status).toBe(403);
    vi.mocked(getAdminActor).mockResolvedValue(actor("read_only"));
    expect((await GET(new Request("http://localhost/api/admin/registrations/export"))).status).toBe(403);
    expect(prisma.structuredRegistration.findMany).not.toHaveBeenCalled();
  });
});
