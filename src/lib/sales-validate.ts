import type { SalesExtract } from "@/lib/sales-types";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function nullableNumber(value: unknown): { ok: true; value: number | null } | { ok: false } {
  if (value == null || value === "") return { ok: true, value: null };
  if (typeof value === "number" && Number.isFinite(value)) return { ok: true, value };
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return { ok: true, value: Number(value) };
  }
  return { ok: false };
}

export function validateExtract(input: unknown): { ok: true; extract: SalesExtract } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "The extract was not an object." };
  const record = input as Record<string, unknown>;
  const businessDate = typeof record.businessDate === "string" ? record.businessDate : "";
  if (!DATE.test(businessDate) || Number.isNaN(Date.parse(`${businessDate}T00:00:00Z`))) {
    return { ok: false, error: "businessDate must be a real YYYY-MM-DD date." };
  }
  const currency = typeof record.currency === "string" && /^[A-Z]{3}$/.test(record.currency)
    ? record.currency
    : "USD";
  if (!Array.isArray(record.rows) || record.rows.length === 0 || record.rows.length > 100) {
    return { ok: false, error: "The extract needs between 1 and 100 location rows." };
  }
  const issues: string[] = [];
  const rows = [];
  const seen = new Set<string>();
  for (const row of record.rows) {
    if (!row || typeof row !== "object") return { ok: false, error: "A row was not an object." };
    const item = row as Record<string, unknown>;
    const location = typeof item.location === "string" ? item.location.trim() : "";
    if (!location || location.length > 120) return { ok: false, error: "Each row needs a location name." };
    const key = location.toLowerCase();
    if (seen.has(key)) return { ok: false, error: `Duplicate location: ${location}.` };
    seen.add(key);
    const net = nullableNumber(item.netSales);
    const treatments = nullableNumber(item.treatments);
    const budget = nullableNumber(item.budget);
    if (!net.ok || !treatments.ok || !budget.ok) {
      return { ok: false, error: `${location} has a value that is not a number.` };
    }
    let netSales = net.value;
    let treatmentCount = treatments.value == null ? null : Math.round(treatments.value);
    let budgetValue = budget.value;
    if (netSales != null && netSales < 0) {
      issues.push(`${location}: net sales ${netSales} is negative and was not stored.`);
      netSales = null;
    }
    if (treatmentCount != null && treatmentCount < 0) {
      issues.push(`${location}: treatments were negative and were not stored.`);
      treatmentCount = null;
    }
    if (budgetValue != null && budgetValue < 0) {
      issues.push(`${location}: budget was negative and was not stored.`);
      budgetValue = null;
    }
    if (netSales == null) issues.push(`${location}: net sales are missing.`);
    rows.push({ location, netSales, treatments: treatmentCount, budget: budgetValue });
  }
  if (rows.every((row) => row.netSales == null)) {
    return { ok: false, error: "Every location is missing net sales, so nothing was stored." };
  }
  return {
    ok: true,
    extract: {
      businessDate,
      currency,
      rows,
      issues,
      complete: issues.length === 0,
    },
  };
}

export function parseCsv(text: string): { ok: true; extract: SalesExtract } | { ok: false; error: string } {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return { ok: false, error: "The CSV needs a header and at least one row." };
  const header = splitCsvLine(lines[0]).map((cell) => cell.trim().toLowerCase());
  const dateIndex = header.indexOf("business_date");
  const locationIndex = header.indexOf("location");
  const salesIndex = header.indexOf("net_sales");
  const treatmentsIndex = header.indexOf("treatments");
  const budgetIndex = header.indexOf("budget");
  if (dateIndex < 0 || locationIndex < 0 || salesIndex < 0) {
    return { ok: false, error: "The CSV header must include business_date, location and net_sales." };
  }
  const dates = new Set<string>();
  const rows = [];
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const businessDate = cells[dateIndex]?.trim() ?? "";
    dates.add(businessDate);
    rows.push({
      location: cells[locationIndex]?.trim() ?? "",
      netSales: cells[salesIndex]?.trim() ?? "",
      treatments: treatmentsIndex >= 0 ? cells[treatmentsIndex]?.trim() ?? "" : "",
      budget: budgetIndex >= 0 ? cells[budgetIndex]?.trim() ?? "" : "",
    });
  }
  if (dates.size !== 1) return { ok: false, error: "Import one business date per file." };
  return validateExtract({ businessDate: [...dates][0], currency: "USD", rows });
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}
