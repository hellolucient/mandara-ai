import { PROMO_CATEGORIES } from "@/lib/promo-categories";

export function PromoCategoryLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
      {PROMO_CATEGORIES.map((cat) => (
        <li key={cat.id} className="flex items-center gap-1.5">
          <span className={`inline-block size-2.5 shrink-0 rounded-sm ${cat.barClass}`} aria-hidden />
          <span>{cat.label}</span>
        </li>
      ))}
    </ul>
  );
}