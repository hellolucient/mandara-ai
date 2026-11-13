import { sql } from "@/lib/db";
import { chunkText } from "@/lib/chunk";
import { SAMPLE_DOCUMENTS, SAMPLE_LOCATIONS, buildSampleDays } from "@/lib/sample-data";

const seeded = new Set<string>();

export async function ensureSeed(stage: string): Promise<void> {
  if (seeded.has(stage)) return;
  const existing = await sql<{ value: string }>(
    "select value from settings where stage = $1 and key = 'sampleSeed'",
    [stage],
  );
  if (existing[0]?.value === "done") {
    seeded.add(stage);
    return;
  }
  await insertRows(
    "locations",
    ["id", "stage", "name", "sort_order"],
    SAMPLE_LOCATIONS.map((location) => [location.id, stage, location.name, location.sort]),
    "(stage, id)",
  );
  const days = buildSampleDays();
  await insertRows(
    "sales_days",
    ["id", "stage", "business_date", "source", "currency", "complete", "note"],
    days.map((day) => [`${stage}:${day.businessDate}`, stage, day.businessDate, "sample", day.currency, day.complete, day.note]),
    "(stage, business_date)",
  );
  await insertRows(
    "sales_lines",
    ["id", "day_id", "location_id", "location_name", "net_sales", "treatments", "budget"],
    days.flatMap((day) =>
      day.lines.map((line) => [
        `${stage}:${day.businessDate}:${line.locationId}`,
        `${stage}:${day.businessDate}`,
        line.locationId,
        line.locationName,
        line.netSales,
        line.treatments,
        line.budget,
      ]),
    ),
    "(day_id, location_id)",
  );
  await insertRows(
    "documents",
    ["id", "stage", "title", "filename", "mime", "visibility", "sample", "uploaded_by", "byte_size"],
    SAMPLE_DOCUMENTS.map((document) => [
      document.id,
      stage,
      document.title,
      document.filename,
      "text/plain",
      document.visibility,
      true,
      "system",
      document.body.length,
    ]),
    "(stage, id)",
  );
  const chunks = SAMPLE_DOCUMENTS.flatMap((document) =>
    chunkText(document.body).map((content, index) => ({
      id: `${stage}:${document.id}:${index}`,
      documentId: document.id,
      ordinal: index,
      content,
    })),
  );
  if (chunks.length > 0) {
    await sql(
      `insert into chunks (id, stage, document_id, ordinal, content, tsv)
       select id, $1, document_id, ordinal, content, to_tsvector('english', content)
       from unnest($2::text[], $3::text[], $4::int[], $5::text[]) as t(id, document_id, ordinal, content)
       on conflict (id) do nothing`,
      [stage, chunks.map((chunk) => chunk.id), chunks.map((chunk) => chunk.documentId), chunks.map((chunk) => chunk.ordinal), chunks.map((chunk) => chunk.content)],
    );
  }
  await sql(
    `insert into settings (stage, key, value) values ($1, 'sampleSeed', 'done')
     on conflict (stage, key) do update set value = excluded.value`,
    [stage],
  );
  seeded.add(stage);
}

async function insertRows(table: string, columns: string[], rows: unknown[][], conflict: string): Promise<void> {
  if (rows.length === 0) return;
  const values: unknown[] = [];
  const groups = rows.map((row) => {
    const placeholders = row.map((value) => {
      values.push(value);
      return `$${values.length}`;
    });
    return `(${placeholders.join(", ")})`;
  });
  await sql(
    `insert into ${table} (${columns.join(", ")}) values ${groups.join(", ")} on conflict ${conflict} do nothing`,
    values,
  );
}
