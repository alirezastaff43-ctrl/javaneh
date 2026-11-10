export function normalizeDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
}

export function toPersianDigits(value: string): string {
  return value.replace(/[0-9٠-٩]/g, (digit) => {
    const code = digit.charCodeAt(0);
    return String.fromCharCode(code >= 0x0660 ? code - 0x0660 + 0x06f0 : code - 0x30 + 0x06f0);
  });
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "نامشخص";
  return new Intl.NumberFormat("fa-IR-u-nu-arabext", {
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new RangeError("Invalid date");
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-arabext", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function isEnglishText(value: string): boolean {
  return !/[^\u0000-\u024f\u2000-\u206f]/u.test(value);
}

export function isPersianText(value: string): boolean {
  return /[\u0600-\u06ff]/u.test(value);
}
