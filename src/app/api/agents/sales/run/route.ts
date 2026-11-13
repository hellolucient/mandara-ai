import { runSalesAgent } from "@/lib/agent";
import { json, rejectCrossOrigin } from "@/lib/http";
import { canManage } from "@/lib/members";
import { isResponse, requireMember } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const blocked = rejectCrossOrigin(request);
  if (blocked) return blocked;
  const member = await requireMember(request);
  if (isResponse(member)) return member;
  if (!canManage(member.role)) return json({ error: "A manager or administrator can run the sales agent." }, 403);
  const run = await runSalesAgent({ stage: member.stage, trigger: "manual", actor: member.email || member.sub });
  return json({ status: run.status, summary: run.summary, error: run.error, report: run.report });
}
