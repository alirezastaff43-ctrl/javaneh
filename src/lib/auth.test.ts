import { describe, expect, it } from "vitest";
import { hasSameOrigin } from "./auth";

describe("same-origin request validation", () => {
  it("uses the external host and protocol when running behind a reverse proxy", () => {
    const request = new Request("http://app:3000/api/admin/users", {
      headers: {
        Host: "admin.example.test",
        Origin: "https://admin.example.test",
        "X-Forwarded-Proto": "https",
      },
    });
    expect(hasSameOrigin(request)).toBe(true);
  });

  it("rejects foreign, null, and missing origins", () => {
    expect(hasSameOrigin(new Request("https://site.test/api", {
      headers: { Origin: "https://attacker.test" },
    }))).toBe(false);
    expect(hasSameOrigin(new Request("https://site.test/api", {
      headers: { Origin: "null" },
    }))).toBe(false);
    expect(hasSameOrigin(new Request("https://site.test/api"))).toBe(false);
  });

  it("rejects unsupported forwarded protocols and host mismatches", () => {
    expect(hasSameOrigin(new Request("http://app:3000/api", {
      headers: {
        Host: "site.test",
        Origin: "https://site.test",
        "X-Forwarded-Proto": "javascript",
      },
    }))).toBe(false);
    expect(hasSameOrigin(new Request("http://app:3000/api", {
      headers: { Host: "site.test", Origin: "https://other.test" },
    }))).toBe(false);
  });
});
