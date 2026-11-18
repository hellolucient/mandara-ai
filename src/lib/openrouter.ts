import { buildPicturePrompt, isImageRefineOrPrintTask, isShortImageFollowUp } from "@/lib/mandara-context";

export type ModelContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type ModelMessage = { role: "system" | "user" | "assistant"; content: string | ModelContentPart[] };

export function textFromContent(content: ModelMessage["content"]): string {
  if (typeof content === "string") return content;
  return content
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

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
  "deepseek/deepseek-v4.1-flash": [0.3, 1.2],
  "deepseek/deepseek-v4.1-flash-1017": [0.038, 0.5],
  "deepseek/deepseek-v4-pro": [0.9, 1.5],
};

const IMAGE_MODEL_DEFAULT = "google/gemini-2.5-flash-image";
const IMAGE_MODEL_FALLBACK = "google/gemini-3.1-flash-image";
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

export function asksForPicture(text: string, context: { priorImage?: boolean } = {}): boolean {
  if (/\b(draw|sketch|illustrat|mock-?up|concept (drawing|image|card|design)|picture of|image of)\b/i.test(text)
    || /\b(create|make|design|show)\b[\s\S]{0,48}\b(drawing|picture|image|mock-?up|concept)\b/i.test(text)) {
    return true;
  }
  if (isImageRefineOrPrintTask(text)) return true;
  if (context.priorImage && isShortImageFollowUp(text)) return true;
  return false;
}

function historyTexts(messages: ModelMessage[]): string[] {
  const texts: string[] = [];
  for (const message of messages) {
    if (message.role === "system") continue;
    const text = textFromContent(message.content).trim();
    if (text) texts.push(text);
  }
  // The current user message is last; keep earlier turns only.
  return texts.slice(0, -1).slice(-6);
}

