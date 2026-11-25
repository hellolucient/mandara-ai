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
            <div
              className="flex h-2.5 w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10"
              role="img"
              aria-label={`${row.spa} promo revenue by category`}
            >
              {row.slices.map((slice) => (
                <div
                  key={slice.id}
                  className={`h-full ${slice.barClass}`}
                  style={{ width: row.totalUsd > 0 ? `${(slice.usd / row.totalUsd) * 100}%` : "0%" }}
                  title={`${slice.label}: ${money(slice.usd, "USD")} (${slice.sharePct}% of spa promo)`}
                />
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}