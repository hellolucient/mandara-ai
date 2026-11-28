import { addDays, businessToday } from "@/lib/dates";
import { groupSpasByBrand } from "@/lib/spa-groups";
import {
  addUsdToCategory,
  isFullPriceCode,
  promoCategoryForCode,
  promoCategoryLabel,
  promoCategorySortKey,
  slicesFromUsdByCategory,
  type CategoryUsdSlice,
  type PromoCategoryId,
} from "@/lib/promo-categories";

function sumPromoUsd(lines: StoredPromoLine[], opts?: { excludeFullPrice?: boolean }): number {
  return lines.reduce((s, line) => {
    if (opts?.excludeFullPrice && isFullPriceCode(line.promoCode)) return s;
    return s + line.usd;
  }, 0);
}
import type { PromoKind, StoredPromoLine, StoredPromoPeriod } from "@/lib/promo-types";
import type { LoadedDay } from "@/lib/sales-types";

/**
 * How a spa's revenue splits, so the Promotions section reconciles to revenue:
 * revenue = promotions + full price + retail + other treatments.
 *
 * - promotions: real promotions and discounts only (the bars).
 * - fullPrice: treatments sold at full price (Promotion Analysis codes FP, MV, GM, LWR). Not a promotion.
 * - retail: retail sales. The Promotion Analysis treatment report never includes retail.
 * - otherTreatments: whatever is left of the treatment revenue, i.e. treatments the spa sold without any
 *   promotion code in the DSR (or that the promotion report leaves out, like a 15 minute upgrade charge).
 */
export type PromoReconciliation = {
  revenueUsd: number;
  promoUsd: number;
  fullPriceUsd: number;
  retailUsd: number;
  otherTreatmentUsd: number;
};

export type SpaCategoryBarRow = {
  spa: string;
  /** Promotions and discounts only. Full Price is not included. */
  totalUsd: number;
  slices: CategoryUsdSlice[];
  /** Full-price treatments in the same window (shown only in the reconciliation line, never as a promotion). */
  fullPriceUsd?: number;
  reconciliation?: PromoReconciliation | null;
};

export type PromoCodeRow = {
  promoCode: string;
  description: string;
  qty: number;
  usd: number;
  offList: boolean;
  promoSharePct: number | null;
  categoryId: PromoCategoryId;
  categoryLabel: string;
};

export type DailySpaPromos = {
  spa: string;
  date: string;
  /** Discounted / low-rate promo USD (excludes Full Price). */
  promoUsd: number;
  fullPricePromoUsd: number;
  treatmentRevenue: number | null;
  /** Share of treatment revenue from discounted promos only. */
  promoSharePct: number | null;
  shareAlert: boolean;
  codes: PromoCodeRow[];
};

export type WeeklySpaDelta = {
  spa: string;
  promoCode: string;
  description: string;
  thisWeekUsd: number;
  priorWeekUsd: number;
  changeUsd: number;
  changePct: number | null;
  offList: boolean;
  categoryId: PromoCategoryId;
  categoryLabel: string;
};

export type MonthlySpaSummary = {
  spa: string;
  promoUsd: number;
  fullPricePromoUsd: number;
  reconciliation?: PromoReconciliation | null;
  treatmentRevenue: number | null;
  promoSharePct: number | null;
  categorySlices: CategoryUsdSlice[];
  topCodes: {
    promoCode: string;
    usd: number;
    offList: boolean;
    categoryId: PromoCategoryId;
    categoryLabel: string;
  }[];
};

export type MonthlyPeriodCompare = {
  label: string;
  periodFrom: string;
  periodTo: string;
  totalUsd: number;
  priorLabel: string | null;
  priorTotalUsd: number | null;
  changePct: number | null;
  spas: MonthlySpaSummary[];
  offListCodes: string[];
  shareJumpSpas: string[];
};

function isSingleDay(period: StoredPromoPeriod): boolean {
  return period.periodFrom === period.periodTo;
}

