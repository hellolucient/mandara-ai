import { PromoCategoryStackedBar } from "@/components/promo-category-cell";
import type { SpaCategoryBarRow } from "@/lib/promo-analytics";
export function PromoSpaCategoryBars({ rows, title }: { rows: SpaCategoryBarRow[]; title?: string }) {
  if (rows.length === 0) return null;

  return (
    <section className="mt-4 rounded-xl border bg-card p-4">
      {title ? <h3 className="mb-3 text-sm font-medium">{title}</h3> : null}
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.spa}>
            <p className="mb-1 text-sm font-medium">{row.spa}</p>
            <PromoCategoryStackedBar slices={row.slices} totalUsd={row.totalUsd} />
          </li>
        ))}
      </ul>
    </section>
  );
}