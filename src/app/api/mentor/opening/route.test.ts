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

function post(seed: string) {
  return POST(
    new Request("http://localhost/api/mentor/opening", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seed }),
    }),
  );
}

function providerResponse(content: string) {
  return Response.json({ choices: [{ message: { content } }] });
}

describe("opening question route", () => {
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

  it("uses the configured AI provider and sends the starting idea", async () => {
    const generated = {
      question:
        "با توجه به خاموش‌ماندن چراغ‌های پارک، کدام موقعیت مشخص را خودت دیده‌ای؟",
      questionContext:
        "به زمان یا بخش مشخصی از پارک اشاره کن تا مسئله را دقیق‌تر بررسی کنیم.",
    };
    const fetchMock = vi.fn().mockResolvedValue(
      providerResponse(JSON.stringify(generated)),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await post("چراغ‌های پارک شب‌ها خاموش می‌مانند");
    const result = await response.json();
    const [url, options] = fetchMock.mock.calls[0];
    const providerRequest = JSON.parse(options.body);

    expect(response.status).toBe(200);
    expect(result).toEqual({ mode: "provider", ...generated });
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(options.headers.Authorization).toBe("Bearer test-provider-key");
    expect(providerRequest.messages[1].content).toContain(
      "چراغ‌های پارک شب‌ها خاموش می‌مانند",
    );
    expect(providerRequest.messages[0].content).toContain(
      "پرسش آغازین مشخص و معنادار",
    );
  });

  it("uses AvalAI's required default temperature", async () => {
    vi.stubEnv("AI_BASE_URL", "https://api.avalai.ir/v1");
    vi.stubEnv("AVALAI_API_KEY", "test-avalai-key");
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const fetchMock = vi.fn().mockResolvedValue(
      providerResponse(
        JSON.stringify({
          question:
            "با توجه به خاموش‌ماندن چراغ‌های پارک، کدام موقعیت مشخص را خودت دیده‌ای؟",
          questionContext:
            "به زمان یا بخش مشخصی از پارک اشاره کن تا مسئله را دقیق‌تر بررسی کنیم.",
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await post("چراغ‌های پارک شب‌ها خاموش می‌مانند");
    const [, options] = fetchMock.mock.calls[0];
    const providerRequest = JSON.parse(options.body);

    expect(response.status).toBe(200);
    expect(providerRequest.model).toBe("gpt-5.6-luna");
    expect(providerRequest.temperature).toBe(1);
  });

  it("keeps a personalized no-key demo path available", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await post("دسترسی کودکان به کتابخانه دشوار است");
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.mode).toBe("demo");
    expect(result.question).toContain(
      "دسترسی کودکان به کتابخانه دشوار است",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not treat invalid provider output as a successful question", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        providerResponse(
          JSON.stringify({
            question: "What is the problem?",
            questionContext: "This gives an example.",
          }),
        ),
      ),
    );

    const response = await post("بهبود رفت‌وآمد محله");
    const result = await response.json();

    expect(response.status).toBe(502);
    expect(result.code).toBe("provider_invalid_response");
  });
});
