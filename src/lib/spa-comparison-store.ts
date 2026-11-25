import { sql } from "@/lib/db";
import { num } from "@/lib/home-kpis";
import { groupSpasByBrand } from "@/lib/spa-groups";
import type { PeriodKind } from "@/lib/statistic-period-parse";
import {
  addRevenueTriples,
  buildSpaComparisonRows,
  compareSides,
  fullMonthsBeforeAsOf,
  fullMonthsBeforeAsOfLastYear,
  groupTotal,
  lyMtdRange,
  monthStart,
  sumPeriodTotals,
  totalsFromParts,
  type RevenueTriple,
  type SpaComparisonSnapshot,
} from "@/lib/spa-comparison";

type KindTotals = Partial<Record<PeriodKind, number>>;

async function loadDsrMtdBySpa(
  stage: string,
  fromDate: string,
  toDate: string,
): Promise<Map<string, RevenueTriple>> {
  const rows = await sql<{
    location_name: string;
    treatment_sales: number | null;
    retail_sales: number | null;
    net_sales: number | null;
  }>(
    `select l.location_name,
            sum(l.treatment_sales) as treatment_sales,
            sum(l.retail_sales) as retail_sales,
            sum(l.net_sales) as net_sales
     from sales_lines l
     join sales_days d on d.id = l.day_id
     where d.stage = $1
       and d.business_date >= $2::date
       and d.business_date <= $3::date
     group by l.location_name`,
    [stage, fromDate, toDate],
  );
  const out = new Map<string, RevenueTriple>();
  for (const row of rows) {
    const treatment = num(row.treatment_sales);
    const retail = num(row.retail_sales);
    const total = num(row.net_sales);
    out.set(row.location_name, {
      treatment,
      retail,
      total: total ?? (treatment != null || retail != null ? (treatment ?? 0) + (retail ?? 0) : null),
    });
  }
  return out;
}

async function loadPeriodRangeBySpa(
  stage: string,
  periodFrom: string,
  periodTo: string,
): Promise<Map<string, Partial<Record<PeriodKind, number>>> | null> {
  const rows = await sql<{ location: string; kind: PeriodKind; nett: number }>(
    `select location, kind, sum(nett) as nett
     from sales_period_items
     where stage = $1
       and period_from = $2::date
       and period_to = $3::date
     group by location, kind`,
    [stage, periodFrom, periodTo],
  );
  if (rows.length === 0) return null;
  const out = new Map<string, Partial<Record<PeriodKind, number>>>();
  for (const row of rows) {
    const bucket = out.get(row.location) ?? {};
    bucket[row.kind] = (bucket[row.kind] ?? 0) + (num(row.nett) ?? 0);
    out.set(row.location, bucket);
  }
  return out;
}

async function loadYtdFromPeriodMonths(
  stage: string,
  ranges: Array<{ from: string; to: string }>,
): Promise<Map<string, RevenueTriple>> {
  const maps: Array<Map<string, Partial<Record<PeriodKind, number>>>> = [];
  for (const range of ranges) {
    const chunk = await loadPeriodRangeBySpa(stage, range.from, range.to);
    if (chunk) maps.push(chunk);
  }
  return sumPeriodTotals(maps);
}

function mergeMaps(
  dsr: Map<string, RevenueTriple>,
  period: Map<string, RevenueTriple>,
): Map<string, RevenueTriple> {
  const names = new Set([...dsr.keys(), ...period.keys()]);
  const out = new Map<string, RevenueTriple>();
  for (const name of names) {
    const a = dsr.get(name) ?? { treatment: null, retail: null, total: null };
    const b = period.get(name) ?? { treatment: null, retail: null, total: null };
    out.set(name, addRevenueTriples(a, b));
  }
  return out;
}

function periodMapToRevenue(map: Map<string, KindTotals> | null): Map<string, RevenueTriple> | null {
  if (!map) return null;
  const out = new Map<string, RevenueTriple>();
  for (const [location, kinds] of map) {
    out.set(location, totalsFromParts(kinds.treatment ?? null, kinds.retail ?? null));
  }
  return out;
}

export async function loadSpaComparisonSnapshot(
  stage: string,
  asOfDate: string,
  currency = "USD",
): Promise<SpaComparisonSnapshot | null> {
  const mtdFrom = monthStart(asOfDate);
  const mtdTy = await loadDsrMtdBySpa(stage, mtdFrom, asOfDate);

  const lyRange = lyMtdRange(asOfDate);
  const lyPeriod = periodMapToRevenue(await loadPeriodRangeBySpa(stage, lyRange.from, lyRange.to));
  const mtdLy = lyPeriod;

  const ytdMonthsTy = await loadYtdFromPeriodMonths(stage, fullMonthsBeforeAsOf(asOfDate));
  const ytdTy = mergeMaps(ytdMonthsTy, mtdTy);

  const lyMonths = fullMonthsBeforeAsOfLastYear(asOfDate);
  const ytdMonthsLy = await loadYtdFromPeriodMonths(stage, lyMonths);
  const lyMtdRangeMap = periodMapToRevenue(await loadPeriodRangeBySpa(stage, lyRange.from, lyRange.to));
  const ytdLy =
    ytdMonthsLy.size > 0 || (lyMtdRangeMap && lyMtdRangeMap.size > 0)
      ? mergeMaps(ytdMonthsLy, lyMtdRangeMap ?? new Map())
      : null;

  const locations = [
    ...new Set([...mtdTy.keys(), ...(mtdLy?.keys() ?? []), ...ytdTy.keys(), ...(ytdLy?.keys() ?? [])]),
  ];

  const revenueForSort = (name: string) => ytdTy.get(name)?.total ?? mtdTy.get(name)?.total ?? 0;
  const grouped = groupSpasByBrand(
    locations.map((location) => ({ location })),
    (r) => revenueForSort(r.location),
    (r) => r.location,
  );
  const orderedLocations = grouped.flatMap((g) => g.items.map((i) => i.location));

  const rows = buildSpaComparisonRows(orderedLocations, mtdTy, mtdLy, ytdTy, ytdLy);

  return {
    asOfDate,
    currency,
    rows,
    group: {
      mtd: compareSides(groupTotal(mtdTy), mtdLy ? groupTotal(mtdLy) : null),
      ytd: compareSides(groupTotal(ytdTy), ytdLy ? groupTotal(ytdLy) : null),
    },
  };
}