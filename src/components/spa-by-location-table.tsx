"use client";

import { Fragment, useState } from "react";
import type { SpaSummary } from "@/lib/home-kpis";
import type { SpaComparisonSnapshot } from "@/lib/spa-comparison";
import { groupSpasByBrand, spaDisplayName } from "@/lib/spa-groups";
import { Sparkline } from "@/components/sparkline";
import { SpaDrilldownPanel } from "@/components/spa-drilldown-panel";
import { addDays, latestDayColumnLabels } from "@/lib/dates";
import { TyLyVarianceCells } from "@/components/spa-comparison-cells";
import { HorizontalScrollInset } from "@/components/horizontal-scroll-inset";

/** Sticky first column: spa names stay visible while scrolling metric bands on small screens. */
const STICKY_SPA =
  "sticky left-0 z-10 bg-card shadow-[4px_0_12px_-6px_rgba(20,40,35,0.14)] dark:shadow-[4px_0_12px_-6px_rgba(0,0,0,0.45)]";
const STICKY_SPA_HEAD =
  "sticky left-0 z-20 bg-card shadow-[4px_0_12px_-6px_rgba(20,40,35,0.14)] dark:shadow-[4px_0_12px_-6px_rgba(0,0,0,0.45)]";

/**
 * Paper-tone column bands from the app stone palette (`--background` oklch(0.965 0.012 92), `--card` 0.985).
 * A 50% page-over-card mix read as ~L 0.975 and almost vanished on the card; use the full page
 * background for MTD and a slightly deeper greige for YTD so the bands stay soft but distinct.
 */
const BAND_MTD_FILL =
  "bg-[var(--background)] dark:bg-[color-mix(in_oklch,var(--background)_80%,var(--card))]";
const BAND_YTD_FILL =
  "bg-[oklch(0.945_0.016_85)] dark:bg-[oklch(0.165_0.014_85)]";

const BAND = {
  card: "bg-card",
  mtd: BAND_MTD_FILL,
  ytd: BAND_YTD_FILL,
} as const;

const DIVIDER = "border-l border-black/[0.09] dark:border-white/10";

/** Alternating column-band tints and dividers between metric groups. */
const COL = {
  spa: "bg-card py-3 pr-3 pl-4 whitespace-nowrap sm:pl-5",
  dayStart: `${DIVIDER} ${BAND.card} px-3 py-3`,
  dayCell: `${BAND.card} px-3 py-3`,
  mtdStart: `${DIVIDER} ${BAND.mtd} px-3 py-3`,
  mtdCell: `${BAND.mtd} px-3 py-3`,
  ytdStart: `${DIVIDER} ${BAND.ytd} px-3 py-3`,
  ytdCell: `${BAND.ytd} px-3 py-3`,
  budgetStart: `${DIVIDER} ${BAND.card} px-3 py-3`,
  sparkStart: `${DIVIDER} ${BAND.card} py-3 pr-4 pl-3 sm:pr-5`,
} as const;

const SUBHEAD =
  "border-b border-black/[0.08] px-3 py-2 text-right text-[10px] font-semibold tracking-[0.08em] whitespace-nowrap text-muted-foreground uppercase dark:border-white/10";
const GROUPHEAD =
  "border-b border-black/[0.08] pb-2.5 pt-0.5 text-center text-[11px] font-bold tracking-[0.16em] text-foreground/90 uppercase dark:border-white/10";
