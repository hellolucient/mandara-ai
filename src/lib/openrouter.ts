export type ModelMessage = { role: "system" | "user" | "assistant"; content: string };

export type Completion = {
  text: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  costKnown: boolean;
};

const ESTIMATES: Record<string, [number, number]> = {
  "google/gemini-2.5-flash": [0.15, 0.6],
  "google/gemini-2.0-flash-001": [0.1, 0.4],
  "meta-llama/llama-3.3-70b-instruct": [0.12, 0.28],
};

export function modelConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

export async function complete(model: string, messages: ModelMessage[]): Promise<Completion> {
  const key = process.env.OPENROUTER_API_KEY?.trim() ?? "";
  if (!key) throw new Error("OPENROUTER_NOT_CONFIGURED");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
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
        temperature: 0.3,
        max_tokens: 900,
        usage: { include: true },
      }),
    });
    if (!response.ok) {
      throw new Error(`The model gateway returned status ${response.status}.`);
    }
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
    };
    const text = payload.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) throw new Error("The model returned an empty answer.");
    const promptTokens = payload.usage?.prompt_tokens ?? 0;
    const completionTokens = payload.usage?.completion_tokens ?? 0;
    if (typeof payload.usage?.cost === "number") {
      return { text, model, promptTokens, completionTokens, costUsd: payload.usage.cost, costKnown: true };
    }
    const rates = ESTIMATES[model] ?? [0.2, 0.8];
    const costUsd = (promptTokens * rates[0] + completionTokens * rates[1]) / 1_000_000;
    return { text, model, promptTokens, completionTokens, costUsd, costKnown: false };
  } finally {
    clearTimeout(timer);
  }
}
