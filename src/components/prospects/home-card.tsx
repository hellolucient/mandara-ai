import Link from "next/link";
import { ArrowRight, Lock, Radar } from "lucide-react";
import { SignalTypeTag, StatusDot } from "@/components/prospects/badges";
import { formatDay } from "@/lib/prospects-format";
import { type ProspectStatus, type ProspectSummary } from "@/lib/prospects-types";

const SHOWN: Array<[ProspectStatus, string]> = [
  ["researching", "Research"],
  ["ready", "Ready"],
  ["in_talks", "In talks"],
  ["proposal", "Proposal"],
  ["won", "Won"],
];

/** Home card for administrators only. The page does not render or load it for anyone else. */
export function ProspectsCard({ summary }: { summary: ProspectSummary }) {
  // Live = moved past Watching and still open. Watching is everything imported and not yet worked.
  const live = summary.byStatus.researching + summary.byStatus.ready + summary.byStatus.in_talks + summary.byStatus.proposal;
  return (
    <section className="mt-12">
      <div className="flex items-baseline justify-between">
        <h2 className="flex items-center gap-2 font-heading text-[19px] font-normal tracking-[-0.005em] text-foreground">
          Prospects
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/[0.07] px-2 py-0.5 font-sans text-[10.5px] font-medium tracking-[0.14em] text-primary/80 uppercase">
            <Lock className="size-2.5" strokeWidth={2.25} /> Admin
          </span>
        </h2>
        <Link href="/prospects" className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline">
          Open <ArrowRight className="size-3.5" strokeWidth={1.75} />
        </Link>
      </div>
      <div className="mt-4 grid gap-4 rounded-2xl border border-black/[0.06] bg-card p-5 shadow-[0_1px_2px_rgba(20,40,35,0.04)] md:grid-cols-12 md:p-6">
        <div className="md:col-span-5">
          <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">Live deals</p>
          <p className="mt-3 text-[34px] leading-none font-medium tracking-[-0.02em] tabular-nums">{live}</p>
          <p className="mt-2 text-[12.5px] text-muted-foreground">
            {summary.total} tracked · {summary.byStatus.watching} watching · {summary.byStatus.lost} lost
          </p>
          <ul className="mt-5 grid grid-cols-5 gap-2">
            {SHOWN.map(([s, label]) => (
              <li key={s} className="rounded-xl bg-background px-2 py-2.5 text-center">
                <p className="text-[18px] leading-none font-medium tabular-nums">{summary.byStatus[s]}</p>
                <p className="mt-1.5 flex items-center justify-center gap-1 text-[10.5px] leading-tight text-muted-foreground">
                  <StatusDot status={s} />
                  <span className="truncate">{label}</span>
                </p>
              </li>
            ))}
          </ul>
        </div>
        <div className="border-t border-black/[0.05] pt-4 md:col-span-7 md:border-t-0 md:border-l md:pt-0 md:pl-6">
          <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">Newest signals</p>
          {summary.recentSignals.length ? (
            <ul className="mt-3 divide-y divide-black/[0.05]">
              {summary.recentSignals.map((s) => (
                <li key={s.id} className="py-2.5 first:pt-0">
                  <Link href={`/prospects/${s.prospectId}`} className="group block">
                    <p className="flex items-center gap-2 text-[12px] text-muted-foreground">
                      <SignalTypeTag type={s.type} /> {formatDay(s.date)}
                    </p>
                    <p className="mt-1 truncate text-[14px] text-foreground group-hover:text-primary">
                      <span className="font-medium">{s.prospectName}</span>
                      <span className="text-muted-foreground"> · {s.summary}</span>
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-3 flex items-start gap-3 rounded-xl bg-background px-4 py-3.5">
              <Radar className="mt-0.5 size-4 shrink-0 text-primary/70" strokeWidth={1.6} />
              <p className="text-[13px] leading-5 text-muted-foreground">
                No signals yet. News, spa job ads and new GM appointments will show here as reasons to reach out.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
