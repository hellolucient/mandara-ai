import { promoCategoriesForLegend } from "@/lib/promo-categories";
import { PromoCategorySwatch } from "@/components/promo-category-swatch";

export function PromoCategoryLegend({ compact }: { compact?: boolean }) {
  const { discount } = promoCategoriesForLegend();
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
    </div>
  );
}