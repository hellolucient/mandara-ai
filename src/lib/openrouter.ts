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
  images: string[];
};

const ESTIMATES: Record<string, [number, number]> = {
  "google/gemini-2.5-flash": [0.15, 0.6],
  "google/gemini-2.0-flash-001": [0.1, 0.4],
  "meta-llama/llama-3.3-70b-instruct": [0.12, 0.28],
};

const IMAGE_MODEL = "google/gemini-2.5-flash-image";
const ASPECTS = new Set(["1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9"]);

const PICTURE_TOOL = {
  type: "function",
  function: {
    name: "create_picture",
    description:
      "Create an original picture, mockup, or concept drawing. Use it when the person wants to see a design, drawing, or visual concept.",
    parameters: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "A complete visual description of the picture." },
        aspect_ratio: { type: "string", enum: [...ASPECTS] },
      },
      required: ["prompt"],
    },
  },
};

type ToolCall = { prompt: string; aspectRatio: string };

export function modelConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

export function asksForPicture(text: string): boolean {
  return /\b(draw|sketch|illustrat|mock-?up|concept (drawing|image|card|design)|picture of|image of)\b/i.test(text)
    || /\b(create|make|design|show)\b[\s\S]{0,48}\b(drawing|picture|image|mock-?up|concept)\b/i.test(text);
}

export function gatewayBody(model: string, messages: ModelMessage[], web: boolean, pictures: boolean) {
  const plugins: Array<Record<string, unknown>> = [];
  if (model === "openrouter/auto") plugins.push({ id: "auto-router", cost_tier: "medium" });
  if (model === "openrouter/auto-beta") plugins.push({ id: "auto-beta-router", cost_tier: "medium" });
  if (web) plugins.push({ id: "web", engine: "exa", max_results: 5 });
  return {
    model,
    messages,
    temperature: 0.4,
    max_tokens: 2200,
    usage: { include: true },
    ...(plugins.length > 0 ? { plugins } : {}),
    ...(pictures ? { tools: [PICTURE_TOOL], tool_choice: "auto" } : {}),
  };
}

export async function complete(model: string, messages: ModelMessage[], web = false, pictures = false): Promise<Completion> {
  const lastUser = [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
  const drawNow = pictures && asksForPicture(lastUser);
  const directPicture = drawNow ? createPicture(lastUser.slice(0, 2000), "3:2") : Promise.resolve(null);
  try {
    return await finish(model, messages, web, pictures && !drawNow, directPicture, drawNow);
  } catch (error) {
    if (!web || !(error instanceof Error) || !/status 4\d\d/.test(error.message)) throw error;
    const fallback = await finish(model, messages, false, pictures && !drawNow, directPicture, drawNow);
    return {
      ...fallback,
      text: `${fallback.text}\n\nI could not check the live web for this, so treat recent facts as unverified.`,
    };
  }
}

async function finish(
  model: string,
  messages: ModelMessage[],
  web: boolean,
  tools: boolean,
  directPicture: Promise<{ url: string; costUsd: number } | null>,
  expectDirect: boolean,
): Promise<Completion> {
  const completion = await requestCompletion(model, messages, web, tools);
  const drawn = await picturesFromTools(completion.toolCalls);
  const direct = expectDirect ? await directPicture : null;
  const images = [...drawn.images, ...(direct?.url ? [direct.url] : [])].slice(0, 2);
  let text = completion.text;
  if (!text && images.length > 0) text = "Here is the concept.";
  if ((expectDirect || completion.toolCalls.length > 0) && images.length === 0) {
    text = text ? `${text}\n\nI could not create the picture this time.` : "I could not create the picture this time.";
  }
  if (!text) throw new Error("The model returned an empty answer.");
  const costUsd = completion.costUsd + drawn.costUsd + (direct?.costUsd ?? 0);
  const costKnown = completion.costKnown || drawn.costUsd > 0 || (direct?.costUsd ?? 0) > 0;
  return { ...completion, text, images, costUsd, costKnown };
}

async function requestCompletion(model: string, messages: ModelMessage[], web: boolean, tools: boolean): Promise<Completion & { toolCalls: ToolCall[] }> {
  const key = process.env.OPENROUTER_API_KEY?.trim() ?? "";
  if (!key) throw new Error("OPENROUTER_NOT_CONFIGURED");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), web ? 55_000 : 40_000);
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
        "x-title": "Mandara AI",
      },
      body: JSON.stringify(gatewayBody(model, messages, web, tools)),
    });
    if (!response.ok) {
      const detail = (await response.text()).replace(/\s+/g, " ").slice(0, 180);
      throw new Error(`The model gateway returned status ${response.status}. ${detail}`.trim());
    }
    const payload = (await response.json()) as {
      model?: string;
      choices?: Array<{ message?: { content?: string | null; annotations?: unknown; tool_calls?: unknown } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
    };
    const message = payload.choices?.[0]?.message;
    const text = typeof message?.content === "string" ? message.content.trim() : "";
    const toolCalls = readToolCalls(message?.tool_calls);
    const promptTokens = payload.usage?.prompt_tokens ?? 0;
    const completionTokens = payload.usage?.completion_tokens ?? 0;
    const served = typeof payload.model === "string" && payload.model.trim() ? payload.model.trim() : model;
    const sources = sourcesFromAnnotations(message?.annotations);
    const base = { text, model: served, promptTokens, completionTokens, sources, images: [] as string[], toolCalls };
    if (typeof payload.usage?.cost === "number") {
      return { ...base, costUsd: payload.usage.cost, costKnown: true };
    }
    const rates = ESTIMATES[served] ?? ESTIMATES[model] ?? [1, 5];
    const costUsd = (promptTokens * rates[0] + completionTokens * rates[1]) / 1_000_000;
    return { ...base, costUsd, costKnown: false };
  } finally {
    clearTimeout(timer);
  }
}

