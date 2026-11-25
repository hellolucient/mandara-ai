import { mapStatisticSpaName, STATISTIC_CLOSED_SPAS } from "@/lib/statistic-period-locations";

export type PeriodKind = "treatment" | "retail";

export type ParsedPeriodItem = {
  itemCode: string;
  itemName: string;
  supplier: string;
  location: string;
  qty: number;
  nett: number;
};

export type ParsedPeriodFile = {
  periodFrom: string;
  periodTo: string;
  kind: PeriodKind;
  items: ParsedPeriodItem[];
  issues: string[];
};

const FILENAME =
  /^stat_(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})_(Treatment|Retail)\.txt$/i;

const FOOTER_MARKERS = new Set([
  "total qty",
  "qty",
  "guest",
  "avg. price",
  "nett",
  "tax",
  "service",
  "total usd",
  "total",
  "supplier",
]);

export function parsePeriodFilename(filename: string): { periodFrom: string; periodTo: string; kind: PeriodKind } | null {
  const base = filename.split(/[/\\]/).pop() ?? filename;
  const match = base.match(FILENAME);
  if (!match) return null;
  return {
    periodFrom: match[1],
    periodTo: match[2],
    kind: match[3].toLowerCase() as PeriodKind,
  };
}

function parseNumber(value: string): number {
  const text = value.trim().replace(/,/g, "");
  if (!text) return 0;
  const n = Number(text);
  return Number.isFinite(n) ? n : 0;
}

function splitRow(line: string): string[] {
  return line.split("\t").map((cell) => cell.trim());
}

type SpaColumn = { headerName: string; location: string; qtyIndex: number; usdIndex: number };

export function parseStatisticPeriodText(
  text: string,
  meta: { periodFrom: string; periodTo: string; kind: PeriodKind },
): ParsedPeriodFile {
  const issues: string[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l.length > 0);
  if (lines.length < 2) {
    return { ...meta, items: [], issues: ["File had no data rows."] };
  }

  const header = splitRow(lines[0]);
  const spaColumns: SpaColumn[] = [];
  for (let i = 0; i < header.length - 1; i++) {
    const h = header[i];
    if (/ qty$/i.test(h) && /^.+ usd$/i.test(header[i + 1] ?? "")) {
      const rawName = h.replace(/\s+qty$/i, "");
      spaColumns.push({
        headerName: rawName,
        location: mapStatisticSpaName(rawName),
        qtyIndex: i,
        usdIndex: i + 1,
      });
    }
  }
  if (spaColumns.length === 0) {
    return { ...meta, items: [], issues: ["No spa qty/usd column pairs found in header."] };
  }

  const supplierIndex = header.findIndex((h) => h.toLowerCase() === "supplier");
  const items: ParsedPeriodItem[] = [];
  const spaNonZero = new Map<string, boolean>();
  for (const col of spaColumns) spaNonZero.set(col.location, false);

  for (let rowIndex = 1; rowIndex < lines.length; rowIndex++) {
    const cells = splitRow(lines[rowIndex]);
    const first = (cells[0] ?? "").toLowerCase();
    if (first === "total" || first.startsWith("total ")) break;
    if (FOOTER_MARKERS.has(first)) break;
    if (!/^\d+\./.test(cells[0] ?? "")) continue;

    const itemCode = cells[1] ?? "";
    const itemName = cells[2] ?? "";
    const supplier =
      meta.kind === "retail" && supplierIndex >= 0 ? (cells[supplierIndex] ?? "").trim() : "";

    for (const col of spaColumns) {
      if (STATISTIC_CLOSED_SPAS.has(col.location)) {
        const q = parseNumber(cells[col.qtyIndex] ?? "");
        const usd = parseNumber(cells[col.usdIndex] ?? "");
        if (q !== 0 || usd !== 0) spaNonZero.set(col.location, true);
        if (!spaNonZero.get(col.location)) continue;
      }
      const qty = parseNumber(cells[col.qtyIndex] ?? "");
      const nett = parseNumber(cells[col.usdIndex] ?? "");
      if (qty === 0 && nett === 0) continue;
      items.push({
        itemCode,
        itemName,
        supplier,
        location: col.location,
        qty,
        nett,
      });
    }
  }

  return { periodFrom: meta.periodFrom, periodTo: meta.periodTo, kind: meta.kind, items, issues };
}

export function parseStatisticPeriodFile(
  text: string,
  filename: string,
): { ok: true; parsed: ParsedPeriodFile } | { ok: false; error: string } {
  const meta = parsePeriodFilename(filename);
  if (!meta) {
    return {
      ok: false,
      error: "Filename must be stat_YYYY-MM-DD_YYYY-MM-DD_Treatment.txt or _Retail.txt",
    };
  }
  const parsed = parseStatisticPeriodText(text, meta);
  return { ok: true, parsed };
}