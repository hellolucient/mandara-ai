import { deleteConversation } from "@/lib/chat";
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
