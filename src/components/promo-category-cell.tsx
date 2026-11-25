import type { CategoryUsdSlice } from "@/lib/promo-categories";
import { promoCategoryColor, promoCategoryLabel } from "@/lib/promo-categories";
import { PromoCategorySwatch } from "@/components/promo-category-swatch";
import { StackedBarSegments, type BarSegment } from "@/components/charts/stacked-bar-segments";

export function PromoCategoryCell({ promoCode }: { promoCode: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <PromoCategorySwatch color={promoCategoryColor(promoCode)} className="size-2 md:size-2.5" />
      <span className="text-xs md:text-[13px]">{promoCategoryLabel(promoCode)}</span>
    </span>
  );
}

function toSegments(slices: CategoryUsdSlice[], barTotal: number): BarSegment[] {
  return slices.map((s) => ({
    id: s.id,
    color: s.color,
    value: s.usd,
    label: s.label,
    sharePct: s.sharePct > 0 ? s.sharePct : barTotal > 0 ? (s.usd / barTotal) * 100 : 0,
  }));
}

export function PromoCategoryStackedBar({
  slices,
  totalUsd,
  widthClass = "w-full",
}: {
  slices: CategoryUsdSlice[];
  totalUsd: number;
  widthClass?: string;
}) {
  const barTotal = totalUsd > 0 ? totalUsd : slices.reduce((s, x) => s + x.usd, 0);
  if (barTotal <= 0) return null;

  const discountSlices = slices.filter((s) => s.segment === "discount" && s.usd > 0);
  const fullSlices = slices.filter((s) => s.segment === "full_price" && s.usd > 0);
  const discountTotal = discountSlices.reduce((s, x) => s + x.usd, 0);
  const fullTotal = fullSlices.reduce((s, x) => s + x.usd, 0);

  return (
    <div className={`flex items-stretch gap-1 md:gap-1.5 ${widthClass}`} role="img" aria-label="Promo revenue by category">
      {discountTotal > 0 ? (
        <div className="flex min-w-0 flex-1">
          <StackedBarSegments
            segments={toSegments(discountSlices, barTotal)}
            total={barTotal}
            widthClass="w-full"
            ariaLabel="Discounted promo categories"
          />
        </div>
      ) : null}
      {discountTotal > 0 && fullTotal > 0 ? (
        <div className="w-px shrink-0 self-stretch rounded-full bg-foreground/25 md:w-0.5" aria-hidden />
      ) : null}
      {fullTotal > 0 ? (
        <div
          className="relative h-2 shrink-0 overflow-hidden rounded-full md:h-[22px] md:min-w-[2.5rem] md:rounded-md"
          style={{ flexGrow: fullTotal, flexBasis: 0, maxWidth: `${(fullTotal / barTotal) * 100}%` }}
          title={`Full Price: $${fullTotal.toFixed(0)}`}
        >
          <div className="h-full w-full" style={{ backgroundColor: fullSlices[0]?.color }} />
          {(fullTotal / barTotal) * 100 >= 12 ? (
            <span className="pointer-events-none absolute inset-0 hidden items-center justify-center text-[10px] font-semibold text-white tabular-nums drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)] md:flex md:text-[11px]">
              {((fullTotal / barTotal) * 100).toFixed(0)}%
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}