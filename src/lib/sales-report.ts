import { addDays } from "@/lib/dates";
import { dayHeadline, sourceLabel } from "@/lib/sales-answers";
import type { LoadedDay } from "@/lib/sales-types";

export type ReportLine = {
  name: string;
  netSales: number | null;
  budget: number | null;
  /** Net sales minus budget, only when both are stored. */
  variance: number | null;
  variancePercent: number | null;
  guests: number | null;
  retailSales: number | null;
  /** Change versus the same weekday one week earlier, in percent. */
  weekChange: number | null;
};

export type SalesReport = {
  businessDate: string;
  currency: string;
  source: string;
  sample: boolean;
  note: string;
  lines: ReportLine[];
  totals: {
    netSales: number | null;
    locations: number;
    budget: number | null;
    /** Variance over spas that have both a figure and a budget. */
    variance: number | null;
    variancePercent: number | null;
    guests: number | null;
    retailSales: number | null;
    retailShare: number | null;
  };
  hasRetail: boolean;
  previousDay: { date: string; netSales: number; change: number | null } | null;
  weekEarlier: { date: string; netSales: number; change: number | null } | null;
  /** budget and budgetPercent cover only spa-days with both a figure and a budget. */
  monthToDate: { netSales: number; days: number; budget: number | null; budgetPercent: number | null };
  missing: string[];
  attention: string[];
};

function sum(values: Array<number | null | undefined>): number | null {
  const present = values.filter((v): v is number => v != null && Number.isFinite(v));
  return present.length ? present.reduce((a, b) => a + b, 0) : null;
}

function change(now: number | null, before: number | null): number | null {
  if (now == null || before == null || before === 0) return null;
  return ((now - before) / before) * 100;
}

function dayTotal(day: LoadedDay | null): number | null {
  return day ? sum(day.lines.map((line) => line.netSales)) : null;
}

/** The figures behind the Sales page management report and its PDF export. Nothing is estimated: a missing number stays null. */
export function buildSalesReport(day: LoadedDay, days: LoadedDay[]): SalesReport {
  const ordered = [...days].sort((a, b) => a.businessDate.localeCompare(b.businessDate));
  const prior = ordered.find((item) => item.businessDate === addDays(day.businessDate, -1)) ?? null;
  const week = ordered.find((item) => item.businessDate === addDays(day.businessDate, -7)) ?? null;
  const headline = dayHeadline(day, ordered);

  const lines: ReportLine[] = day.lines.map((line) => {
    const variance = line.netSales != null && line.budget != null ? line.netSales - line.budget : null;
    const before = week?.lines.find((item) => item.locationName === line.locationName)?.netSales ?? null;
    return {
      name: line.locationName,
      netSales: line.netSales,
      budget: line.budget,
      variance,
      variancePercent: variance != null && line.budget ? (variance / line.budget) * 100 : null,
      guests: line.treatments,
      retailSales: line.retailSales ?? null,
      weekChange: change(line.netSales, before),
    };
  });

  const compared = lines.filter((line) => line.variance != null);
  const variance = sum(compared.map((line) => line.variance));
  const comparedBudget = sum(compared.map((line) => line.budget));
  const netSales = sum(lines.map((line) => line.netSales));
  const retailSales = sum(lines.map((line) => line.retailSales));

  const month = ordered.filter(
    (item) => item.businessDate.slice(0, 7) === day.businessDate.slice(0, 7) && item.businessDate <= day.businessDate,
  );
  const mtdNet = sum(month.flatMap((item) => item.lines.map((line) => line.netSales))) ?? 0;
  // Budget pace compares like with like: only spa-days that have both a figure and a budget.
  const paired = month.flatMap((item) => item.lines).filter((line) => line.netSales != null && line.budget != null);
  const mtdBudget = sum(paired.map((line) => line.budget));
  const mtdPairedNet = sum(paired.map((line) => line.netSales));

  const total = (d: LoadedDay | null) => {
    const value = dayTotal(d);
    return d && value != null ? { date: d.businessDate, netSales: value, change: change(netSales, value) } : null;
  };

  return {
    businessDate: day.businessDate,
    currency: day.currency,
    source: sourceLabel(day.source),
    sample: day.source === "sample",
    note: day.note,
    lines,
    totals: {
      netSales,
      locations: headline.locations,
      budget: sum(lines.map((line) => line.budget)),
      variance,
      variancePercent: variance != null && comparedBudget ? (variance / comparedBudget) * 100 : null,
      guests: sum(lines.map((line) => line.guests)),
      retailSales,
      retailShare: retailSales != null && netSales ? (retailSales / netSales) * 100 : null,
    },
    hasRetail: lines.some((line) => line.retailSales != null),
    previousDay: total(prior),
    weekEarlier: total(week),
    monthToDate: {
      netSales: mtdNet,
      days: month.length,
      budget: mtdBudget,
      budgetPercent: mtdBudget && mtdPairedNet != null ? (mtdPairedNet / mtdBudget) * 100 : null,
    },
    missing: headline.missing,
    attention: headline.notes,
  };
}
