"use client";

import { Fragment, useState } from "react";
import type { SpaSummary } from "@/lib/home-kpis";
import type { SpaComparisonSnapshot } from "@/lib/spa-comparison";
import { groupSpasByBrand, spaDisplayName } from "@/lib/spa-groups";
import { Sparkline } from "@/components/sparkline";
import { SpaDrilldownPanel } from "@/components/spa-drilldown-panel";
import { addDays, latestDayColumnLabels } from "@/lib/dates";
import { TyLyVarianceCells } from "@/components/spa-comparison-cells";

/** Alternating column-band tints and dividers between metric groups (desktop table). */
const COL = {
  spa: "py-3 pr-3 pl-4 sm:pl-5",
  dayBand: "",
  dayStart: "border-l border-black/[0.07] px-3 py-3 dark:border-white/10",
  mtdBand: "bg-primary/[0.04] dark:bg-primary/[0.07]",
  mtdStart: "border-l border-black/[0.07] bg-primary/[0.04] px-3 py-3 dark:border-white/10 dark:bg-primary/[0.07]",
  mtdCell: "bg-primary/[0.04] px-3 py-3 dark:bg-primary/[0.07]",
  ytdBand: "bg-muted/35 dark:bg-muted/20",
  ytdStart: "border-l border-black/[0.07] bg-muted/35 px-3 py-3 dark:border-white/10 dark:bg-muted/20",
  ytdCell: "bg-muted/35 px-3 py-3 dark:bg-muted/20",
  budgetStart: "border-l border-black/[0.07] px-3 py-3 dark:border-white/10",
  sparkStart: "border-l border-black/[0.07] py-3 pr-4 pl-3 sm:pr-5 dark:border-white/10",
} as const;

const SUBHEAD =
  "border-b border-black/[0.06] px-3 py-2 text-right text-[10px] font-medium tracking-[0.08em] whitespace-nowrap text-muted-foreground uppercase dark:border-white/10";
const GROUPHEAD =
  "border-b border-black/[0.06] pb-2 text-center text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase dark:border-white/10";

type Props = {
  spas: SpaSummary[];
  currency: string;
  latestDate: string;
  today: string;
  comparison?: SpaComparisonSnapshot | null;
};

