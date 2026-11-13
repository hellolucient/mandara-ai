import { deleteDocument } from "@/lib/knowledge";
import { json, rejectCrossOrigin } from "@/lib/http";
import { isResponse, requireMember } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const blocked = rejectCrossOrigin(request);
  if (blocked) return blocked;
  const member = await requireMember(request);
  if (isResponse(member)) return member;
  const { id } = await context.params;
  const removed = await deleteDocument(member.stage, id, member.sub, member.role);
  if (!removed) return json({ error: "That document cannot be removed with this role." }, 403);
  return json({ ok: true });
}
