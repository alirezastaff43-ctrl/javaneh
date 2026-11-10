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
  prisma: {
    user: { count: vi.fn() },
    structuredRegistration: { count: vi.fn() },
    legacyIdea: { count: vi.fn() },
  },
}));

const actor = (roles: AdminRole[]) => ({
  id: "00000000-0000-4000-8000-000000000001",
  mobile: "+989121234567",
  fullName: null,
  roles,
});

describe("admin aggregate reports API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(prisma.user.count).mockResolvedValue(10);
    vi.mocked(prisma.structuredRegistration.count)
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(2);
    vi.mocked(prisma.legacyIdea.count).mockResolvedValue(3);
  });

  it.each([
    ["platform_owner"],
    ["registration_manager"],
    ["support"],
    ["read_only"],
    ["analyst"],
  ] as const)("returns aggregate counts for %s", async (role) => {
    vi.mocked(getAdminActor).mockResolvedValue(actor([role]));
    const response = await GET(new Request("http://localhost/api/admin/overview"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      users: 10,
      registrations: 7,
      submitted: 4,
      drafts: 3,
      legacyIdeas: 3,
    });
  });

  it("returns forbidden for an authenticated account without an admin role", async () => {
    vi.mocked(getAdminActor).mockResolvedValue(actor([]));
    const response = await GET(new Request("http://localhost/api/admin/overview"));
    expect(response.status).toBe(403);
  });
});
