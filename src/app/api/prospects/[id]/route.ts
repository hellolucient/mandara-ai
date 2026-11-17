import { handleGetProspect, handleUpdateProspect } from "@/lib/prospects-api";
import { requireMember } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return handleGetProspect(await requireMember(request), id);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return handleUpdateProspect(await requireMember(request), request, id);
}
