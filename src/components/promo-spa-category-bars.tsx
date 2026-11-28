import { Fragment } from "react";
import { PromoCategoryStackedBar } from "@/components/promo-category-cell";
import { PromoReconciliationLine } from "@/components/promo-reconciliation-line";
import type { SpaCategoryBarRow } from "@/lib/promo-analytics";
import { groupSpasByBrand, spaDisplayName } from "@/lib/spa-groups";

export function PromoSpaCategoryBars({ rows, title }: { rows: SpaCategoryBarRow[]; title?: string }) {
  if (rows.length === 0) return null;
  const grouped = groupSpasByBrand(rows, (r) => r.totalUsd, (r) => r.spa);

  return (
    <section className="mt-4 rounded-xl border bg-card p-4">
      {title ? <h3 className="mb-3 text-sm font-medium">{title}</h3> : null}
      <ul className="space-y-3">
        {grouped.map((group) => (
          <Fragment key={group.groupId}>
            <li className="pt-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">{group.groupLabel}</li>
            {group.items.map((row) => (
              <li key={row.spa}>
                <p className="mb-1 text-sm font-medium">{spaDisplayName(row.spa)}</p>
                <PromoCategoryStackedBar slices={row.slices} totalUsd={row.totalUsd} />
                <PromoReconciliationLine data={row.reconciliation} className="mt-1" />
              </li>
            ))}
          </Fragment>
        ))}
      </ul>
    </section>
  );
}