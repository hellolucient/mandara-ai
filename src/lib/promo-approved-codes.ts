import { sql } from "@/lib/db";

/**
 * Standing promo codes allowed without an alert.
 * TODO(Trent): Confirm this list against Steiners / MSP before treating off-list alerts as operational.
 */
/** Every code appearing in data/promo-backfill/json (Sep–Nov 2026 treatment + retail). */
export const DEFAULT_APPROVED_PROMO_CODES = [
  "AC",
  "AI30",
  "AI45",
  "AM",
  "AP",
  "ASP",
  "ATOLL",
  "CD15",
  "CM",
  "CP",
  "CPL",
  "CR50",
  "CRD20",
  "DEPRO",
  "EB",
  "EP",
  "EX24",
  "FAMTR",
  "FF",
  "FP",
  "GC",
  "GHA",
  "GM",
  "HMOON",
  "HNY20",
  "INCLU",
  "JLR",
  "LWR",
  "MC",
  "MRBLS",
  "MV",
  "POTD",
  "PP",
  "PRIND",
  "PSIND",
  "PSPR",
  "PSSRF",
  "RI15",
  "RI20",
  "RIY",
  "RTL",
  "SCPAI",
  "SCSF",
  "SCSP",
  "SD",
  "SP",
  "SR20",
  "STAFF",
  "T15",
  "T20",
  "T30",
  "TOP",
  "UPG",
  "VIP",
  "WOTM",
  "WV",
] as const;

const SETTINGS_KEY = "promoApprovedCodes";

export async function loadApprovedPromoCodes(stage: string): Promise<Set<string>> {
  const rows = await sql<{ value: string }>(
    "select value from settings where stage = $1 and key = $2",
    [stage, SETTINGS_KEY],
  );
  if (!rows[0]?.value) return new Set(DEFAULT_APPROVED_PROMO_CODES);
  try {
    const parsed = JSON.parse(rows[0].value) as unknown;
    if (!Array.isArray(parsed)) return new Set(DEFAULT_APPROVED_PROMO_CODES);
    return new Set(parsed.filter((c): c is string => typeof c === "string").map((c) => c.trim().toUpperCase()));
  } catch {
    return new Set(DEFAULT_APPROVED_PROMO_CODES);
  }
}

export async function saveApprovedPromoCodes(stage: string, codes: string[]): Promise<void> {
  const normalized = [...new Set(codes.map((c) => c.trim().toUpperCase()).filter(Boolean))].sort();
  await sql(
    `insert into settings (stage, key, value) values ($1, $2, $3)
     on conflict (stage, key) do update set value = excluded.value`,
    [stage, SETTINGS_KEY, JSON.stringify(normalized)],
  );
}