import { SalesActions } from "@/components/sales-actions";
import { Badge } from "@/components/ui/badge";
import { listRuns } from "@/lib/agent";
import { formatMaldives } from "@/lib/dates";
import { canManage } from "@/lib/members";
import { integrationStatus } from "@/lib/secrets";
import { currentMember } from "@/lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const member = await currentMember();
  if (!member) redirect("/");
  const runs = await listRuns(member.stage);
  const status = integrationStatus();
  const signedIn = status.dsrUrl && status.dsrUsername && status.dsrPassword;
  const dsrState = !signedIn
    ? "DSR sign-in is not available to this server. Reports use the records already stored, and they name that source."
    : "The saved login is submitted from this server when you generate a report or check the sign-in. The result is written in the activity log. Sales figures are not taken from the page until the table is identified.";
  return (
    <main className="mx-auto max-w-5xl px-4 py-6 md:px-8">
      <h1 className="font-heading text-3xl">Agents</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
        One agent is in this proof of concept. Further specialists can use the same run log later. They are not built yet.
      </p>
      <article className="mt-6 rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-heading text-2xl">Maldives Daily Sales</h2>
          <Badge variant="secondary">Read only</Badge>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-6">
          Collects the previous day&apos;s spa sales, keeps a structured history, and writes a management report. It cannot change DSR, send messages, or approve spending. A person runs it here. A scheduler can call it once a day at 07:30 Maldives time when the schedule secret is set.
        </p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Live DSR collection</dt>
            <dd>{dsrState}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Schedule endpoint</dt>
            <dd>{status.cron ? "Secret configured." : "Waiting for a schedule secret. Manual runs still work."}</dd>
          </div>
        </dl>
        <div className="mt-4">
          <SalesActions canRun={canManage(member.role)} />
        </div>
      </article>
      <section className="mt-8">
        <h2 className="font-heading text-2xl">Activity</h2>
        {runs.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No runs yet. Generate a report to write the first log.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {runs.map((run) => (
              <li key={run.id} className="rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={run.status === "failed" ? "destructive" : "secondary"}>{run.status}</Badge>
                  <span className="text-sm">{run.trigger}</span>
                  <span className="text-xs text-muted-foreground">{formatMaldives(run.started_at)}</span>
                </div>
                {run.summary ? <p className="mt-2 text-sm">{run.summary}</p> : null}
                {run.error ? <p className="mt-2 text-sm text-destructive">{run.error}</p> : null}
                <pre className="mt-3 font-sans text-xs leading-5 whitespace-pre-wrap text-muted-foreground">{run.log}</pre>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
