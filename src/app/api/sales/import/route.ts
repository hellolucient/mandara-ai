import { canManage } from "@/lib/members";
import { parseCsv, validateExtract } from "@/lib/sales-validate";
import { saveExtract } from "@/lib/sales-store";
import { json, rejectCrossOrigin } from "@/lib/http";
import { isResponse, requireMember } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const blocked = rejectCrossOrigin(request);
  if (blocked) return blocked;
  const member = await requireMember(request);
  if (isResponse(member)) return member;
  if (!canManage(member.role)) return json({ error: "A manager or administrator can import sales." }, 403);
  const type = request.headers.get("content-type") ?? "";
  let validated;
  if (type.includes("application/json")) {
    const raw = await request.text();
    if (raw.length > 500_000) return json({ error: "That file is too large." }, 413);
    try {
      validated = validateExtract(JSON.parse(raw));
    } catch {
      return json({ error: "The file was not valid JSON." }, 400);
    }
  } else {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return json({ error: "Choose a CSV or JSON file." }, 400);
    if (file.size > 500_000) return json({ error: "That file is too large." }, 413);
    const text = await file.text();
    validated = file.name.toLowerCase().endsWith(".json") ? safeJson(text) : parseCsv(text);
  }
  if (!validated.ok) return json({ error: validated.error }, 422);
  await saveExtract(member.stage, validated.extract, "import");
  return json({ ok: true, issues: validated.extract.issues, businessDate: validated.extract.businessDate });
}

function safeJson(text: string) {
  try {
    return validateExtract(JSON.parse(text));
  } catch {
    return { ok: false as const, error: "The file was not valid JSON." };
  }
}
