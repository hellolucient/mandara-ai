import { runSalesAgent } from "@/lib/agent";
import { sql } from "@/lib/db";
import { bearer, json } from "@/lib/http";
import { newId } from "@/lib/ids";
import { saveExtract } from "@/lib/sales-store";
import { validateExtract } from "@/lib/sales-validate";
import { cronAuthorized } from "@/lib/secrets";
import { ensureSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!cronAuthorized(bearer(request))) return json({ error: "The schedule secret was not accepted." }, 401);
  const raw = await request.text();
  if (raw.length > 500_000) return json({ error: "That extract is too large." }, 413);
  await ensureSeed("production");
  if (raw.trim()) {
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return json({ error: "The body was not valid JSON." }, 400);
    }
    const failure = readFailure(body);
    if (failure) {
      await recordFailure(failure);
      return json({ status: "failed", error: failure }, 422);
    }
    const validated = validateExtract(body);
    if (!validated.ok) {
      await recordFailure(validated.error);
      return json({ status: "failed", error: validated.error }, 422);
    }
    await saveExtract("production", validated.extract, "dsr");
  }
  const run = await runSalesAgent({ stage: "production", trigger: "schedule", actor: "schedule" });
  return json({ status: run.status, summary: run.summary, error: run.error });
}

function readFailure(body: unknown): string {
  if (!body || typeof body !== "object" || !("ok" in body)) return "";
  const record = body as { ok?: boolean; error?: string };
  if (record.ok === false) return (record.error || "The extractor reported a failure.").slice(0, 500);
  return "";
}

async function recordFailure(error: string) {
  await sql(
    `insert into agent_runs (id, stage, agent, trigger, status, actor, finished_at, log, error)
     values ($1, 'production', 'maldives-daily-sales', 'schedule', 'failed', 'schedule', now(), $2, $2)`,
    [newId(), error],
  );
}
