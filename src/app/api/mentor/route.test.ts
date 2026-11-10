import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEVELOPMENT_AXES, INTAKE_AXES } from "@/lib/interviewer";
import { GET, POST } from "./route";

vi.mock("@/lib/auth", () => ({
  getAuthenticatedUser: vi.fn().mockResolvedValue({
    id: "00000000-0000-4000-8000-000000000001",
    mobile: "+989121234567",
    fullName: null,
  }),
  unauthorizedResponse: () => Response.json({ error: "unauthorized" }, { status: 401 }),
}));

vi.mock("@/lib/user-data", () => ({
  loadUserData: vi.fn().mockResolvedValue({
    version: 1,
    state: { schemaVersion: 1, profile: null, ideas: [] },
    registrations: [],
  }),
}));

function requestBody(overrides: Record<string, unknown> = {}) {
  const axes = INTAKE_AXES;
  return {
    seed: "رفت‌وآمد سالمندان به بازار دشوار است",
    stage: "initial",
    section: axes[1].section,
    index: 1,
    question: "چه کسانی با این مشکل روبه‌رو هستند؟",
    answer: "در مسیر بازار، سالمندان از پله‌های ورودی گفتند.",
    answeredSections: [axes[0].section, axes[1].section],
    skippedSections: [],
    remainingSections: axes.slice(2).map((axis) => axis.section),
    history: [
      {
        stage: "initial",
        section: axes[0].section,
        question: "چه مشکلی را مشاهده کرده‌اید؟",
        answer: "ورودی بازار برای رفت‌وآمد سخت است.",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

function validDecision() {
  return {
    mentorMessage: "ممنون که این را با من در میان گذاشتی.",
    answerSufficient: true,
    stageComplete: false,
    coveredSections: [],
    nextSection: INTAKE_AXES[2].section,
    nextQuestion: "چه چیزهایی دربارهٔ علت این مسئله هنوز برایت روشن نیست؟",
    questionContext:
      "جداکردن دانسته‌ها از پرسش‌های بی‌پاسخ کمک می‌کند بفهمیم چه چیزی هنوز نیاز به بررسی دارد.",
  };
}

function providerResponse(content: string) {
  return Response.json({
    choices: [{ message: { content } }],
  });
}

describe("mentor explanation validation", () => {
  beforeEach(() => {
    vi.stubEnv("AVALAI_API_KEY", "");
    vi.stubEnv("OPENROUTER_API_KEY", "test-openrouter-key");
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

  it("announces demo mode without exposing provider configuration", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const response = await GET(new Request("http://localhost/api/mentor"));
    const result = await response.json();

    expect(result).toEqual({ mode: "demo" });
    expect(JSON.stringify(result)).not.toContain("test-openrouter-key");
  });

  it("uses a safe Persian explanation when the provider omits it", async () => {
    const decision = validDecision();
    delete (decision as Partial<typeof decision>).questionContext;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(providerResponse(JSON.stringify(decision))),
    );

    const response = await post(requestBody());
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.nextQuestion).toBe(decision.nextQuestion);
    expect(result.questionContext).toContain("دانسته‌ها");
    expect(result.questionContext).toMatch(/[آ-ی]/u);
  });

  it.each([
    ["empty", ""],
    ["non-Persian", "This context explains why the question matters."],
    ["question-shaped", "چرا دانستن این موضوع به فهم مسئله کمک می‌کند؟"],
    ["too long", "ا".repeat(361)],
    ["null", null],
  ])("replaces a %s provider explanation with a safe fallback", async (_label, context) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        providerResponse(
          JSON.stringify({ ...validDecision(), questionContext: context }),
        ),
      ),
    );

    const response = await post(requestBody());
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.questionContext).toContain("دانسته‌ها");
    expect(result.questionContext).not.toMatch(/[؟?]/u);
  });
});

