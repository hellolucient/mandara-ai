import { handleImport } from "@/lib/prospects-api";
import { requireMember } from "@/lib/session";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  return handleImport(await requireMember(request), request);
}
