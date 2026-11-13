import { deleteMemory, getMemories } from "@/lib/memory";
import { json, rejectCrossOrigin } from "@/lib/http";
import { isResponse, requireMember } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const blocked = rejectCrossOrigin(request);
  if (blocked) return blocked;
  const member = await requireMember(request);
  if (isResponse(member)) return member;
  
  const memories = await getMemories(member.stage, member.sub);
  return json({ memories });
}

export async function DELETE(request: Request) {
  const blocked = rejectCrossOrigin(request);
  if (blocked) return blocked;
  const member = await requireMember(request);
  if (isResponse(member)) return member;
  
  const body = (await request.json()) as { id?: string };
  if (!body.id) return json({ error: "Memory ID required" }, 400);
  
  const deleted = await deleteMemory(member.stage, member.sub, body.id);
  if (!deleted) return json({ error: "Memory not found" }, 404);
  
  return json({ ok: true });
}
