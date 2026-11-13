import { formatBusinessDate } from "@/lib/dates";
import { openDsrSession, type DsrFetch } from "@/lib/dsr-probe";
import type { SalesExtract } from "@/lib/sales-types";
import { validateExtract } from "@/lib/sales-validate";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TOTAL_ACTUAL = 18;
const TOTAL_FORECAST = 19;
const TREATMENT_GUESTS = 2;
const MALDIVES_GROUP = "MDV";

export type DailyRead =
  | { ok: true; extract: SalesExtract; note: string }
  | { ok: false; note: string };

export async function readMaldivesDaily(businessDate: string, fetchImpl: DsrFetch = fetch): Promise<DailyRead> {
  if (!DATE.test(businessDate)) return { ok: false, note: "The business date was not a real date. No figures were stored." };
  const session = await openDsrSession(fetchImpl);
  if (!session.ok) return { ok: false, note: session.probe.note };
  const [year, month, day] = businessDate.split("-");
  let posted: { status: number; body: string };
  try {
    posted = await session.post(
      "r_statdsr_e.php",
      {
        rpt: "dsr_daily",
        grp1: MALDIVES_GROUP,
        mm: month,
        yy: year,
        tgl1: `${day}-${month}-${year}`,
        refer: "stat",
        output: "SCREEN",
        prdtype: "",
        sublevel: "1",
        seed: String(Math.floor(Math.random() * 10023)),
        userid: session.userid,
      },
      25_000,
    );
  } catch {
    return { ok: false, note: "Signed in, but the daily DSR did not respond. No figures were stored." };
  }
  if (posted.status < 200 || posted.status >= 300 || !posted.body) {
    return { ok: false, note: "Signed in, but the daily DSR did not respond. No figures were stored." };
  }
  if (/type="password"|name="pin"/i.test(posted.body)) {
    return { ok: false, note: "The sign-in did not hold for the report request. No figures were stored." };
  }
  const parsed = parseDailyDsr(posted.body, businessDate);
  if (!parsed.ok) return parsed;
  const validated = validateExtract(parsed.extract);
  if (!validated.ok) return { ok: false, note: `${validated.error} No figures were stored.` };
  const count = validated.extract.rows.length;
  return {
    ok: true,
    extract: validated.extract,
    note: `Signed in. Stored the Maldives daily DSR for ${formatBusinessDate(businessDate)}: ${count} location${count === 1 ? "" : "s"}.`,
  };
}

export function parseDailyDsr(html: string, businessDate: string): DailyRead {
  if (!/\(USD\)/i.test(html)) {
    return { ok: false, note: "The daily DSR did not say which currency it uses. No figures were stored." };
  }
  const statAt = html.search(/left-menu">\s*Statistical/i);
  const revenueHtml = statAt >= 0 ? html.slice(0, statAt) : html;
  const statHtml = statAt >= 0 ? html.slice(statAt) : "";
  const spas = [...revenueHtml.matchAll(/statdsr_spaid\('([^']+)',\s*'rev'\)">([^<]+)/gi)].map((match) => ({
    id: match[1],
    location: spaName(match[2]),
  }));
  if (spas.length === 0) return { ok: false, note: "The daily DSR did not list any spas. No figures were stored." };
  const revenueRows = numericRows(revenueHtml);
  const aligned = revenueRows.length === spas.length + 1 ? revenueRows.slice(0, -1) : revenueRows;
  if (aligned.length !== spas.length) {
    return { ok: false, note: "The daily DSR table did not line up with the spa list. No figures were stored." };
  }
  const guestRows = numericRows(statHtml);
  const guests = guestRows.length === spas.length + 1 ? guestRows.slice(0, -1) : guestRows;
  const guestIssue = guests.length === spas.length ? "" : "Treatment guest counts did not line up, so they were left blank.";
  const rows = spas.map((spa, index) => ({
    location: spa.location,
    netSales: numberCell(aligned[index]?.[TOTAL_ACTUAL] ?? ""),
    treatments: guests.length === spas.length ? wholeCell(guests[index]?.[TREATMENT_GUESTS] ?? "") : null,
    budget: numberCell(aligned[index]?.[TOTAL_FORECAST] ?? ""),
  }));
  return {
    ok: true,
    extract: {
      businessDate,
      currency: "USD",
      rows,
      issues: guestIssue ? [guestIssue] : [],
      complete: !guestIssue && rows.every((row) => row.netSales != null),
    },
    note: "",
  };
}

function spaName(label: string): string {
  const text = label.replace(/\s+/g, " ").trim();
  const comma = text.indexOf(",");
  const name = comma >= 0 ? text.slice(comma + 1).trim() : text;
  return name || text;
}

function numericRows(html: string): string[][] {
  const rows: string[][] = [];
  for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => cellText(cell[1]));
    if (cells.length < 15) continue;
    const filled = cells.filter((cell) => cell !== "");
    if (filled.length < 4) continue;
    if (!filled.every((cell) => /^-?\d[\d,]*(?:\.\d+)?$/.test(cell))) continue;
    rows.push(cells);
  }
  return rows;
}

function numberCell(value: string): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function wholeCell(value: string): number | null {
  const parsed = numberCell(value);
  return parsed == null ? null : Math.round(parsed);
}

function cellText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}
