export const ATTACHMENT_MAX_BYTES = 2_000_000;

/** Cheap, vision-capable OpenRouter model used when the chat or reasoning model cannot see images. */
export const VISION_MODEL_DEFAULT = "google/gemini-2.5-flash";

export type ImageKind = "jpeg" | "png" | "webp" | "heic";

const IMAGE_MIME: Record<ImageKind, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
};

const HEIC_BRANDS = new Set(["heic", "heix", "heif", "hevc", "hevx", "mif1", "msf1"]);

export function isDeclaredImage(filename: string, mime: string): boolean {
  const type = mime.toLowerCase().trim();
  if (type.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|heic|heif)$/i.test(filename);
}

export function imageKindFromBytes(bytes: Uint8Array): ImageKind | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "webp";
  }
  if (isHeic(bytes)) return "heic";
  return null;
}

function isHeic(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  if (bytes[4] !== 0x66 || bytes[5] !== 0x74 || bytes[6] !== 0x79 || bytes[7] !== 0x70) return false;
  const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]).toLowerCase();
  return HEIC_BRANDS.has(brand);
}

export function imageDataUrl(bytes: Uint8Array, kind: ImageKind): string {
  return `data:${IMAGE_MIME[kind]};base64,${Buffer.from(bytes).toString("base64")}`;
}

export function readChatImage(filename: string, mime: string, bytes: Uint8Array): { kind: ImageKind; dataUrl: string } {
  if (bytes.length === 0) throw new Error("That image was empty.");
  if (bytes.length > ATTACHMENT_MAX_BYTES) throw new Error("Attachments are limited to 2 MB.");
  const kind = imageKindFromBytes(bytes);
  if (!kind) throw new Error("Use a JPEG, PNG, WebP or HEIC photo, or a PDF, Word, text, Markdown or CSV file.");
  void filename;
  void mime;
  return { kind, dataUrl: imageDataUrl(bytes, kind) };
}

/**
 * Gemini, GPT-4o-class, Claude 3+, and explicit vision/VL tags can see images.
 * Image-generation ids (for example google/gemini-2.5-flash-image) are excluded.
 * deepseek/deepseek-v4.1-flash and deepseek/deepseek-v4-pro are text-only.
 */
export function modelSupportsVision(model: string): boolean {
  const id = model.trim().toLowerCase();
  if (!id) return false;
  if (/-image(?:-|$)/.test(id)) return false;
  if (/(^|\/)(dall-e|flux|ideogram|stable-diffusion|imagen)\b/.test(id)) return false;
  if (id.startsWith("google/gemini-")) return true;
  if (id.startsWith("openai/gpt-4o") || id.startsWith("openai/chatgpt-4o")) return true;
  if (id.startsWith("openai/gpt-4.1") || id.startsWith("openai/gpt-5")) return true;
  if (id.startsWith("anthropic/claude-3")) return true;
  if (/^anthropic\/claude-(sonnet|haiku|opus)/.test(id)) return true;
  if (id.startsWith("meta-llama/llama-4")) return true;
  if (/\b(vision|llava)/.test(id) || /(^|[-/.])vl([-/.]|$)/.test(id)) return true;
  return false;
}

export function modelForAttachment(input: {
  chatModel: string;
  reasoningModel: string;
  visionModel: string;
  useReasoning: boolean;
  hasImage: boolean;
}): string {
  const preferred = input.useReasoning ? input.reasoningModel : input.chatModel;
  if (!input.hasImage) return preferred;
  if (modelSupportsVision(preferred)) return preferred;
  const configured = input.visionModel.trim();
  return configured || VISION_MODEL_DEFAULT;
}
