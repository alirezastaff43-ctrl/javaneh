import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatNumber,
  isEnglishText,
  normalizeDigits,
} from "./locale";

describe("English localization helpers", () => {
  it("normalizes Persian, Arabic, and Western digits for validation", () => {
    expect(normalizeDigits("۰۱۲۳۴۵۶۷۸۹")).toBe("0123456789");
    expect(normalizeDigits("٠١٢٣٤٥٦٧٨٩")).toBe("0123456789");
    expect(normalizeDigits("0123456789")).toBe("0123456789");
    expect(normalizeDigits("۰۹۱۲-٣٤٥-0123").replace(/\D/g, "")).toBe(
      "09123450123",
    );
    expect(normalizeDigits("۱۲۳۴-٥٦")).toBe("1234-56");
  });

  it("formats interface numbers with Western digits", () => {
    expect(formatNumber(1200)).toBe("1,200");
    expect(formatNumber(72)).toBe("72");
  });

  it("accepts English text and rejects non-Latin scripts in mentor copy", () => {
    expect(isEnglishText("Thanks for sharing your idea.")).toBe(true);
    expect(isEnglishText("Thanks, 123!")).toBe(true);
    expect(isEnglishText("سلام")).toBe(false);
  });

  it("formats dates in English with Western digits", () => {
    const result = formatDate("2026-03-21T12:30:00.000Z");
    expect(result).toMatch(/Mar \d{1,2}, 2026/);
    expect(result).toMatch(/[0-9]/);
    expect(result).not.toMatch(/[۰-۹٠-٩]/);
  });

  it("rejects invalid date values instead of displaying a misleading date", () => {
    expect(() => formatDate("not-a-date")).toThrow(RangeError);
  });
});
