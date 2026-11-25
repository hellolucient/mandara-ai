import { addDays, businessToday } from "@/lib/dates";
import {
  addUsdToCategory,
  promoCategoryForCode,
  promoCategoryLabel,
  slicesFromUsdByCategory,
  type CategoryUsdSlice,
  type PromoCategoryId,
} from "@/lib/promo-categories";
import type { PromoKind, StoredPromoLine, StoredPromoPeriod } from "@/lib/promo-types";
import type { LoadedDay } from "@/lib/sales-types";

export type SpaCategoryBarRow = {
  spa: string;
  totalUsd: number;
  slices: CategoryUsdSlice[];
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
  promoUsd: number;
  treatmentRevenue: number | null;
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

export function buildSpaCategoryBars(
  lines: StoredPromoLine[],
  filter: (line: StoredPromoLine) => boolean,
): SpaCategoryBarRow[] {
  const bySpa = new Map<string, Partial<Record<PromoCategoryId, number>>>();
  for (const line of lines) {
    if (!filter(line)) continue;
    if (line.kind !== "treatment") continue;
    const spaBucket = bySpa.get(line.locationName) ?? {};
    addUsdToCategory(spaBucket, line.promoCode, line.usd);
    bySpa.set(line.locationName, spaBucket);
  }
  return [...bySpa.entries()]
    .map(([spa, totals]) => {
      const slices = slicesFromUsdByCategory(totals);
      const totalUsd = slices.reduce((s, x) => s + x.usd, 0);
      return { spa, totalUsd, slices };
    })
    .filter((r) => r.totalUsd > 0)
    .sort((a, b) => b.totalUsd - a.totalUsd);
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
  const spas = [...new Set(dayLines.map((l) => l.locationName))].sort();
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
      const promoUsd = codes.reduce((s, c) => s + c.usd, 0);
      const treatmentRevenue = treatmentRevenueForSpa(salesDays, spa, period.periodFrom);
      const promoSharePct =
        treatmentRevenue != null && treatmentRevenue > 0 ? Math.round((promoUsd / treatmentRevenue) * 1000) / 10 : null;

      const priorShares: number[] = [];
      for (const week of priorWeekKeys) {
        const weekLines = linesInWeek(
          lines.filter((l) => l.kind === "treatment" && l.locationName === spa),
          week,
        );
        const weekUsd = weekLines.reduce((s, l) => s + l.usd, 0);
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
        treatmentRevenue,
        promoSharePct,
        shareAlert,
        codes: codes
          .sort(
            (a, b) =>
              promoCategoryLabel(a.promoCode).localeCompare(promoCategoryLabel(b.promoCode)) ||
              b.usd - a.usd,
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
): SpaCategoryBarRow[] {
  return buildSpaCategoryBars(
    lines,
    (l) => l.kind === "treatment" && l.periodFrom === periodFrom && l.periodTo === periodTo,
  );
}

export function buildSpaCategoryBarsForWeek(lines: StoredPromoLine[], weekKey: string): SpaCategoryBarRow[] {
  return buildSpaCategoryBars(lines, (l) => l.kind === "treatment" && isoWeekKey(l.periodTo) === weekKey);
}

export function buildWeeklyView(
  lines: StoredPromoLine[],
  approved: Set<string>,
  kind: PromoKind = "treatment",
): { weekKey: string; priorWeekKey: string | null; rows: WeeklySpaDelta[] } {
  const kindLines = lines.filter((l) => l.kind === kind);
  const weeks = [...new Set(kindLines.map((l) => isoWeekKey(l.periodTo)))].sort();
  const weekKey = weeks.at(-1) ?? "";
  const priorWeekKey = weeks.length > 1 ? weeks.at(-2) ?? null : null;
  if (!weekKey) return { weekKey: "", priorWeekKey: null, rows: [] };

  const thisMap = sumBySpaCode(linesInWeek(kindLines, weekKey));
  const priorMap = priorWeekKey ? sumBySpaCode(linesInWeek(kindLines, priorWeekKey)) : new Map();

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
      a.categoryLabel.localeCompare(b.categoryLabel) || Math.abs(b.changeUsd) - Math.abs(a.changeUsd),
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
      const promoUsd = spaLines.reduce((s, l) => s + l.usd, 0);
      const treatmentRevenue = sumTreatmentRevenueInRange(salesDays, spa, period.periodFrom, period.periodTo);
      const byCode = new Map<string, number>();
      const categoryTotals: Partial<Record<PromoCategoryId, number>> = {};
      for (const line of spaLines) {
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
        treatmentRevenue,
        promoSharePct:
          treatmentRevenue != null && treatmentRevenue > 0
            ? Math.round((promoUsd / treatmentRevenue) * 1000) / 10
            : null,
        categorySlices: slicesFromUsdByCategory(categoryTotals),
        topCodes,
      };
    });

    const priorTotal = prior?.totalUsd ?? null;
    const changePct =
      priorTotal != null && priorTotal > 0
        ? Math.round(((period.totalUsd - priorTotal) / priorTotal) * 1000) / 10
        : null;

    results.push({
      label,
      periodFrom: period.periodFrom,
      periodTo: period.periodTo,
      totalUsd: period.totalUsd,
      priorLabel: prior ? formatMonthLabel(prior.periodFrom, prior.periodTo) : null,
      priorTotalUsd: priorTotal,
      changePct,
      spas: spaSummaries.sort((a, b) => b.promoUsd - a.promoUsd),
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