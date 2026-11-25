export type BarSegment = {
  id: string;
  color: string;
  value: number;
  label: string;
  sharePct?: number;
};

/** Mobile: compact flush bar (~8px). Desktop (md+): ~22px tall segments with gaps and in-bar labels when wide enough. */
export function StackedBarSegments({
  segments,
  total,
  widthClass = "w-full",
  inBarLabelMinPct = 12,
  ariaLabel = "Stacked category bar",
  formatInBarLabel,
}: {
  segments: BarSegment[];
  total: number;
  widthClass?: string;
  inBarLabelMinPct?: number;
  ariaLabel?: string;
  /** When set, used for in-bar text on md+ (e.g. promo $ (%) caption). */
  formatInBarLabel?: (segment: BarSegment, sharePct: number) => string;
}) {
  const barTotal = total > 0 ? total : segments.reduce((s, x) => s + x.value, 0);
  if (barTotal <= 0 || segments.length === 0) return null;

  return (
    <div
      className={`flex h-2 items-stretch overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10 md:h-[22px] md:gap-1 md:overflow-visible md:rounded-none md:bg-transparent ${widthClass}`}
      role="img"
      aria-label={ariaLabel}
    >
      {segments.map((seg) => {
        const pct = barTotal > 0 ? (seg.value / barTotal) * 100 : 0;
        const labelPct = seg.sharePct ?? pct;
        const showInBar = labelPct >= inBarLabelMinPct;
        const inBarText = formatInBarLabel ? formatInBarLabel(seg, labelPct) : `${labelPct.toFixed(0)}%`;
        return (
          <div
            key={seg.id}
            style={{ flexGrow: seg.value, flexBasis: 0, backgroundColor: seg.color }}
            className="relative h-full min-w-0 md:min-w-[3px] md:overflow-hidden md:rounded-md"
            title={`${seg.label}: ${inBarText}`}
          >
            {showInBar ? (
              <span className="pointer-events-none absolute inset-0 hidden items-center justify-center px-0.5 text-[9px] font-semibold leading-none text-white tabular-nums drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)] md:flex md:text-[10px]">
                {inBarText}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}