import { sql } from "@/lib/db";
import { newId } from "@/lib/ids";
import { assertProspectsAccess } from "@/lib/prospects-access";
import {
  PROSPECT_STATUSES,
  STATUS_LABELS,
  type Prospect,
  type ProspectInput,
  type ProspectNote,
  type ProspectSignal,
  type ProspectStatus,
  type ProspectSummary,
  type SignalInput,
  type SignalType,
} from "@/lib/prospects-types";
import { signalDedupe, type ProspectImport } from "@/lib/prospects-validate";

/** Who is asking. Anything but an administrator is refused before the database is touched. */
export type Viewer = { role: string; stage: string; name?: string };

// Every exported function takes the viewer and refuses anyone who is not an administrator.
// The chat assistant never imports this module (see prospects-security.test.ts).

type ProspectRow = {
  id: string;
  key: string;
  name: string;
  property_type: string;
  atoll: string;
  brand_group: string;
  owner_company: string;
  management_company: string;
  keys: number | null;
  tier: string;
  spa_name: string;
  spa_operator: string;
  spa_managed_by: string;
  spa_model: string;
  mandara_history: string;
  priority: Prospect["priority"];
  verdict: string;
  status: ProspectStatus;
  timing: string;
  timing_date: string | null;
  est_spa_revenue: number | string | null;
  est_fee: number | string | null;
  gm_name: string;
  gm_since: string;
  gm_background: string;
  spa_manager: string;
  approach: string;
  owner_links: string;
  notes: string;
  confidence: string;
  intel_date: string | null;
  sources: string;
  updated_at: string;
  signal_count: number | string;
  latest_signal_date: string | null;
  latest_signal_type: SignalType | null;
  latest_signal_summary: string | null;
};

const SELECT = `
  select p.id, p.key, p.name, p.property_type, p.atoll, p.brand_group, p.owner_company, p.management_company,
         p.keys, p.tier, p.spa_name, p.spa_operator, p.spa_managed_by, p.spa_model, p.mandara_history, p.priority,
         p.verdict, p.status, p.timing, to_char(p.timing_date, 'YYYY-MM-DD') as timing_date,
         p.est_spa_revenue, p.est_fee, p.gm_name, p.gm_since, p.gm_background, p.spa_manager, p.approach,
         p.owner_links, p.notes, p.confidence, to_char(p.intel_date, 'YYYY-MM-DD') as intel_date, p.sources,
         p.updated_at::text as updated_at,
         (select count(*) from prospect_signals s where s.prospect_id = p.id) as signal_count,
         ls.signal_date as latest_signal_date, ls.type as latest_signal_type, ls.summary as latest_signal_summary
  from prospects p
  left join lateral (
    select to_char(s.signal_date, 'YYYY-MM-DD') as signal_date, s.type, s.summary
    from prospect_signals s where s.prospect_id = p.id
    order by s.signal_date desc, s.created_at desc limit 1
  ) ls on true`;

function num(value: number | string | null): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toProspect(row: ProspectRow): Prospect {
  let sources: string[] = [];
  try {
    const parsed: unknown = JSON.parse(row.sources);
    if (Array.isArray(parsed)) sources = parsed.filter((item): item is string => typeof item === "string");
  } catch {
    sources = [];
  }
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    propertyType: row.property_type,
    atoll: row.atoll,
    brandGroup: row.brand_group,
    ownerCompany: row.owner_company,
    managementCompany: row.management_company,
    keys: row.keys == null ? null : Number(row.keys),
    tier: row.tier,
    spaName: row.spa_name,
    spaOperator: row.spa_operator,
    spaManagedBy: row.spa_managed_by,
    spaModel: row.spa_model,
    mandaraHistory: row.mandara_history,
    priority: row.priority,
    verdict: row.verdict,
    status: row.status,
    timing: row.timing,
    timingDate: row.timing_date,
    estSpaRevenue: num(row.est_spa_revenue),
    estFee: num(row.est_fee),
    gmName: row.gm_name,
    gmSince: row.gm_since,
    gmBackground: row.gm_background,
    spaManager: row.spa_manager,
    approach: row.approach,
    ownerLinks: row.owner_links,
    notes: row.notes,
    confidence: row.confidence,
    intelDate: row.intel_date,
    sources,
    updatedAt: row.updated_at,
    signalCount: Number(row.signal_count ?? 0),
    latestSignal:
      row.latest_signal_date && row.latest_signal_type
        ? { date: row.latest_signal_date, type: row.latest_signal_type, summary: row.latest_signal_summary ?? "" }
        : null,
  };
}

