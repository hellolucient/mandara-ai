import {
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  type LeadStatus,
  PRIORITIES,
  PROSPECT_STATUSES,
  SIGNAL_TYPES,
  type Priority,
  type ProspectInput,
  type ProspectStatus,
  type SignalInput,
  type SignalType,
} from "@/lib/prospects-types";

export type ProspectImport = { prospects: ProspectInput[]; signals: SignalInput[]; skipped: string[] };

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const PHONE = /(?<![\w/=.-])\+\d[\d ()-]{6,}\d|(?<![\w/=.:-])\b\d{3}[ -]\d{4}\b(?![\w/-])/g;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Personal contact details never get stored here: emails and phone numbers are removed from every text field. */
export function scrubContact(text: string): string {
  return text.replace(EMAIL, "[email removed]").replace(PHONE, "[phone removed]");
}

function text(value: unknown, max = 4000): string {
  if (value == null) return "";
  const raw = typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
  return scrubContact(raw.trim()).slice(0, max);
}

function number(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function isoDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function safeUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString().slice(0, 1000) : "";
  } catch {
    return "";
  }
}

/**
 * A sortable date for free-text timing such as "Opening: June 2027 (Q2 2027)" or "Late 2026".
 * Approximate on purpose: quarter = its first month, late = October, mid = June, a bare year = July.
 */
export function timingSortDate(value: string): string | null {
  const s = value.toLowerCase();
  const pad = (n: number) => String(n).padStart(2, "0");
  const exact = /\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(20\d{2})\b/.exec(s);
  if (exact) return isoDate(`${exact[3]}-${pad(MONTHS.indexOf(exact[2]) + 1)}-${pad(Number(exact[1]))}`);
  const month = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(20\d{2})\b/.exec(s);
  if (month) return `${month[2]}-${pad(MONTHS.indexOf(month[1]) + 1)}-01`;
  const quarter = /\bq([1-4])\s+(20\d{2})\b/.exec(s);
  if (quarter) return `${quarter[2]}-${pad((Number(quarter[1]) - 1) * 3 + 1)}-01`;
  const part = /\b(early|mid|late|autumn|spring|summer|winter)\s+(20\d{2})\b/.exec(s);
  if (part) {
    const m = { early: 1, spring: 3, mid: 6, summer: 6, autumn: 9, late: 10, winter: 12 }[part[1] as "early"];
    return `${part[2]}-${pad(m)}-01`;
  }
  const year = /\b(20\d{2})\b/.exec(s);
  if (year) return `${year[1]}-07-01`;
  return null;
}

export function isStatus(value: unknown): value is ProspectStatus {
  return typeof value === "string" && (PROSPECT_STATUSES as readonly string[]).includes(value);
}

export function isSignalType(value: unknown): value is SignalType {
  return typeof value === "string" && (SIGNAL_TYPES as readonly string[]).includes(value);
}

/**
 * The workbook Status column: accepts the label ("Warm lead"), the key ("warm") or close variants.
 * Returns undefined when the field is absent (older files), "" when blank, and null when unrecognised.
 */
export function leadStatus(value: unknown): LeadStatus | "" | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return "";
  if (typeof value !== "string") return null;
  const norm = value.trim().toLowerCase().replace(/[\s_-]+/g, " ").replace(/[^a-z ]/g, "").trim();
  if (!norm) return "";
  for (const key of LEAD_STATUSES) {
    if (norm === key.replace(/_/g, " ") || norm === LEAD_STATUS_LABELS[key].toLowerCase()) return key;
  }
  const aliases: Record<string, LeadStatus> = {
    "warm leads": "warm",
    "warm lead via jessel": "warm",
    "contact chased": "chasing",
    "being chased": "chasing",
    "chasing contact": "chasing",
    possibles: "possible",
    "long shots": "long_shot",
    longshot: "long_shot",
    out: "out",
    "out for now": "out",
    "watch": "watch",
    "watch only": "watch",
    "not going ahead": "not_proceeding",
    "not proceeding": "not_proceeding",
    off: "not_proceeding",
  };
  return aliases[norm] ?? null;
}

/** JC notes keep contact details on purpose: prospects are administrator-only and this field never reaches the chat model. */
function plainText(value: unknown, max: number): string | undefined {
  if (value === undefined) return undefined;
  if (value == null) return "";
  const raw = typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
  return raw.trim().slice(0, max);
}

function priority(value: unknown): Priority {
  const p = typeof value === "string" ? value.trim().toUpperCase() : "";
  return (PRIORITIES as readonly string[]).includes(p) ? (p as Priority) : "";
}

