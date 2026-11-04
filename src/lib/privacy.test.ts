import { describe, expect, it } from "vitest";
import { redactPersonalData } from "./privacy";

describe("mentor input privacy", () => {
  it("redacts national IDs and mobile numbers in every supported digit set", () => {
    expect(redactPersonalData("شناسه ۱۲۳۴۵۶۷۸۹۰")).toBe(
      "شناسه [personal information removed]",
    );
    expect(redactPersonalData("همراه ٠٩١٢-٣٤٥-٦٧٨٩")).toBe(
      "همراه [personal information removed]",
    );
    expect(redactPersonalData("contact 09123456789")).toBe(
      "contact [personal information removed]",
    );
  });

  it("redacts email addresses from participant text", () => {
    expect(redactPersonalData("ایمیل: person@example.com")).toBe(
      "ایمیل: [personal information removed]",
    );
  });

  it("preserves ordinary short numbers in participant text", () => {
    expect(redactPersonalData("در ۳ محله، ۲۵ نفر را دیدیم")).toBe(
      "در ۳ محله، ۲۵ نفر را دیدیم",
    );
  });
});
