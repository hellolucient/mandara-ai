import type { MixSlice } from "@/lib/item-groups";
import { StackedBarSegments, type BarSegment } from "@/components/charts/stacked-bar-segments";

function money(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function mixToSegments(slices: MixSlice[]): BarSegment[] {
  return slices.map((slice) => ({
    id: slice.id,
    color: slice.color,
    value: slice.netSales,
    label: slice.label,
    sharePct: slice.sharePct,
  }));
}

export function RevenueMixCategoryBar({
  label,
  total,
  slices,
  currency,
  compact,
}: {
  label: string;
  total: number;
  slices: MixSlice[];
  currency: string;
  compact?: boolean;
}) {
  if (slices.length === 0) {
    return (
      <p className="text-[12px] text-muted-foreground">No {label.toLowerCase()} item lines for this period.</p>
    );
  }

  return (
    <div className={compact ? "space-y-1.5 md:space-y-2.5" : "space-y-2 md:space-y-3"}>
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={`font-medium text-foreground ${compact ? "text-[12.5px] md:text-sm" : "text-sm md:text-[15px]"}`}
        >
          {label}
        </span>
        <span className={`text-muted-foreground tabular-nums ${compact ? "text-[12px] md:text-sm" : "text-sm"}`}>
          {money(total, currency)}
        </span>
      </div>
      <StackedBarSegments
        segments={mixToSegments(slices)}
        total={total}
        ariaLabel={`${label} revenue mix`}
      />
      <ul className={`${compact ? "mt-1.5 space-y-1 md:mt-2 md:space-y-1.5" : "mt-2 space-y-1.5 md:mt-3"}`}>
        {slices.map((slice) => (
          <li
            key={slice.id}
            className="flex items-center justify-between gap-2 text-[12px] md:text-[13px]"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="size-2 shrink-0 rounded-full md:size-3"
                style={{ backgroundColor: slice.color }}
                aria-hidden
              />
              <span className="truncate text-foreground">{slice.label}</span>
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {money(slice.netSales, currency)}
              <span className="ml-1.5 text-[11px] md:text-xs">{slice.sharePct.toFixed(1)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RevenueMixLegend({ slices }: { slices: MixSlice[] }) {
  if (slices.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground md:gap-x-5 md:text-xs">
      {slices.map((s) => (
        <li key={s.id} className="flex items-center gap-1.5 md:gap-2">
          <span className="size-2 rounded-full md:size-3" style={{ backgroundColor: s.color }} />
          {s.label}
        </li>
      ))}
    </ul>
  );
}