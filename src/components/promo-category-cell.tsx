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
  slices: { color: string; usd: number; label: string }[];
  totalUsd: number;
  heightClass?: string;
  widthClass?: string;
}) {
  if (totalUsd <= 0) return null;
  return (
    <div
      className={`flex overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10 ${heightClass} ${widthClass}`}
      role="img"
      aria-hidden
    >
      {slices.map((slice) => (
        <div
          key={`${slice.label}-${slice.usd}`}
          style={{
            width: `${(slice.usd / totalUsd) * 100}%`,
            backgroundColor: slice.color,
          }}
          className="h-full"
          title={`${slice.label}: $${slice.usd.toFixed(0)}`}
        />
      ))}
    </div>
  );
}