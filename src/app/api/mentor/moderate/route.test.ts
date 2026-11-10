import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/auth", () => ({
  getAuthenticatedUser: vi.fn().mockResolvedValue({
    id: "00000000-0000-4000-8000-000000000001",
    mobile: "+989121234567",
    fullName: null,
  }),
  unauthorizedResponse: () => Response.json({ error: "unauthorized" }, { status: 401 }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    formValidationLock: { findUnique: vi.fn().mockResolvedValue(null) },
  },
}));

function post(overrides: Record<string, unknown> = {}) {
  return POST(
    new Request("http://localhost/api/mentor/moderate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "seed",
        seed: "تاب‌آوری محله در بحران",
        text: "تاب‌آوری محله در بحران",
        ...overrides,
      }),
    }),
  );
}

function providerResponse(category: string) {
  return Response.json({
    choices: [{ message: { content: JSON.stringify({ category }) } }],
  });
}

describe("moderation route", () => {
  beforeEach(() => {
    vi.stubEnv("AVALAI_API_KEY", "");
    vi.stubEnv("OPENROUTER_API_KEY", "test-provider-key");
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("GOOGLE_API_KEY", "");
    vi.stubEnv("AI_API_KEY", "");
    vi.stubEnv("AI_BASE_URL", "");
    vi.stubEnv("AI_MODEL", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses a separate provider classification without changing mentor routes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(providerResponse("relevant"));
    vi.stubGlobal("fetch", fetchMock);

    const response = await post();
    const result = await response.json();
    const providerRequest = JSON.parse(fetchMock.mock.calls[0][1].body);

    expect(response.status).toBe(200);
    expect(result).toEqual({ mode: "provider", category: "relevant" });
    expect(providerRequest.temperature).toBe(0);
    expect(providerRequest.messages[0].content).toContain("off_topic");
  });

  it("uses AvalAI's required temperature", async () => {
    vi.stubEnv("AI_BASE_URL", "https://api.avalai.ir/v1");
    vi.stubEnv("AVALAI_API_KEY", "test-avalai-key");
    const fetchMock = vi.fn().mockResolvedValue(providerResponse("relevant"));
    vi.stubGlobal("fetch", fetchMock);

    const response = await post();
    const providerRequest = JSON.parse(fetchMock.mock.calls[0][1].body);

    expect(response.status).toBe(200);
    expect(providerRequest.temperature).toBe(1);
  });

  it("uses the deterministic fallback when no provider key is configured", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await post();
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result).toEqual({ mode: "demo", category: "relevant" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not accept an invalid classifier response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(providerResponse("maybe")));

    const response = await post();

    expect(response.status).toBe(502);
    expect((await response.json()).code).toBe("moderation_invalid_response");
  });

  it("rejects malformed requests before calling the provider", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await post({ kind: "unknown" });

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});