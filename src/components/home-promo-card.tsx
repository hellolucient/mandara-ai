"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { Fragment } from "react";
import { PromoCategoryLegend } from "@/components/promo-category-legend";
import { PromoCategoryStackedBar } from "@/components/promo-category-cell";
import type { HomePromoCardData, HomePromoCardSlice } from "@/lib/promo-analytics";
import { formatHomePromoHeading } from "@/lib/promo-analytics";
import { groupSpasByBrand, spaDisplayName } from "@/lib/spa-groups";

type Mode = "mtd" | "daily";

export function HomePromoCard({ data }: { data: HomePromoCardData }) {
  const [mode, setMode] = useState<Mode>("mtd");
  const active: HomePromoCardSlice = mode === "daily" && data.daily ? data.daily : data.mtd;
  const canToggleDaily = data.daily != null;

  const alerts: string[] = [];
  if (active.offListCodes.length > 0) {
    alerts.push(`New off-list codes: ${active.offListCodes.join(", ")}`);
  }
  if (active.shareJumpSpas.length > 0) {
    alerts.push(`Promo share jump: ${active.shareJumpSpas.join(", ")}`);
  }

  const emptyLabel =
    mode === "mtd" ? "No spa-level promo lines month to date." : "No spa-level promo lines for this day.";

  const alertFootnote =
    mode === "mtd"
      ? "No off-list codes in this month-to-date window."
      : "No off-list codes or share-jump flags on this day.";

  return (
    <section className="mt-10 md:mt-12">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-heading text-[19px] font-normal tracking-[-0.005em] text-foreground">Promotions</h2>
        <Link href="/promotions" className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline">
          See all <ArrowRight className="size-3.5" strokeWidth={1.75} />
        </Link>
      </div>
      <article className="mt-4 rounded-2xl border border-black/[0.06] bg-card p-5 shadow-[0_1px_2px_rgba(20,40,35,0.04)] md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
            {formatHomePromoHeading(mode === "daily" && data.daily ? "daily" : "mtd", active.periodFrom, active.periodTo)}
          </p>
          {canToggleDaily ? (
            <div
              className="inline-flex rounded-full border border-black/[0.08] bg-background p-0.5 text-[10px] font-medium dark:border-white/15"
              role="tablist"
              aria-label="Promo period"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === "mtd"}
                className={`rounded-full px-2.5 py-0.5 ${mode === "mtd" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                onClick={() => setMode("mtd")}
              >
                Month to date
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "daily"}
                className={`rounded-full px-2.5 py-0.5 ${mode === "daily" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                onClick={() => setMode("daily")}
              >
                Latest day
              </button>
            </div>
          ) : null}
        </div>
        <div className="mt-3">
          <PromoCategoryLegend compact />
        </div>
        {active.spaBars.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          <ul className="mt-4 space-y-2.5">
            {groupSpasByBrand(active.spaBars, (r) => r.totalUsd, (r) => r.spa).map((group) => (
              <Fragment key={group.groupId}>
                <li className="pt-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">{group.groupLabel}</li>
                {group.items.map((row) => (
                  <li key={row.spa} className="grid grid-cols-[minmax(0,5.5rem)_1fr] items-start gap-2 md:gap-3">
                    <span className="truncate pt-0.5 text-[13px] font-medium">{spaDisplayName(row.spa)}</span>
                    <PromoCategoryStackedBar slices={row.slices} totalUsd={row.totalUsd} />
                  </li>
                ))}
              </Fragment>
            ))}
          </ul>
        )}
        {alerts.length > 0 ? (
          <p className="mt-4 rounded-lg border border-amber-200/80 bg-amber-50 px-3 py-2 text-[12.5px] leading-snug text-amber-950">
            {alerts.join(" · ")}
          </p>
        ) : (
          <p className="mt-4 text-[12.5px] text-muted-foreground">{alertFootnote}</p>
        )}
      </article>
    </section>
  );
}