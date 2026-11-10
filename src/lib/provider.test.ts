import { afterEach, describe, expect, it, vi } from "vitest";
import { getProviderConfiguration } from "./provider";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("provider configuration", () => {
  it("keeps the existing development default", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("AI_BASE_URL", "");
    vi.stubEnv("AI_MODEL", "");
    vi.stubEnv("OPENROUTER_API_KEY", "dev-key");
    vi.stubEnv("AI_API_KEY", "");

    expect(getProviderConfiguration()).toMatchObject({
      configuration: {
        endpoint: "https://openrouter.ai/api/v1/chat/completions",
      },
    });
  });

  it("requires an explicit host allowlist, endpoint, and model in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AI_BASE_URL", "");
    vi.stubEnv("AI_MODEL", "");
    vi.stubEnv("INTERNAL_PROVIDER_ALLOWED_HOSTS", "");

    expect(getProviderConfiguration()).toEqual({ error: "invalid_endpoint" });

    vi.stubEnv("AI_BASE_URL", "https://ai.internal.example/v1");
    vi.stubEnv("INTERNAL_PROVIDER_ALLOWED_HOSTS", "ai.internal.example");
    vi.stubEnv("AI_MODEL", "local-model");
    vi.stubEnv("AI_API_KEY", "local-key");

    expect(getProviderConfiguration()).toMatchObject({
      configuration: {
        endpoint: "https://ai.internal.example/v1/chat/completions",
        model: "local-model",
      },
    });
  });

  it("rejects known external providers in production even if listed", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AI_BASE_URL", "https://openrouter.ai/api/v1");
    vi.stubEnv("AI_MODEL", "external-model");
    vi.stubEnv("INTERNAL_PROVIDER_ALLOWED_HOSTS", "openrouter.ai");
    vi.stubEnv("OPENROUTER_API_KEY", "external-key");

    expect(getProviderConfiguration()).toEqual({ error: "invalid_endpoint" });
  });
});