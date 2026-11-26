import { sql } from "@/lib/db";
import { groupSpasByBrand } from "@/lib/spa-groups";
import { num } from "@/lib/home-kpis";
import type { ItemCategory } from "@/lib/sales-item-types";
import type { StoredItemLine } from "@/lib/sales-item-types";
import {
  buildRevenueMixPeriod,
  composeRangeItemLines,
  type RevenueMixHomeSnapshot,
} from "@/lib/revenue-mix-view";

export {
  buildRevenueMixPeriod,
  buildSpaMixRows,
  monthRangeContaining,
  weekRangeContaining,
  type RevenueMixHomeSnapshot,
  type RevenueMixPeriod,
  type SpaMixRow,
} from "@/lib/revenue-mix-view";

type ItemRow = {
  location_id: string;
  location_name: string;
  category: ItemCategory;
  item_name: string;
  net_sales: number;
  item_code: string | null;
  supplier: string | null;
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
            location_id, location_name, category, item_name, quantity, net_sales, currency,
            item_code, supplier
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
    itemCode: row.item_code,
    supplier: row.supplier,
  }));
}

/** Steiners Statistic range rows that start on `fromDate` and end on or before `toDate`, as item lines dated at period end. */
export async function loadPeriodItemLinesForMix(
  stage: string,
  fromDate: string,
  toDate: string,
  locationId?: string | null,
): Promise<StoredItemLine[]> {
  const rows = await sql<{
    period_from: string;
    period_to: string;
    location: string;
    location_id: string | null;
    kind: ItemCategory;
    item_code: string;
    item_name: string;
    supplier: string;
    qty: number;
    nett: number;
  }>(
    `select to_char(p.period_from, 'YYYY-MM-DD') as period_from,
            to_char(p.period_to, 'YYYY-MM-DD') as period_to,
            p.location, l.id as location_id, p.kind, p.item_code, p.item_name, p.supplier, p.qty, p.nett
     from sales_period_items p
     left join locations l on l.stage = p.stage and lower(l.name) = lower(p.location)
     where p.stage = $1
       and p.period_from = $2::date
       and p.period_to <= $3::date`,
    [stage, fromDate, toDate],
  );
  return rows
    .map((row) => ({
      id: `period-${row.period_to}-${row.location}-${row.kind}-${row.item_code}-${row.item_name}`,
      businessDate: row.period_to,
      periodFrom: row.period_from,
      locationId: row.location_id ?? row.location.toLowerCase().replace(/\s+/g, "-"),
      locationName: row.location,
      category: row.kind,
      itemName: row.item_name,
      quantity: Number(row.qty),
      netSales: num(row.nett) ?? 0,
      currency: "USD",
      itemCode: row.item_code || null,
      supplier: row.supplier || null,
    }))
    .filter((line) => !locationId || line.locationId === locationId);
}

/**
 * Item lines for a date range with full coverage: Statistic range export from `fromDate` (when stored)
 * plus daily DSR item lines for the days after it. Use this for month-to-date mixes.
 */
export async function loadRangeItemLinesForMix(
  stage: string,
  fromDate: string,
  toDate: string,
  locationId?: string | null,
): Promise<StoredItemLine[]> {
  if (fromDate === toDate) return loadItemLinesForMix(stage, fromDate, toDate, locationId);
  const [periodLines, dailyLines] = await Promise.all([
    loadPeriodItemLinesForMix(stage, fromDate, toDate, locationId),
    loadItemLinesForMix(stage, fromDate, toDate, locationId),
  ]);
  return composeRangeItemLines(periodLines, dailyLines, fromDate, toDate).lines;
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

export async function loadRevenueMixHomeSnapshot(
  stage: string,
  latestDate: string,
): Promise<RevenueMixHomeSnapshot | null> {
  const monthStart = `${latestDate.slice(0, 7)}-01`;
  const spaList = await listSpasWithItemLines(stage);
  const [yesterdayLines, mtdLines] = await Promise.all([
    loadItemLinesForMix(stage, latestDate, latestDate),
    loadRangeItemLinesForMix(stage, monthStart, latestDate),
  ]);
  const mtdBySpa = new Map<string, number>();
  for (const line of mtdLines) {
    mtdBySpa.set(line.locationName, (mtdBySpa.get(line.locationName) ?? 0) + line.netSales);
  }
  const spas = groupSpasByBrand(spaList, (s) => mtdBySpa.get(s.name) ?? 0, (s) => s.name).flatMap((g) => g.items);
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
