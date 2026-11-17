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

export type Prospect = Omit<ProspectInput, "statusOnCreate" | "initialNote"> & {
  id: string;
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
