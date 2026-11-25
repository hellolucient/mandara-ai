import type { CategoryUsdSlice } from "@/lib/promo-categories";
import { promoCategoryColor, promoCategoryLabel } from "@/lib/promo-categories";
import { PromoCategorySwatch } from "@/components/promo-category-swatch";

export function PromoCategoryCell({ promoCode }: { promoCode: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <PromoCategorySwatch color={promoCategoryColor(promoCode)} className="size-2" />
      <span className="text-xs">{promoCategoryLabel(promoCode)}</span>
    </span>
  );
}

export function PromoCategoryStackedBar({
  slices,
  totalUsd,
  heightClass = "h-2",
  widthClass = "w-full",
}: {
  slices: CategoryUsdSlice[];
  totalUsd: number;
  heightClass?: string;
  widthClass?: string;
}) {
  const barTotal = totalUsd > 0 ? totalUsd : slices.reduce((s, x) => s + x.usd, 0);
  if (barTotal <= 0) return null;

  const discountSlices = slices.filter((s) => s.segment === "discount" && s.usd > 0);
  const fullSlices = slices.filter((s) => s.segment === "full_price" && s.usd > 0);
  const discountTotal = discountSlices.reduce((s, x) => s + x.usd, 0);
  const fullTotal = fullSlices.reduce((s, x) => s + x.usd, 0);

  return (
    <div
      className={`flex items-stretch gap-1 ${heightClass} ${widthClass}`}
      role="img"
      aria-label="Promo revenue by category"
    >
      {discountTotal > 0 ? (
        <div className="flex min-w-0 flex-1 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10">
          {discountSlices.map((slice) => (
            <div
              key={`${slice.id}-${slice.usd}`}
              style={{
                width: `${(slice.usd / barTotal) * 100}%`,
                backgroundColor: slice.color,
              }}
              className="h-full"
              title={`${slice.label}: $${slice.usd.toFixed(0)}`}
            />
          ))}
        </div>
      ) : null}
      {discountTotal > 0 && fullTotal > 0 ? (
        <div className="w-px shrink-0 self-stretch rounded-full bg-foreground/25" aria-hidden />
      ) : null}
      {fullTotal > 0 ? (
        <div
          className="h-full shrink-0 overflow-hidden rounded-full"
          style={{ width: `${(fullTotal / barTotal) * 100}%`, minWidth: "0.5rem" }}
          title={`Full Price: $${fullTotal.toFixed(0)}`}
        >
          <div className="h-full w-full" style={{ backgroundColor: fullSlices[0]?.color }} />
        </div>
      ) : null}
    </div>
  );
}