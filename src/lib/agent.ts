import { sql } from "@/lib/db";
import { businessToday, formatBusinessDate } from "@/lib/dates";
import { probeDsr } from "@/lib/dsr-probe";
import { newId } from "@/lib/ids";
import { reportFor } from "@/lib/sales-answers";
import { loadDays } from "@/lib/sales-store";
import { integrationStatus } from "@/lib/secrets";

export type AgentRun = {
  id: string;
  trigger: string;
  status: string;
  actor: string;
  started_at: string;
  business_date: string | null;
  summary: string;
  report: string;
  log: string;
  error: string;
};

export async function runSalesAgent(input: {
  stage: string;
  trigger: "manual" | "schedule";
  actor: string;
  today?: string;
}): Promise<AgentRun> {
  const id = newId();
  const today = input.today ?? businessToday();
  const status = await integrationStatus();
  const lines = [`Run started (${input.trigger}).`];
  if (!status.dsrUrl || !status.dsrUsername || !status.dsrPassword) {
    lines.push("DSR sign-in is not available to this server, so this report uses the records already stored.");
  } else {
    const probe = await probeDsr();
    lines.push(probe.note);
    lines.push("Figures from the page were not stored. The report below uses the records already stored.");
  }
  await sql(
    `insert into agent_runs (id, stage, agent, trigger, status, actor, log)
     values ($1, $2, 'maldives-daily-sales', $3, 'running', $4, $5)`,
    [id, input.stage, input.trigger, input.actor, lines.join("\n")],
  );
  try {
    const days = await loadDays(input.stage);
    const target = days.find((day) => day.businessDate === addIso(today, -1)) ?? null;
    if (!target) {
      const latest = days.at(-1);
      const error = latest
        ? `No sales record for ${formatBusinessDate(addIso(today, -1))}. Latest stored date is ${formatBusinessDate(latest.businessDate)}. No figures were invented.`
        : "No sales records are stored. No figures were invented.";
      lines.push(error);
      await finish(id, "failed", null, "", "", lines.join("\n"), error);
      return (await getRun(id))!;
    }
    const report = reportFor(target, days);
    const summary = report.split("\n").find((line) => line.startsWith("Recorded net sales")) ?? "Report stored.";
    lines.push(`Report built for ${target.businessDate} from ${target.source} records.`);
    await finish(id, target.complete ? "completed" : "attention", target.businessDate, summary, report, lines.join("\n"), "");
    return (await getRun(id))!;
  } catch (error) {
    const message = error instanceof Error ? error.message : "The sales run failed.";
    lines.push(message);
    await finish(id, "failed", null, "", "", lines.join("\n"), message);
    return (await getRun(id))!;
  }
}

async function finish(
  id: string,
  status: string,
  businessDate: string | null,
  summary: string,
  report: string,
  log: string,
  error: string,
) {
  await sql(
    `update agent_runs
     set status = $2, finished_at = now(), business_date = $3, summary = $4, report = $5, log = $6, error = $7
     where id = $1`,
    [id, status, businessDate, summary, report, log, error],
  );
}

export async function listRuns(stage: string): Promise<AgentRun[]> {
  return sql<AgentRun>(
    `select id, trigger, status, actor, started_at::text, to_char(business_date, 'YYYY-MM-DD') as business_date,
            summary, report, log, error
     from agent_runs where stage = $1 order by started_at desc limit 20`,
    [stage],
  );
}

export async function latestReport(stage: string): Promise<AgentRun | null> {
  const rows = await sql<AgentRun>(
    `select id, trigger, status, actor, started_at::text, to_char(business_date, 'YYYY-MM-DD') as business_date,
            summary, report, log, error
     from agent_runs where stage = $1 and report <> '' order by started_at desc limit 1`,
    [stage],
  );
  return rows[0] ?? null;
}

async function getRun(id: string): Promise<AgentRun | null> {
  const rows = await sql<AgentRun>(
    `select id, trigger, status, actor, started_at::text, to_char(business_date, 'YYYY-MM-DD') as business_date,
            summary, report, log, error
     from agent_runs where id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

function addIso(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
