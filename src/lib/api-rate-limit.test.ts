import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  configuredMaxRequestsPerMinute,
  enforceApiRateLimit,
} from "./api-rate-limit";

vi.mock("@/lib/prisma", () => ({
  prisma: { $queryRaw: vi.fn() },
}));

describe("shared API rate limit", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VITEST_WORKER_ID", undefined);
    vi.stubEnv("AUTH_OTP_SECRET", "test-secret-with-more-than-32-characters");
    vi.stubEnv("API_RATE_LIMIT_PER_MINUTE", "120");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns a retry-after response when the shared client bucket is exhausted", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce(
      [{ requestCount: 121 }] as never,
    );

    const response = await enforceApiRateLimit(
      new Request("https://site.test/api/data", {
        headers: { "x-real-ip": "192.0.2.10" },
      }),
    );

    expect(response?.status).toBe(429);
    expect(response?.headers.get("Retry-After")).toMatch(/^\d+$/);
  });

  it("fails closed if the shared counter cannot be stored", async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error("database down"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await enforceApiRateLimit(
      new Request("https://site.test/api/data"),
    );

    expect(response?.status).toBe(503);
  });

  it("rejects unsafe configured limits", () => {
    vi.stubEnv("API_RATE_LIMIT_PER_MINUTE", "0");

    expect(configuredMaxRequestsPerMinute()).toBeNull();
  });
});