export async function listProspects(viewer: Viewer): Promise<Prospect[]> {
  assertProspectsAccess(viewer);
  const rows = await sql<ProspectRow>(`${SELECT} where p.stage = $1 order by p.name`, [viewer.stage]);
  return rows.map(toProspect);
}

export async function getProspect(
  viewer: Viewer,
  id: string,
): Promise<{ prospect: Prospect; notes: ProspectNote[]; signals: ProspectSignal[] } | null> {
  assertProspectsAccess(viewer);
  const rows = await sql<ProspectRow>(`${SELECT} where p.stage = $1 and p.id = $2`, [viewer.stage, id]);
  if (!rows[0]) return null;
  const prospect = toProspect(rows[0]);
  const [notes, signals] = await Promise.all([
    sql<{ id: string; note_date: string; body: string; author: string; created_at: string }>(
      `select id, to_char(note_date, 'YYYY-MM-DD') as note_date, body, author, created_at::text as created_at
       from prospect_notes where stage = $1 and prospect_id = $2 order by note_date desc, created_at desc`,
      [viewer.stage, id],
    ),
    signalRows(viewer.stage, "and s.prospect_id = $2", [id], 200),
  ]);
  return {
    prospect,
    notes: notes.map((n) => ({ id: n.id, date: n.note_date, body: n.body, author: n.author, createdAt: n.created_at })),
    signals,
  };
}

async function signalRows(stage: string, where: string, params: unknown[], limit: number): Promise<ProspectSignal[]> {
  const rows = await sql<{
    id: string;
    prospect_id: string;
    prospect_name: string;
    signal_date: string;
    type: SignalType;
    summary: string;
    source_url: string;
    added_by: string;
  }>(
    `select s.id, s.prospect_id, p.name as prospect_name, to_char(s.signal_date, 'YYYY-MM-DD') as signal_date,
            s.type, s.summary, s.source_url, s.added_by
     from prospect_signals s join prospects p on p.id = s.prospect_id
     where s.stage = $1 ${where}
     order by s.signal_date desc, s.created_at desc limit ${Math.max(1, Math.min(limit, 500))}`,
    [stage, ...params],
  );
  return rows.map((r) => ({
    id: r.id,
    prospectId: r.prospect_id,
    prospectName: r.prospect_name,
    date: r.signal_date,
    type: r.type,
    summary: r.summary,
    url: r.source_url,
    addedBy: r.added_by,
  }));
}

export async function prospectSummary(viewer: Viewer): Promise<ProspectSummary> {
  assertProspectsAccess(viewer);
  const counts = await sql<{ status: ProspectStatus; n: number | string }>(
    "select status, count(*) as n from prospects where stage = $1 group by status",
    [viewer.stage],
  );
  const byStatus = Object.fromEntries(PROSPECT_STATUSES.map((s) => [s, 0])) as Record<ProspectStatus, number>;
  let total = 0;
  for (const row of counts) {
    byStatus[row.status] = Number(row.n);
    total += Number(row.n);
  }
  return { total, byStatus, recentSignals: await signalRows(viewer.stage, "", [], 4) };
}

export async function setProspectStatus(
  viewer: Viewer,
  id: string,
  status: ProspectStatus,
  date: string,
): Promise<boolean> {
  assertProspectsAccess(viewer);
  const before = await sql<{ status: ProspectStatus }>("select status from prospects where stage = $1 and id = $2", [
    viewer.stage,
    id,
  ]);
  if (!before[0]) return false;
  if (before[0].status === status) return true;
  await sql("update prospects set status = $3, updated_at = now() where stage = $1 and id = $2", [viewer.stage, id, status]);
  await sql(
    "insert into prospect_notes (id, stage, prospect_id, note_date, body, author) values ($1, $2, $3, $4, $5, $6)",
    [newId(), viewer.stage, id, date, `Stage: ${STATUS_LABELS[before[0].status]} → ${STATUS_LABELS[status]}`, viewer.name ?? ""],
  );
  return true;
}

export async function addProspectNote(
  viewer: Viewer,
  id: string,
  date: string,
  body: string,
): Promise<boolean> {
  assertProspectsAccess(viewer);
  const found = await sql("select id from prospects where stage = $1 and id = $2", [viewer.stage, id]);
  if (!found[0]) return false;
  await sql(
    "insert into prospect_notes (id, stage, prospect_id, note_date, body, author) values ($1, $2, $3, $4, $5, $6)",
    [newId(), viewer.stage, id, date, body, viewer.name ?? ""],
  );
  await sql("update prospects set updated_at = now() where stage = $1 and id = $2", [viewer.stage, id]);
  return true;
}

