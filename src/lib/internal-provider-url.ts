const KNOWN_EXTERNAL_PROVIDER_HOSTS = [
  "generativelanguage.googleapis.com",
  "openrouter.ai",
];

function isLocalHostname(hostname: string): boolean {
  return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname);
}

export function getApprovedProviderUrl(value: string): URL | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.protocol !== "https:" &&
      !(url.protocol === "http:" && isLocalHostname(url.hostname)))
  )
    return null;

  if (process.env.NODE_ENV !== "production") return url;

  const host = url.host.toLowerCase().replace(/\.$/u, "");
  const allowedHosts = (process.env.INTERNAL_PROVIDER_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase().replace(/\.$/u, ""))
    .filter(Boolean);
  if (!allowedHosts.includes(host)) return null;
  if (
    KNOWN_EXTERNAL_PROVIDER_HOSTS.some(
      (externalHost) => host === externalHost || host.endsWith(`.${externalHost}`),
    )
  )
    return null;

  return url;
}