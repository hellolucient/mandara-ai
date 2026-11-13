import { sql } from "@/lib/db";
import { newId, slug } from "@/lib/ids";
import type { LoadedDay, SalesExtract, SalesLine, SalesSource } from "@/lib/sales-types";

type DayRow = {
  id: string;
  business_date: string;
  source: SalesSource;
  currency: string;
  complete: boolean;
  note: string;
};

type LineRow = {
  day_id: string;
  location_id: string;
  location_name: string;
  net_sales: number | null;
  treatments: number | null;
  budget: number | null;
};

export async function loadDays(stage: string): Promise<LoadedDay[]> {
  const days = await sql<DayRow>(
    `select id, to_char(business_date, 'YYYY-MM-DD') as business_date, source, currency, complete, note
     from sales_days where stage = $1 order by business_date`,
    [stage],
  );
  if (days.length === 0) return [];
  const lines = await sql<LineRow>(
    `select l.day_id, l.location_id, l.location_name, l.net_sales, l.treatments, l.budget
     from sales_lines l
     join sales_days d on d.id = l.day_id
     where d.stage = $1`,
    [stage],
  );
  return days.map((day) => ({
    businessDate: day.business_date,
    source: day.source,
    currency: day.currency,
    complete: day.complete,
    note: day.note,
    lines: lines
      .filter((line) => line.day_id === day.id)
      .map((line) => ({
        locationId: line.location_id,
        locationName: line.location_name,
        netSales: num(line.net_sales),
        treatments: line.treatments == null ? null : Number(line.treatments),
        budget: num(line.budget),
      })),
  }));
}

export async function locationNames(stage: string): Promise<string[]> {
  const rows = await sql<{ name: string }>(
    "select name from locations where stage = $1 and active = true order by sort_order, name",
    [stage],
  );
  return rows.map((row) => row.name);
}

export async function removeSampleDays(stage: string): Promise<void> {
  await sql("delete from sales_days where stage = $1 and source = 'sample'", [stage]);
}

export async function saveExtract(stage: string, extract: SalesExtract, source: Exclude<SalesSource, "sample">): Promise<void> {
  const existing = await sql<{ id: string }>(
    "select id from sales_days where stage = $1 and business_date = $2",
    [stage, extract.businessDate],
  );
  if (existing[0]) await sql("delete from sales_days where id = $1", [existing[0].id]);
  const dayId = newId();
  const note = extract.issues.length ? extract.issues.join(" ") : "";
  await sql(
    `insert into sales_days (id, stage, business_date, source, currency, complete, note)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [dayId, stage, extract.businessDate, source, extract.currency, extract.complete, note],
  );
  for (const row of extract.rows) {
    const locationId = await ensureLocation(stage, row.location);
    await sql(
      `insert into sales_lines (id, day_id, location_id, location_name, net_sales, treatments, budget)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [newId(), dayId, locationId, row.location, row.netSales, row.treatments, row.budget],
    );
  }
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

function num(value: number | null): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export type { SalesLine };
