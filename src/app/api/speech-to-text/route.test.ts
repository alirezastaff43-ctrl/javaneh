import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

function audioRequest() {
  const body = new FormData();
  body.append("audio", new Blob(["audio"], { type: "audio/webm" }), "voice.webm");
  return new Request("http://localhost/api/speech-to-text", {
    method: "POST",
    body,
  });
}

describe("speech-to-text route", () => {
  beforeEach(() => {
    vi.stubEnv("BINAVIRA_API_TOKEN", "test-binavira-token");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sends audio to Binavira and returns only the transcript", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ response: "یک متن آزمایشی" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(audioRequest());
    const result = await response.json();
    const [url, options] = fetchMock.mock.calls[0];
    const sentForm = options.body as FormData;

    expect(response.status).toBe(200);
    expect(result).toEqual({ text: "یک متن آزمایشی" });
    expect(url).toBe("https://binavira.ir/api/stt");
    expect(new Headers(options.headers).get("authorization")).toBe(
      "Bearer test-binavira-token",
    );
    expect(sentForm.get("source")).toBe("web");
    expect(sentForm.get("audio")).toBeInstanceOf(File);
  });

  it("polls long jobs and retrieves the resulting text file", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ job_id: "job-123" }))
      .mockResolvedValueOnce(Response.json({ status: "completed", progress: 100 }))
      .mockResolvedValueOnce(new Response("گفتار تبدیل‌شده"));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(audioRequest());
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result).toEqual({ text: "گفتار تبدیل‌شده" });
    expect(fetchMock.mock.calls[1][0]).toBe("https://binavira.ir/api/stt/status");
    expect(fetchMock.mock.calls[2][0]).toBe(
      "https://binavira.ir/files/stt-text/job-123.txt",
    );
  });

  it("requires a server-side token without calling the provider", async () => {
    vi.stubEnv("BINAVIRA_API_TOKEN", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(audioRequest());

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "speech_not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects non-audio uploads", async () => {
    const body = new FormData();
    body.append("audio", new Blob(["not audio"], { type: "text/plain" }), "notes.txt");

    const response = await POST(
      new Request("http://localhost/api/speech-to-text", {
        method: "POST",
        body,
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "invalid_audio" });
  });
});