import { businessToday } from "@/lib/dates";
import { json, rejectCrossOrigin } from "@/lib/http";
import type { Member } from "@/lib/members";
import { canSeeProspects } from "@/lib/prospects-access";
import {
  addProspectNote,
  addSignal,
  getProspect,
  importProspects,
  listProspects,
  setProspectStatus,
} from "@/lib/prospects-store";
import { isStatus, isoDate, validateProspectImport, validateSignal, scrubContact } from "@/lib/prospects-validate";

// Route handlers for /api/prospects. Each one receives the result of requireMember
// (a Member, or the 401/403 Response it produced) so tests can call them with any role.

const MAX_IMPORT_BYTES = 3_000_000;

export type Caller = Member | Response;

/** Refuses anyone who is not an administrator. Returns the Response to send, or null to continue. */
export function prospectsGate(caller: Caller): Response | null {
  if (caller instanceof Response) return caller;
  if (!canSeeProspects(caller.role)) return json({ error: "Prospects are for administrators only." }, 403);
  return null;
}

function viewer(member: Member) {
  return { stage: member.stage, role: member.role, name: member.name };
}

async function readJson(request: Request, max = 100_000): Promise<unknown> {
  const raw = await request.text();
  if (raw.length > max) throw new Error("too large");
  return JSON.parse(raw);
}

export async function handleListProspects(caller: Caller): Promise<Response> {
  const denied = prospectsGate(caller);
  if (denied) return denied;
  const member = caller as Member;
  return json({ prospects: await listProspects(viewer(member)) });
}

export async function handleGetProspect(caller: Caller, id: string): Promise<Response> {
  const denied = prospectsGate(caller);
  if (denied) return denied;
  const found = await getProspect(viewer(caller as Member), id);
  return found ? json(found) : json({ error: "That prospect was not found." }, 404);
}

export async function handleUpdateProspect(caller: Caller, request: Request, id: string): Promise<Response> {
  const blocked = rejectCrossOrigin(request);
  if (blocked) return blocked;
  const denied = prospectsGate(caller);
  if (denied) return denied;
  let body: { status?: unknown; date?: unknown };
  try {
    body = (await readJson(request)) as typeof body;
  } catch {
    return json({ error: "The request was not valid JSON." }, 400);
  }
  if (!isStatus(body.status)) return json({ error: "Choose a valid stage." }, 422);
  const date = isoDate(body.date) ?? businessToday();
  const ok = await setProspectStatus(viewer(caller as Member), id, body.status, date);
  return ok ? json({ ok: true }) : json({ error: "That prospect was not found." }, 404);
}

export async function handleAddNote(caller: Caller, request: Request, id: string): Promise<Response> {
  const blocked = rejectCrossOrigin(request);
  if (blocked) return blocked;
  const denied = prospectsGate(caller);
  if (denied) return denied;
  let body: { date?: unknown; body?: unknown };
  try {
    body = (await readJson(request)) as typeof body;
  } catch {
    return json({ error: "The request was not valid JSON." }, 400);
  }
  const date = isoDate(body.date);
  const text = typeof body.body === "string" ? scrubContact(body.body.trim()).slice(0, 4000) : "";
  if (!date) return json({ error: "Choose a date for the note." }, 422);
  if (!text) return json({ error: "Write the note first." }, 422);
  const ok = await addProspectNote(viewer(caller as Member), id, date, text);
  return ok ? json({ ok: true }) : json({ error: "That prospect was not found." }, 404);
}

export async function handleAddSignal(caller: Caller, request: Request, id: string): Promise<Response> {
  const blocked = rejectCrossOrigin(request);
  if (blocked) return blocked;
  const denied = prospectsGate(caller);
  if (denied) return denied;
  let body: Record<string, unknown>;
  try {
    body = (await readJson(request)) as Record<string, unknown>;
  } catch {
    return json({ error: "The request was not valid JSON." }, 400);
  }
  const checked = validateSignal({ ...body, prospect: id });
  if (!checked.ok) return json({ error: checked.error }, 422);
  const outcome = await addSignal(viewer(caller as Member), id, checked.value);
  if (outcome === "missing") return json({ error: "That prospect was not found." }, 404);
  return json({ ok: true, duplicate: outcome === "duplicate" });
}

/** Prospects > Import workbook. Accepts the JSON file built from the resort intel workbook, as a form upload or a JSON body. */
export async function handleImport(caller: Caller, request: Request): Promise<Response> {
  const blocked = rejectCrossOrigin(request);
  if (blocked) return blocked;
  const denied = prospectsGate(caller);
  if (denied) return denied;
  const type = request.headers.get("content-type") ?? "";
  let raw: string;
  if (type.includes("application/json")) {
    raw = await request.text();
  } else {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return json({ error: "Choose the prospects JSON file." }, 400);
    }
    const file = form.get("file");
    if (!(file instanceof File)) return json({ error: "Choose the prospects JSON file." }, 400);
    if (file.size > MAX_IMPORT_BYTES) return json({ error: "That file is too large." }, 413);
    raw = await file.text();
  }
  if (raw.length > MAX_IMPORT_BYTES) return json({ error: "That file is too large." }, 413);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return json({ error: "The file was not valid JSON." }, 400);
  }
  const checked = validateProspectImport(parsed);
  if (!checked.ok) return json({ error: checked.error }, 422);
  const result = await importProspects(viewer(caller as Member), checked.value);
  return json({ ok: true, ...result });
}
