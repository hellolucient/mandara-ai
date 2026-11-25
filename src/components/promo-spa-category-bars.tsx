import { PromoCategoryStackedBar } from "@/components/promo-category-cell";
import type { SpaCategoryBarRow } from "@/lib/promo-analytics";
import { money } from "@/lib/dates";

export function PromoSpaCategoryBars({ rows, title }: { rows: SpaCategoryBarRow[]; title?: string }) {
  if (rows.length === 0) return null;

  return (
    <section className="mt-4 rounded-xl border bg-card p-4">
      {title ? <h3 className="mb-3 text-sm font-medium">{title}</h3> : null}
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.spa}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium">{row.spa}</span>
              <span className="text-muted-foreground">{money(row.totalUsd, "USD")}</span>
            </div>
            <PromoCategoryStackedBar slices={row.slices} totalUsd={row.totalUsd} />
          </li>
        ))}
      </ul>
    </section>
  );
}