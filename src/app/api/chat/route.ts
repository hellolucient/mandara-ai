import { reply } from "@/lib/chat";
import { ATTACHMENT_MAX_BYTES, imageKindFromBytes, isDeclaredImage, readChatImage } from "@/lib/chat-images";
import { extractText, safeFilename } from "@/lib/extract-text";
import { json, rejectCrossOrigin } from "@/lib/http";
import { isResponse, requireMember } from "@/lib/session";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  const blocked = rejectCrossOrigin(request);
  if (blocked) return blocked;
  const member = await requireMember(request);
  if (isResponse(member)) return member;
  try {
    const payload = await readPayload(request);
    const result = await reply({ member, ...payload });
    return json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The message could not be answered.";
    const status = message.includes("limit") ? 429 : 400;
    return json({ error: message }, status);
  }
}

async function readPayload(request: Request) {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const body = (await request.json()) as { content?: string; conversationId?: string; mode?: string };
    return { conversationId: body.conversationId ?? "", conversationMode: body.mode ?? "general", content: body.content ?? "" };
  }
  const form = await request.formData();
  const file = form.get("file");
  let attachmentName = "";
  let attachmentText = "";
  let attachmentImage = "";
  if (file instanceof File && file.size > 0) {
    if (file.size > ATTACHMENT_MAX_BYTES) throw new Error("Attachments are limited to 2 MB.");
    attachmentName = safeFilename(file.name);
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (isDeclaredImage(file.name, file.type) || imageKindFromBytes(bytes)) {
      attachmentImage = readChatImage(file.name, file.type, bytes).dataUrl;
    } else {
      attachmentText = await extractText(file.name, file.type, bytes);
      if (!attachmentText.trim()) throw new Error("That file did not contain readable text.");
    }
  }
  return {
    conversationId: String(form.get("conversationId") ?? ""),
    conversationMode: String(form.get("mode") ?? "general"),
    content: String(form.get("content") ?? ""),
    attachmentName,
    attachmentText,
    attachmentImage,
  };
}