function prospectKey(value: unknown, name: string): string {
  const raw = typeof value === "string" && value.trim() ? value : name;
  return raw
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

export function validateProspect(raw: unknown): { ok: true; value: ProspectInput } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "A prospect must be an object." };
  const r = raw as Record<string, unknown>;
  const name = text(r.name, 200);
  if (!name) return { ok: false, error: "A prospect needs a name." };
  const key = prospectKey(r.key, name);
  if (!key) return { ok: false, error: `${name}: no usable key.` };
  const timing = text(r.timing, 500);
  const keys = number(r.keys);
  const note = r.initialNote as Record<string, unknown> | null | undefined;
  const noteDate = note ? isoDate(note.date) : null;
  const noteBody = note ? text(note.body, 4000) : "";
  const sources = Array.isArray(r.sources) ? r.sources.map(safeUrl).filter(Boolean).slice(0, 25) : [];
  const rawLead = r.status !== undefined ? r.status : r.leadStatus;
  const lead = leadStatus(rawLead);
  if (lead === null) return { ok: false, error: `${name}: status "${String(rawLead).slice(0, 60)}" is not a known lead status.` };
  const jcNotes = plainText(r.jcNotes, 8000);
  return {
    ok: true,
    value: {
      key,
      name,
      propertyType: text(r.propertyType, 200),
      atoll: text(r.atoll, 200),
      brandGroup: text(r.brandGroup, 300),
      ownerCompany: text(r.ownerCompany, 500),
      managementCompany: text(r.managementCompany, 1000),
      keys: keys == null ? null : Math.round(keys),
      tier: text(r.tier, 100),
      spaName: text(r.spaName, 300),
      spaOperator: text(r.spaOperator, 300),
      spaManagedBy: text(r.spaManagedBy),
      spaModel: text(r.spaModel, 100),
      mandaraHistory: text(r.mandaraHistory, 300),
      priority: priority(r.priority),
      verdict: text(r.verdict, 1000),
      timing,
      timingDate: isoDate(r.timingDate) ?? timingSortDate(timing),
      estSpaRevenue: number(r.estSpaRevenue),
      estFee: number(r.estFee),
      gmName: text(r.gmName, 500),
      gmSince: text(r.gmSince, 300),
      gmBackground: text(r.gmBackground),
      spaManager: text(r.spaManager),
      approach: text(r.approach),
      ownerLinks: text(r.ownerLinks),
      notes: text(r.notes),
      confidence: text(r.confidence, 1000),
      intelDate: isoDate(r.intelDate),
      sources: [...new Set(sources)],
      ...(lead !== undefined ? { leadStatus: lead } : {}),
      ...(jcNotes !== undefined ? { jcNotes } : {}),
      statusOnCreate: isStatus(r.statusOnCreate) ? r.statusOnCreate : null,
      initialNote: noteDate && noteBody ? { date: noteDate, body: noteBody } : null,
    },
  };
}

export function validateSignal(raw: unknown): { ok: true; value: SignalInput } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "A signal must be an object." };
  const r = raw as Record<string, unknown>;
  const prospect = text(r.prospect, 200);
  const date = isoDate(r.date);
  const summary = text(r.summary, 1000);
  if (!prospect) return { ok: false, error: "A signal needs the prospect it belongs to." };
  if (!date) return { ok: false, error: "A signal needs a date (YYYY-MM-DD)." };
  if (!isSignalType(r.type)) return { ok: false, error: "Signal type must be news, job_ad, new_gm, development or other." };
  if (!summary) return { ok: false, error: "A signal needs a summary." };
  const url = typeof r.url === "string" && r.url.trim() ? safeUrl(r.url) : "";
  if (typeof r.url === "string" && r.url.trim() && !url) return { ok: false, error: "The source link must start with http or https." };
  return { ok: true, value: { prospect, date, type: r.type, summary, url } };
}

/** The file Prospects > Import workbook accepts: { kind: "mandara-prospects", prospects: [...], signals: [...] }. */
export function validateProspectImport(raw: unknown): { ok: true; value: ProspectImport } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "The file is not a prospects import." };
  const r = raw as Record<string, unknown>;
  if (r.kind !== "mandara-prospects") return { ok: false, error: 'The file is not a prospects import (kind must be "mandara-prospects").' };
  const rawProspects = Array.isArray(r.prospects) ? r.prospects : [];
  const rawSignals = Array.isArray(r.signals) ? r.signals : [];
  if (rawProspects.length === 0 && rawSignals.length === 0) return { ok: false, error: "The file has no prospects or signals." };
  if (rawProspects.length > 1000 || rawSignals.length > 2000) return { ok: false, error: "That file has too many rows." };
  const prospects: ProspectInput[] = [];
  const signals: SignalInput[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();
  for (const item of rawProspects) {
    const result = validateProspect(item);
    if (!result.ok) skipped.push(result.error);
    else if (seen.has(result.value.key)) skipped.push(`${result.value.name}: listed twice, kept the first.`);
    else {
      seen.add(result.value.key);
      prospects.push(result.value);
    }
  }
  for (const item of rawSignals) {
    const result = validateSignal(item);
    if (result.ok) signals.push(result.value);
    else skipped.push(result.error);
  }
  return { ok: true, value: { prospects, signals, skipped } };
}

export function signalDedupe(prospectId: string, signal: Pick<SignalInput, "date" | "type" | "summary" | "url">): string {
  const summary = signal.summary.toLowerCase().replace(/\s+/g, " ").trim();
  return [prospectId, signal.date, signal.type, signal.url || summary].join("|").slice(0, 1500);
}
