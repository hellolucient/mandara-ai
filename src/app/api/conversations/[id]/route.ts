import { deleteConversation, renameConversation } from "@/lib/chat";
import { json, rejectCrossOrigin } from "@/lib/http";
import { isResponse, requireMember } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const blocked = rejectCrossOrigin(request);
  if (blocked) return blocked;
  const member = await requireMember(request);
  if (isResponse(member)) return member;
  const { id } = await context.params;
  const removed = await deleteConversation(member, id);
  if (!removed) return json({ error: "That conversation is not in your workspace." }, 404);
  return json({ ok: true });
}

/** Rename: { "title": "…" }. Only the owner's own conversations. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const blocked = rejectCrossOrigin(request);
  if (blocked) return blocked;
  const member = await requireMember(request);
  if (isResponse(member)) return member;
  const { id } = await context.params;
  let title = "";
  try {
    const body = (await request.json()) as { title?: unknown };
    title = typeof body.title === "string" ? body.title : "";
  } catch {
    return json({ error: "Send a title." }, 400);
  }
  if (!title.trim()) return json({ error: "Give the chat a name." }, 400);
  const renamed = await renameConversation(member, id, title);
  if (!renamed) return json({ error: "That conversation is not in your workspace." }, 404);
  return json({ ok: true });
}
