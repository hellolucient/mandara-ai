import { sql } from "@/lib/db";
import { newId, slug } from "@/lib/ids";
import { num } from "@/lib/home-kpis";
import type { AggregatedItemLine, ItemCategory, SalesItemsExtract, StoredItemLine } from "@/lib/sales-item-types";

type ItemRow = {
  id: string;
  business_date: string;
  location_id: string;
  location_name: string;
  category: ItemCategory;
  item_name: string;
  quantity: number;
  net_sales: number;
  currency: string;
};

type SpaDayTotals = {
  treatment_sales: number | null;
  retail_sales: number | null;
  currency: string;
};

export async function saveItemLines(stage: string, extract: SalesItemsExtract): Promise<{ locations: number; lines: number }> {
  const locations = [...new Set(extract.items.map((item) => item.location.toLowerCase()))];
  const locationIds: string[] = [];
  for (const locationName of [...new Set(extract.items.map((item) => item.location))]) {
    const locationId = await ensureLocation(stage, locationName);
    locationIds.push(locationId);
    await sql(
      `delete from sales_item_lines
       where stage = $1 and business_date = $2
         and lower(location_name) = lower($3)`,
      [stage, extract.businessDate, locationName],
    );
  }
  for (const row of extract.items) {
    const locationId = await ensureLocation(stage, row.location);
    await sql(
      `insert into sales_item_lines
         (id, stage, business_date, location_id, location_name, category, item_name, quantity, net_sales, currency)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       on conflict (stage, business_date, location_id, category, item_name)
       do update set quantity = excluded.quantity, net_sales = excluded.net_sales, currency = excluded.currency`,
      [
        newId(),
        stage,
        extract.businessDate,
        locationId,
        row.location,
        row.category,
        row.name,
        row.quantity,
        row.netSales,
        extract.currency,
      ],
    );
  }
  return { locations: locations.length, lines: extract.items.length };
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

export async function loadItemLinesForSpa(
  stage: string,
  locationId: string,
  fromDate: string,
  toDate: string,
): Promise<StoredItemLine[]> {
  const rows = await sql<ItemRow>(
    `select id, to_char(business_date, 'YYYY-MM-DD') as business_date,
            location_id, location_name, category, item_name, quantity, net_sales, currency
     from sales_item_lines
     where stage = $1 and location_id = $2
       and business_date >= $3 and business_date <= $4
     order by net_sales desc`,
    [stage, locationId, fromDate, toDate],
  );
  return rows.map((row) => ({
    id: row.id,
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

export function aggregateItemLines(
  lines: StoredItemLine[],
  singleDay: boolean,
): { treatments: AggregatedItemLine[]; retail: AggregatedItemLine[] } {
  const bucket = (category: ItemCategory) => {
    const map = new Map<string, AggregatedItemLine>();
    for (const line of lines.filter((l) => l.category === category)) {
      const key = line.itemName;
      const existing = map.get(key);
      if (existing) {
        existing.quantity += line.quantity;
        existing.netSales += line.netSales;
      } else {
        map.set(key, { itemName: key, quantity: line.quantity, netSales: line.netSales });
      }
    }
    const list = [...map.values()].sort((a, b) => b.netSales - a.netSales);
    if (singleDay) return list;
    return list;
  };
  return { treatments: bucket("treatment"), retail: bucket("retail") };
}

export async function spaDayTotalsFromSales(
  stage: string,
  locationId: string,
  businessDate: string,
): Promise<SpaDayTotals | null> {
  const rows = await sql<SpaDayTotals & { business_date: string }>(
    `select l.treatment_sales, l.retail_sales, d.currency
     from sales_lines l
     join sales_days d on d.id = l.day_id
     where d.stage = $1 and l.location_id = $2 and d.business_date = $3`,
    [stage, locationId, businessDate],
  );
  if (!rows[0]) return null;
  return {
    treatment_sales: num(rows[0].treatment_sales),
    retail_sales: num(rows[0].retail_sales),
    currency: rows[0].currency,
  };
}

export async function spaRangeTotalsFromSales(
  stage: string,
  locationId: string,
  fromDate: string,
  toDate: string,
): Promise<{ treatment: number | null; retail: number | null; currency: string } | null> {
  const rows = await sql<{ treatment_sales: number | null; retail_sales: number | null; currency: string }>(
    `select sum(l.treatment_sales) as treatment_sales, sum(l.retail_sales) as retail_sales, min(d.currency) as currency
     from sales_lines l
     join sales_days d on d.id = l.day_id
     where d.stage = $1 and l.location_id = $2
       and d.business_date >= $3 and d.business_date <= $4`,
    [stage, locationId, fromDate, toDate],
  );
  if (!rows[0]?.currency) return null;
  return {
    treatment: num(rows[0].treatment_sales),
    retail: num(rows[0].retail_sales),
    currency: rows[0].currency,
  };
}

export async function answerItemsSoldText(
  stage: string,
  locationName: string,
  businessDate: string,
  category: ItemCategory | "all",
): Promise<string> {
  const loc = await sql<{ id: string; name: string }>(
    "select id, name from locations where stage = $1 and lower(name) = lower($2)",
    [stage, locationName],
  );
  if (!loc[0]) return `No stored location matches ${locationName}.`;
  const lines = await loadItemLinesForSpa(stage, loc[0].id, businessDate, businessDate);
  if (lines.length === 0) {
    const totals = await spaDayTotalsFromSales(stage, loc[0].id, businessDate);
    const parts = [`No item breakdown is stored for ${loc[0].name} on ${businessDate}.`];
    if (totals) {
      if (totals.treatment_sales != null) parts.push(`Treatment total (DSR): $${totals.treatment_sales.toFixed(2)}.`);
      if (totals.retail_sales != null) parts.push(`Retail total (DSR): $${totals.retail_sales.toFixed(2)}.`);
    }
    return parts.join(" ");
  }
  const { treatments, retail } = aggregateItemLines(lines, true);
  const showTreatments = category === "all" || category === "treatment";
  const showRetail = category === "all" || category === "retail";
  const parts = [`Items sold at ${loc[0].name} on ${businessDate}.`];
  if (showTreatments) {
    parts.push("", "Treatments:");
    if (treatments.length === 0) parts.push("None stored.");
    else {
      for (const row of treatments) parts.push(`- ${row.itemName}: qty ${row.quantity}, $${row.netSales.toFixed(2)}`);
      parts.push(`Subtotal: $${treatments.reduce((s, r) => s + r.netSales, 0).toFixed(2)}`);
    }
  }
  if (showRetail) {
    parts.push("", "Retail:");
    if (retail.length === 0) parts.push("None stored.");
    else {
      for (const row of retail) parts.push(`- ${row.itemName}: qty ${row.quantity}, $${row.netSales.toFixed(2)}`);
      parts.push(`Subtotal: $${retail.reduce((s, r) => s + r.netSales, 0).toFixed(2)}`);
    }
  }
  return parts.join("\n");
}