import { promoCategoryDef, promoCategoryForCode } from "@/lib/promo-categories";

export function PromoCategoryCell({ promoCode }: { promoCode: string }) {
  const def = promoCategoryDef(promoCategoryForCode(promoCode));
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <span className={`inline-block size-2 shrink-0 rounded-sm ${def.barClass}`} aria-hidden />
      <span className="text-xs">{def.label}</span>
    </span>
  );
}