function readToolCalls(value: unknown): ToolCall[] {
  if (!Array.isArray(value)) return [];
  const calls: ToolCall[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const fn = (item as { function?: { name?: unknown; arguments?: unknown } }).function;
    if (fn?.name !== "create_picture") continue;
    let parsed: { prompt?: unknown; aspect_ratio?: unknown } = {};
    if (typeof fn.arguments === "string") {
      try {
        parsed = JSON.parse(fn.arguments) as { prompt?: unknown; aspect_ratio?: unknown };
      } catch {
        parsed = {};
      }
    }
    const prompt = typeof parsed.prompt === "string" ? parsed.prompt.trim() : "";
    if (!prompt) continue;
    const aspect = typeof parsed.aspect_ratio === "string" && ASPECTS.has(parsed.aspect_ratio) ? parsed.aspect_ratio : "3:2";
    calls.push({ prompt: prompt.slice(0, 2000), aspectRatio: aspect });
    if (calls.length === 2) break;
  }
  return calls;
}

async function picturesFromTools(calls: ToolCall[]): Promise<{ images: string[]; costUsd: number }> {
  const images: string[] = [];
  let costUsd = 0;
  for (const call of calls) {
    const picture = await createPicture(call.prompt, call.aspectRatio).catch(() => null);
    if (!picture) continue;
    images.push(picture.url);
    costUsd += picture.costUsd;
  }
  return { images, costUsd };
}

async function createPicture(prompt: string, aspectRatio: string): Promise<{ url: string; costUsd: number } | null> {
  const key = process.env.OPENROUTER_API_KEY?.trim() ?? "";
  if (!key || !prompt.trim()) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 50_000);
  try {
    const response = await fetch("https://openrouter.ai/api/v1/images", {
      method: "POST",
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
        "x-title": "Mandara AI",
      },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        prompt: prompt.trim().slice(0, 2000),
        aspect_ratio: ASPECTS.has(aspectRatio) ? aspectRatio : "3:2",
      }),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      data?: Array<{ b64_json?: string; media_type?: string }>;
      usage?: { cost?: number };
    };
    const encoded = payload.data?.[0]?.b64_json?.replace(/\s/g, "") ?? "";
    const media = payload.data?.[0]?.media_type || "image/png";
    if (!encoded || encoded.length > 5_000_000 || !/^image\/(png|jpeg|webp)$/.test(media)) return null;
    const costUsd = typeof payload.usage?.cost === "number" ? payload.usage.cost : 0;
    return { url: `data:${media};base64,${encoded}`, costUsd };
  } catch {
    return null;
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
