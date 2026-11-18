import { exportWorkspace } from "@/lib/data-export";
import { json } from "@/lib/http";
import { isResponse, requireMember } from "@/lib/session";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Administrator-only download of the whole workspace, for moving to new hosting. GET /api/admin/export */
export async function GET(request: Request) {
  const member = await requireMember(request);
  if (isResponse(member)) return member;
  if (member.role !== "admin") return json({ error: "Only an administrator can export the workspace." }, 403);
  const data = await exportWorkspace(member.stage);
  const day = data.exportedAt.slice(0, 10);
  return new Response(JSON.stringify(data), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="mandara-export-${member.stage}-${day}.json"`,
      "cache-control": "private, no-store",
    },
  });
}
