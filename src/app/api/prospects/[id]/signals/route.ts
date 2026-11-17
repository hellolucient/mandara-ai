import { handleAddSignal } from "@/lib/prospects-api";
import { requireMember } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return handleAddSignal(await requireMember(request), request, id);
}
