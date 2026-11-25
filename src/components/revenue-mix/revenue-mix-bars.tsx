import type { MixSlice } from "@/lib/item-groups";

function money(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function StackedBar({ slices, total, heightClass }: { slices: MixSlice[]; total: number; heightClass: string }) {
  return (
    <div
      className={`flex w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10 ${heightClass}`}
      role="img"
      aria-label="Revenue mix by group"
    >
      {slices.map((slice) => (
        <div
          key={slice.id}
          style={{
            width: total > 0 ? `${(slice.netSales / total) * 100}%` : "0%",
            backgroundColor: slice.color,
          }}
          className="h-full min-w-0"
          title={`${slice.label}: ${money(slice.netSales, "USD")} (${slice.sharePct}%)`}
        />
      ))}
    </div>
  );
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
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
      <div className="flex items-baseline justify-between gap-2">
        <span className={`font-medium text-foreground ${compact ? "text-[12.5px]" : "text-sm"}`}>{label}</span>
        <span className={`text-muted-foreground tabular-nums ${compact ? "text-[12px]" : "text-sm"}`}>{money(total, currency)}</span>
      </div>
      <StackedBar slices={slices} total={total} heightClass={compact ? "h-2" : "h-2.5"} />
      <ul className={`${compact ? "mt-1.5 space-y-1" : "mt-2 space-y-1.5"}`}>
        {slices.map((slice) => (
          <li key={slice.id} className="flex items-center justify-between gap-2 text-[12px]">
            <span className="flex min-w-0 items-center gap-2">
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} aria-hidden />
              <span className="truncate text-foreground">{slice.label}</span>
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {money(slice.netSales, currency)}
              <span className="ml-1.5 text-[11px]">{slice.sharePct.toFixed(1)}%</span>
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
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
      {slices.map((s) => (
        <li key={s.id} className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
          {s.label}
        </li>
      ))}
    </ul>
  );
}