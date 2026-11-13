import { sql } from "@/lib/db";
import { chunkText } from "@/lib/chunk";
import { newId } from "@/lib/ids";
import type { Role } from "@/lib/members";

export type DocumentRow = {
  id: string;
  title: string;
  filename: string;
  visibility: "company" | "restricted";
  sample: boolean;
  uploaded_by: string;
  byte_size: number;
  created_at: string;
};

type HitRow = {
  document_id: string;
  title: string;
  excerpt: string;
  sample: boolean;
  visibility: "company" | "restricted";
};

function mapHits(rows: HitRow[]): Hit[] {
  return rows.map((row) => ({
    documentId: row.document_id,
    title: row.title,
    excerpt: row.excerpt,
    sample: Boolean(row.sample),
    visibility: row.visibility,
  }));
}

export type Hit = {
  documentId: string;
  title: string;
  excerpt: string;
  sample: boolean;
  visibility: "company" | "restricted";
};

export async function listDocuments(stage: string, role: Role): Promise<DocumentRow[]> {
  return sql<DocumentRow>(
    `select id, title, filename, visibility, sample, uploaded_by, byte_size, created_at::text
     from documents where stage = $1 and ($2::text = 'admin' or $2::text = 'manager' or visibility = 'company')
     order by sample desc, created_at desc`,
    [stage, role],
  );
}

export async function searchKnowledge(stage: string, query: string, role: Role): Promise<{ hits: Hit[]; restrictedHidden: boolean }> {
  const terms = keywords(query);
  if (terms.length < 2) return { hits: [], restrictedHidden: false };
  const allowed = role === "admin" || role === "manager" ? ["company", "restricted"] : ["company"];
  let hits: Hit[] = [];
  try {
    hits = await rankedSearch(stage, terms, allowed);
  } catch {
    hits = [];
  }
  let restrictedHidden = false;
  if (allowed.length === 1) {
    try {
      const hidden = await sql<{ n: number }>(
        `select count(*)::int as n from chunks c
         join documents d on d.stage = c.stage and d.id = c.document_id
         where c.stage = $1 and d.visibility = 'restricted' and c.tsv @@ plainto_tsquery('english', $2)`,
        [stage, terms],
      );
      restrictedHidden = Number(hidden[0]?.n ?? 0) > 0;
    } catch {
      restrictedHidden = false;
    }
  }
  return {
    hits: hits.map((hit) => ({ ...hit, excerpt: hit.excerpt.slice(0, 700) })),
    restrictedHidden,
  };
}

export async function addDocument(input: {
  stage: string;
  title: string;
  filename: string;
  mime: string;
  visibility: "company" | "restricted";
  uploadedBy: string;
  byteSize: number;
  text: string;
}): Promise<void> {
  const id = newId();
  await sql(
    `insert into documents (id, stage, title, filename, mime, visibility, sample, uploaded_by, byte_size)
     values ($1, $2, $3, $4, $5, $6, false, $7, $8)`,
    [id, input.stage, input.title, input.filename, input.mime, input.visibility, input.uploadedBy, input.byteSize],
  );
  const chunks = chunkText(input.text);
  for (let index = 0; index < chunks.length; index += 1) {
    await sql(
      `insert into chunks (id, stage, document_id, ordinal, content, tsv)
       values ($1, $2, $3, $4, $5, to_tsvector('english', $5))`,
      [newId(), input.stage, id, index, chunks[index]],
    );
  }
}

export async function deleteDocument(stage: string, id: string, actorSub: string, role: Role): Promise<boolean> {
  const rows = await sql<{ uploaded_by: string }>(
    "select uploaded_by from documents where stage = $1 and id = $2",
    [stage, id],
  );
  if (!rows[0]) return false;
  if (role !== "admin" && rows[0].uploaded_by !== actorSub) return false;
  await sql("delete from documents where stage = $1 and id = $2", [stage, id]);
  return true;
}

async function rankedSearch(stage: string, terms: string, allowed: string[]): Promise<Hit[]> {
  return mapHits(await sql<HitRow>(
    `select d.id as document_id, d.title, c.content as excerpt, d.sample, d.visibility
     from chunks c
     join documents d on d.stage = c.stage and d.id = c.document_id
     where c.stage = $1
       and c.tsv @@ plainto_tsquery('english', $2)
       and d.visibility = any($3::text[])
     order by ts_rank(c.tsv, plainto_tsquery('english', $2)) desc
     limit 6`,
    [stage, terms, allowed],
  ));
}

const STOP = new Set([
  "what", "does", "the", "and", "for", "with", "from", "that", "this", "into",
  "your", "about", "please", "tell", "how", "can", "you", "are", "was", "were",
  "our", "say", "not", "note",
]);

function keywords(query: string): string {
  return query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP.has(word))
    .slice(0, 8)
    .join(" ");
}