const BRAND_ROW = "py-1.5 text-[10px] font-bold tracking-[0.16em] text-foreground/80 uppercase";

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

  return (
    <section className="mt-12 min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-heading text-[19px] font-normal tracking-[-0.005em] text-foreground">By spa</h2>
        <p className="hidden text-[12px] text-muted-foreground sm:block">
          {comparison
            ? `Revenue vs last year · as of ${comparison.asOfDate} · budget vs days reported`
            : "Budget compared with the days reported so far"}
        </p>
      </div>

      <HorizontalScrollInset className="mt-4" scrollId="by-spa">
        <table className="w-full min-w-[1040px] border-collapse text-[14px]">
            <thead>
              <tr>
                <th rowSpan={2} className={`${COL.spa} ${STICKY_SPA_HEAD} border-b border-black/[0.08] text-left text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase dark:border-white/10`}>
                  Spa
                </th>
                <th colSpan={2} className={`${COL.dayStart} ${GROUPHEAD}`}>
                  {latestDayGroup}
                </th>
                <th colSpan={3} className={`${COL.mtdStart} ${GROUPHEAD}`}>
                  Month to date
                </th>
                <th colSpan={3} className={`${COL.ytdStart} ${GROUPHEAD}`}>
                  Year to date
                </th>
                <th rowSpan={2} className={`${COL.budgetStart} border-b border-black/[0.08] text-left text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase dark:border-white/10`}>
                  vs budget
                </th>
                <th rowSpan={2} className={`${COL.sparkStart} border-b border-black/[0.08] text-right text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase dark:border-white/10`}>
                  14 days
                </th>
              </tr>
              <tr>
                <th className={`${COL.dayStart} ${SUBHEAD}`}>Treatment</th>
                <th className={`${COL.dayCell} ${SUBHEAD}`}>Retail</th>
                <th className={`${COL.mtdStart} ${SUBHEAD}`}>TY</th>
                <th className={`${COL.mtdCell} ${SUBHEAD}`}>LY</th>
                <th className={`${COL.mtdCell} ${SUBHEAD}`}>Var %</th>
                <th className={`${COL.ytdStart} ${SUBHEAD}`}>TY</th>
                <th className={`${COL.ytdCell} ${SUBHEAD}`}>LY</th>
                <th className={`${COL.ytdCell} ${SUBHEAD}`}>Var %</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((group) => (
                <Fragment key={group.groupId}>
                  <tr className="border-b border-black/[0.06] dark:border-white/[0.08]">
                    <td className={`${COL.spa} ${STICKY_SPA} ${BRAND_ROW}`}>{group.groupLabel}</td>
                    <td colSpan={2} className={`${COL.dayStart} ${BRAND_ROW}`} aria-hidden="true" />
                    <td colSpan={3} className={`${COL.mtdStart} ${BRAND_ROW}`} aria-hidden="true" />
                    <td colSpan={3} className={`${COL.ytdStart} ${BRAND_ROW}`} aria-hidden="true" />
                    <td className={`${COL.budgetStart} ${BRAND_ROW}`} aria-hidden="true" />
                    <td className={`${COL.sparkStart} ${BRAND_ROW}`} aria-hidden="true" />
                  </tr>
                  {group.items.map((spa) => {
                    const cmp = comparisonBySpa.get(spa.locationName);
                    return (
                      <tr
                        key={spa.locationId}
                        className="border-b border-black/[0.06] transition-[filter] last:border-0 hover:brightness-[0.985] dark:border-white/[0.07] dark:hover:brightness-110"
                      >
                        <td className={`${COL.spa} ${STICKY_SPA}`}>
                          <SpaNameButton name={spaDisplayName(spa.locationName)} onClick={() => setActive(spa)} />
                        </td>
                        <td className={`${COL.dayStart} text-right whitespace-nowrap text-muted-foreground tabular-nums`}>
                          {spa.latestTreatmentSales != null ? formatCurrencyExact(spa.latestTreatmentSales, currency) : <Missing />}
                        </td>
                        <td className={`${COL.dayCell} text-right whitespace-nowrap text-muted-foreground tabular-nums`}>
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
        <p className="border-t border-black/[0.06] px-4 py-2.5 text-[12px] text-muted-foreground sm:px-6 dark:border-white/10">
          TY from DSR and period imports; LY from stored Statistic range exports when present. Scroll sideways inside this card on small screens. Tap a spa for item detail.
        </p>
      </HorizontalScrollInset>

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