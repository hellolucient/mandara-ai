import {
  formatComparisonMoney,
  formatVariancePct,
  type ComparedPeriod,
} from "@/lib/spa-comparison";

export function VariancePct({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted-foreground">n/a</span>;
  const tone = value > 0 ? "text-emerald-700 dark:text-emerald-400" : value < 0 ? "text-red-700 dark:text-red-400" : "text-muted-foreground";
  return <span className={`font-medium tabular-nums ${tone}`}>{formatVariancePct(value)}</span>;
}

export function ComparisonAmount({ value, currency }: { value: number | null; currency: string }) {
  if (value == null) return <span className="text-muted-foreground">n/a</span>;
  return <span className="tabular-nums">{formatComparisonMoney(value, currency)}</span>;
}

export function TyLyVarianceCells({
  period,
  currency,
  tdClassName = "px-2 py-3 text-right tabular-nums",
}: {
  period: ComparedPeriod;
  currency: string;
  tdClassName?: string;
}) {
  return (
    <>
      <td className={tdClassName}>
        <ComparisonAmount value={period.ty.total} currency={currency} />
      </td>
      <td className={tdClassName}>
        <ComparisonAmount value={period.ly?.total ?? null} currency={currency} />
      </td>
      <td className={tdClassName}>
        <VariancePct value={period.variance.pct} />
      </td>
    </>
  );
}