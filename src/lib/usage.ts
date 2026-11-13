import { sql } from "@/lib/db";

export async function usageSummary(stage: string) {
  const byModel = await sql<{
    model: string;
    calls: number;
    prompt_tokens: number;
    completion_tokens: number;
    cost: number;
    estimated: number;
  }>(
    `select model,
            count(*)::int as calls,
            coalesce(sum(prompt_tokens), 0)::int as prompt_tokens,
            coalesce(sum(completion_tokens), 0)::int as completion_tokens,
            coalesce(sum(cost_usd) filter (where cost_known), 0)::float8 as cost,
            coalesce(sum(cost_usd) filter (where not cost_known), 0)::float8 as estimated
     from usage_events
     where stage = $1 and created_at >= date_trunc('month', now())
     group by model
     order by cost desc, estimated desc`,
    [stage],
  );
  const calls = byModel.reduce((sum, row) => sum + Number(row.calls), 0);
  const known = byModel.reduce((sum, row) => sum + Number(row.cost), 0);
  const estimated = byModel.reduce((sum, row) => sum + Number(row.estimated), 0);
  return { byModel, calls, known, estimated };
}
