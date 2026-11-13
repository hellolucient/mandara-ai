import { addDocument } from "@/lib/knowledge";
import { extractText, fileKind, safeFilename } from "@/lib/extract-text";
import { json, rejectCrossOrigin } from "@/lib/http";
import { isResponse, requireMember } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const blocked = rejectCrossOrigin(request);
  if (blocked) return blocked;
  const member = await requireMember(request);
  if (isResponse(member)) return member;
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return json({ error: "Choose a file." }, 400);
  if (file.size > 5_000_000) return json({ error: "Documents are limited to 5 MB." }, 413);
  if (!fileKind(file.name, file.type)) return json({ error: "Use a PDF, Word, text, Markdown or CSV file." }, 400);
  const visibility = String(form.get("visibility") ?? "company");
  if (visibility !== "company" && visibility !== "restricted") return json({ error: "Unknown visibility." }, 400);
  if (visibility === "restricted" && member.role === "staff") {
    return json({ error: "Only a manager or administrator can store a restricted document." }, 403);
  }
  try {
    const text = await extractText(file.name, file.type, new Uint8Array(await file.arrayBuffer()));
    if (text.trim().length < 20) return json({ error: "That file did not contain enough readable text." }, 400);
    const title = String(form.get("title") ?? "").trim().slice(0, 120) || safeFilename(file.name);
    await addDocument({
      stage: member.stage,
      title,
      filename: safeFilename(file.name),
      mime: file.type || "application/octet-stream",
      visibility,
      uploadedBy: member.sub,
      byteSize: file.size,
      text,
    });
    return json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The document could not be read.";
    return json({ error: message }, 400);
  }
}
