"use client";

import { useState } from "react";
import type { SpaSummary } from "@/lib/home-kpis";
import { Sparkline } from "@/components/sparkline";
import { SpaDrilldownPanel } from "@/components/spa-drilldown-panel";
import { latestDayColumnLabels } from "@/lib/dates";

type Props = {
  spas: SpaSummary[];
  currency: string;
  latestDate: string;
  today: string;
};

export function SpaByLocationTable({ spas, currency, latestDate, today }: Props) {
  const [active, setActive] = useState<SpaSummary | null>(null);
  const headings = latestDate ? latestDayColumnLabels(latestDate, today) : { treatment: "Treatment", retail: "Retail", day: "Latest day", summary: "Treatment and retail" };

  return (
    <section className="mt-12">
      <div className="flex items-baseline justify-between">
        <h2 className="font-heading text-[19px] font-normal tracking-[-0.005em] text-foreground">By spa</h2>
        <p className="hidden text-[12px] text-muted-foreground sm:block">Budget compared with the days reported so far</p>
      </div>

      <div className="mt-4 hidden overflow-hidden rounded-2xl border border-black/[0.06] bg-card shadow-[0_1px_2px_rgba(20,40,35,0.04)] md:block dark:border-white/10">
        <table className="w-full border-collapse text-[14px]">
          <thead>
            <tr className="border-b border-black/[0.06] text-left text-[11px] tracking-[0.14em] text-muted-foreground uppercase dark:border-white/10">
              <th className="w-[22%] py-3 pr-3 pl-5 font-medium">Spa</th>
              <th className="w-[14%] px-2 py-3 text-right font-medium">{headings.treatment}</th>
              <th className="w-[14%] px-2 py-3 text-right font-medium">{headings.retail}</th>
              <th className="w-[14%] px-2 py-3 text-right font-medium">Month to date</th>
              <th className="w-[16%] px-2 py-3 font-medium">vs budget</th>
              <th className="w-[20%] py-3 pr-5 pl-2 text-right font-medium">14 days</th>
            </tr>
          </thead>
          <tbody>
            {spas.map((spa) => (
              <tr
                key={spa.locationId}
                className="border-b border-black/[0.045] transition-colors last:border-0 hover:bg-primary/[0.025] dark:border-white/[0.06]"
              >
                <td className="py-3 pr-3 pl-5">
                  <SpaNameButton name={spa.locationName} onClick={() => setActive(spa)} />
                </td>
                <td className="px-2 py-3 text-right whitespace-nowrap text-muted-foreground tabular-nums">
                  {spa.latestTreatmentSales != null ? formatCurrencyExact(spa.latestTreatmentSales, currency) : <Missing />}
                </td>
                <td className="px-2 py-3 text-right whitespace-nowrap text-muted-foreground tabular-nums">
                  {spa.latestRetailSales != null ? formatCurrencyExact(spa.latestRetailSales, currency) : <Missing />}
                </td>
                <td className="px-2 py-3 text-right font-medium whitespace-nowrap text-foreground tabular-nums">
                  {formatCurrencyExact(spa.mtdRevenue, currency)}
                </td>
                <td className="px-2 py-3">
                  <BudgetBar percent={spa.budgetPercent} />
                </td>
                <td className="py-3 pr-5 pl-2 text-right">
                  <Sparkline data={spa.sparklineData} id={spa.locationId} width={128} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-6 py-2.5 text-[12px] text-muted-foreground">Month to date is treatment + retail. Click a spa for item detail.</p>
      </div>

      <p className="mt-3 text-[12px] leading-5 text-muted-foreground md:hidden">{headings.summary}</p>
      <ul className="mt-2 divide-y divide-black/[0.05] overflow-hidden rounded-2xl border border-black/[0.06] bg-card shadow-[0_1px_2px_rgba(20,40,35,0.04)] md:hidden dark:divide-white/[0.06] dark:border-white/10">
        {spas.map((spa) => (
          <li key={spa.locationId} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <SpaNameButton name={spa.locationName} onClick={() => setActive(spa)} className="min-w-0 truncate pt-0.5 text-left text-[14.5px]" />
              <div className="shrink-0 text-right">
                <p className="text-[15px] leading-5 font-medium text-foreground tabular-nums">{formatCurrencyExact(spa.mtdRevenue, currency)}</p>
                <p className="mt-0.5 text-[10px] leading-3 tracking-wide text-muted-foreground uppercase">Month to date</p>
              </div>
            </div>
            <div className="mt-2.5 grid grid-cols-3 gap-2">
              <Stat label="Treatment" value={spa.latestTreatmentSales != null ? formatCurrencyExact(spa.latestTreatmentSales, currency) : "—"} />
              <Stat label="Retail" value={spa.latestRetailSales != null ? formatCurrencyExact(spa.latestRetailSales, currency) : "—"} />
              <Stat label="vs budget" value={spa.budgetPercent == null ? "No budget" : `${spa.budgetPercent.toFixed(0)}%`} />
            </div>
            <MobileSparkline spa={spa} />
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[12px] text-muted-foreground md:hidden">Tap a spa for item detail.</p>

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
      className={`cursor-pointer font-medium text-foreground underline-offset-[3px] transition-colors hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${className ?? ""}`}
    >
      {name}
    </button>
  );
}

function MobileSparkline({ spa }: { spa: SpaSummary }) {
  return (
    <div className="mt-2.5 w-full">
      <Sparkline data={spa.sparklineData} id={`m-${spa.locationId}`} width={320} height={28} className="text-primary w-full" />
    </div>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 text-left">
      <p className="text-[10px] leading-3 tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-0.5 text-[13px] leading-5 tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function Missing() {
  return <span className="text-muted-foreground/60">—</span>;
}

function formatCurrencyExact(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}