function conversationHasPicture(messages: ModelMessage[]): boolean {
  return messages.some((message) => {
    if (message.role === "system") return false;
    const text = textFromContent(message.content);
    return /\[This reply included a generated picture\.\]/.test(text) || /\ba picture was generated\b/i.test(text);
  });
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

export async function complete(model: string, messages: ModelMessage[], web = false, pictures = false, imageModel?: string): Promise<Completion> {
  const lastUser = textFromContent([...messages].reverse().find((message) => message.role === "user")?.content ?? "");
  const priorImage = conversationHasPicture(messages);
  const drawNow = pictures && asksForPicture(lastUser, { priorImage });
  const picture = drawNow ? buildPicturePrompt(lastUser, historyTexts(messages)) : null;
  const directPicture = picture ? createPicture(picture.prompt, picture.aspectRatio, imageModel ?? IMAGE_MODEL_DEFAULT) : Promise.resolve(null);
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
  directPicture: Promise<{ url: string; costUsd: number; reason?: string } | null>,
  expectDirect: boolean,
): Promise<Completion> {
  const completion = await requestCompletion(model, messages, web, tools);
  const drawn = await picturesFromTools(completion.toolCalls);
  const direct = expectDirect ? await directPicture : null;
  const directImages = completion.images.concat(drawn.images, direct?.url ? [direct.url] : []);
  const images = directImages.slice(0, 2);
  let text = completion.text;
  if (!text && images.length > 0) text = "Here is the concept.";
  if ((expectDirect || completion.toolCalls.length > 0) && images.length === 0) {
    const reason = direct?.reason ? ` (${direct.reason})` : "";
    text = text ? `${text}\n\nI could not create the picture this time${reason}.` : `I could not create the picture this time${reason}.`;
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
      const error = new Error(`The model gateway returned status ${response.status}. ${detail}`.trim());
      // Mark which model failed for fallback logic
      (error as Error & { failedModel?: string }).failedModel = model;
      throw error;
    }
    type ImageEntry = { image_url?: { url?: unknown } };
    const payload = (await response.json()) as {
      model?: string;
      choices?: Array<{ message?: { content?: string | null; annotations?: unknown; tool_calls?: unknown; images?: ImageEntry[] } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
    };
    const message = payload.choices?.[0]?.message;
    const text = typeof message?.content === "string" ? message.content.trim() : "";
    const toolCalls = readToolCalls(message?.tool_calls);
    const modalityImages = readModalityImages(message?.images);
    const promptTokens = payload.usage?.prompt_tokens ?? 0;
    const completionTokens = payload.usage?.completion_tokens ?? 0;
    const served = typeof payload.model === "string" && payload.model.trim() ? payload.model.trim() : model;
    const sources = sourcesFromAnnotations(message?.annotations);
    const base = { text, model: served, promptTokens, completionTokens, sources, images: modalityImages, toolCalls };
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

export function readModalityImages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const images: string[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const entry = item as { image_url?: { url?: unknown } };
    const url = typeof entry.image_url?.url === "string" ? entry.image_url.url.trim() : "";
    if (url && /^data:image\/(png|jpeg|webp);base64,/.test(url)) {
      images.push(url);
      if (images.length === 2) break;
    }
  }
  return images;
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
    const picture = await createPicture(call.prompt, call.aspectRatio, IMAGE_MODEL_DEFAULT).catch(() => null);
    if (!picture || !picture.url) continue;
    images.push(picture.url);
    costUsd += picture.costUsd;
  }
  return { images, costUsd };
}

async function createPicture(prompt: string, aspectRatio: string, imageModel: string): Promise<{ url: string; costUsd: number; reason?: string } | null> {
  const key = process.env.OPENROUTER_API_KEY?.trim() ?? "";
  if (!key || !prompt.trim()) return null;
  
  const result = await attemptPictureGeneration(prompt, aspectRatio, imageModel, key);
  if (result) return result;
  
  if (imageModel !== IMAGE_MODEL_FALLBACK) {
    console.warn(`Image generation failed with ${imageModel}, trying fallback ${IMAGE_MODEL_FALLBACK}`);
    return attemptPictureGeneration(prompt, aspectRatio, IMAGE_MODEL_FALLBACK, key);
  }
  
  return null;
}

async function attemptPictureGeneration(prompt: string, aspectRatio: string, model: string, key: string): Promise<{ url: string; costUsd: number; reason?: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 50_000);
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
        messages: [{ role: "user", content: prompt.trim().slice(0, 2000) }],
        modalities: ["image", "text"],
        image_config: { aspect_ratio: ASPECTS.has(aspectRatio) ? aspectRatio : "3:2" },
      }),
    });
    
    if (!response.ok) {
      const status = response.status;
      let reason = "image model unavailable";
      try {
        const errorText = await response.text();
        const errorData = JSON.parse(errorText) as { error?: { message?: string; code?: number } };
        const errorMsg = errorData.error?.message || errorText;
        console.error(`Image generation failed (${status}): ${errorMsg.slice(0, 200)}`);
        if (status === 402) reason = "out of credit";
        else if (status === 429) reason = "image model busy";
        else if (status === 503 || status === 502) reason = "image model unavailable";
        else if (errorMsg.toLowerCase().includes("credit")) reason = "out of credit";
        else if (errorMsg.toLowerCase().includes("rate")) reason = "image model busy";
      } catch {
        console.error(`Image generation failed with status ${status}`);
      }
      return { url: "", costUsd: 0, reason };
    }
    
    type ImageEntry = { image_url?: { url?: unknown } };
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { images?: ImageEntry[] } }>;
      usage?: { cost?: number };
    };
    
    const images = payload.choices?.[0]?.message?.images;
    const url = typeof images?.[0]?.image_url?.url === "string" ? images[0].image_url.url.trim() : "";
    
    if (!url || !/^data:image\/(png|jpeg|webp);base64,/.test(url) || url.length > 5_000_000) {
      console.error("Image generation returned no valid image");
      return { url: "", costUsd: 0, reason: "invalid image response" };
    }
    
    const costUsd = typeof payload.usage?.cost === "number" ? payload.usage.cost : 0;
    return { url, costUsd };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error("Image generation timed out");
      return { url: "", costUsd: 0, reason: "request timed out" };
    }
    console.error("Image generation error:", error instanceof Error ? error.message : String(error));
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
