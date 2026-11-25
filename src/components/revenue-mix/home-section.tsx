"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import type { RevenueMixHomeSnapshot, RevenueMixPeriod } from "@/lib/revenue-mix-view";
import { buildRevenueMixPeriod } from "@/lib/revenue-mix-view";
import type { StoredItemLine } from "@/lib/sales-item-types";
import { spaDisplayName } from "@/lib/spa-groups";
import { RevenueMixCategoryBar } from "@/components/revenue-mix/revenue-mix-bars";

type Props = {
  snapshot: RevenueMixHomeSnapshot;
  linesJson: string;
};

function periodFromLines(lines: StoredItemLine[]): RevenueMixPeriod {
  return buildRevenueMixPeriod(lines);
}

export function RevenueMixHomeSection({ snapshot, linesJson }: Props) {
  const allLines = useMemo(() => JSON.parse(linesJson) as StoredItemLine[], [linesJson]);
  const [spaId, setSpaId] = useState("");

  const filtered = useMemo(() => {
    const scoped = spaId ? allLines.filter((l) => l.locationId === spaId) : allLines;
    const yesterdayLines = scoped.filter((l) => l.businessDate === snapshot.latestDate);
    const mtdLines = scoped.filter((l) => l.businessDate >= snapshot.monthStart && l.businessDate <= snapshot.latestDate);
    return {
      yesterday: periodFromLines(yesterdayLines),
      mtd: periodFromLines(mtdLines),
    };
  }, [allLines, spaId, snapshot.latestDate, snapshot.monthStart]);

  const unmapped = [
    ...new Set([
      ...filtered.yesterday.unmappedTreatmentNames,
      ...filtered.mtd.unmappedTreatmentNames,
      ...filtered.yesterday.unmappedRetailNames,
      ...filtered.mtd.unmappedRetailNames,
    ]),
  ];

  return (
    <section className="mt-10 rounded-2xl border border-black/[0.06] bg-card p-5 shadow-[0_1px_2px_rgba(20,40,35,0.04)] md:p-6 dark:border-white/10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-[19px] font-normal tracking-[-0.005em] text-foreground">Revenue mix</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Treatment menu sections and retail brands — latest DSR day and month to date.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="revenue-mix-spa">
            Spa filter
          </label>
          <select
            id="revenue-mix-spa"
            value={spaId}
            onChange={(e) => setSpaId(e.target.value)}
            className="rounded-full border border-black/[0.08] bg-background px-3 py-1.5 text-[12.5px] dark:border-white/15"
          >
            <option value="">All spas</option>
            {snapshot.spas.map((s) => (
              <option key={s.id} value={s.id}>
                {spaDisplayName(s.name)}
              </option>
            ))}
          </select>
          <Link
            href="/revenue-mix"
            className="inline-flex items-center gap-1 rounded-full border border-primary/15 px-3 py-1.5 text-[12.5px] font-medium text-primary hover:bg-primary/[0.05]"
          >
            Full view <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>

      <div className="mt-5 grid gap-6 md:grid-cols-2">
        <PeriodBlock title={`Latest day (${shortDate(snapshot.latestDate)})`} currency={snapshot.currency} period={filtered.yesterday} />
        <PeriodBlock title="Month to date" currency={snapshot.currency} period={filtered.mtd} />
      </div>

      {unmapped.length > 0 ? (
        <p className="mt-4 text-[11.5px] leading-5 text-muted-foreground">
          <span className="font-medium text-foreground">Unmapped items</span> in this view need a rule in{" "}
          <code className="rounded bg-muted px-1 text-[10px]">src/lib/item-groups.ts</code>: {unmapped.join("; ")}
        </p>
      ) : null}
    </section>
  );
}

function PeriodBlock({ title, currency, period }: { title: string; currency: string; period: RevenueMixPeriod }) {
  return (
    <div>
      <h3 className="mb-3 text-[12px] font-medium tracking-[0.12em] text-muted-foreground uppercase">{title}</h3>
      <div className="space-y-4">
        <RevenueMixCategoryBar
          label="Treatments"
          total={period.treatmentTotal}
          slices={period.treatmentSlices}
          currency={currency}
          compact
        />
        <RevenueMixCategoryBar label="Retail" total={period.retailTotal} slices={period.retailSlices} currency={currency} compact />
      </div>
    </div>
  );
}

function shortDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}