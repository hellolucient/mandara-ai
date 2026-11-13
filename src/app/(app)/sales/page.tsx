import Link from "next/link";
import { SalesActions } from "@/components/sales-actions";
import { Badge } from "@/components/ui/badge";
import { addDays, businessToday, formatBusinessDate, money } from "@/lib/dates";
import { canManage } from "@/lib/members";
import { dayHeadline, reportFor, sourceLabel } from "@/lib/sales-answers";
import { latestReport } from "@/lib/agent";
import { loadDays } from "@/lib/sales-store";
import { currentMember } from "@/lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const member = await currentMember();
  if (!member) redirect("/");
  const query = await searchParams;
  const days = await loadDays(member.stage);
  const today = businessToday();
  const requested = query.date && /^\d{4}-\d{2}-\d{2}$/.test(query.date) ? query.date : addDays(today, -1);
  const day = days.find((item) => item.businessDate === requested) ?? days.at(-1) ?? null;
  const stored = await latestReport(member.stage);
  const headline = day ? dayHeadline(day, days) : null;
  const max = day ? Math.max(...day.lines.map((line) => line.netSales ?? 0), 1) : 1;

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 md:px-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-heading text-3xl">Sales</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Figures come from stored records. A missing number stays missing. The same records answer sales questions in the assistant.
          </p>
        </div>
        <SalesActions canRun={canManage(member.role)} />
      </div>

      {days.length === 0 || !day || !headline ? (
        <p className="mt-8 rounded-xl border bg-card px-4 py-6 text-sm">No sales records are stored yet.</p>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Badge variant={day.source === "sample" ? "secondary" : "default"}>{sourceLabel(day.source)}</Badge>
            <span className="text-sm text-muted-foreground">{formatBusinessDate(day.businessDate)}</span>
            {day.note ? <span className="text-sm text-muted-foreground">{day.note}</span> : null}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {days.slice(-14).map((item) => (
              <Link
                key={item.businessDate}
                href={`/sales?date=${item.businessDate}`}
                className={`rounded-full border px-3 py-1 text-xs whitespace-nowrap ${item.businessDate === day.businessDate ? "bg-primary text-primary-foreground" : "bg-card"}`}
              >
                {formatBusinessDate(item.businessDate)}
              </Link>
            ))}
          </div>
          <section className="mt-5 grid gap-3 sm:grid-cols-3">
            <article className="rounded-xl border bg-card p-4">
              <p className="text-xs tracking-wide text-muted-foreground uppercase">Recorded net sales</p>
              <p className="mt-2 font-heading text-3xl">{headline.total == null ? "—" : money(headline.total, day.currency)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{headline.locations} locations with a figure</p>
            </article>
            <article className="rounded-xl border bg-card p-4">
              <p className="text-xs tracking-wide text-muted-foreground uppercase">Missing figures</p>
              <p className="mt-2 font-heading text-3xl">{headline.missing.length}</p>
              <p className="mt-1 text-xs text-muted-foreground">{headline.missing.join(", ") || "None on this date"}</p>
            </article>
            <article className="rounded-xl border bg-card p-4">
              <p className="text-xs tracking-wide text-muted-foreground uppercase">Needs attention</p>
              <p className="mt-2 font-heading text-3xl">{headline.notes.length}</p>
              <p className="mt-1 text-xs text-muted-foreground">Missing figures, a stored budget miss, or a drop of 25% or more versus last week.</p>
            </article>
          </section>
          <section className="mt-6 overflow-hidden rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">Location</th>
                  <th className="px-4 py-3 font-medium">Net sales</th>
                  <th className="px-4 py-3 font-medium">Budget</th>
                  <th className="px-4 py-3 font-medium">Treatments</th>
                </tr>
              </thead>
              <tbody>
                {day.lines.map((line) => (
                  <tr key={line.locationId} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <div>{line.locationName}</div>
                      <div className="mt-2 h-1.5 rounded-full bg-muted">
                        <div
                          className="h-1.5 rounded-full bg-primary"
                          style={{ width: `${line.netSales == null ? 0 : Math.max(4, (line.netSales / max) * 100)}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">{line.netSales == null ? "Missing" : money(line.netSales, day.currency)}</td>
                    <td className="px-4 py-3">{line.budget == null ? "Not stored" : money(line.budget, day.currency)}</td>
                    <td className="px-4 py-3">{line.treatments ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          {headline.notes.length > 0 ? (
            <section className="mt-6">
              <h2 className="font-heading text-2xl">Needs attention</h2>
              <ul className="mt-3 space-y-2">
                {headline.notes.map((note) => (
                  <li key={note} className="rounded-lg border bg-accent/60 px-3 py-2 text-sm">
                    {note}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <section className="mt-6">
            <h2 className="font-heading text-2xl">Management report</h2>
            <pre className="mt-3 overflow-x-auto rounded-xl border bg-card p-4 font-sans text-sm leading-6 whitespace-pre-wrap">
              {stored?.report && stored.business_date === day.businessDate ? stored.report : reportFor(day, days)}
            </pre>
          </section>
        </>
      )}
    </main>
  );
}
