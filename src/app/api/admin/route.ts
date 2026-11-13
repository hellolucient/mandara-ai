import { json, rejectCrossOrigin } from "@/lib/http";
import { listMembers, saveInvite, setMemberRole, type Role } from "@/lib/members";
import { isResponse, requireMember } from "@/lib/session";
import { updateSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

const ROLES = new Set<Role>(["admin", "manager", "staff"]);

export async function POST(request: Request) {
  const blocked = rejectCrossOrigin(request);
  if (blocked) return blocked;
  const member = await requireMember(request);
  if (isResponse(member)) return member;
  if (member.role !== "admin") return json({ error: "Only an administrator can change these settings." }, 403);
  const body = (await request.json()) as Record<string, string>;
  if (body.action === "settings") {
    await updateSettings(member.stage, {
      companyName: body.companyName ?? "",
      model: body.model ?? "",
      currency: body.currency ?? "",
    });
    return json({ ok: true });
  }
  if (body.action === "role") {
    if (!ROLES.has(body.role as Role)) return json({ error: "Unknown role." }, 400);
    const error = await setMemberRole(member.stage, body.sub ?? "", body.role as Role, member.sub);
    if (error) return json({ error }, 400);
    return json({ ok: true });
  }
  if (body.action === "invite") {
    const email = (body.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Enter a valid email." }, 400);
    if (!ROLES.has(body.role as Role)) return json({ error: "Unknown role." }, 400);
    const known = await listMembers(member.stage);
    if (known.some((person) => person.email.toLowerCase() === email)) {
      return json({ error: "That person has already opened Mandara AI. Change the role on their row." }, 400);
    }
    await saveInvite(member.stage, email, body.role as Role);
    return json({ ok: true });
  }
  return json({ error: "Unknown action." }, 400);
}