export function SpaByLocationTable({ spas, currency, latestDate, today, comparison }: Props) {
  const [active, setActive] = useState<SpaSummary | null>(null);
  const headings = latestDate ? latestDayColumnLabels(latestDate, today) : { treatment: "Treatment", retail: "Retail", day: "Latest day", summary: "Treatment and retail" };
  const latestDayGroup =
    latestDate && latestDate === addDays(today, -1) ? "Yesterday" : latestDate ? headings.day : "Latest day";
  const comparisonBySpa = new Map(comparison?.rows.map((r) => [r.location, r]) ?? []);
  const grouped = groupSpasByBrand(spas, (s) => s.mtdRevenue, (s) => s.locationName);
  const dataColCount = 10;

  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-heading text-[19px] font-normal tracking-[-0.005em] text-foreground">By spa</h2>
        <p className="hidden text-[12px] text-muted-foreground sm:block">
          {comparison
            ? `Revenue vs last year · as of ${comparison.asOfDate} · budget vs days reported`
            : "Budget compared with the days reported so far"}
        </p>
      </div>

      <div className="mt-4 -mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
        <div className="min-w-0 overflow-x-auto rounded-2xl border border-black/[0.06] bg-card shadow-[0_1px_2px_rgba(20,40,35,0.04)] dark:border-white/10">
          <table className="w-full min-w-[1040px] border-collapse text-[14px]">
            <thead>
              <tr>
                <th rowSpan={2} className={`${COL.spa} border-b border-black/[0.06] text-left text-[10px] font-medium tracking-[0.12em] text-muted-foreground uppercase dark:border-white/10`}>
                  Spa
                </th>
                <th colSpan={2} className={`${COL.dayStart} ${GROUPHEAD}`}>
                  {latestDayGroup}
                </th>
                <th colSpan={3} className={`${COL.mtdStart} ${GROUPHEAD} ${COL.mtdBand}`}>
                  Month to date
                </th>
                <th colSpan={3} className={`${COL.ytdStart} ${GROUPHEAD} ${COL.ytdBand}`}>
                  Year to date
                </th>
                <th rowSpan={2} className={`${COL.budgetStart} border-b border-black/[0.06] text-left text-[10px] font-medium tracking-[0.12em] text-muted-foreground uppercase dark:border-white/10`}>
                  vs budget
                </th>
                <th rowSpan={2} className={`${COL.sparkStart} border-b border-black/[0.06] text-right text-[10px] font-medium tracking-[0.12em] text-muted-foreground uppercase dark:border-white/10`}>
                  14 days
                </th>
              </tr>
              <tr>
                <th className={`${COL.dayStart} ${SUBHEAD}`}>Treatment</th>
                <th className={SUBHEAD}>Retail</th>
                <th className={`${COL.mtdStart} ${SUBHEAD} ${COL.mtdBand}`}>TY</th>
                <th className={`${COL.mtdCell} ${SUBHEAD} ${COL.mtdBand}`}>LY</th>
                <th className={`${COL.mtdCell} ${SUBHEAD} ${COL.mtdBand}`}>Var %</th>
                <th className={`${COL.ytdStart} ${SUBHEAD} ${COL.ytdBand}`}>TY</th>
                <th className={`${COL.ytdCell} ${SUBHEAD} ${COL.ytdBand}`}>LY</th>
                <th className={`${COL.ytdCell} ${SUBHEAD} ${COL.ytdBand}`}>Var %</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((group) => (
                <Fragment key={group.groupId}>
                  <tr className="bg-muted/40">
                    <td colSpan={1 + dataColCount} className="px-4 py-1.5 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase sm:px-5">
                      {group.groupLabel}
                    </td>
                  </tr>
                  {group.items.map((spa) => {
                    const cmp = comparisonBySpa.get(spa.locationName);
                    return (
                      <tr
                        key={spa.locationId}
                        className="border-b border-black/[0.045] transition-colors last:border-0 hover:bg-primary/[0.025] dark:border-white/[0.06]"
                      >
                        <td className={COL.spa}>
                          <SpaNameButton name={spaDisplayName(spa.locationName)} onClick={() => setActive(spa)} />
                        </td>
                        <td className={`${COL.dayStart} text-right whitespace-nowrap text-muted-foreground tabular-nums`}>
                          {spa.latestTreatmentSales != null ? formatCurrencyExact(spa.latestTreatmentSales, currency) : <Missing />}
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap text-muted-foreground tabular-nums">
                          {spa.latestRetailSales != null ? formatCurrencyExact(spa.latestRetailSales, currency) : <Missing />}
                        </td>
                        {cmp ? (
                          <>
                            <TyLyVarianceCells
                              period={cmp.mtd}
                              currency={currency}
                              tyClassName={`${COL.mtdStart} text-right tabular-nums whitespace-nowrap`}
                              lyClassName={`${COL.mtdCell} text-right tabular-nums whitespace-nowrap`}
                              varClassName={`${COL.mtdCell} text-right tabular-nums whitespace-nowrap`}
                            />
                            <TyLyVarianceCells
                              period={cmp.ytd}
                              currency={currency}
                              tyClassName={`${COL.ytdStart} text-right tabular-nums whitespace-nowrap`}
                              lyClassName={`${COL.ytdCell} text-right tabular-nums whitespace-nowrap`}
                              varClassName={`${COL.ytdCell} text-right tabular-nums whitespace-nowrap`}
                            />
                          </>
                        ) : (
                          <td colSpan={6} className={`${COL.mtdStart} px-3 py-3 text-center text-[12px] text-muted-foreground`}>
                            —
                          </td>
                        )}
                        <td className={`${COL.budgetStart} py-3`}>
                          <BudgetBar percent={spa.budgetPercent} />
                        </td>
                        <td className={`${COL.sparkStart} text-right`}>
                          <Sparkline data={spa.sparklineData} id={spa.locationId} width={128} />
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-2.5 text-[12px] text-muted-foreground sm:px-6">
            TY from DSR and period imports; LY from stored Statistic range exports when present. Scroll sideways on small screens. Tap a spa for item detail.
          </p>
        </div>
      </div>

      <SpaDrilldownPanel
        spa={active}
        open={active != null}
        onClose={() => setActive(null)}
        currency={currency}
        defaultDate={latestDate || today}
        today={today}
      />
    </section>
  );
}

function SpaNameButton({ name, onClick, className }: { name: string; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-spa-drilldown={name}
      aria-haspopup="dialog"
      className={`cursor-pointer whitespace-nowrap font-medium text-foreground underline-offset-[3px] transition-colors hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${className ?? ""}`}
    >
      {name}
    </button>
  );
}

function BudgetBar({ percent }: { percent: number | null }) {
  if (percent === null) return <span className="text-[12px] text-muted-foreground/80">No budget</span>;
  const tone =
    percent >= 100
      ? { bar: "bg-primary", text: "text-primary" }
      : percent >= 90
        ? { bar: "bg-[#b08a5a]", text: "text-[#8a6a40] dark:text-[#d9b98a]" }
        : { bar: "bg-[#c2703d]", text: "text-[#a65a2b] dark:text-[#e5a27a]" };
  const width = Math.min(percent, 150) / 1.5;
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative h-1 w-24 rounded-full bg-black/[0.07] dark:bg-white/10">
        <div className={`absolute inset-y-0 left-0 rounded-full ${tone.bar}`} style={{ width: `${width}%` }} />
        <div aria-hidden="true" className="absolute -top-1 -bottom-1 left-[66.6%] w-px bg-foreground/25" />
      </div>
      <span className={`w-10 text-[12.5px] font-medium tabular-nums ${tone.text}`}>{percent.toFixed(0)}%</span>
    </div>
  );
}

function Missing() {
  return <span className="text-muted-foreground/60">—</span>;
}

function formatCurrencyExact(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}
