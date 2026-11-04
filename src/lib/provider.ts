export type ProviderConfiguration = {
  apiKey: string;
  endpoint: string;
  model: string;
};

export function getProviderConfiguration():
  | { configuration: ProviderConfiguration }
  | {
      error:
        | "invalid_endpoint"
        | "missing_provider_key"
        | "mismatched_provider_key";
    } {
  const baseUrl = process.env.AI_BASE_URL || "https://openrouter.ai/api/v1";
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    return { error: "invalid_endpoint" };
  }
  if (
    (url.protocol !== "https:" &&
      !(url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname))) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    return { error: "invalid_endpoint" };

  const isGemini = url.hostname === "generativelanguage.googleapis.com";
  const isAvalai = url.hostname === "api.avalai.ir";
  const hasAnyKey = [
    process.env.AVALAI_API_KEY,
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_API_KEY,
    process.env.OPENROUTER_API_KEY,
    process.env.AI_API_KEY,
  ].some((key) => Boolean(key?.trim()));
  let apiKey: string | undefined;
  if (isAvalai) {
    apiKey = process.env.AVALAI_API_KEY?.trim();
  } else if (isGemini) {
    apiKey =
      process.env.GEMINI_API_KEY?.trim() ||
      process.env.GOOGLE_API_KEY?.trim() ||
      process.env.AI_API_KEY?.trim();
  } else if (url.hostname === "openrouter.ai") {
    apiKey =
      process.env.OPENROUTER_API_KEY?.trim() || process.env.AI_API_KEY?.trim();
  } else {
    apiKey =
      process.env.AI_API_KEY?.trim() ||
      process.env.OPENROUTER_API_KEY?.trim() ||
      process.env.GEMINI_API_KEY?.trim() ||
      process.env.GOOGLE_API_KEY?.trim();
  }

  if (!apiKey)
    return {
      error: hasAnyKey ? "mismatched_provider_key" : "missing_provider_key",
    };

  const normalizedBaseUrl = url.toString().replace(/\/+$/, "");
  const endpoint = normalizedBaseUrl.endsWith("/chat/completions")
    ? normalizedBaseUrl
    : `${normalizedBaseUrl}/chat/completions`;
  const model =
    process.env.AI_MODEL?.trim() ||
    (isAvalai
      ? "gpt-5.6-luna"
      : isGemini
        ? "gemini-2.5-flash"
        : "google/gemma-4-26b-a4b-it:free");
  if (!model || model.length > 200)
    return { error: "invalid_endpoint" };

  return { configuration: { apiKey, endpoint, model } };
}
