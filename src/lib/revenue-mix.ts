import { sql } from "@/lib/db";
import { groupSpasByBrand } from "@/lib/spa-groups";
import { num } from "@/lib/home-kpis";
import type { ItemCategory } from "@/lib/sales-item-types";
import type { StoredItemLine } from "@/lib/sales-item-types";
import {
  buildRevenueMixPeriod,
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
    loadItemLinesForMix(stage, monthStart, latestDate),
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
