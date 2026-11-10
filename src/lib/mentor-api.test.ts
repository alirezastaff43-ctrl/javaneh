import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isMentorApiDisabled,
  resetMentorApiConnection,
  requestMentorApi,
} from "./mentor-api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("mentor API connection fallback", () => {
  it("retries after one failure and disables after two consecutive failures", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const parseResponse = (payload: unknown) =>
      payload && typeof payload === "object" && "ok" in payload && payload.ok === true
        ? true
        : null;

    expect(await requestMentorApi({}, parseResponse)).toEqual({
      status: "success",
      data: true,
    });
    expect(await requestMentorApi({}, parseResponse)).toMatchObject({
      status: "retry",
      message: expect.stringContaining("یک بار دیگر"),
    });
    expect(await requestMentorApi({}, parseResponse)).toMatchObject({
      status: "success",
      data: true,
    });
    expect(await requestMentorApi({}, parseResponse)).toMatchObject({ status: "retry" });
    expect(await requestMentorApi({}, parseResponse)).toMatchObject({ status: "disabled" });
    expect(isMentorApiDisabled()).toBe(true);

    const callCount = fetchMock.mock.calls.length;
    expect(await requestMentorApi({}, parseResponse)).toMatchObject({ status: "disabled" });
    expect(fetchMock).toHaveBeenCalledTimes(callCount);
    resetMentorApiConnection();
    expect(isMentorApiDisabled()).toBe(false);
    expect(await requestMentorApi({}, parseResponse)).toMatchObject({
      status: "success",
      data: true,
    });
  });
});
