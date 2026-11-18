export const PROSPECT_STATUSES = [
  "watching",
  "researching",
  "ready",
  "in_talks",
  "proposal",
  "won",
  "lost",
] as const;

export type ProspectStatus = (typeof PROSPECT_STATUSES)[number];

export const STATUS_LABELS: Record<ProspectStatus, string> = {
  watching: "Watching",
  researching: "Researching",
  ready: "Ready to approach",
  in_talks: "In talks",
  proposal: "Proposal",
  won: "Won",
  lost: "Lost / Declined",
};

/** Lead status from the reconciled master workbook ("Status" column). Separate from the pipeline stage above. */
export const LEAD_STATUSES = ["warm", "chasing", "possible", "long_shot", "out", "watch", "not_proceeding"] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  warm: "Warm lead",
  chasing: "Contact being chased",
  possible: "Possible",
  long_shot: "Long shot",
  out: "Out for now",
  watch: "Watch only",
  not_proceeding: "Not proceeding",
};

export const SIGNAL_TYPES = ["news", "job_ad", "new_gm", "development", "other"] as const;

export type SignalType = (typeof SIGNAL_TYPES)[number];

export const SIGNAL_LABELS: Record<SignalType, string> = {
  news: "News",
  job_ad: "Job ad",
  new_gm: "New GM",
  development: "Development",
  other: "Other",
};

export const PRIORITIES = ["A", "B", "C", "X", ""] as const;

export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_LABELS: Record<Priority, string> = {
  A: "In play",
  B: "Possible",
  C: "Occupied",
  X: "Excluded",
  "": "Unrated",
};

/** Workbook fields an import may set. Status is only applied when the prospect is first created. */
export type ProspectInput = {
  key: string;
  name: string;
  propertyType: string;
  atoll: string;
  brandGroup: string;
  ownerCompany: string;
  managementCompany: string;
  keys: number | null;
  tier: string;
  spaName: string;
  spaOperator: string;
  spaManagedBy: string;
  spaModel: string;
  mandaraHistory: string;
  priority: Priority;
  verdict: string;
  timing: string;
  timingDate: string | null;
  estSpaRevenue: number | null;
  estFee: number | null;
  gmName: string;
  gmSince: string;
  gmBackground: string;
  spaManager: string;
  approach: string;
  ownerLinks: string;
  notes: string;
  confidence: string;
  intelDate: string | null;
  sources: string[];
  /** Lead status from the workbook. Undefined when the file has no Status column, so an older file leaves it alone. "" clears it. */
  leadStatus?: LeadStatus | "";
  /** JC notes & contacts. Admin-only, never sent to the chat model. Undefined when the file has no such column. */
  jcNotes?: string;
  statusOnCreate: ProspectStatus | null;
  initialNote: { date: string; body: string } | null;
};

export type SignalInput = {
  prospect: string;
  date: string;
  type: SignalType;
  summary: string;
  url: string;
};

export type Prospect = Omit<ProspectInput, "statusOnCreate" | "initialNote" | "leadStatus" | "jcNotes"> & {
  id: string;
  leadStatus: LeadStatus | "";
  jcNotes: string;
  status: ProspectStatus;
  updatedAt: string;
  latestSignal: { date: string; type: SignalType; summary: string } | null;
  signalCount: number;
};

export type ProspectNote = { id: string; date: string; body: string; author: string; createdAt: string };

export type ProspectSignal = {
  id: string;
  prospectId: string;
  prospectName: string;
  date: string;
  type: SignalType;
  summary: string;
  url: string;
  addedBy: string;
};

export type ProspectSummary = {
  total: number;
  byStatus: Record<ProspectStatus, number>;
  recentSignals: ProspectSignal[];
};
