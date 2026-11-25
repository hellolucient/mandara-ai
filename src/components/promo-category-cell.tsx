import type { CategoryUsdSlice } from "@/lib/promo-categories";
import { promoCategoryColor, promoCategoryLabel } from "@/lib/promo-categories";
import { PromoCategorySwatch } from "@/components/promo-category-swatch";
import { StackedBarSegments, type BarSegment } from "@/components/charts/stacked-bar-segments";
import { money } from "@/lib/dates";
import {
  formatPromoSegmentCaption,
  planPromoBarSegmentLabels,
  PROMO_IN_BAR_LABEL_MIN_PCT,
} from "@/lib/promo-bar-labels";

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

function PromoBarBreakdown({
  items,
  currency,
  className,
}: {
  items: Array<{ id: string; label: string; color: string; usd: number; sharePct: number }>;
  currency: string;
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <ul className={`mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5 ${className ?? ""}`}>
      {items.map((item) => (
        <li key={item.id} className="inline-flex items-center gap-1 text-[10px] leading-snug text-muted-foreground md:text-[11px]">
          <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} aria-hidden />
          <span className="max-w-[8rem] truncate">{item.label}</span>
          <span className="shrink-0 font-medium text-foreground tabular-nums">
            {formatPromoSegmentCaption(item.usd, item.sharePct, currency)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function PromoCategoryStackedBar({
  slices,
  totalUsd,
  widthClass = "w-full",
  currency = "USD",
  showTotal = true,
}: {
  slices: CategoryUsdSlice[];
  totalUsd: number;
  widthClass?: string;
  currency?: string;
  showTotal?: boolean;
}) {
  const barTotal = totalUsd > 0 ? totalUsd : slices.reduce((s, x) => s + x.usd, 0);
  if (barTotal <= 0) return null;

  const discountSlices = slices.filter((s) => s.segment === "discount" && s.usd > 0);
  const fullSlices = slices.filter((s) => s.segment === "full_price" && s.usd > 0);
  const discountTotal = discountSlices.reduce((s, x) => s + x.usd, 0);
  const fullTotal = fullSlices.reduce((s, x) => s + x.usd, 0);

  const labelSegments = slices
    .filter((s) => s.usd > 0)
    .map((s) => ({
      id: s.id,
      label: s.label,
      color: s.color,
      usd: s.usd,
    }));

  const desktopPlan = planPromoBarSegmentLabels(labelSegments, barTotal);
  const mobilePlan = planPromoBarSegmentLabels(labelSegments, barTotal, { forceBreakdown: true });

  const formatInBar = (seg: BarSegment, sharePct: number) =>
    formatPromoSegmentCaption(seg.value, sharePct, currency);

  const showDesktopBreakdown = desktopPlan.some((p) => !p.showInBar);

  const fullSharePct = barTotal > 0 ? (fullTotal / barTotal) * 100 : 0;
  const showFullInBar = fullTotal > 0 && fullSharePct >= PROMO_IN_BAR_LABEL_MIN_PCT;

  return (
    <div className={`min-w-0 ${widthClass}`}>
      <div className="flex items-stretch gap-2 md:gap-3">
        <div className="flex min-w-0 flex-1 items-stretch gap-1 md:gap-1.5" role="img" aria-label="Promo revenue by category">
          {discountTotal > 0 ? (
            <div className="flex min-w-0 flex-1">
              <StackedBarSegments
                segments={toSegments(discountSlices, barTotal)}
                total={barTotal}
                widthClass="w-full"
                inBarLabelMinPct={PROMO_IN_BAR_LABEL_MIN_PCT}
                formatInBarLabel={formatInBar}
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
              title={formatPromoSegmentCaption(fullTotal, fullSharePct, currency)}
            >
              <div className="h-full w-full" style={{ backgroundColor: fullSlices[0]?.color }} />
              {showFullInBar ? (
                <span className="pointer-events-none absolute inset-0 hidden items-center justify-center px-0.5 text-[9px] font-semibold text-white tabular-nums drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)] md:flex md:text-[10px]">
                  {formatPromoSegmentCaption(fullTotal, fullSharePct, currency)}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        {showTotal ? (
          <dl className="shrink-0 text-right leading-tight">
            <dt className="text-[9px] font-medium tracking-[0.12em] text-muted-foreground uppercase md:text-[10px]">Total</dt>
            <dd className="text-[12px] font-semibold tabular-nums text-foreground md:text-[13px]">{money(barTotal, currency)}</dd>
          </dl>
        ) : null}
      </div>
      <PromoBarBreakdown
        items={mobilePlan}
        currency={currency}
        className="md:hidden"
      />
      {showDesktopBreakdown ? (
        <PromoBarBreakdown items={desktopPlan} currency={currency} className="hidden md:flex" />
      ) : null}
    </div>
  );
}