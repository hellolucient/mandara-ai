import { sql } from "@/lib/db";
import { newId, slug } from "@/lib/ids";
import type { PromotionsExtract, PromoKind, StoredPromoLine, StoredPromoPeriod } from "@/lib/promo-types";

type PeriodRow = {
  period_from: string;
  period_to: string;
  kind: PromoKind;
  currency: string;
  total_qty: number | null;
  guest: number | null;
  nett: number | null;
  tax: number | null;
  service: number | null;
  total_usd: number;
  spa_totals: string;
  imported_at: string;
};

type LineRow = {
  period_from: string;
  period_to: string;
  kind: PromoKind;
  location_id: string;
  location_name: string;
  promo_code: string;
  description: string;
  qty: number;
  usd: number;
};

export async function savePromotions(
  stage: string,
  extract: PromotionsExtract,
): Promise<{ lines: number; spas: number }> {
  await sql(
    `delete from promo_lines where stage = $1 and period_from = $2::date and period_to = $3::date and kind = $4`,
    [stage, extract.periodFrom, extract.periodTo, extract.kind],
  );
  await sql(
    `delete from promo_periods where stage = $1 and period_from = $2::date and period_to = $3::date and kind = $4`,
    [stage, extract.periodFrom, extract.periodTo, extract.kind],
  );

  const spaNames = [...new Set(extract.rows.map((row) => row.spa))];
  for (const row of extract.rows) {
    const locationId = await ensureLocation(stage, row.spa);
    await sql(
      `insert into promo_lines
        (id, stage, period_from, period_to, kind, location_id, location_name, promo_code, description, qty, usd)
       values ($1,$2,$3::date,$4::date,$5,$6,$7,$8,$9,$10,$11)
       on conflict (stage, period_from, period_to, kind, location_id, promo_code)
       do update set description = excluded.description, qty = excluded.qty, usd = excluded.usd`,
      [
        newId(),
        stage,
        extract.periodFrom,
        extract.periodTo,
        extract.kind,
        locationId,
        row.spa,
        row.promoCode,
        row.description,
        row.qty,
        row.usd,
      ],
    );
  }

  await sql(
    `insert into promo_periods
      (id, stage, period_from, period_to, kind, currency, total_qty, guest, nett, tax, service, total_usd, spa_totals)
     values ($1,$2,$3::date,$4::date,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      newId(),
      stage,
      extract.periodFrom,
      extract.periodTo,
      extract.kind,
      extract.currency,
      extract.totals.totalQty,
      extract.totals.guest,
      extract.totals.nett,
      extract.totals.tax,
      extract.totals.service,
      extract.totals.totalUsd,
      JSON.stringify(extract.totals.perSpa),
    ],
  );

  return { lines: extract.rows.length, spas: spaNames.length };
}

async function ensureLocation(stage: string, name: string): Promise<string> {
  const found = await sql<{ id: string }>(
    "select id from locations where stage = $1 and lower(name) = lower($2)",
    [stage, name],
  );
  if (found[0]) return found[0].id;
  const id = slug(name);
  await sql(
    `insert into locations (id, stage, name, sort_order)
     values ($1, $2, $3, 100)
     on conflict (stage, id) do nothing`,
    [id, stage, name],
  );
  return id;
}

export async function listPromoPeriods(stage: string): Promise<StoredPromoPeriod[]> {
  const rows = await sql<PeriodRow>(
    `select to_char(period_from, 'YYYY-MM-DD') as period_from,
            to_char(period_to, 'YYYY-MM-DD') as period_to,
            kind, currency, total_qty, guest, nett, tax, service, total_usd,
            spa_totals::text as spa_totals,
            to_char(imported_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as imported_at
     from promo_periods where stage = $1
     order by period_to desc, kind`,
    [stage],
  );
  return rows.map(mapPeriod);
}

export async function loadPromoLines(
  stage: string,
  periodFrom: string,
  periodTo: string,
  kind: PromoKind,
): Promise<StoredPromoLine[]> {
  const rows = await sql<LineRow>(
    `select to_char(period_from, 'YYYY-MM-DD') as period_from,
            to_char(period_to, 'YYYY-MM-DD') as period_to,
            kind, location_id, location_name, promo_code, description, qty, usd
     from promo_lines
     where stage = $1 and period_from = $2::date and period_to = $3::date and kind = $4
     order by location_name, promo_code`,
    [stage, periodFrom, periodTo, kind],
  );
  return rows.map((row) => ({
    periodFrom: row.period_from,
    periodTo: row.period_to,
    kind: row.kind,
    locationId: row.location_id,
    locationName: row.location_name,
    promoCode: row.promo_code,
    description: row.description,
    qty: Number(row.qty),
    usd: Number(row.usd),
  }));
}

export async function loadAllPromoLines(stage: string, kind: PromoKind): Promise<StoredPromoLine[]> {
  const rows = await sql<LineRow>(
    `select to_char(period_from, 'YYYY-MM-DD') as period_from,
            to_char(period_to, 'YYYY-MM-DD') as period_to,
            kind, location_id, location_name, promo_code, description, qty, usd
     from promo_lines
     where stage = $1 and kind = $2
     order by period_to, location_name, promo_code`,
    [stage, kind],
  );
  return rows.map((row) => ({
    periodFrom: row.period_from,
    periodTo: row.period_to,
    kind: row.kind,
    locationId: row.location_id,
    locationName: row.location_name,
    promoCode: row.promo_code,
    description: row.description,
    qty: Number(row.qty),
    usd: Number(row.usd),
  }));
}

function mapPeriod(row: PeriodRow): StoredPromoPeriod {
  let spaTotals: StoredPromoPeriod["spaTotals"] = {};
  try {
    spaTotals = JSON.parse(row.spa_totals) as StoredPromoPeriod["spaTotals"];
  } catch {
    spaTotals = {};
  }
  return {
    periodFrom: row.period_from,
    periodTo: row.period_to,
    kind: row.kind,
    currency: row.currency,
    totalQty: row.total_qty == null ? null : Number(row.total_qty),
    guest: row.guest == null ? null : Number(row.guest),
    nett: row.nett == null ? null : Number(row.nett),
    tax: row.tax == null ? null : Number(row.tax),
    service: row.service == null ? null : Number(row.service),
    totalUsd: Number(row.total_usd),
    spaTotals,
    importedAt: row.imported_at,
  };
}