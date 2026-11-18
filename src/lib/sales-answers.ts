import { addDays, formatBusinessDate, money, percent } from "@/lib/dates";
import type { LoadedDay, SalesIntent, SalesLine, SalesSource } from "@/lib/sales-types";

const DROP_ATTENTION = -25;

function salesDayTarget(today: string, intent: { dayOffset?: number }): string {
  return addDays(today, -1 + (intent.dayOffset ?? 0));
}

export function answerSales(intent: SalesIntent, days: LoadedDay[], today: string): string {
  const ordered = [...days].sort((a, b) => a.businessDate.localeCompare(b.businessDate));
  const target = salesDayTarget(today, intent);
  const day = ordered.find((item) => item.businessDate === target) ?? null;
  
  // Period-based queries don't need yesterday's data
  if (intent.kind === "last-month") return lastMonthAnswer(ordered, today);
  if (intent.kind === "this-month") return thisMonthAnswer(ordered, today);
  if (intent.kind === "named-month") return namedMonthAnswer(ordered, intent.month, today);
  if (intent.kind === "comparison") return comparisonAnswer(ordered, intent.period, today);
  if (intent.kind === "mtd") return mtdAnswer(ordered, day?.businessDate ?? target);
  if (intent.kind === "location-month") return locationMonthAnswer(ordered, intent.name, target);
  if (intent.kind === "mix") return mixAnswer(ordered, today, intent);
  
  // Single-day queries need yesterday's data
  if (!day) {
    const latest = ordered.at(-1);
    return latest
      ? `There is no sales record for ${formatBusinessDate(target)}. The latest stored date is ${formatBusinessDate(latest.businessDate)}. Nothing was estimated.`
      : "There are no sales records stored yet. Nothing was estimated.";
  }
  if (intent.kind === "total") return totalAnswer(day!, target);
  if (intent.kind === "best-worst") return rankAnswer(day!);
  if (intent.kind === "below-budget") return budgetAnswer(day!);
  if (intent.kind === "attention" || intent.kind === "overview") return reportFor(day!, ordered);
  if (intent.kind === "week") return weekAnswer(day!, ordered);
  return locationAnswer(day!, ordered, intent.name);
}

export function reportFor(day: LoadedDay, ordered: LoadedDay[]): string {
  const prior = ordered.find((item) => item.businessDate === addDays(day.businessDate, -1)) ?? null;
  const week = ordered.find((item) => item.businessDate === addDays(day.businessDate, -7)) ?? null;
  const month = ordered.filter((item) => item.businessDate.slice(0, 7) === day.businessDate.slice(0, 7) && item.businessDate <= day.businessDate);
  const parts = [
    `Daily sales report for ${formatBusinessDate(day.businessDate)}.`,
    sourceLine(day),
    `Currency: ${day.currency}.`,
    "",
    totalSentence(day),
    "",
    "By location",
    ...day.lines.map((line) => lineSentence(line, day.currency)),
    "",
    comparisonBlock("Previous day", prior, day),
    "",
    comparisonBlock("Same weekday one week earlier", week, day),
    "",
    "Needs attention",
    ...attentionLines(day, week),
    "",
    mtdAnswer(month, day.businessDate),
  ];
  return parts.filter((part) => part !== "").join("\n");
}


function mixAnswer(ordered: LoadedDay[], today: string, intent: { yesterday: boolean; mtd: boolean; dayOffset?: number }): string {
  const target = salesDayTarget(today, intent);
  const day = ordered.find((item) => item.businessDate === target) ?? null;
  const parts: string[] = [];
  if (intent.yesterday) {
    if (!day) {
      const latest = ordered.at(-1);
      parts.push(
        latest
          ? `There is no sales record for ${formatBusinessDate(target)}. The latest stored date is ${formatBusinessDate(latest.businessDate)}. Nothing was estimated.`
          : "There are no sales records stored yet. Nothing was estimated.",
      );
    } else {
      parts.push(mixDaySection(day, "Treatment and retail sales"));
    }
  }
  const through = day?.businessDate ?? target;
  if (intent.mtd) parts.push(mixMtdSection(ordered, through, !intent.yesterday));
  return parts.filter(Boolean).join("\n\n");
}