function treatmentRevenueForSpa(days: LoadedDay[], spa: string, date: string): number | null {
  const day = days.find((d) => d.businessDate === date);
  if (!day) return null;
  const line = day.lines.find((l) => l.locationName.toLowerCase() === spa.toLowerCase());
  if (!line) return null;
  return line.treatmentSales ?? line.netSales;
}

function isoWeekKey(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function linesInWeek(lines: StoredPromoLine[], weekKey: string): StoredPromoLine[] {
  return lines.filter((line) => isoWeekKey(line.periodTo) === weekKey);
}

function dayLineForSpa(day: LoadedDay, spa: string) {
  return day.lines.find((l) => l.locationName.toLowerCase() === spa.toLowerCase());
}

/**
 * Splits a spa's DSR revenue over a date range into promotions, full price, retail and the rest, so that
 * promotions + full price + retail + other treatments = revenue exactly. Null when the DSR has no line for the spa.
 */
export function reconcilePromoRevenue(
  days: LoadedDay[],
  spa: string,
  from: string,
  to: string,
  promoUsd: number,
  fullPriceUsd: number,
): PromoReconciliation | null {
  let revenue = 0;
  let retail = 0;
  let any = false;
  for (const day of days) {
    if (day.businessDate < from || day.businessDate > to) continue;
    const line = dayLineForSpa(day, spa);
    if (!line || line.netSales == null) continue;
    any = true;
    revenue += line.netSales;
    retail += line.retailSales ?? 0;
  }
  if (!any) return null;
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    revenueUsd: round(revenue),
    promoUsd: round(promoUsd),
    fullPriceUsd: round(fullPriceUsd),
    retailUsd: round(retail),
    otherTreatmentUsd: round(revenue - promoUsd - fullPriceUsd - retail),
  };
}

/** Adds the reconciliation to each bar row, plus a row for any spa that has revenue but no promotion lines. */
export function withPromoReconciliation(
  rows: SpaCategoryBarRow[],
  days: LoadedDay[],
  from: string,
  to: string,
): SpaCategoryBarRow[] {
  const out = rows.map((row) => ({
    ...row,
    reconciliation: reconcilePromoRevenue(days, row.spa, from, to, row.totalUsd, row.fullPriceUsd ?? 0),
  }));
  const have = new Set(out.map((r) => r.spa.toLowerCase()));
  const extra = new Set<string>();
  for (const day of days) {
    if (day.businessDate < from || day.businessDate > to) continue;
    for (const line of day.lines) if ((line.netSales ?? 0) > 0 && !have.has(line.locationName.toLowerCase())) extra.add(line.locationName);
  }
  for (const spa of [...extra].sort()) {
    out.push({ spa, totalUsd: 0, slices: [], fullPriceUsd: 0, reconciliation: reconcilePromoRevenue(days, spa, from, to, 0, 0) });
  }
  return groupSpasByBrand(out, (r) => r.totalUsd, (r) => r.spa).flatMap((g) => g.items);
}

/** Promotions only: Full Price lines are left out of the slices and the total, and counted separately. */
export function buildSpaCategoryBars(
  lines: StoredPromoLine[],
  filter: (line: StoredPromoLine) => boolean,
): SpaCategoryBarRow[] {
  const bySpa = new Map<string, { promo: Partial<Record<PromoCategoryId, number>>; fullPrice: number }>();
  for (const line of lines) {
    if (!filter(line)) continue;
    if (line.kind !== "treatment") continue;
    const bucket = bySpa.get(line.locationName) ?? { promo: {}, fullPrice: 0 };
    if (isFullPriceCode(line.promoCode)) bucket.fullPrice += line.usd;
    else addUsdToCategory(bucket.promo, line.promoCode, line.usd);
    bySpa.set(line.locationName, bucket);
  }
  const rows = [...bySpa.entries()]
    .map(([spa, { promo, fullPrice }]) => {
      const slices = slicesFromUsdByCategory(promo);
      const totalUsd = slices.reduce((s, x) => s + x.usd, 0);
      return { spa, totalUsd, slices, fullPriceUsd: fullPrice };
    })
    .filter((r) => r.totalUsd > 0 || r.fullPriceUsd > 0);
  return groupSpasByBrand(rows, (r) => r.totalUsd, (r) => r.spa).flatMap((g) => g.items);
}

