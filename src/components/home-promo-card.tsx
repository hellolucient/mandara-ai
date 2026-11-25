import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PromoCategoryLegend } from "@/components/promo-category-legend";
import { PromoCategoryStackedBar } from "@/components/promo-category-cell";
import type { HomePromoCardData } from "@/lib/promo-analytics";
import { formatBusinessDate } from "@/lib/dates";

export function HomePromoCard({ data }: { data: HomePromoCardData }) {
  const alerts: string[] = [];
  if (data.offListCodes.length > 0) {
    alerts.push(`New off-list codes: ${data.offListCodes.join(", ")}`);
  }
  if (data.shareJumpSpas.length > 0) {
    alerts.push(`Promo share jump: ${data.shareJumpSpas.join(", ")}`);
  }

  return (
    <section className="mt-10 md:mt-12">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-heading text-[19px] font-normal tracking-[-0.005em] text-foreground">Promotions</h2>
        <Link href="/promotions" className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline">
          See all <ArrowRight className="size-3.5" strokeWidth={1.75} />
        </Link>
      </div>
      <article className="mt-4 rounded-2xl border border-black/[0.06] bg-card p-5 shadow-[0_1px_2px_rgba(20,40,35,0.04)] md:p-6">
        <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
          Treatment promos · {data.date ? formatBusinessDate(data.date) : "—"}
        </p>
        <div className="mt-3">
          <PromoCategoryLegend compact />
        </div>
        {data.spaBars.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No spa-level promo lines for this day.</p>
        ) : (
          <ul className="mt-4 space-y-2.5">
            {data.spaBars.map((row) => (
              <li key={row.spa} className="grid grid-cols-[minmax(0,6.5rem)_1fr] items-center gap-3">
                <span className="truncate text-[13px] font-medium">{row.spa}</span>
                <PromoCategoryStackedBar slices={row.slices} totalUsd={row.totalUsd} />
              </li>
            ))}
          </ul>
        )}
        {alerts.length > 0 ? (
          <p className="mt-4 rounded-lg border border-amber-200/80 bg-amber-50 px-3 py-2 text-[12.5px] leading-snug text-amber-950">
            {alerts.join(" · ")}
          </p>
        ) : (
          <p className="mt-4 text-[12.5px] text-muted-foreground">No off-list codes or share-jump flags on this day.</p>
        )}
      </article>
    </section>
  );
}