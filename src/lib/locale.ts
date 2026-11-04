export function normalizeDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US-u-nu-latn", {
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new RangeError("Invalid date");
  return new Intl.DateTimeFormat("en-US-u-nu-latn", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function isEnglishText(value: string): boolean {
  return !/[^\u0000-\u024f\u2000-\u206f]/u.test(value);
}