async function post(value: unknown) {
  return POST(
    new Request("http://localhost/api/mentor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    }),
  );
}

describe("adaptive interview route", () => {
  beforeEach(() => {
    vi.stubEnv("AVALAI_API_KEY", "");
    vi.stubEnv("OPENROUTER_API_KEY", "test-openrouter-key");
    vi.stubEnv("AI_API_KEY", "legacy-test-key");
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("GOOGLE_API_KEY", "");
    vi.stubEnv("AI_BASE_URL", "");
    vi.stubEnv("AI_MODEL", "");
    vi.stubEnv("OPENROUTER_SITE_URL", "");
    vi.stubEnv("OPENROUTER_APP_NAME", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses the current answer and ordered history to make a provider decision", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      providerResponse(JSON.stringify(validDecision())),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await post(requestBody());
    const result = await response.json();
    expect(response.status).toBe(200);
    expect(result.nextQuestion).toBe(validDecision().nextQuestion);
    expect(result.nextQuestion).not.toBe(INTAKE_AXES[2].question);
    expect(result.questionContext).toBe(validDecision().questionContext);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(options.method).toBe("POST");
    expect(options.headers).toEqual({
      Authorization: "Bearer test-openrouter-key",
      "Content-Type": "application/json",
    });
    const providerRequest = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(providerRequest.model).toBe("google/gemma-4-26b-a4b-it:free");
    expect(providerRequest.response_format).toEqual({ type: "json_object" });
    const userContext = JSON.parse(providerRequest.messages[1].content);
    expect(userContext.answer).toBe(requestBody().answer);
    expect(
      userContext.history.some(
        (item: { answer: string }) => item.answer === requestBody().answer,
      ),
    ).toBe(false);
    expect(userContext.history).toEqual(requestBody().history);
    expect(userContext.responseLanguage).toBe("Persian");
    expect(userContext.eligibleCoveredSections).toEqual(requestBody().remainingSections);
    expect(userContext.sectionFocusTerms["What is known"]).toContain("علت");
    expect(userContext).not.toHaveProperty("suggestedNextQuestion");
  });

  it("ignores extra provider fields while validating the required decision fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      providerResponse(
        JSON.stringify({
          ...validDecision(),
          reasoning: "Internal provider metadata",
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await post(requestBody());
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.nextQuestion).toBe(validDecision().nextQuestion);
    expect(result).not.toHaveProperty("reasoning");
  });

  it("retries once when a provider decision is invalid and returns only a valid decision", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        providerResponse(
          JSON.stringify({ ...validDecision(), nextQuestion: null }),
        ),
      )
      .mockResolvedValueOnce(
        providerResponse(JSON.stringify(validDecision())),
      );
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await post(requestBody());
    const result = await response.json();
    const retryRequest = JSON.parse(fetchMock.mock.calls[1][1].body);

    expect(response.status).toBe(200);
    expect(result.nextQuestion).toBe(validDecision().nextQuestion);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(retryRequest.messages[1].content).toContain(
      "اگر مرحله کامل نیست",
    );
    expect(
      JSON.parse(retryRequest.messages.at(-1).content).answer,
    ).toBe(requestBody().answer);
  });

  it("allows a supported later axis when preceding axes are covered", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      providerResponse(
        JSON.stringify({
          ...validDecision(),
          coveredSections: [INTAKE_AXES[2].section],
          nextSection: INTAKE_AXES[3].section,
          nextQuestion: "دوست داری چه راهکاری را برای این مسئله امتحان کنی؟",
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const response = await post(requestBody());
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.coveredSections).toEqual([INTAKE_AXES[2].section]);
    expect(result.nextSection).toBe(INTAKE_AXES[3].section);
  });

  it("sends the bounded prior intake history during idea development", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      providerResponse(
        JSON.stringify({
          mentorMessage: "نوشتی که می‌خواهی این موضوع را بیشتر بررسی کنی.",
          answerSufficient: true,
          stageComplete: false,
          coveredSections: [],
          nextSection: DEVELOPMENT_AXES[1].section,
          nextQuestion: DEVELOPMENT_AXES[1].question,
          questionContext:
            "شنیدن دیدگاه‌های افراد مرتبط کمک می‌کند راهکار با تجربهٔ آن‌ها هماهنگ باشد.",
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const history = INTAKE_AXES.map((axis, index) => ({
      stage: "initial",
      section: axis.section,
      question: axis.question,
      answer: `پاسخ ثبت اولیهٔ ${index + 1}`,
      createdAt: `2026-01-0${index + 1}T00:00:00.000Z`,
    }));
    const response = await post(
      requestBody({
        stage: "development",
        section: DEVELOPMENT_AXES[0].section,
        index: 0,
        question: DEVELOPMENT_AXES[0].question,
        answer: "هنوز نمونه‌ای در ذهنم نیست.",
        answeredSections: [DEVELOPMENT_AXES[0].section],
        remainingSections: DEVELOPMENT_AXES.slice(1).map((axis) => axis.section),
        history,
      }),
    );
    const result = await response.json();
    const userContext = JSON.parse(fetchMock.mock.calls[0][1].body).messages[1]
      .content;
    const context = JSON.parse(userContext);

    expect(response.status).toBe(200);
    expect(context.history).toHaveLength(INTAKE_AXES.length);
    expect(context.history.map((item: { section: string }) => item.section)).toEqual(
      INTAKE_AXES.map((axis) => axis.section),
    );
    expect(context.answer).toBe("هنوز نمونه‌ای در ذهنم نیست.");
    expect(result.nextSection).toBe(DEVELOPMENT_AXES[1].section);
  });

  it("accepts the maximum relevant history within the bounded request size", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    vi.stubEnv("AI_API_KEY", "");
    const history = [
      ...INTAKE_AXES.map((axis) => ({ axis, stage: "initial" })),
      ...DEVELOPMENT_AXES.slice(0, -1).map((axis) => ({
        axis,
        stage: "development",
      })),
    ].map(({ axis, stage }, index) => ({
      stage,
      section: axis.section,
      question: "ا".repeat(200),
      answer: "ا".repeat(200),
      createdAt: `2026-01-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
    }));
    const value = requestBody({
      seed: "ا".repeat(1200),
      stage: "development",
      section: DEVELOPMENT_AXES[9].section,
      index: 9,
      question: "ا".repeat(600),
      answer: "ا".repeat(1500),
      answeredSections: DEVELOPMENT_AXES.map((axis) => axis.section),
      remainingSections: [],
      history,
    });
    const serialized = JSON.stringify(value);

    const bodySize = new TextEncoder().encode(serialized).byteLength;
    expect(bodySize).toBeLessThan(36_000);
    const response = await post(value);

    expect(response.status).toBe(200);
  });

  it("orders the bounded history and redacts identifiers before sending context", async () => {
    const axes = DEVELOPMENT_AXES;
    const fetchMock = vi.fn().mockResolvedValue(
      providerResponse(
        JSON.stringify({
          mentorMessage: "ممنون از توضیحت.",
          answerSufficient: true,
          stageComplete: false,
          coveredSections: [],
          nextSection: axes[3].section,
          nextQuestion:
            "راهکارت برای افراد درگیر چه تجربه‌ای می‌سازد؟",
          questionContext:
            "روشن‌شدن تجربهٔ افراد از راهکار کمک می‌کند بفهمیم تغییر موردنظر در عمل چگونه رخ می‌دهد.",
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const response = await post(
      requestBody({
        stage: "development",
        section: axes[2].section,
        index: 2,
        question: "به‌نظر شما چرا این مشکل ادامه پیدا کرده است؟",
        answer: "تماس با 09123456789 یا person@example.com",
        answeredSections: axes.slice(0, 3).map((axis) => axis.section),
        remainingSections: axes.slice(3).map((axis) => axis.section),
        history: [
          {
            stage: "development",
            section: axes[1].section,
            question: "چه کسانی باید همراه باشند؟",
            answer: "گروه‌های محلی",
            createdAt: "2026-02-02T00:00:00.000Z",
          },
          {
            stage: "development",
            section: axes[0].section,
            question: "چه نمونه‌ای مشاهده کردید؟",
            answer: "یک نمونهٔ مشخص",
            createdAt: "2026-02-01T00:00:00.000Z",
          },
        ],
      }),
    );
    const providerRequest = JSON.parse(fetchMock.mock.calls[0][1].body);
    const userContext = JSON.parse(providerRequest.messages[1].content);

    expect(response.status).toBe(200);
    expect(userContext.history.map((item: { section: string }) => item.section)).toEqual([
      axes[0].section,
      axes[1].section,
    ]);
    expect(userContext.answer).not.toContain("09123456789");
    expect(userContext.answer).not.toContain("person@example.com");
    expect(userContext.answer.match(/\[personal information removed\]/g)).toHaveLength(2);
  });

  it("uses configured endpoint and model and sends optional public attribution", async () => {
    vi.stubEnv("AI_BASE_URL", "https://openrouter.ai/api/v1/");
    vi.stubEnv("AI_MODEL", "custom/provider-model");
    vi.stubEnv("OPENROUTER_SITE_URL", "https://javaneh.example");
    vi.stubEnv("OPENROUTER_APP_NAME", "Javaneh");
    const fetchMock = vi.fn().mockResolvedValue(
      providerResponse(JSON.stringify(validDecision())),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await post(requestBody());
    const [, options] = fetchMock.mock.calls[0];
    const providerRequest = JSON.parse(options.body);

    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://openrouter.ai/api/v1/chat/completions",
    );
    expect(providerRequest.model).toBe("custom/provider-model");
    expect(options.headers).toMatchObject({
      "HTTP-Referer": "https://javaneh.example",
      "X-Title": "Javaneh",
    });
  });

  it("uses the Gemini OpenAI-compatible endpoint and its provider-specific key", async () => {
    vi.stubEnv("AI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai");
    vi.stubEnv("AI_MODEL", "gemini-3.8-flash");
    vi.stubEnv("GEMINI_API_KEY", "test-gemini-key");
    vi.stubEnv("OPENROUTER_API_KEY", "wrong-provider-key");
    const fetchMock = vi.fn().mockResolvedValue(
      providerResponse(JSON.stringify(validDecision())),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await post(requestBody());
    const [url, options] = fetchMock.mock.calls[0];
    const providerRequest = JSON.parse(options.body);

    expect(response.status).toBe(200);
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    );
    expect(options.headers.Authorization).toBe("Bearer test-gemini-key");
    expect(providerRequest.model).toBe("gemini-3.8-flash");
  });

  it("uses the AvalAI endpoint and its provider-specific key", async () => {
    vi.stubEnv("AI_BASE_URL", "https://api.avalai.ir/v1");
    vi.stubEnv("AVALAI_API_KEY", "test-avalai-key");
    vi.stubEnv("OPENROUTER_API_KEY", "wrong-provider-key");
    const fetchMock = vi.fn().mockResolvedValue(
      providerResponse(JSON.stringify(validDecision())),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await post(requestBody());
    const [url, options] = fetchMock.mock.calls[0];
    const providerRequest = JSON.parse(options.body);

    expect(response.status).toBe(200);
    expect(url).toBe("https://api.avalai.ir/v1/chat/completions");
    expect(options.headers.Authorization).toBe("Bearer test-avalai-key");
    expect(providerRequest.model).toBe("gpt-5.6-luna");
    expect(providerRequest.temperature).toBe(1);
  });

  it("does not send another provider's key to AvalAI", async () => {
    vi.stubEnv("AI_BASE_URL", "https://api.avalai.ir/v1");
    vi.stubEnv("OPENROUTER_API_KEY", "wrong-provider-key");
    vi.stubEnv("AI_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await post(requestBody());
    const result = await response.json();

    expect(response.status).toBe(500);
    expect(result.code).toBe("provider_configuration");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(JSON.stringify(error.mock.calls)).not.toContain("wrong-provider-key");
  });

  it("does not send an OpenRouter key to a Gemini endpoint", async () => {
    vi.stubEnv(
      "AI_BASE_URL",
      "https://generativelanguage.googleapis.com/v1beta/openai",
    );
    vi.stubEnv("OPENROUTER_API_KEY", "wrong-provider-key");
    vi.stubEnv("AI_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await post(requestBody());
    const result = await response.json();

    expect(response.status).toBe(500);
    expect(result.code).toBe("provider_configuration");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(JSON.stringify(error.mock.calls)).not.toContain("wrong-provider-key");
  });

  it("uses the legacy API key when the OpenRouter key is not configured", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const fetchMock = vi.fn().mockResolvedValue(
      providerResponse(JSON.stringify(validDecision())),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await post(requestBody());

    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(
      "Bearer legacy-test-key",
    );
  });

  it("returns a Persian fallback question when no key is configured", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    vi.stubEnv("AI_API_KEY", "");

    const response = await post(
      requestBody({
        section: INTAKE_AXES[0].section,
        index: 0,
        question: "چه مشکل مشخصی را مشاهده کرده‌اید؟",
        answer: "چراغ مسیر پیاده‌رو شب‌ها خاموش می‌ماند.",
        answeredSections: [INTAKE_AXES[0].section],
        remainingSections: INTAKE_AXES.slice(1).map((axis) => axis.section),
        history: [],
      }),
    );
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.mode).toBe("demo");
    expect(result.mentorMessage).toContain(
      "چراغ مسیر پیاده‌رو شب‌ها خاموش می‌ماند",
    );
    expect(result.nextQuestion).toContain(requestBody().seed);
    expect(result.nextQuestion).toContain(INTAKE_AXES[1].question);
    expect(result.questionContext).toContain("نیازهای واقعی");
    expect(result.nextSection).toBe(INTAKE_AXES[1].section);
    expect(result.stageComplete).toBe(false);
  });

  it("completes the final axis without manufacturing another question", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    vi.stubEnv("AI_API_KEY", "");
    const response = await post(
      requestBody({
        section: INTAKE_AXES[4].section,
        index: 4,
        question: "چه ارتباطی با این مسئله دارید؟",
        answer: "در محله زندگی می‌کنم.",
        answeredSections: INTAKE_AXES.map((axis) => axis.section),
        remainingSections: [],
        history: [],
      }),
    );
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.stageComplete).toBe(true);
    expect(result.nextSection).toBeNull();
    expect(result.nextQuestion).toBeNull();
    expect(result.questionContext).toBeNull();
  });

  it("completes the final development axis without a follow-up question", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    vi.stubEnv("AI_API_KEY", "");
    const axes = DEVELOPMENT_AXES;
    const response = await post(
      requestBody({
        stage: "development",
        section: axes[axes.length - 1].section,
        index: axes.length - 1,
        question: "برای گام‌های بعدی چه چیزی را بررسی می‌کنید؟",
        answer: "با افراد درگیر گفت‌وگو می‌کنم.",
        answeredSections: axes.map((axis) => axis.section),
        remainingSections: [],
        history: [],
      }),
    );
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.stageComplete).toBe(true);
    expect(result.nextQuestion).toBeNull();
    expect(result.questionContext).toBeNull();
  });

  it("rejects malformed or inconsistent participant requests", async () => {
    const invalidAxis = await post(
      requestBody({ section: "Unknown axis" }),
    );
    expect(invalidAxis.status).toBe(400);

    const emptyAnswer = await post(requestBody({ answer: "   " }));
    expect(emptyAnswer.status).toBe(400);

    const badBody = await POST(
      new Request("http://localhost/api/mentor", {
        method: "POST",
        body: "{",
      }),
    );
    expect(badBody.status).toBe(400);

    const axes = DEVELOPMENT_AXES;
    const skippedDevelopmentAxis = await post(
      requestBody({
        stage: "development",
        section: axes[0].section,
        index: 0,
        answeredSections: [axes[0].section],
        skippedSections: [axes[1].section],
        remainingSections: axes.slice(2).map((axis) => axis.section),
      }),
    );
    expect(skippedDevelopmentAxis.status).toBe(400);

    const missingEarlierDevelopmentAxis = await post(
      requestBody({
        stage: "development",
        section: axes[2].section,
        index: 2,
        answeredSections: [axes[0].section, axes[2].section],
        remainingSections: axes.slice(3).map((axis) => axis.section),
      }),
    );
    expect(missingEarlierDevelopmentAxis.status).toBe(400);
  });

  it.each([
    ["invalid JSON", "not-json"],
    [
      "wrong axis",
      JSON.stringify({
        ...validDecision(),
        nextSection: DEVELOPMENT_AXES[0].section,
      }),
    ],
    [
      "non-Persian question",
      JSON.stringify({ ...validDecision(), nextQuestion: "What did you notice?" }),
    ],
    [
      "non-Persian reflection",
      JSON.stringify({
        ...validDecision(),
        mentorMessage: "Thank you for sharing that.",
      }),
    ],
    [
      "empty question",
      JSON.stringify({ ...validDecision(), nextQuestion: "" }),
    ],
    [
      "unrelated question",
      JSON.stringify({
        ...validDecision(),
        nextQuestion: "What change do you expect from the solution?",
      }),
    ],
    [
      "repeated question",
      JSON.stringify({
        ...validDecision(),
        nextQuestion: "What might still be unclear about why this happens?",
      }),
    ],
    [
      "multi-part question",
      JSON.stringify({
        ...validDecision(),
        nextQuestion:
          "به نظرت چه چیزی باعث ادامه شده و چه کاری را امتحان کرده‌اید؟",
      }),
    ],
  ])("rejects provider output with %s", async (_case, content) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(providerResponse(content)),
    );

    const response = await post(
      requestBody(
        _case === "repeated question"
          ? { question: validDecision().nextQuestion }
          : {},
      ),
    );
    expect(response.status).toBe(502);
  });

  it("retains a clear failure response when the provider is unavailable", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);
    const response = await post(requestBody());
    const result = await response.json();

    expect(response.status).toBe(503);
    expect(result.error).toContain("پاسخ شما ذخیره شده");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("retries timeouts and reports a gateway timeout after the final attempt", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new DOMException("timed out", "TimeoutError"));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await post(requestBody());
    const result = await response.json();

    expect(response.status).toBe(504);
    expect(result.code).toBe("provider_timeout");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("returns a safe error for provider HTTP failures without logging credentials", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          { error: { message: "provider detail" } },
          { status: 429, headers: { "Retry-After": "0" } },
        ),
      ),
    );

    const response = await post(requestBody());
    const result = await response.json();

    expect(response.status).toBe(429);
    expect(result.code).toBe("provider_rate_limited");
    expect(result.error).not.toContain("provider detail");
    expect(JSON.stringify(result)).not.toContain("test-openrouter-key");
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('"status":429'),
    );
    expect(JSON.stringify(error.mock.calls)).not.toContain("test-openrouter-key");
  });

  it("retries transient 503 failures and returns the successful decision", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          { error: { message: "temporarily unavailable" } },
          { status: 503, headers: { "Retry-After": "0" } },
        ),
      )
      .mockResolvedValueOnce(
        providerResponse(JSON.stringify(validDecision())),
      );
    vi.stubGlobal("fetch", fetchMock);

    const response = await post(requestBody());
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.nextQuestion).toBe(validDecision().nextQuestion);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("stops after the retry limit for persistent 503 failures", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json(
        { error: { message: "temporarily unavailable" } },
        { status: 503, headers: { "Retry-After": "0" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await post(requestBody());
    const result = await response.json();

    expect(response.status).toBe(503);
    expect(result.code).toBe("provider_unavailable");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(error.mock.calls)).not.toContain("test-openrouter-key");
  });

  it.each([400, 401, 403])(
    "does not retry permanent provider HTTP %i failures",
    async (status) => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const fetchMock = vi.fn().mockResolvedValue(
        Response.json(
          { error: { message: "provider detail" } },
          { status },
        ),
      );
      vi.stubGlobal("fetch", fetchMock);

      const response = await post(requestBody());
      const result = await response.json();

      expect(response.status).toBe(502);
      expect(result.code).toBe(
        status === 401 || status === 403
          ? "provider_authentication"
          : "provider_request_rejected",
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(error.mock.calls)).toContain("provider detail");
      expect(JSON.stringify(error.mock.calls)).not.toContain("test-openrouter-key");
    },
  );

  it("rejects insecure provider endpoints without making an upstream request", async () => {
    vi.stubEnv("AI_BASE_URL", "http://provider.example/api");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await post(requestBody());
    const result = await response.json();

    expect(response.status).toBe(500);
    expect(result.code).toBe("provider_configuration");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
