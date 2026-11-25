import type { PromoKind, PromoLineRow, PromotionsExtract, PromoTotals } from "@/lib/promo-types";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input && typeof input === "object");
}

function readString(record: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function parseKind(value: unknown): PromoKind | null {
  if (typeof value !== "string") return null;
  const folded = value.trim().toLowerCase();
  if (folded === "treatment" || folded === "retail") return folded;
  return null;
}

export function isPromotionsImport(input: unknown): boolean {
  if (!isRecord(input)) return false;
  const rows = input.rows;
  if (!Array.isArray(rows) || rows.length === 0) return false;
  const periodFrom = readString(input, "periodFrom", "period_from");
  const periodTo = readString(input, "periodTo", "period_to");
  const kind = parseKind(input.kind ?? input.Kind);
  if (!periodFrom || !periodTo || !kind) return false;
  const first = rows[0];
  if (!isRecord(first)) return false;
  const code = readString(first, "promoCode", "promo_code");
  const spa = readString(first, "spa", "location");
  return Boolean(code && spa);
}

function parseTotals(input: unknown): PromoTotals | null {
  if (!isRecord(input)) return null;
  const perSpaRaw = input.perSpa ?? input.per_spa;
  if (!isRecord(perSpaRaw)) return null;
  const perSpa: PromoTotals["perSpa"] = {};
  for (const [spa, value] of Object.entries(perSpaRaw)) {
    if (!isRecord(value)) continue;
    const qty = readNumber(value.qty);
    const usd = readNumber(value.usd);
    if (qty == null || usd == null) continue;
    perSpa[spa] = { qty, usd };
  }
  const totalUsd = readNumber(input.totalUsd ?? input.total_usd);
  if (totalUsd == null || totalUsd < 0) return null;
  return {
    totalQty: readNumber(input.totalQty ?? input.total_qty) ?? 0,
    guest: readNumber(input.guest) ?? 0,
    nett: readNumber(input.nett) ?? 0,
    tax: readNumber(input.tax) ?? 0,
    service: readNumber(input.service) ?? 0,
    totalUsd,
    perSpa,
  };
}

export function validatePromotionsExtract(
  input: unknown,
): { ok: true; extract: PromotionsExtract } | { ok: false; error: string } {
  if (!isPromotionsImport(input)) return { ok: false, error: "The file was not a promotions extract." };
  const record = input as Record<string, unknown>;
  const periodFrom = readString(record, "periodFrom", "period_from");
  const periodTo = readString(record, "periodTo", "period_to");
  const kind = parseKind(record.kind);
  if (!kind) return { ok: false, error: "kind must be treatment or retail." };
  if (!DATE.test(periodFrom) || !DATE.test(periodTo)) {
    return { ok: false, error: "periodFrom and periodTo must be YYYY-MM-DD." };
  }
  if (Date.parse(`${periodFrom}T00:00:00Z`) > Date.parse(`${periodTo}T00:00:00Z`)) {
    return { ok: false, error: "periodFrom must be on or before periodTo." };
  }
  const currency =
    typeof record.currency === "string" && /^[A-Z]{3}$/.test(record.currency) ? record.currency : "USD";
  const rowsRaw = record.rows;
  if (!Array.isArray(rowsRaw) || rowsRaw.length === 0 || rowsRaw.length > 20_000) {
    return { ok: false, error: "The extract needs between 1 and 20000 promo rows." };
  }
  const totals = parseTotals(record.totals);
  if (!totals) return { ok: false, error: "The extract needs a totals block with total_usd and per-spa figures." };

  const rows: PromoLineRow[] = [];
  const seen = new Set<string>();
  for (const row of rowsRaw) {
    if (!isRecord(row)) return { ok: false, error: "A promo row was not an object." };
    const spa = readString(row, "spa", "location");
    const promoCode = readString(row, "promoCode", "promo_code");
    if (!spa || spa.length > 120) return { ok: false, error: "Each row needs a spa name." };
    if (!promoCode || promoCode.length > 40) return { ok: false, error: `Each row needs a promo code (${spa}).` };
    const description =
      typeof row.description === "string"
        ? row.description.trim()
        : readString(row, "Description");
    const qty = readNumber(row.qty);
    const usd = readNumber(row.usd);
    if (qty == null || usd == null || qty < 0 || usd < 0) {
      return { ok: false, error: `${spa} · ${promoCode}: qty and usd must be numbers zero or greater.` };
    }
    const key = `${spa.toLowerCase()}|${kind}|${promoCode.toLowerCase()}`;
    if (seen.has(key)) return { ok: false, error: `Duplicate promo line: ${spa}, ${promoCode}.` };
    seen.add(key);
    rows.push({ spa, promoCode, description, qty, usd });
  }

  return {
    ok: true,
    extract: { periodFrom, periodTo, kind, currency, rows, totals, issues: [] },
  };
}