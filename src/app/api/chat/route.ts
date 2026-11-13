import { reply } from "@/lib/chat";
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
    const body = (await request.json()) as { content?: string; conversationId?: string };
    return { conversationId: body.conversationId ?? "", content: body.content ?? "" };
  }
  const form = await request.formData();
  const file = form.get("file");
  let attachmentName = "";
  let attachmentText = "";
  if (file instanceof File && file.size > 0) {
    if (file.size > 2_000_000) throw new Error("Attachments are limited to 2 MB.");
    attachmentName = safeFilename(file.name);
    attachmentText = await extractText(file.name, file.type, new Uint8Array(await file.arrayBuffer()));
    if (!attachmentText.trim()) throw new Error("That file did not contain readable text.");
  }
  return {
    conversationId: String(form.get("conversationId") ?? ""),
    content: String(form.get("content") ?? ""),
    attachmentName,
    attachmentText,
  };
}
