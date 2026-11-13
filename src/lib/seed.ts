import { sql } from "@/lib/db";
import { chunkText } from "@/lib/chunk";
import { SAMPLE_DOCUMENTS, SAMPLE_LOCATIONS, buildSampleDays } from "@/lib/sample-data";

const seeded = new Set<string>();

export async function ensureSeed(stage: string): Promise<void> {
  if (seeded.has(stage)) return;
  const existing = await sql<{ n: number }>("select count(*)::int as n from locations where stage = $1", [stage]);
  if (Number(existing[0]?.n ?? 0) > 0) {
    seeded.add(stage);
    return;
  }
  for (const location of SAMPLE_LOCATIONS) {
    await sql(
      `insert into locations (id, stage, name, sort_order) values ($1, $2, $3, $4)
       on conflict (stage, id) do nothing`,
      [location.id, stage, location.name, location.sort],
    );
  }
  for (const day of buildSampleDays()) {
    const dayId = `${stage}:${day.businessDate}`;
    await sql(
      `insert into sales_days (id, stage, business_date, source, currency, complete, note)
       values ($1, $2, $3, 'sample', $4, $5, $6)
       on conflict (stage, business_date) do nothing`,
      [dayId, stage, day.businessDate, day.currency, day.complete, day.note],
    );
    for (const line of day.lines) {
      await sql(
        `insert into sales_lines (id, day_id, location_id, location_name, net_sales, treatments, budget)
         values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (day_id, location_id) do nothing`,
        [`${dayId}:${line.locationId}`, dayId, line.locationId, line.locationName, line.netSales, line.treatments, line.budget],
      );
    }
  }
  for (const document of SAMPLE_DOCUMENTS) {
    await sql(
      `insert into documents (id, stage, title, filename, mime, visibility, sample, uploaded_by, byte_size)
       values ($1, $2, $3, $4, 'text/plain', $5, true, 'system', $6)
       on conflict (stage, id) do nothing`,
      [document.id, stage, document.title, document.filename, document.visibility, document.body.length],
    );
    const chunks = chunkText(document.body);
    for (let index = 0; index < chunks.length; index += 1) {
      await sql(
        `insert into chunks (id, stage, document_id, ordinal, content, tsv)
         values ($1, $2, $3, $4, $5, to_tsvector('english', $5))
         on conflict (id) do nothing`,
        [`${stage}:${document.id}:${index}`, stage, document.id, index, chunks[index]],
      );
    }
  }
  seeded.add(stage);
}
