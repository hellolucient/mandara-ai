import { PROMO_CATEGORIES } from "@/lib/promo-categories";
import { PromoCategorySwatch } from "@/components/promo-category-swatch";

export function PromoCategoryLegend({ compact }: { compact?: boolean }) {
  return (
    <ul className={`flex flex-wrap gap-x-3 gap-y-1.5 text-muted-foreground ${compact ? "text-[10px]" : "text-xs"}`}>
      {PROMO_CATEGORIES.map((cat) => (
        <li key={cat.id} className="flex items-center gap-1.5">
          <PromoCategorySwatch color={cat.color} className={compact ? "size-2" : "size-2.5"} />
          <span>{cat.label}</span>
        </li>
      ))}
    </ul>
  );
}