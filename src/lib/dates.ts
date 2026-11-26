export const BUSINESS_ZONE = "Indian/Maldives";

export function businessToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * Month-to-date window for Home dashboard figures.
 * Always the calendar month of the latest loaded DSR business date, through that date —
 * never the calendar month of "today". On the 1st of a new month, before that month's
 * first DSR is in, every panel still shows the previous month.
 */
export function mtdPeriodFromLatest(latestDate: string): { monthKey: string; from: string; to: string } {
  const monthKey = latestDate.slice(0, 7);
  return { monthKey, from: `${monthKey}-01`, to: latestDate };
}

export function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

export function formatBusinessDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatMaldives(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return `${formatted} Maldives`;
}

export function money(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${Math.round(value).toLocaleString("en-US")}`;
  }
}

export function percent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

/** "Sat 21 Nov" for a business date, used in dashboard column headings. */
export function shortWeekdayDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

/**
 * Headings for the latest DSR day on the Home By spa table.
 * "Yesterday" when that day is the calendar day before today; otherwise the actual date.
 */
export function latestDayColumnLabels(latestDate: string, today: string): {
  treatment: string;
  retail: string;
  day: string;
  summary: string;
} {
  const isYesterday = latestDate === addDays(today, -1);
  const day = isYesterday ? "Yesterday" : shortWeekdayDate(latestDate);
  return {
    treatment: `${day} treatment`,
    retail: `${day} retail`,
    day,
    summary: isYesterday ? "Yesterday's treatment and retail" : `Treatment and retail · ${day}`,
  };
}

