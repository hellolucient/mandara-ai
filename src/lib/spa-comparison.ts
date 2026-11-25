import type { PeriodKind } from "@/lib/statistic-period-parse";

export type RevenueTriple = {
  treatment: number | null;
  retail: number | null;
  total: number | null;
};

export type PeriodComparisonSide = {
  ty: RevenueTriple;
  ly: RevenueTriple | null;
};

export type Variance = {
  usd: number | null;
  pct: number | null;
};

export type ComparedPeriod = PeriodComparisonSide & {
  variance: Variance;
};

export type SpaComparisonRow = {
  location: string;
  mtd: ComparedPeriod;
  ytd: ComparedPeriod;
};

export type SpaComparisonSnapshot = {
  asOfDate: string;
  currency: string;
  rows: SpaComparisonRow[];
  group: {
    mtd: ComparedPeriod;
    ytd: ComparedPeriod;
  };
};

export function shiftYear(date: string, deltaYears: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${y + deltaYears}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function monthEnd(date: string): string {
  const [y, m] = date.split("-").map(Number);
  return `${y}-${String(m).padStart(2, "0")}-${String(daysInMonth(y, m)).padStart(2, "0")}`;
}

export function lySameCalendarDay(date: string): string {
  return shiftYear(date, -1);
}

export function lyMtdRange(asOf: string): { from: string; to: string } {
  const ly = shiftYear(asOf, -1);
  return { from: monthStart(ly), to: lySameCalendarDay(asOf) };
}

/** Full calendar months strictly before the month containing `asOf`, same calendar year. */
export function fullMonthsBeforeAsOf(asOf: string): Array<{ from: string; to: string }> {
  const year = Number(asOf.slice(0, 4));
  const month = Number(asOf.slice(5, 7));
  const ranges: Array<{ from: string; to: string }> = [];
  for (let m = 1; m < month; m++) {
    const from = `${year}-${String(m).padStart(2, "0")}-01`;
    ranges.push({ from, to: monthEnd(from) });
  }
  return ranges;
}

export function fullMonthsBeforeAsOfLastYear(asOf: string): Array<{ from: string; to: string }> {
  return fullMonthsBeforeAsOf(shiftYear(asOf, -1));
}

export function addRevenueTriples(a: RevenueTriple, b: RevenueTriple): RevenueTriple {
  const treatment = sumNullable(a.treatment, b.treatment);
  const retail = sumNullable(a.retail, b.retail);
  const total = sumNullable(a.total, b.total);
  return { treatment, retail, total };
}

function sumNullable(a: number | null, b: number | null): number | null {
  if (a == null && b == null) return null;
  return (a ?? 0) + (b ?? 0);
}

export function totalsFromParts(treatment: number | null, retail: number | null): RevenueTriple {
  if (treatment == null && retail == null) return { treatment: null, retail: null, total: null };
  const total = (treatment ?? 0) + (retail ?? 0);
  return { treatment, retail, total };
}

export function variance(ty: number | null, ly: number | null): Variance {
  if (ty == null || ly == null) return { usd: null, pct: null };
  const usd = ty - ly;
  const pct = ly !== 0 ? (usd / ly) * 100 : null;
  return { usd, pct };
}

export function compareSides(ty: RevenueTriple, ly: RevenueTriple | null): ComparedPeriod {
  return {
    ty,
    ly,
    variance: variance(ty.total, ly?.total ?? null),
  };
}

export function sumPeriodTotals(
  maps: Array<Partial<Record<string, Partial<Record<PeriodKind, number>>>>>,
): Map<string, RevenueTriple> {
  const out = new Map<string, RevenueTriple>();
  for (const map of maps) {
    for (const [location, kinds] of Object.entries(map)) {
      const existing = out.get(location) ?? { treatment: null, retail: null, total: null };
      const treatment = sumNullable(existing.treatment, kinds?.treatment ?? null);
      const retail = sumNullable(existing.retail, kinds?.retail ?? null);
      out.set(location, totalsFromParts(treatment, retail));
    }
  }
  return out;
}

export function groupTotal(rows: Map<string, RevenueTriple>): RevenueTriple {
  let treatment = 0;
  let retail = 0;
  let hasTreatment = false;
  let hasRetail = false;
  for (const row of rows.values()) {
    if (row.treatment != null) {
      treatment += row.treatment;
      hasTreatment = true;
    }
    if (row.retail != null) {
      retail += row.retail;
      hasRetail = true;
    }
  }
  return totalsFromParts(hasTreatment ? treatment : null, hasRetail ? retail : null);
}

export function buildSpaComparisonRows(
  locations: string[],
  mtdTy: Map<string, RevenueTriple>,
  mtdLy: Map<string, RevenueTriple> | null,
  ytdTy: Map<string, RevenueTriple>,
  ytdLy: Map<string, RevenueTriple> | null,
): SpaComparisonSnapshot["rows"] {
  return locations.map((location) => ({
    location,
    mtd: compareSides(
      mtdTy.get(location) ?? { treatment: null, retail: null, total: null },
      mtdLy?.get(location) ?? null,
    ),
    ytd: compareSides(
      ytdTy.get(location) ?? { treatment: null, retail: null, total: null },
      ytdLy?.get(location) ?? null,
    ),
  }));
}

export function formatVariancePct(pct: number | null): string {
  if (pct == null) return "n/a";
  const rounded = Math.round(pct);
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

export function formatComparisonMoney(value: number | null, currency: string): string {
  if (value == null) return "n/a";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `$${Math.round(value).toLocaleString("en-US")}`;
  }
}