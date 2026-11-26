/**
 * Pure revenue-mix helpers and types, safe for client components.
 * Database loaders stay in revenue-mix.ts so webpack does not bundle `pg`.
 */

import {
  aggregateMixTotals,
  buildMixSlices,
  type MixSlice,
} from "@/lib/item-groups";
import type { StoredItemLine } from "@/lib/sales-item-types";
import { addDays } from "@/lib/dates";
import { groupSpasByBrand } from "@/lib/spa-groups";

export type RevenueMixPeriod = {
  currency: string;
  treatmentSlices: MixSlice[];
  retailSlices: MixSlice[];
  treatmentTotal: number;
  retailTotal: number;
  unmappedTreatmentNames: string[];
  unmappedRetailNames: string[];
  hasData: boolean;
};

export function buildRevenueMixPeriod(lines: StoredItemLine[]): RevenueMixPeriod {
  const currency = lines[0]?.currency ?? "USD";
  const { treatments, retail, unmappedTreatmentNames, unmappedRetailNames } = aggregateMixTotals(
    lines.map((l) => ({
      category: l.category,
      itemName: l.itemName,
      netSales: l.netSales,
      itemCode: l.itemCode,
      supplier: l.supplier,
    })),
  );
  const treatmentSlices = buildMixSlices("treatment", treatments);
  const retailSlices = buildMixSlices("retail", retail);
  const treatmentTotal = treatmentSlices.reduce((s, x) => s + x.netSales, 0);
  const retailTotal = retailSlices.reduce((s, x) => s + x.netSales, 0);
  return {
    currency,
    treatmentSlices,
    retailSlices,
    treatmentTotal,
    retailTotal,
    unmappedTreatmentNames,
    unmappedRetailNames,
    hasData: lines.length > 0,
  };
}

/**
 * Month-to-date (or any range) item lines without gaps or double counting.
 *
 * Daily DSR item lines only exist from the day item imports started, so a range built from them alone
 * covers a few days while the KPI cards cover the whole month. Steiners Statistic range exports
 * (`sales_period_items`) cover `from`..X; we take, per category, the longest range that starts on `from`
 * and ends on or before `to`, then add daily lines only for days after X.
 */
export function composeRangeItemLines(
  periodLines: StoredItemLine[],
  dailyLines: StoredItemLine[],
  from: string,
  to: string,
): { lines: StoredItemLine[]; coveredTo: Partial<Record<"treatment" | "retail", string>> } {
  const coveredTo: Partial<Record<"treatment" | "retail", string>> = {};
  for (const line of periodLines) {
    if (line.periodFrom !== from || line.businessDate > to || line.businessDate < from) continue;
    const prev = coveredTo[line.category];
    if (!prev || line.businessDate > prev) coveredTo[line.category] = line.businessDate;
  }
  const out: StoredItemLine[] = [];
  for (const line of periodLines) {
    if (line.periodFrom === from && coveredTo[line.category] === line.businessDate) out.push(line);
  }
  for (const line of dailyLines) {
    if (line.businessDate < from || line.businessDate > to) continue;
    const cut = coveredTo[line.category];
    if (cut && line.businessDate <= cut) continue;
    out.push(line);
  }
  return { lines: out, coveredTo };
}

export type RevenueMixHomeSnapshot = {
  latestDate: string;
  monthStart: string;
  currency: string;
  spas: Array<{ id: string; name: string }>;
  /** All spas combined */
  yesterday: RevenueMixPeriod;
  mtd: RevenueMixPeriod;
};

export type SpaMixRow = {
  spa: string;
  locationId: string;
  treatmentSlices: MixSlice[];
  retailSlices: MixSlice[];
  total: number;
};

export function buildSpaMixRows(lines: StoredItemLine[]): SpaMixRow[] {
  const bySpa = new Map<string, StoredItemLine[]>();
  for (const line of lines) {
    const list = bySpa.get(line.locationId) ?? [];
    list.push(line);
    bySpa.set(line.locationId, list);
  }
  const rows: SpaMixRow[] = [];
  for (const [locationId, spaLines] of bySpa) {
    const period = buildRevenueMixPeriod(spaLines);
    rows.push({
      spa: spaLines[0]?.locationName ?? locationId,
      locationId,
      treatmentSlices: period.treatmentSlices,
      retailSlices: period.retailSlices,
      total: period.treatmentTotal + period.retailTotal,
    });
  }
  return groupSpasByBrand(rows, (r) => r.total, (r) => r.spa).flatMap((g) => g.items);
}

/** Monday-based week containing `iso` (UTC date string). */
export function weekRangeContaining(iso: string): { from: string; to: string } {
  const [y, m, d] = iso.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  const dow = utc.getUTCDay();
  const daysFromMonday = (dow + 6) % 7;
  const from = addDays(iso, -daysFromMonday);
  const to = addDays(from, 6);
  return { from, to };
}

export function monthRangeContaining(iso: string): { from: string; to: string } {
  const from = `${iso.slice(0, 7)}-01`;
  const to = iso;
  return { from, to };
}