function mixDaySection(day: LoadedDay, heading: string): string {
  const rows = day.lines.map((line) => ({
    name: line.locationName,
    treatment: line.treatmentSales ?? null,
    retail: line.retailSales ?? null,
    total: line.netSales,
    budget: line.budget,
  }));
  const missingSplit = rows.some((row) => row.treatment == null || row.retail == null);
  const lines = [
    `${heading} for ${formatBusinessDate(day.businessDate)}.`,
    sourceLine(day),
    "Budget is only held as a total, not split into treatment and retail.",
    "",
    mixTable(rows, day.currency),
  ];
  if (missingSplit) lines.push("A dash means that figure is not stored.");
  return lines.join("\n");
}

function mixMtdSection(days: LoadedDay[], through: string, includePreamble: boolean): string {
  const month = through.slice(0, 7);
  const inMonth = days.filter((day) => day.businessDate.slice(0, 7) === month && day.businessDate <= through);
  if (inMonth.length === 0) return `No month-to-date sales are stored through ${formatBusinessDate(through)}.`;
  const currency = inMonth[0].currency;
  const names: string[] = [];
  const seen = new Set<string>();
  for (const day of inMonth) {
    for (const line of day.lines) {
      if (!seen.has(line.locationName)) {
        seen.add(line.locationName);
        names.push(line.locationName);
      }
    }
  }
  const rows = names.map((name) => {
    let treatment: number | null = null;
    let retail: number | null = null;
    let total: number | null = null;
    let budget: number | null = null;
    for (const day of inMonth) {
      const line = day.lines.find((item) => item.locationName === name);
      if (!line) continue;
      if (line.treatmentSales != null) treatment = (treatment ?? 0) + line.treatmentSales;
      if (line.retailSales != null) retail = (retail ?? 0) + line.retailSales;
      if (line.netSales != null) total = (total ?? 0) + line.netSales;
      if (line.budget != null) budget = (budget ?? 0) + line.budget;
    }
    return { name, treatment, retail, total, budget };
  });
  const presentDates = new Set(inMonth.map((day) => day.businessDate));
  const missingDates: string[] = [];
  const [year, monthNumber] = month.split("-").map(Number);
  const last = Number(through.slice(-2));
  for (let day = 1; day <= last; day += 1) {
    const iso = `${year}-${String(monthNumber).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (!presentDates.has(iso)) missingDates.push(formatBusinessDate(iso));
  }
  const missingSplit = rows.some((row) => row.treatment == null || row.retail == null);
  const lines = [
    `Month to date through ${formatBusinessDate(through)}, actual versus the stored month-to-date budget.`,
    ...(includePreamble ? [sourceLine(inMonth[inMonth.length - 1]), "Budget is only held as a total, not split into treatment and retail."] : []),
    "",
    mixTable(rows, currency),
  ];
  if (missingSplit) lines.push("A dash means that figure is not stored. Treatment and retail totals only include days with a stored split.");
  if (missingDates.length) lines.push(`No record for ${missingDates.join(", ")}. Those dates are not estimated.`);
  return lines.join("\n");
}

type MixRow = { name: string; treatment: number | null; retail: number | null; total: number | null; budget: number | null };

function mixTable(rows: MixRow[], currency: string): string {
  const header = "| Spa | Treatment | Retail | Total | vs budget |";
  const rule = "| --- | ---: | ---: | ---: | ---: |";
  const body = rows.map((row) => mixTableRow(row.name, row, currency));
  const totals: MixRow = {
    name: "Total",
    treatment: sumKnown(rows.map((row) => row.treatment)),
    retail: sumKnown(rows.map((row) => row.retail)),
    total: sumKnown(rows.map((row) => row.total)),
    budget: sumKnown(rows.map((row) => row.budget)),
  };
  // vs budget on the total row only uses spas that have both a total and a budget.
  const comparable = rows.filter((row) => row.total != null && row.budget != null);
  const comparableSales = sumKnown(comparable.map((row) => row.total));
  const comparableBudget = sumKnown(comparable.map((row) => row.budget));
  const totalLine = `| Total | ${cellMoney(totals.treatment, currency)} | ${cellMoney(totals.retail, currency)} | ${cellMoney(totals.total, currency)} | ${varianceCell(comparableSales, comparableBudget, currency)} |`;
  return [header, rule, ...body, totalLine].join("\n");
}

function mixTableRow(name: string, row: MixRow, currency: string): string {
  return `| ${name} | ${cellMoney(row.treatment, currency)} | ${cellMoney(row.retail, currency)} | ${cellMoney(row.total, currency)} | ${varianceCell(row.total, row.budget, currency)} |`;
}

function cellMoney(value: number | null, currency: string): string {
  return value == null ? "—" : moneyExact(value, currency);
}

function varianceCell(sales: number | null, budget: number | null, currency: string): string {
  if (sales == null || budget == null) return "—";
  const gap = sales - budget;
  if (gap === 0) return moneyExact(0, currency);
  const amount = moneyExact(Math.abs(gap), currency);
  return gap > 0 ? `+${amount}` : `−${amount}`;
}

function moneyExact(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

function sumKnown(values: Array<number | null>): number | null {
  let total = 0;
  let seen = false;
  for (const value of values) {
    if (value == null) continue;
    total += value;
    seen = true;
  }
  return seen ? total : null;
}

function totalAnswer(day: LoadedDay, _target: string): string {
  return mixDaySection(day, "Treatment and retail sales");
}

function rankAnswer(day: LoadedDay): string {
  const ranked = day.lines.filter((line) => line.netSales != null).sort((a, b) => (b.netSales ?? 0) - (a.netSales ?? 0));
  if (ranked.length === 0) return `No location has a sales figure on ${formatBusinessDate(day.businessDate)}.`;
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];
  const missing = day.lines.filter((line) => line.netSales == null).map((line) => line.locationName);
  const lines = [
    `On ${formatBusinessDate(day.businessDate)}, ${best.locationName} was highest at ${money(best.netSales ?? 0, day.currency)}.`,
    ranked.length > 1
      ? `${worst.locationName} was lowest among locations with a figure, at ${money(worst.netSales ?? 0, day.currency)}.`
      : "Only one location has a figure, so there is no lowest comparison.",
    sourceLine(day),
  ];
  if (missing.length) lines.push(`Missing and excluded: ${missing.join(", ")}.`);
  return lines.join("\n");
}

function budgetAnswer(day: LoadedDay): string {
  const comparable = day.lines.filter((line) => line.netSales != null && line.budget != null);
  const below = comparable.filter((line) => (line.netSales ?? 0) < (line.budget ?? 0));
  const missingBudget = day.lines.filter((line) => line.budget == null).map((line) => line.locationName);
  const missingSales = day.lines.filter((line) => line.netSales == null).map((line) => line.locationName);
  if (comparable.length === 0) {
    return `No location on ${formatBusinessDate(day.businessDate)} has both a sales figure and a budget, so none can be marked below budget.`;
  }
  const lines = [
    below.length
      ? `Below the stored budget on ${formatBusinessDate(day.businessDate)}: ${below.map((line) => `${line.locationName} ${money(line.netSales ?? 0, day.currency)} against ${money(line.budget ?? 0, day.currency)}`).join("; ")}.`
      : `No location with both a figure and a budget is below budget on ${formatBusinessDate(day.businessDate)}.`,
    sourceLine(day),
  ];
  if (missingBudget.length) lines.push(`No budget is stored for ${missingBudget.join(", ")}, so those locations are not included.`);
  if (missingSales.length) lines.push(`No sales figure is stored for ${missingSales.join(", ")}, so those locations are not included.`);
  return lines.join("\n");
}

function locationAnswer(day: LoadedDay, ordered: LoadedDay[], name: string): string {
  const line = day.lines.find((item) => item.locationName.toLowerCase() === name.toLowerCase());
  if (!line) return `${name} is not on the sales record for ${formatBusinessDate(day.businessDate)}.`;
  const weekDate = addDays(day.businessDate, -7);
  const week = ordered.find((item) => item.businessDate === weekDate);
  const priorLine = week?.lines.find((item) => item.locationName === line.locationName) ?? null;
  const shortWeek = formatBusinessDate(weekDate).replace(/ \d{4}$/, "");
  const split =
    line.treatmentSales != null && line.retailSales != null
      ? `Treatments ${money(line.treatmentSales, day.currency)} · Retail ${money(line.retailSales, day.currency)}`
      : "";
  const lastWeek =
    priorLine && line.netSales != null && priorLine.netSales != null && priorLine.netSales !== 0
      ? `Same day last week (${shortWeek}): ${money(priorLine.netSales, day.currency)}, ${percent(((line.netSales - priorLine.netSales) / priorLine.netSales) * 100)}`
      : `Same day last week (${shortWeek}): ${changePhrase(line, priorLine, day.currency, weekDate)}`;
  const bits = [
    `**${line.locationName} · ${formatBusinessDate(day.businessDate)}**`,
    `Net sales: ${figure(line, day.currency)}`,
    line.treatments != null ? `Treatment guests: ${line.treatments}` : "",
    split,
    line.budget == null ? "Budget: none on file for this spa" : `Budget: ${budgetPhrase(line, day.currency)}`,
    lastWeek,
    sourceLine(day),
  ];
  return bits.filter(Boolean).join("\n");
}

/** One spa, month to date: net sales, guests, budget pace where both exist, and its rank among the spas. */
function locationMonthAnswer(ordered: LoadedDay[], name: string, through: string): string {
  const monthKey = through.slice(0, 7);
  const inMonth = ordered.filter((day) => day.businessDate.startsWith(monthKey) && day.businessDate <= through);
  if (inMonth.length === 0) return `No sales records are stored for this month yet.`;
  const currency = inMonth[0].currency;
  const key = name.toLowerCase();
  let sales = 0;
  let guests = 0;
  let days = 0;
  let paced = 0;
  let budget = 0;
  const totals = new Map<string, number>();
  for (const day of inMonth) {
    for (const line of day.lines) {
      if (line.netSales != null) totals.set(line.locationName, (totals.get(line.locationName) ?? 0) + line.netSales);
      if (line.locationName.toLowerCase() !== key || line.netSales == null) continue;
      sales += line.netSales;
      guests += line.treatments ?? 0;
      days += 1;
      if (line.budget != null) {
        paced += line.netSales;
        budget += line.budget;
      }
    }
  }
  const first = inMonth[0].businessDate;
  const last = inMonth[inMonth.length - 1].businessDate;
  if (days === 0) return `${name} has no sales figures stored for ${formatBusinessDate(first)} to ${formatBusinessDate(last)}.`;
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const rank = ranked.findIndex(([spa]) => spa.toLowerCase() === key) + 1;
  const lines = [
    `**${name} · month to date (${formatBusinessDate(first).replace(/ \d{4}$/, "")} – ${formatBusinessDate(last)})**`,
    `Net sales: ${money(sales, currency)} over ${days} recorded day${days === 1 ? "" : "s"}`,
    `Average per day: ${money(sales / days, currency)}`,
    guests ? `Treatment guests: ${guests}` : "",
    budget > 0
      ? `Budget pace: ${money(paced, currency)} against ${money(budget, currency)} on days with a budget, ${percent(((paced - budget) / budget) * 100)}`
      : "Budget: none on file for this spa",
    rank ? `Rank: ${rank} of ${ranked.length} spas this month` : "",
    sourceLine(inMonth[inMonth.length - 1]),
  ];
  return lines.filter(Boolean).join("\n");
}

function weekAnswer(day: LoadedDay, ordered: LoadedDay[]): string {
  const weekDate = addDays(day.businessDate, -7);
  const week = ordered.find((item) => item.businessDate === weekDate) ?? null;
  return [
    `Changes against ${formatBusinessDate(weekDate)}, the same weekday one week before ${formatBusinessDate(day.businessDate)}.`,
    comparisonBlock("Same weekday", week, day),
    windowNote(ordered, day.businessDate),
    sourceLine(day),
  ].filter(Boolean).join("\n");
}

function mtdAnswer(days: LoadedDay[], through: string): string {
  const month = through.slice(0, 7);
  const inMonth = days.filter((day) => day.businessDate.slice(0, 7) === month && day.businessDate <= through);
  const presentDates = new Set(inMonth.map((day) => day.businessDate));
  const missingDates: string[] = [];
  const [year, monthNumber] = month.split("-").map(Number);
  const last = Number(through.slice(-2));
  for (let day = 1; day <= last; day += 1) {
    const iso = `${year}-${String(monthNumber).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (!presentDates.has(iso)) missingDates.push(formatBusinessDate(iso));
  }
  let total = 0;
  let counted = 0;
  const sources = new Set<SalesSource>();
  for (const day of inMonth) {
    sources.add(day.source);
    for (const line of day.lines) {
      if (line.netSales != null) {
        total += line.netSales;
        counted += 1;
      }
    }
  }
  if (counted === 0) return `No month-to-date sales are stored through ${formatBusinessDate(through)}.`;
  const currency = inMonth[0]?.currency ?? "USD";
  const lines = [
    `Month-to-date net sales through ${formatBusinessDate(through)} are ${money(total, currency)}, from ${counted} stored location figures across ${inMonth.length} recorded days.`,
  ];
  if (missingDates.length) lines.push(`No record for ${missingDates.join(", ")}. Those dates are not estimated.`);
  if (sources.size > 1) lines.push(`This total mixes ${[...sources].join(", ")} records. It is not a single-source figure.`);
  const budgets = inMonth.flatMap((day) => day.lines).filter((line) => line.budget != null);
  if (budgets.length === 0) lines.push("No budgets are stored, so there is no month-to-date budget variance.");
  return lines.join(" ");
}

function totalSentence(day: LoadedDay): string {
  const present = day.lines.filter((line) => line.netSales != null);
  const missing = day.lines.filter((line) => line.netSales == null).map((line) => line.locationName);
  if (present.length === 0) return "No location has a net sales figure.";
  const total = present.reduce((sum, line) => sum + (line.netSales ?? 0), 0);
  const sentence = `Recorded net sales are ${money(total, day.currency)} across ${present.length} location${present.length === 1 ? "" : "s"}.`;
  return missing.length ? `${sentence} Excluded because the figure is missing: ${missing.join(", ")}.` : sentence;
}

function lineSentence(line: SalesLine, currency: string): string {
  return `${line.locationName}: ${figure(line, currency)}. ${budgetPhrase(line, currency)}`.trim();
}

function figure(line: SalesLine, currency: string): string {
  return line.netSales == null ? "no sales figure" : money(line.netSales, currency);
}

function budgetPhrase(line: SalesLine, currency: string): string {
  if (line.budget == null) return "No budget is stored.";
  if (line.netSales == null) return `Budget on record is ${money(line.budget, currency)}, with no sales figure to compare.`;
  const gap = line.netSales - line.budget;
  if (gap < 0) return `${money(Math.abs(gap), currency)} below the stored budget of ${money(line.budget, currency)}.`;
  return `${money(gap, currency)} above the stored budget of ${money(line.budget, currency)}.`;
}

function comparisonBlock(label: string, prior: LoadedDay | null, day: LoadedDay): string {
  if (!prior) return `${label}: no stored record, so no percentage is calculated.`;
  const lines = day.lines.map((line) => {
    const before = prior.lines.find((item) => item.locationName === line.locationName);
    return `${line.locationName}: ${changePhrase(line, before ?? null, day.currency, prior.businessDate)}`;
  });
  return [`${label}, ${formatBusinessDate(prior.businessDate)}.`, ...lines].join("\n");
}

function changePhrase(line: SalesLine, prior: SalesLine | null, currency: string, priorDate: string): string {
  if (!prior || line.netSales == null || prior.netSales == null) {
    return `no like-for-like figure against ${formatBusinessDate(priorDate)}.`;
  }
  if (prior.netSales === 0) return `${money(line.netSales, currency)} against ${money(0, currency)}. A percentage is not calculated from a zero base.`;
  const change = ((line.netSales - prior.netSales) / prior.netSales) * 100;
  return `${money(line.netSales, currency)} against ${money(prior.netSales, currency)} (${percent(change)}).`;
}

function attentionLines(day: LoadedDay, week: LoadedDay | null): string[] {
  const notes: string[] = [];
  for (const line of day.lines) {
    if (line.netSales == null) notes.push(`${line.locationName} has no sales figure.`);
    if (line.netSales != null && line.budget != null && line.netSales < line.budget) {
      notes.push(`${line.locationName} is below its stored budget of ${money(line.budget, day.currency)}.`);
    }
    const prior = week?.lines.find((item) => item.locationName === line.locationName);
    if (line.netSales != null && prior?.netSales != null && prior.netSales !== 0) {
      const change = ((line.netSales - prior.netSales) / prior.netSales) * 100;
      if (change <= DROP_ATTENTION) {
        notes.push(`${line.locationName} is ${percent(change)} versus the same weekday one week earlier.`);
      }
    }
  }
  return notes.length ? notes : ["Nothing in the stored figures meets the attention rules."];
}

function windowNote(ordered: LoadedDay[], through: string): string {
  const start = addDays(through, -6);
  const previousStart = addDays(through, -13);
  const previousEnd = addDays(through, -7);
  const has = (iso: string) => ordered.some((day) => day.businessDate === iso);
  const currentMissing = datesBetween(start, through).filter((iso) => !has(iso));
  const priorMissing = datesBetween(previousStart, previousEnd).filter((iso) => !has(iso));
  if (currentMissing.length === 0 && priorMissing.length === 0) {
    return "Both seven-day windows are complete in the records.";
  }
  return "A seven-day total is not compared, because one of the windows is missing days. Missing dates are left blank rather than filled.";
}

function datesBetween(start: string, end: string): string[] {
  const dates: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

function sourceLine(day: LoadedDay): string {
  if (day.source === "sample") return "Source: sample figures. These were not read from DSR.";
  if (day.source === "import") return "Source: Steiners DSR, imported from the daily export. Net sales are total revenue, guests are treatment guests, and the budget is that day's forecast.";
  return "Source: Maldives daily DSR. Net sales are total revenue, guests are treatment guests, and the budget is that day's forecast.";
}

function lastMonthAnswer(ordered: LoadedDay[], today: string): string {
  const [year, month] = today.split("-").map(Number);
  const lastMonth = month === 1 ? 12 : month - 1;
  const lastMonthYear = month === 1 ? year - 1 : year;
  const monthKey = `${lastMonthYear}-${String(lastMonth).padStart(2, "0")}`;
  return monthPeriodAnswer(ordered, monthKey, "last month");
}

function thisMonthAnswer(ordered: LoadedDay[], today: string): string {
  const monthKey = today.slice(0, 7);
  return monthPeriodAnswer(ordered, monthKey, "this month");
}

function namedMonthAnswer(ordered: LoadedDay[], monthName: string, today: string): string {
  const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  const monthNumber = months.indexOf(monthName.toLowerCase()) + 1;
  if (monthNumber === 0) return "That month name was not recognized.";
  
  const year = Number(today.slice(0, 4));
  const monthKey = `${year}-${String(monthNumber).padStart(2, "0")}`;
  return monthPeriodAnswer(ordered, monthKey, monthName.charAt(0).toUpperCase() + monthName.slice(1));
}

function monthPeriodAnswer(ordered: LoadedDay[], monthKey: string, periodLabel: string): string {
  const inMonth = ordered.filter((day) => day.businessDate.startsWith(monthKey));
  if (inMonth.length === 0) return `No sales records are stored for ${periodLabel}.`;
  
  const currency = inMonth[0].currency;
  const locationTotals = new Map<string, number>();
  
  for (const day of inMonth) {
    for (const line of day.lines) {
      if (line.netSales != null) {
        locationTotals.set(line.locationName, (locationTotals.get(line.locationName) ?? 0) + line.netSales);
      }
    }
  }
  
  if (locationTotals.size === 0) return `No location has sales figures for ${periodLabel}.`;
  
  const sortedLocations = Array.from(locationTotals.entries()).sort((a, b) => b[1] - a[1]);
  const grandTotal = sortedLocations.reduce((sum, [, total]) => sum + total, 0);
  
  const firstDay = inMonth[0].businessDate;
  const lastDay = inMonth[inMonth.length - 1].businessDate;
  const coverage = firstDay === lastDay 
    ? `${formatBusinessDate(firstDay)} only`
    : `${formatBusinessDate(firstDay)} through ${formatBusinessDate(lastDay)}`;
  
  const lines = [
    `Sales for ${periodLabel} (${coverage}, ${inMonth.length} days stored):`,
    `Total: ${money(grandTotal, currency)}`,
    "",
    "By location:",
    ...sortedLocations.map(([name, total]) => `${name}: ${money(total, currency)}`),
  ];
  
  return lines.join("\n");
}

function comparisonAnswer(ordered: LoadedDay[], period: "last-month" | "this-month" | "week" | "yesterday", today: string): string {
  let periodKey: string;
  let periodLabel: string;
  let daysInPeriod: LoadedDay[];
  
  if (period === "last-month") {
    const [year, month] = today.split("-").map(Number);
    const lastMonth = month === 1 ? 12 : month - 1;
    const lastMonthYear = month === 1 ? year - 1 : year;
    periodKey = `${lastMonthYear}-${String(lastMonth).padStart(2, "0")}`;
    periodLabel = "last month";
    daysInPeriod = ordered.filter((day) => day.businessDate.startsWith(periodKey));
  } else if (period === "this-month") {
    periodKey = today.slice(0, 7);
    periodLabel = "this month";
    daysInPeriod = ordered.filter((day) => day.businessDate.startsWith(periodKey));
  } else if (period === "week") {
    const weekStart = addDays(today, -7);
    periodLabel = "last week";
    daysInPeriod = ordered.filter((day) => day.businessDate >= weekStart && day.businessDate < today);
  } else {
    // yesterday
    const target = addDays(today, -1);
    periodLabel = "yesterday";
    const day = ordered.find((item) => item.businessDate === target);
    daysInPeriod = day ? [day] : [];
  }
  
  if (daysInPeriod.length === 0) return `No sales records are stored for ${periodLabel}.`;
  
  const currency = daysInPeriod[0].currency;
  const locationTotals = new Map<string, number>();
  
  for (const day of daysInPeriod) {
    for (const line of day.lines) {
      if (line.netSales != null) {
        locationTotals.set(line.locationName, (locationTotals.get(line.locationName) ?? 0) + line.netSales);
      }
    }
  }
  
  if (locationTotals.size === 0) return `No location has sales figures for ${periodLabel}.`;
  
  const sortedLocations = Array.from(locationTotals.entries()).sort((a, b) => b[1] - a[1]);
  const highest = sortedLocations[0];
  const lowest = sortedLocations[sortedLocations.length - 1];
  
  const firstDay = daysInPeriod[0].businessDate;
  const lastDay = daysInPeriod[daysInPeriod.length - 1].businessDate;
  const coverage = firstDay === lastDay 
    ? formatBusinessDate(firstDay)
    : `${formatBusinessDate(firstDay)} through ${formatBusinessDate(lastDay)}`;
  
  const lines = [
    `Revenue comparison for ${periodLabel} (${coverage}, ${daysInPeriod.length} day${daysInPeriod.length === 1 ? "" : "s"} stored):`,
    "",
    `Highest: ${highest[0]} with ${money(highest[1], currency)}`,
  ];
  
  if (sortedLocations.length > 1) {
    lines.push(`Lowest: ${lowest[0]} with ${money(lowest[1], currency)}`);
  }
  
  if (sortedLocations.length > 2) {
    lines.push("");
    lines.push("All locations:");
    lines.push(...sortedLocations.map(([name, total]) => `${name}: ${money(total, currency)}`));
  }
  
  return lines.join("\n");
}

export function dayHeadline(day: LoadedDay, ordered: LoadedDay[]) {
  const present = day.lines.filter((line) => line.netSales != null);
  const total = present.reduce((sum, line) => sum + (line.netSales ?? 0), 0);
  const priorWeek = ordered.find((item) => item.businessDate === addDays(day.businessDate, -7)) ?? null;
  const notes = attentionLines(day, priorWeek).filter((note) => note !== "Nothing in the stored figures meets the attention rules.");
  return {
    total: present.length ? total : null,
    locations: present.length,
    missing: day.lines.filter((line) => line.netSales == null).map((line) => line.locationName),
    notes,
  };
}

export function sourceLabel(source: SalesSource): string {
  if (source === "sample") return "Sample data";
  if (source === "import") return "Steiners DSR (imported)";
  return "DSR extract";
}