function sumBySpaCode(lines: StoredPromoLine[]): Map<string, { spa: string; code: string; description: string; usd: number }> {
  const map = new Map<string, { spa: string; code: string; description: string; usd: number }>();
  for (const line of lines) {
    const key = `${line.locationName}|${line.promoCode}`;
    const prev = map.get(key) ?? {
      spa: line.locationName,
      code: line.promoCode,
      description: line.description,
      usd: 0,
    };
    prev.usd += line.usd;
    if (!prev.description && line.description) prev.description = line.description;
    map.set(key, prev);
  }
  return map;
}

export function buildDailyView(
  periods: StoredPromoPeriod[],
  lines: StoredPromoLine[],
  salesDays: LoadedDay[],
  approved: Set<string>,
  shareJumpThresholdPct = 10,
): { date: string | null; spas: DailySpaPromos[] } {
  const yesterday = addDays(businessToday(), -1);
  const singles = periods
    .filter((p) => p.kind === "treatment" && isSingleDay(p))
    .sort((a, b) => b.periodFrom.localeCompare(a.periodFrom));
  const period =
    singles.find((p) => p.periodFrom === yesterday) ?? singles.find((p) => p.periodTo <= yesterday) ?? singles[0];
  if (!period) return { date: null, spas: [] };

  const dayLines = lines.filter(
    (l) => l.kind === "treatment" && l.periodFrom === period.periodFrom && l.periodTo === period.periodTo,
  );
  const spaSet = [...new Set(dayLines.map((l) => l.locationName))];
  const revenueBySpa = new Map<string, number>();
  for (const spa of spaSet) {
    revenueBySpa.set(
      spa,
      dayLines.filter((l) => l.locationName === spa).reduce((s, l) => s + l.usd, 0),
    );
  }
  const spas = groupSpasByBrand(
    spaSet.map((spa) => ({ spa })),
    (r) => revenueBySpa.get(r.spa) ?? 0,
    (r) => r.spa,
  ).flatMap((g) => g.items.map((i) => i.spa));
  const priorWeekKeys = new Set(
    lines
      .filter((l) => l.kind === "treatment")
      .map((l) => isoWeekKey(l.periodTo))
      .sort()
      .slice(-5, -1),
  );

  return {
    date: period.periodFrom,
    spas: spas.map((spa) => {
      const codes = dayLines.filter((l) => l.locationName === spa);
      const promoUsd = sumPromoUsd(codes, { excludeFullPrice: true });
      const fullPricePromoUsd = sumPromoUsd(codes.filter((l) => isFullPriceCode(l.promoCode)));
      const treatmentRevenue = treatmentRevenueForSpa(salesDays, spa, period.periodFrom);
      const promoSharePct =
        treatmentRevenue != null && treatmentRevenue > 0 ? Math.round((promoUsd / treatmentRevenue) * 1000) / 10 : null;

      const priorShares: number[] = [];
      for (const week of priorWeekKeys) {
        const weekLines = linesInWeek(
          lines.filter((l) => l.kind === "treatment" && l.locationName === spa),
          week,
        );
        const weekUsd = sumPromoUsd(weekLines, { excludeFullPrice: true });
        if (weekUsd <= 0) continue;
        // Without daily DSR for that week, skip share — use week promo intensity vs max day revenue if present
        const rev = treatmentRevenueForSpa(salesDays, spa, period.periodFrom);
        if (rev != null && rev > 0) priorShares.push((weekUsd / 7 / rev) * 100);
      }
      const avgPrior = priorShares.length ? priorShares.reduce((a, b) => a + b, 0) / priorShares.length : null;
      const shareAlert =
        promoSharePct != null && avgPrior != null && promoSharePct - avgPrior > shareJumpThresholdPct;

      return {
        spa,
        date: period.periodFrom,
        promoUsd,
        fullPricePromoUsd,
        treatmentRevenue,
        promoSharePct,
        shareAlert,
        codes: codes
          .filter((c) => !isFullPriceCode(c.promoCode))
          .sort(
            (a, b) =>
              promoCategorySortKey(a.promoCode).localeCompare(promoCategorySortKey(b.promoCode)) || b.usd - a.usd,
          )
          .map((c) => ({
            promoCode: c.promoCode,
            description: c.description,
            qty: c.qty,
            usd: c.usd,
            offList: !approved.has(c.promoCode.toUpperCase()),
            promoSharePct:
              treatmentRevenue != null && treatmentRevenue > 0
                ? Math.round((c.usd / treatmentRevenue) * 1000) / 10
                : null,
            categoryId: promoCategoryForCode(c.promoCode),
            categoryLabel: promoCategoryLabel(c.promoCode),
          })),
      };
    }),
  };
}

