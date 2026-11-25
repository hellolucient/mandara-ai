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
  return rows.sort((a, b) => b.total - a.total);
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