/** Adds one signal. Returns "added", "duplicate", or "missing" when the prospect is not found. */
export async function addSignal(
  viewer: Viewer,
  prospectId: string,
  signal: Omit<SignalInput, "prospect">,
): Promise<"added" | "duplicate" | "missing"> {
  assertProspectsAccess(viewer);
  const found = await sql("select id from prospects where stage = $1 and id = $2", [viewer.stage, prospectId]);
  if (!found[0]) return "missing";
  const rows = await sql(
    `insert into prospect_signals (id, stage, prospect_id, signal_date, type, summary, source_url, dedupe, added_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     on conflict (stage, dedupe) do nothing returning id`,
    [
      newId(),
      viewer.stage,
      prospectId,
      signal.date,
      signal.type,
      signal.summary,
      signal.url,
      signalDedupe(prospectId, signal),
      viewer.name ?? "",
    ],
  );
  return rows.length ? "added" : "duplicate";
}

export type ImportResult = {
  created: number;
  updated: number;
  signalsAdded: number;
  signalsDuplicate: number;
  signalsUnmatched: string[];
  skipped: string[];
};

/**
 * Idempotent: prospects are matched on their key. Workbook fields are refreshed on every import.
 * The stage, notes and signals an administrator has set are never overwritten. statusOnCreate
 * and initialNote apply only when the prospect is new.
 */
export async function importProspects(
  viewer: Viewer,
  data: ProspectImport,
): Promise<ImportResult> {
  assertProspectsAccess(viewer);
  const result: ImportResult = {
    created: 0,
    updated: 0,
    signalsAdded: 0,
    signalsDuplicate: 0,
    signalsUnmatched: [],
    skipped: [...data.skipped],
  };
  for (const p of data.prospects) {
    const outcome = await upsertProspect(viewer.stage, p, viewer.name ?? "");
    if (outcome === "created") result.created += 1;
    else result.updated += 1;
  }
  if (data.signals.length) {
    const index = await sql<{ id: string; key: string; name: string }>(
      "select id, key, name from prospects where stage = $1",
      [viewer.stage],
    );
    const byKey = new Map(index.map((row) => [row.key, row.id]));
    const byName = new Map(index.map((row) => [row.name.trim().toLowerCase(), row.id]));
    for (const signal of data.signals) {
      const id = byKey.get(signal.prospect) ?? byName.get(signal.prospect.trim().toLowerCase());
      if (!id) {
        result.signalsUnmatched.push(signal.prospect);
        continue;
      }
      const added = await addSignal(viewer, id, signal);
      if (added === "added") result.signalsAdded += 1;
      else result.signalsDuplicate += 1;
    }
  }
  return result;
}

async function upsertProspect(stage: string, p: ProspectInput, author: string): Promise<"created" | "updated"> {
  const fields = [
    p.name,
    p.propertyType,
    p.atoll,
    p.brandGroup,
    p.ownerCompany,
    p.managementCompany,
    p.keys,
    p.tier,
    p.spaName,
    p.spaOperator,
    p.spaManagedBy,
    p.spaModel,
    p.mandaraHistory,
    p.priority,
    p.verdict,
    p.timing,
    p.timingDate,
    p.estSpaRevenue,
    p.estFee,
    p.gmName,
    p.gmSince,
    p.gmBackground,
    p.spaManager,
    p.approach,
    p.ownerLinks,
    p.notes,
    p.confidence,
    p.intelDate,
    JSON.stringify(p.sources),
  ];
  const columns =
    "name, property_type, atoll, brand_group, owner_company, management_company, keys, tier, spa_name, spa_operator, " +
    "spa_managed_by, spa_model, mandara_history, priority, verdict, timing, timing_date, est_spa_revenue, est_fee, " +
    "gm_name, gm_since, gm_background, spa_manager, approach, owner_links, notes, confidence, intel_date, sources";
  const names = columns.split(",").map((c) => c.trim());
  const placeholders = names.map((_, i) => `$${i + 5}`).join(", ");
  const updates = names.map((c) => `${c} = excluded.${c}`).join(", ");
  const id = newId();
  const rows = await sql<{ id: string; inserted: boolean }>(
    `insert into prospects (id, stage, key, status, ${columns}, imported_at)
     values ($1, $2, $3, $4, ${placeholders}, now())
     on conflict (stage, key) do update set ${updates}, imported_at = now(), updated_at = now()
     returning id, (xmax = 0) as inserted`,
    [id, stage, p.key, p.statusOnCreate ?? "watching", ...fields],
  );
  const row = rows[0];
  if (row?.inserted && p.initialNote) {
    await sql(
      "insert into prospect_notes (id, stage, prospect_id, note_date, body, author) values ($1, $2, $3, $4, $5, $6)",
      [newId(), stage, row.id, p.initialNote.date, p.initialNote.body, author || "Import"],
    );
  }
  return row?.inserted ? "created" : "updated";
}