export function buildSpaCategoryBarsForPeriod(
  lines: StoredPromoLine[],
  periodFrom: string,
  periodTo: string,
  salesDays?: LoadedDay[],
): SpaCategoryBarRow[] {
  const rows = buildSpaCategoryBars(
    lines,
    (l) => l.kind === "treatment" && l.periodFrom === periodFrom && l.periodTo === periodTo,
  );
  return salesDays ? withPromoReconciliation(rows, salesDays, periodFrom, periodTo) : rows;
}

function isTreatmentSingleDayOnOrBetween(line: StoredPromoLine, from: string, to: string): boolean {
  return (
    line.kind === "treatment" &&
    line.periodFrom === line.periodTo &&
    line.periodFrom >= from &&
    line.periodFrom <= to
  );
}

/**
 * Treatment promo lines that cover `from`..`to` exactly once: the longest stored range report that starts
 * on `from` and ends on or before `to` (e.g. the Steiners Promotion Analysis for 1–24 Nov), plus single-day
 * reports for the days after it. Without a range report this falls back to single days only.
 */
export function treatmentPromoLinesForDateRange(lines: StoredPromoLine[], from: string, to: string): StoredPromoLine[] {
  let coveredTo: string | null = null;
  for (const line of lines) {
    if (line.kind !== "treatment" || line.periodFrom !== from || line.periodTo === line.periodFrom) continue;
    if (line.periodTo > to) continue;
    if (!coveredTo || line.periodTo > coveredTo) coveredTo = line.periodTo;
  }
  const out: StoredPromoLine[] = [];
  for (const line of lines) {
    if (line.kind !== "treatment") continue;
    if (coveredTo && line.periodFrom === from && line.periodTo === coveredTo) {
      out.push(line);
      continue;
    }
    if (isTreatmentSingleDayOnOrBetween(line, from, to) && (!coveredTo || line.periodFrom > coveredTo)) out.push(line);
  }
  return out;
}

/** Treatment promo bars across a calendar date range (inclusive), using range reports plus later single days. */
export function buildSpaCategoryBarsForDateRange(
  lines: StoredPromoLine[],
  from: string,
  to: string,
): SpaCategoryBarRow[] {
  const covered = new Set(treatmentPromoLinesForDateRange(lines, from, to));
  return buildSpaCategoryBars(lines, (l) => covered.has(l));
}

export function formatHomePromoHeading(mode: "mtd" | "daily", periodFrom: string, periodTo: string): string {
  const end = new Date(`${periodTo}T12:00:00Z`);
  const month = end.toLocaleString("en-GB", { month: "short", timeZone: "UTC" }).toUpperCase();
  const year = end.getUTCFullYear();
  if (mode === "daily") {
    return `TREATMENT PROMOS · ${end.getUTCDate()} ${month} ${year}`;
  }
  const start = new Date(`${periodFrom}T12:00:00Z`);
  return `TREATMENT PROMOS · MTD ${start.getUTCDate()}–${end.getUTCDate()} ${month} ${year}`;
}

function offListCodesInLines(lines: StoredPromoLine[], approved: Set<string>): string[] {
  return [
    ...new Set(lines.map((l) => l.promoCode.toUpperCase()).filter((c) => c && !approved.has(c))),
  ].sort();
}

