import { sql } from "@/lib/db";
import { num } from "@/lib/home-kpis";
import {
  aggregateMixTotals,
  buildMixSlices,
  type MixSlice,
} from "@/lib/item-groups";
import type { ItemCategory, StoredItemLine } from "@/lib/sales-item-types";
import { addDays } from "@/lib/dates";

type ItemRow = {
  location_id: string;
  location_name: string;
  category: ItemCategory;
  item_name: string;
  net_sales: number;
};

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

export async function loadItemLinesForMix(
  stage: string,
  fromDate: string,
  toDate: string,
  locationId?: string | null,
): Promise<StoredItemLine[]> {
  const locationClause = locationId ? "and location_id = $4" : "";
  const params: unknown[] = locationId
    ? [stage, fromDate, toDate, locationId]
    : [stage, fromDate, toDate];
  const rows = await sql<ItemRow & { business_date: string; currency: string; quantity: number }>(
    `select to_char(business_date, 'YYYY-MM-DD') as business_date,
            location_id, location_name, category, item_name, quantity, net_sales, currency
     from sales_item_lines
     where stage = $1
       and business_date >= $2 and business_date <= $3
       ${locationClause}
     order by net_sales desc`,
    params,
  );
  return rows.map((row) => ({
    id: `${row.location_id}-${row.item_name}`,
    businessDate: row.business_date,
    locationId: row.location_id,
    locationName: row.location_name,
    category: row.category,
    itemName: row.item_name,
    quantity: Number(row.quantity),
    netSales: num(row.net_sales) ?? 0,
    currency: row.currency,
  }));
}

export async function listSpasWithItemLines(stage: string): Promise<Array<{ id: string; name: string }>> {
  const rows = await sql<{ id: string; name: string }>(
    `select distinct l.id, l.name
     from sales_item_lines i
     join locations l on l.id = i.location_id and l.stage = i.stage
     where i.stage = $1
     order by l.name`,
    [stage],
  );
  return rows;
}

export function buildRevenueMixPeriod(lines: StoredItemLine[]): RevenueMixPeriod {
  const currency = lines[0]?.currency ?? "USD";
  const { treatments, retail, unmappedTreatmentNames, unmappedRetailNames } = aggregateMixTotals(
    lines.map((l) => ({ category: l.category, itemName: l.itemName, netSales: l.netSales })),
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

export async function loadRevenueMixHomeSnapshot(
  stage: string,
  latestDate: string,
): Promise<RevenueMixHomeSnapshot | null> {
  const monthStart = `${latestDate.slice(0, 7)}-01`;
  const spas = await listSpasWithItemLines(stage);
  const [yesterdayLines, mtdLines] = await Promise.all([
    loadItemLinesForMix(stage, latestDate, latestDate),
    loadItemLinesForMix(stage, monthStart, latestDate),
  ]);
  if (yesterdayLines.length === 0 && mtdLines.length === 0) return null;
  return {
    latestDate,
    monthStart,
    currency: mtdLines[0]?.currency ?? yesterdayLines[0]?.currency ?? "USD",
    spas,
    yesterday: buildRevenueMixPeriod(yesterdayLines),
    mtd: buildRevenueMixPeriod(mtdLines),
  };
}

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