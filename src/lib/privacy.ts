export function redactPersonalData(text: string): string {
  const withoutEmails = text.replace(
    /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu,
    "[personal information removed]",
  );
  return withoutEmails.replace(/[+]?\p{Nd}[\p{Nd}\s().-]*\p{Nd}/gu, (match) => {
    const digitCount = match.match(/\p{Nd}/gu)?.length ?? 0;
    return digitCount >= 6 ? "[personal information removed]" : match;
  });
}
