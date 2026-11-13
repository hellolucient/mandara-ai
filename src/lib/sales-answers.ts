import { addDays, formatBusinessDate, money, percent } from "@/lib/dates";
import type { LoadedDay, SalesIntent, SalesLine, SalesSource } from "@/lib/sales-types";

const DROP_ATTENTION = -25;

export function answerSales(intent: SalesIntent, days: LoadedDay[], today: string): string {
  const ordered = [...days].sort((a, b) => a.businessDate.localeCompare(b.businessDate));
  const target = addDays(today, -1);
  const day = ordered.find((item) => item.businessDate === target) ?? null;
  if (!day && intent.kind !== "mtd") {
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
  if (intent.kind === "mtd") return mtdAnswer(ordered, day?.businessDate ?? target);
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

function totalAnswer(day: LoadedDay, target: string): string {
  return [`Sales for ${formatBusinessDate(target)}.`, sourceLine(day), totalSentence(day), ...day.lines.map((line) => lineSentence(line, day.currency))].join("\n");
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
  const week = ordered.find((item) => item.businessDate === addDays(day.businessDate, -7));
  const priorLine = week?.lines.find((item) => item.locationName === line.locationName) ?? null;
  const bits = [
    `${line.locationName} on ${formatBusinessDate(day.businessDate)}: ${figure(line, day.currency)}.`,
    budgetPhrase(line, day.currency),
    line.treatments != null ? `${line.treatments} treatments are recorded.` : "",
    priorLine ? changePhrase(line, priorLine, day.currency, week!.businessDate) : `There is no record for ${formatBusinessDate(addDays(day.businessDate, -7))}.`,
    sourceLine(day),
  ];
  return bits.filter(Boolean).join(" ");
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
  if (day.source === "import") return "Source: imported file. This was not a live DSR extract.";
  return "Source: stored DSR extract.";
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
  if (source === "import") return "Imported file";
  return "DSR extract";
}
