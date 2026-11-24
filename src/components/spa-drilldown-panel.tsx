"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import type { SpaSummary } from "@/lib/home-kpis";

export type DrilldownScope = "day" | "14d" | "mtd";

type ItemsResponse = {
  error?: string;
  locationId: string;
  locationName: string | null;
  mode: "day" | "range";
  fromDate: string;
  toDate: string;
  currency: string;
  spaTreatmentTotal: number | null;
  spaRetailTotal: number | null;
  itemTreatmentTotal: number | null;
  itemRetailTotal: number | null;
  hasItems: boolean;
  treatments: Array<{ itemName: string; quantity: number; netSales: number }>;
  retail: Array<{ itemName: string; quantity: number; netSales: number }>;
  mismatch: { treatment?: number; retail?: number } | null;
};

type Props = {
  spa: SpaSummary | null;
  open: boolean;
  onClose: () => void;
  currency: string;
  defaultDate: string;
  today: string;
};

export function SpaDrilldownPanel({ spa, open, onClose, currency, defaultDate, today }: Props) {
  const [scope, setScope] = useState<DrilldownScope>("day");
  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ItemsResponse | null>(null);
  const [error, setError] = useState("");

  const reportedDates = useMemo(() => {
    if (!spa) return [];
    return spa.sparklineData.map((p) => p.date).filter((d) => d);
  }, [spa]);

  useEffect(() => {
    if (open && spa) {
      setSelectedDate(spa.latestDate ?? defaultDate);
      setScope("day");
    }
  }, [open, spa, defaultDate]);

  const queryRange = useMemo((): { date: string } | { from: string; to: string } | null => {
    if (!spa) return null;
    if (scope === "day") return { date: selectedDate };
    if (scope === "14d") {
      const dates = reportedDates.slice(-14);
      if (dates.length === 0) return { date: selectedDate };
      return { from: dates[0]!, to: dates.at(-1)! };
    }
    const monthStart = `${today.slice(0, 7)}-01`;
    const end = spa.latestDate && spa.latestDate < today ? spa.latestDate : today;
    return { from: monthStart, to: end };
  }, [scope, selectedDate, reportedDates, spa, today]);

  const load = useCallback(async () => {
    if (!spa || !queryRange) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ locationId: spa.locationId });
      if ("date" in queryRange) params.set("date", queryRange.date);
      else {
        params.set("from", queryRange.from);
        params.set("to", queryRange.to);
      }
      const response = await fetch(`/api/sales/items?${params}`, { cache: "no-store" });
      const body = (await response.json()) as ItemsResponse;
      if (!response.ok) {
        setError(body.error || "Could not load item lines.");
        setData(null);
        return;
      }
      setData(body);
    } catch {
      setError("Could not load item lines.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [spa, queryRange]);

  useEffect(() => {
    if (open && spa) void load();
  }, [open, spa, load]);

  const dateIndex = reportedDates.indexOf(selectedDate);
  const canPrev = scope === "day" && dateIndex > 0;
  const canNext = scope === "day" && dateIndex >= 0 && dateIndex < reportedDates.length - 1;

  const treatmentDisplay = data?.spaTreatmentTotal ?? null;
  const retailDisplay = data?.spaRetailTotal ?? null;
  const showCurrency = data?.currency ?? currency;

  if (!spa) return null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className="fixed inset-0 z-50 bg-black/15 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
          onClick={onClose}
        />
        <DialogPrimitive.Popup
          className={cn(
            "fixed z-50 flex flex-col overflow-hidden bg-card text-sm shadow-[0_1px_2px_rgba(20,40,35,0.06),0_20px_48px_-16px_rgba(20,40,35,0.28)] outline-none",
            "inset-0 md:inset-y-0 md:left-auto md:w-[min(100%,28rem)] md:border-l md:border-black/[0.06]",
            "data-open:animate-in data-closed:animate-out data-open:slide-in-from-right data-closed:slide-out-to-right",
          )}
          role="dialog"
          aria-label={`${spa.locationName} sales detail`}
        >
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-black/[0.06] px-5 py-4 dark:border-white/10">
            <div className="min-w-0">
              <DialogPrimitive.Title className="font-heading text-xl text-foreground">{spa.locationName}</DialogPrimitive.Title>
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                {scope === "day" ? shortDate(selectedDate) : scope === "14d" ? "Last 14 reported days" : "Month to date"}
              </p>
            </div>
            <Button type="button" variant="ghost" size="icon-sm" className="shrink-0" onClick={onClose} aria-label="Close">
              <X className="size-4" />
            </Button>
          </header>

          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-black/[0.06] px-5 py-3 dark:border-white/10">
            {(["day", "14d", "mtd"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setScope(value)}
                className={cn(
                  "rounded-full border px-3 py-1 text-[12.5px] transition-colors",
                  scope === value
                    ? "border-primary/20 bg-primary text-primary-foreground"
                    : "border-black/[0.08] bg-background text-muted-foreground hover:text-foreground",
                )}
              >
                {value === "day" ? "One day" : value === "14d" ? "14 days" : "Month to date"}
              </button>
            ))}
          </div>

          {scope === "day" ? (
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-black/[0.06] px-5 py-2.5 dark:border-white/10">
              <Button type="button" variant="ghost" size="icon-sm" disabled={!canPrev} onClick={() => setSelectedDate(reportedDates[dateIndex - 1])} aria-label="Previous day">
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-[13px] font-medium tabular-nums">{shortDate(selectedDate)}</span>
              <Button type="button" variant="ghost" size="icon-sm" disabled={!canNext} onClick={() => setSelectedDate(reportedDates[dateIndex + 1])} aria-label="Next day">
                <ChevronRight className="size-4" />
              </Button>
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <div className="grid grid-cols-2 gap-3">
              <TotalCard label="Treatment" value={treatmentDisplay} currency={showCurrency} />
              <TotalCard label="Retail" value={retailDisplay} currency={showCurrency} />
            </div>

            {loading ? <p className="mt-6 text-sm text-muted-foreground">Loading item lines…</p> : null}
            {error ? <p className="mt-6 text-sm text-destructive">{error}</p> : null}

            {!loading && !error && data && !data.hasItems ? (
              <p className="mt-6 rounded-xl border border-black/[0.06] bg-primary/[0.03] px-3 py-3 text-[13px] leading-5 text-muted-foreground">
                Item breakdown not loaded for this {scope === "day" ? "day" : "period"} yet. Totals above come from the daily DSR import.
              </p>
            ) : null}

            {!loading && data?.mismatch ? (
              <p className="mt-3 text-[12px] text-muted-foreground">
                {data.mismatch.treatment != null
                  ? `Item treatment total differs from DSR by ${formatMoney(data.mismatch.treatment, showCurrency)}. `
                  : ""}
                {data.mismatch.retail != null
                  ? `Item retail total differs from DSR by ${formatMoney(data.mismatch.retail, showCurrency)}.`
                  : ""}
              </p>
            ) : null}

            {data?.hasItems ? (
              <>
                <ItemList heading="Treatments sold" rows={data.treatments} currency={showCurrency} />
                <ItemList heading="Retail products sold" rows={data.retail} currency={showCurrency} className="mt-6" />
              </>
            ) : null}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function TotalCard({ label, value, currency }: { label: string; value: number | null; currency: string }) {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-card p-4 shadow-[0_1px_2px_rgba(20,40,35,0.04)] dark:border-white/10">
      <p className="text-[10px] tracking-[0.16em] text-muted-foreground uppercase">{label}</p>
      <p className="mt-2 text-[22px] font-medium tabular-nums tracking-[-0.02em]">{value == null ? "—" : formatMoneyExact(value, currency)}</p>
    </div>
  );
}

function ItemList({
  heading,
  rows,
  currency,
  className,
}: {
  heading: string;
  rows: Array<{ itemName: string; quantity: number; netSales: number }>;
  currency: string;
  className?: string;
}) {
  const subtotal = rows.reduce((s, r) => s + r.netSales, 0);
  return (
    <section className={className}>
      <h3 className="font-heading text-base text-foreground">{heading}</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-[13px] text-muted-foreground">None recorded.</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-xl border border-black/[0.06] dark:border-white/10">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-black/[0.06] text-left text-[10px] tracking-wide text-muted-foreground uppercase dark:border-white/10">
                <th className="py-2 pr-2 pl-3 font-medium">Item</th>
                <th className="px-2 py-2 text-right font-medium">Qty</th>
                <th className="py-2 pr-3 pl-2 text-right font-medium">
                  <span className="md:hidden">Net</span>
                  <span className="hidden md:inline">Net sales</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.itemName} className="border-b border-black/[0.04] last:border-0 dark:border-white/[0.05]">
                  <td className="py-2 pr-2 pl-3 text-foreground">{row.itemName}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{formatQty(row.quantity)}</td>
                  <td className="py-2 pr-3 pl-2 text-right tabular-nums">{formatMoneyExact(row.netSales, currency)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-primary/[0.04]">
                <td className="py-2 pr-2 pl-3 font-medium">Subtotal</td>
                <td />
                <td className="py-2 pr-3 pl-2 text-right font-medium tabular-nums">{formatMoneyExact(subtotal, currency)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

function shortDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function formatMoneyExact(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

function formatMoney(amount: number, currency: string): string {
  const sign = amount >= 0 ? "+" : "";
  return `${sign}${formatMoneyExact(amount, currency)}`;
}

function formatQty(qty: number): string {
  return Number.isInteger(qty) ? String(qty) : qty.toFixed(1);
}