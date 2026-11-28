import type { PromoReconciliation } from "@/lib/promo-analytics";
import { money } from "@/lib/dates";

/**
 * Shows how a spa's revenue splits, so the Promotions bar can be checked against revenue:
 * revenue = promotions + full price + retail + other treatments.
 */
export function PromoReconciliationLine({ data, className }: { data: PromoReconciliation | null | undefined; className?: string }) {
  if (!data) return null;
  const d = (n: number) => money(n, "USD");
  return (
    <p className={`text-[10px] leading-snug text-muted-foreground tabular-nums md:text-[11px] ${className ?? ""}`}>
      <span className="font-medium text-foreground">Revenue {d(data.revenueUsd)}</span> = promotions {d(data.promoUsd)} + full price{" "}
      {d(data.fullPriceUsd)} + retail {d(data.retailUsd)} + other treatments {d(data.otherTreatmentUsd)}
    </p>
  );
}
