import { promoCategoriesForLegend } from "@/lib/promo-categories";
import { PromoCategorySwatch } from "@/components/promo-category-swatch";

export function PromoCategoryLegend({ compact }: { compact?: boolean }) {
  const { discount, fullPrice } = promoCategoriesForLegend();
  const text = compact ? "text-[10px]" : "text-xs";
  const swatch = compact ? "size-2" : "size-2.5";

  return (
    <div className={`space-y-2 text-muted-foreground ${text}`}>
      <ul className="flex flex-wrap gap-x-3 gap-y-1.5">
        {discount.map((cat) => (
          <li key={cat.id} className="flex items-center gap-1.5">
            <PromoCategorySwatch color={cat.color} className={swatch} />
            <span>{cat.label}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2 border-t border-black/[0.08] pt-2 dark:border-white/12">
        <PromoCategorySwatch color={fullPrice.color} className={swatch} />
        <span className="font-medium text-foreground">{fullPrice.label}</span>
        <span className="text-muted-foreground">(not included in discount / low-rate totals)</span>
      </div>
    </div>
  );
}