export function buildSpaCategoryBarsForWeek(lines: StoredPromoLine[], weekKey: string): SpaCategoryBarRow[] {
  return buildSpaCategoryBars(
    lines,
    (l) => l.kind === "treatment" && l.periodFrom === l.periodTo && isoWeekKey(l.periodTo) === weekKey,
  );
}

export function buildWeeklyView(
  lines: StoredPromoLine[],
  approved: Set<string>,
  kind: PromoKind = "treatment",
): { weekKey: string; priorWeekKey: string | null; rows: WeeklySpaDelta[] } {
  // Weeks are built from single-day reports only; month/range reports would otherwise land in the week of their end date.
  const kindLines = lines.filter((l) => l.kind === kind && l.periodFrom === l.periodTo);
  const weeks = [...new Set(kindLines.map((l) => isoWeekKey(l.periodTo)))].sort();
  const weekKey = weeks.at(-1) ?? "";
  const priorWeekKey = weeks.length > 1 ? weeks.at(-2) ?? null : null;
  if (!weekKey) return { weekKey: "", priorWeekKey: null, rows: [] };

  // Promotions only: Full Price is not a promotion.
  const promoOnly = (ls: StoredPromoLine[]) => ls.filter((l) => !isFullPriceCode(l.promoCode));
  const thisMap = sumBySpaCode(promoOnly(linesInWeek(kindLines, weekKey)));
  const priorMap = priorWeekKey ? sumBySpaCode(promoOnly(linesInWeek(kindLines, priorWeekKey))) : new Map();

  const keys = new Set([...thisMap.keys(), ...priorMap.keys()]);
  const rows: WeeklySpaDelta[] = [...keys].map((key) => {
    const cur = thisMap.get(key);
    const prev = priorMap.get(key);
    const thisWeekUsd = cur?.usd ?? 0;
    const priorWeekUsd = prev?.usd ?? 0;
    const changeUsd = thisWeekUsd - priorWeekUsd;
    const changePct =
      priorWeekUsd > 0 ? Math.round((changeUsd / priorWeekUsd) * 1000) / 10 : thisWeekUsd > 0 ? null : 0;
    const code = cur?.code ?? prev?.code ?? "";
    return {
      spa: cur?.spa ?? prev?.spa ?? "",
      promoCode: code,
      description: cur?.description ?? prev?.description ?? "",
      thisWeekUsd,
      priorWeekUsd,
      changeUsd,
      changePct,
      offList: !approved.has(code.toUpperCase()),
      categoryId: promoCategoryForCode(code),
      categoryLabel: promoCategoryLabel(code),
    };
  });

  rows.sort(
    (a, b) =>
      promoCategorySortKey(a.promoCode).localeCompare(promoCategorySortKey(b.promoCode)) ||
      Math.abs(b.changeUsd) - Math.abs(a.changeUsd),
  );
  return { weekKey, priorWeekKey, rows };
}

