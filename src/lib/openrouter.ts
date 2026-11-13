export type ModelMessage = { role: "system" | "user" | "assistant"; content: string };

export type WebSource = { title: string; url: string };

export type Completion = {
  text: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  costKnown: boolean;
  sources: WebSource[];
};

const ESTIMATES: Record<string, [number, number]> = {
  "google/gemini-2.5-flash": [0.15, 0.6],
  "google/gemini-2.0-flash-001": [0.1, 0.4],
  "meta-llama/llama-3.3-70b-instruct": [0.12, 0.28],
};

export function modelConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

export async function complete(model: string, messages: ModelMessage[], web = false): Promise<Completion> {
  try {
    return await requestCompletion(model, messages, web);
  } catch (error) {
    if (!web || !(error instanceof Error) || !/status 4\d\d/.test(error.message)) throw error;
    const fallback = await requestCompletion(model, messages, false);
    return {
      ...fallback,
      text: `${fallback.text}\n\nI could not check the live web for this, so treat recent facts as unverified.`,
    };
  }
}

async function requestCompletion(model: string, messages: ModelMessage[], web: boolean): Promise<Completion> {
  const key = process.env.OPENROUTER_API_KEY?.trim() ?? "";
  if (!key) throw new Error("OPENROUTER_NOT_CONFIGURED");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), web ? 60_000 : 45_000);
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
        "x-title": "Mandara AI",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: web ? 0.2 : 0.3,
        max_tokens: 900,
        usage: { include: true },
        ...(web
          ? {
              plugins: [{ id: "web", engine: "exa", max_results: 5 }],
            }
          : {}),
      }),
    });
    if (!response.ok) {
      const detail = (await response.text()).replace(/\s+/g, " ").slice(0, 180);
      throw new Error(`The model gateway returned status ${response.status}. ${detail}`.trim());
    }
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string; annotations?: unknown } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
    };
    const message = payload.choices?.[0]?.message;
    const text = message?.content?.trim() ?? "";
    if (!text) throw new Error("The model returned an empty answer.");
    const promptTokens = payload.usage?.prompt_tokens ?? 0;
    const completionTokens = payload.usage?.completion_tokens ?? 0;
    const sources = sourcesFromAnnotations(message?.annotations);
    if (typeof payload.usage?.cost === "number") {
      return { text, model, promptTokens, completionTokens, costUsd: payload.usage.cost, costKnown: true, sources };
    }
    const rates = ESTIMATES[model] ?? [0.2, 0.8];
    const costUsd = (promptTokens * rates[0] + completionTokens * rates[1]) / 1_000_000;
    return { text, model, promptTokens, completionTokens, costUsd, costKnown: false, sources };
  } finally {
    clearTimeout(timer);
  }
}

export function sourcesFromAnnotations(annotations: unknown): WebSource[] {
  if (!Array.isArray(annotations)) return [];
  const seen = new Set<string>();
  const sources: WebSource[] = [];
  for (const item of annotations) {
    if (!item || typeof item !== "object") continue;
    const citation = (item as { url_citation?: { url?: unknown; title?: unknown } }).url_citation;
    const url = typeof citation?.url === "string" ? citation.url.trim() : "";
    if (!/^https?:\/\//i.test(url) || seen.has(url)) continue;
    seen.add(url);
    const title = typeof citation?.title === "string" && citation.title.trim() ? citation.title.trim() : url;
    sources.push({ title, url });
    if (sources.length === 4) break;
  }
  return sources;
}
