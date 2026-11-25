import { money } from "@/lib/dates";

/** Minimum bar share (0–100) before an in-segment $ (%) label is shown on desktop. */
export const PROMO_IN_BAR_LABEL_MIN_PCT = 18;

export function formatPromoSegmentCaption(usd: number, sharePct: number, currency = "USD"): string {
  return `${money(usd, currency)}  (${Math.round(sharePct)}%)`;
}

export type PromoBarSegmentLabel = {
  id: string;
  label: string;
  color: string;
  usd: number;
  sharePct: number;
  showInBar: boolean;
};

export function planPromoBarSegmentLabels(
  segments: Array<{ id: string; label: string; color: string; usd: number }>,
  barTotal: number,
  options?: { inBarMinPct?: number; forceBreakdown?: boolean },
): PromoBarSegmentLabel[] {
  const inBarMinPct = options?.inBarMinPct ?? PROMO_IN_BAR_LABEL_MIN_PCT;
  const forceBreakdown = options?.forceBreakdown ?? false;
  const total = barTotal > 0 ? barTotal : segments.reduce((s, x) => s + x.usd, 0);
  return segments
    .filter((s) => s.usd > 0)
    .map((seg) => {
      const sharePct = total > 0 ? (seg.usd / total) * 100 : 0;
      const showInBar = !forceBreakdown && sharePct >= inBarMinPct;
      return { ...seg, sharePct, showInBar };
    });
}