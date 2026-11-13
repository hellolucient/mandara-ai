import { probeDsr } from "@/lib/dsr-probe";
import { sql } from "@/lib/db";
import { json, rejectCrossOrigin } from "@/lib/http";
import { newId } from "@/lib/ids";
import { canManage } from "@/lib/members";
import { isResponse, requireMember } from "@/lib/session";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const blocked = rejectCrossOrigin(request);
  if (blocked) return blocked;
  const member = await requireMember(request);
  if (isResponse(member)) return member;
  if (!canManage(member.role)) return json({ error: "A manager or administrator can check the DSR sign-in." }, 403);

  const result = await probeDsr().catch(() => null);
  const note = result?.note || "The DSR sign-in check failed.";
  const failed = !result?.signedIn;
  await sql(
    `insert into agent_runs (id, stage, agent, trigger, status, actor, finished_at, summary, report, log, error)
     values ($1, $2, 'maldives-daily-sales', 'check', $3, $4, now(), $5, '', $6, $7)`,
    [
      newId(),
      member.stage,
      failed ? "failed" : "completed",
      member.email || member.sub,
      note,
      note,
      failed ? note : "",
    ],
  );
  return json({ ok: !failed, summary: note });
}