export function buildMonthlySummaries(
  periods: StoredPromoPeriod[],
  lines: StoredPromoLine[],
  salesDays: LoadedDay[],
  approved: Set<string>,
  kind: PromoKind = "treatment",
): MonthlyPeriodCompare[] {
  const monthlies = periods
    .filter((p) => p.kind === kind && p.periodFrom !== p.periodTo)
    .sort((a, b) => a.periodFrom.localeCompare(b.periodFrom));

  // Promotions only: Full Price lines are not promotions, so they are left out of every total here.
  const promoTotal = (period: StoredPromoPeriod) =>
    lines
      .filter(
        (l) =>
          l.periodFrom === period.periodFrom &&
          l.periodTo === period.periodTo &&
          l.kind === kind &&
          !(kind === "treatment" && isFullPriceCode(l.promoCode)),
      )
      .reduce((sum, l) => sum + l.usd, 0);

  const results: MonthlyPeriodCompare[] = [];
  for (let i = 0; i < monthlies.length; i++) {
    const period = monthlies[i];
    const prior = i > 0 ? monthlies[i - 1] : null;
    const label = formatMonthLabel(period.periodFrom, period.periodTo);
    const periodLines = lines.filter(
      (l) => l.periodFrom === period.periodFrom && l.periodTo === period.periodTo && l.kind === kind,
    );
    const spas = [...new Set(periodLines.map((l) => l.locationName))].sort();
    const offListCodes = [
      ...new Set(periodLines.map((l) => l.promoCode.toUpperCase()).filter((c) => !approved.has(c))),
    ].sort();

    const spaSummaries: MonthlySpaSummary[] = spas.map((spa) => {
      const spaLines = periodLines.filter((l) => l.locationName === spa);
      const promoLines = spaLines.filter((l) => !isFullPriceCode(l.promoCode));
      const promoUsd = sumPromoUsd(spaLines, { excludeFullPrice: true });
      const fullPricePromoUsd = sumPromoUsd(spaLines.filter((l) => isFullPriceCode(l.promoCode)));
      const treatmentRevenue = sumTreatmentRevenueInRange(salesDays, spa, period.periodFrom, period.periodTo);
      const byCode = new Map<string, number>();
      const categoryTotals: Partial<Record<PromoCategoryId, number>> = {};
      for (const line of promoLines) {
        byCode.set(line.promoCode, (byCode.get(line.promoCode) ?? 0) + line.usd);
        addUsdToCategory(categoryTotals, line.promoCode, line.usd);
      }
      const topCodes = [...byCode.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([promoCode, usd]) => ({
          promoCode,
          usd,
          offList: !approved.has(promoCode.toUpperCase()),
          categoryId: promoCategoryForCode(promoCode),
          categoryLabel: promoCategoryLabel(promoCode),
        }));
      return {
        spa,
        promoUsd,
        fullPricePromoUsd,
        reconciliation:
          kind === "treatment"
            ? reconcilePromoRevenue(salesDays, spa, period.periodFrom, period.periodTo, promoUsd, fullPricePromoUsd)
            : null,
        treatmentRevenue,
        promoSharePct:
          treatmentRevenue != null && treatmentRevenue > 0
            ? Math.round((promoUsd / treatmentRevenue) * 1000) / 10
            : null,
        categorySlices: slicesFromUsdByCategory(categoryTotals),
        topCodes,
      };
    });

    const totalUsd = promoTotal(period);
    const priorTotal = prior ? promoTotal(prior) : null;
    const changePct =
      priorTotal != null && priorTotal > 0 ? Math.round(((totalUsd - priorTotal) / priorTotal) * 1000) / 10 : null;

    results.push({
      label,
      periodFrom: period.periodFrom,
      periodTo: period.periodTo,
      totalUsd,
      priorLabel: prior ? formatMonthLabel(prior.periodFrom, prior.periodTo) : null,
      priorTotalUsd: priorTotal,
      changePct,
      spas: groupSpasByBrand(
        spaSummaries,
        (s) => s.promoUsd,
        (s) => s.spa,
      ).flatMap((g) => g.items),
      offListCodes,
      shareJumpSpas: [],
    });
  }
  return results;
}

function formatMonthLabel(from: string, to: string): string {
  const start = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  const sameMonth = start.getUTCFullYear() === end.getUTCFullYear() && start.getUTCMonth() === end.getUTCMonth();
  if (sameMonth && from.endsWith("-01") && to.match(/-\d{2}$/)) {
    return start.toLocaleString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
  }
  return `${from} → ${to}`;
}

export type HomePromoCardSlice = {
  periodFrom: string;
  periodTo: string;
  spaBars: SpaCategoryBarRow[];
  /** Grand total per promotion category across every spa in the window. */
  allSpas: SpaCategoryBarRow | null;
  offListCodes: string[];
  shareJumpSpas: string[];
};

export type HomePromoCardData = {
  /** Month to date through the latest DSR day (default on Home). */
  mtd: HomePromoCardSlice;
  /** Latest single-day promo snapshot (optional toggle). */
  daily: HomePromoCardSlice | null;
};

