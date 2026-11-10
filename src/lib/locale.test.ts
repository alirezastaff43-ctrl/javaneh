import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatNumber,
  isEnglishText,
  normalizeDigits,
  toPersianDigits,
} from "./locale";

describe("Persian localization helpers", () => {
  it("normalizes Persian, Arabic, and Western digits for validation", () => {
    expect(normalizeDigits("۰۱۲۳۴۵۶۷۸۹")).toBe("0123456789");
    expect(normalizeDigits("٠١٢٣٤٥٦٧٨٩")).toBe("0123456789");
    expect(normalizeDigits("0123456789")).toBe("0123456789");
    expect(normalizeDigits("۰۹۱۲-٣٤٥-0123").replace(/\D/g, "")).toBe(
      "09123450123",
    );
    expect(normalizeDigits("۱۲۳۴-٥٦")).toBe("1234-56");
  });

  it("formats interface numbers with Persian digits", () => {
    expect(formatNumber(1200)).toBe("۱٬۲۰۰");
    expect(formatNumber(72)).toBe("۷۲");
    expect(formatNumber(Number.NaN)).toBe("نامشخص");
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe("نامشخص");
  });

  it("converts Western and Arabic digits in displayed text", () => {
    expect(toPersianDigits("۳ مورد، 12 سؤال، ٤ پاسخ")).toBe(
      "۳ مورد، ۱۲ سؤال، ۴ پاسخ",
    );
  });

  it("accepts English text and rejects non-Latin scripts in mentor copy", () => {
    expect(isEnglishText("Thanks for sharing your idea.")).toBe(true);
    expect(isEnglishText("Thanks, 123!")).toBe(true);
    expect(isEnglishText("سلام")).toBe(false);
  });

  it("formats dates in Persian with Persian digits", () => {
    const result = formatDate("2026-03-21T12:30:00.000Z");
    expect(result).toMatch(/[۰-۹]/);
    expect(result).toContain("۱۴۰۵");
    expect(result).not.toMatch(/[A-Za-z]/);
  });

  it("rejects invalid date values instead of displaying a misleading date", () => {
    expect(() => formatDate("not-a-date")).toThrow(RangeError);
  });
});
