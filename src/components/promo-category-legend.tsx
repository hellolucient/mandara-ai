import { promoCategoriesForLegend } from "@/lib/promo-categories";
import { PromoCategorySwatch } from "@/components/promo-category-swatch";

export function PromoCategoryLegend({ compact }: { compact?: boolean }) {
  const { discount, fullPrice } = promoCategoriesForLegend();
  const text = compact ? "text-[10px] md:text-xs" : "text-xs md:text-sm";
  const swatch = compact ? "size-2 md:size-3.5" : "size-2.5 md:size-3.5";

  return (
    <div className={`space-y-2 text-muted-foreground md:space-y-2.5 ${text}`}>
      <ul className="flex flex-wrap gap-x-3 gap-y-1.5 md:gap-x-4 md:gap-y-2">
        {discount.map((cat) => (
          <li key={cat.id} className="flex items-center gap-1.5 md:gap-2">
            <PromoCategorySwatch color={cat.color} className={swatch} />
            <span>{cat.label}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2 border-t border-black/[0.08] pt-2 md:pt-2.5 dark:border-white/12">
        <PromoCategorySwatch color={fullPrice.color} className={swatch} />
        <span className="font-medium text-foreground">{fullPrice.label}</span>
        <span className="text-muted-foreground">(not included in discount / low-rate totals)</span>
      </div>
    </div>
  );
}