/** Sum spa rows into one "All spas" row (grand total per promotion category, promotions only). */
export function allSpasCategoryBar(rows: SpaCategoryBarRow[]): SpaCategoryBarRow | null {
  const totals: Partial<Record<PromoCategoryId, number>> = {};
  let fullPriceUsd = 0;
  const rec: PromoReconciliation = { revenueUsd: 0, promoUsd: 0, fullPriceUsd: 0, retailUsd: 0, otherTreatmentUsd: 0 };
  let anyRec = false;
  for (const row of rows) {
    for (const slice of row.slices) totals[slice.id] = (totals[slice.id] ?? 0) + slice.usd;
    fullPriceUsd += row.fullPriceUsd ?? 0;
    if (row.reconciliation) {
      anyRec = true;
      rec.revenueUsd += row.reconciliation.revenueUsd;
      rec.promoUsd += row.reconciliation.promoUsd;
      rec.fullPriceUsd += row.reconciliation.fullPriceUsd;
      rec.retailUsd += row.reconciliation.retailUsd;
      rec.otherTreatmentUsd += row.reconciliation.otherTreatmentUsd;
    }
  }
  const slices = slicesFromUsdByCategory(totals);
  const totalUsd = slices.reduce((s, x) => s + x.usd, 0);
  if (totalUsd <= 0 && !anyRec) return null;
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    spa: "All spas",
    totalUsd,
    slices,
    fullPriceUsd,
    reconciliation: anyRec
      ? {
          revenueUsd: round(rec.revenueUsd),
          promoUsd: round(rec.promoUsd),
          fullPriceUsd: round(rec.fullPriceUsd),
          retailUsd: round(rec.retailUsd),
          otherTreatmentUsd: round(rec.otherTreatmentUsd),
        }
      : null,
  };
}

/** Compact Home snapshot: MTD treatment promos with optional latest-day drill-down. */
export function buildHomePromoCardData(
  periods: StoredPromoPeriod[],
  lines: StoredPromoLine[],
  salesDays: LoadedDay[],
  approved: Set<string>,
): HomePromoCardData | null {
  const daily = buildDailyView(periods, lines, salesDays, approved);
  if (!daily.date) return null;

  const latestDate = daily.date;
  const monthStart = `${latestDate.slice(0, 7)}-01`;

  const mtdLines = treatmentPromoLinesForDateRange(lines, monthStart, latestDate);
  const dayLines = lines.filter((l) => isTreatmentSingleDayOnOrBetween(l, latestDate, latestDate));

  const mtdBars = withPromoReconciliation(
    buildSpaCategoryBarsForDateRange(lines, monthStart, latestDate),
    salesDays,
    monthStart,
    latestDate,
  );
  const dayBars = withPromoReconciliation(
    buildSpaCategoryBarsForDateRange(lines, latestDate, latestDate),
    salesDays,
    latestDate,
    latestDate,
  );
  const mtd: HomePromoCardSlice = {
    periodFrom: monthStart,
    periodTo: latestDate,
    spaBars: mtdBars,
    allSpas: allSpasCategoryBar(mtdBars),
    offListCodes: offListCodesInLines(mtdLines, approved),
    shareJumpSpas: [],
  };

  const dailySlice: HomePromoCardSlice = {
    periodFrom: latestDate,
    periodTo: latestDate,
    spaBars: dayBars,
    allSpas: allSpasCategoryBar(dayBars),
    offListCodes: offListCodesInLines(dayLines, approved),
    shareJumpSpas: daily.spas.filter((s) => s.shareAlert).map((s) => s.spa),
  };

  return { mtd, daily: dailySlice };
}

function sumTreatmentRevenueInRange(days: LoadedDay[], spa: string, from: string, to: string): number | null {
  const inRange = days.filter((d) => d.businessDate >= from && d.businessDate <= to);
  if (inRange.length === 0) return null;
  let sum = 0;
  let any = false;
  for (const day of inRange) {
    const line = day.lines.find((l) => l.locationName.toLowerCase() === spa.toLowerCase());
    if (!line) continue;
    const val = line.treatmentSales ?? line.netSales;
    if (val != null) {
      sum += val;
      any = true;
    }
  }
  return any ? sum : null;
}