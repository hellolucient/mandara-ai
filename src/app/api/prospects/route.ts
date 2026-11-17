import { handleListProspects } from "@/lib/prospects-api";
import { requireMember } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleListProspects(await requireMember(request));
}
