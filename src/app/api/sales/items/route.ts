import { aggregateItemLines, loadItemLinesForSpa, spaDayTotalsFromSales, spaRangeTotalsFromSales } from "@/lib/sales-item-store";
import { parseItemsQuery } from "@/lib/sales-items-query";
import { json, rejectCrossOrigin } from "@/lib/http";
import { isResponse, requireMember } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const blocked = rejectCrossOrigin(request);
  if (blocked) return blocked;
  const member = await requireMember(request);
  if (isResponse(member)) return member;

  const url = new URL(request.url);
  const locationId = url.searchParams.get("locationId")?.trim() ?? "";
  if (!locationId) return json({ error: "locationId is required." }, 400);

  const parsed = parseItemsQuery({
    date: url.searchParams.get("date") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });
  if (!parsed.ok) return json({ error: parsed.error }, parsed.status);
  const { fromDate, toDate, mode } = parsed;

  const lines = await loadItemLinesForSpa(member.stage, locationId, fromDate, toDate);
  const { treatments, retail } = aggregateItemLines(lines, mode === "day");
  const itemTreatmentTotal = treatments.reduce((s, r) => s + r.netSales, 0);
  const itemRetailTotal = retail.reduce((s, r) => s + r.netSales, 0);
  const hasItems = lines.length > 0;

  const currency = lines[0]?.currency ?? null;
  let spaTreatment: number | null = null;
  let spaRetail: number | null = null;
  let resolvedCurrency = currency ?? "USD";

  if (mode === "day") {
    const totals = await spaDayTotalsFromSales(member.stage, locationId, fromDate);
    if (totals) {
      spaTreatment = totals.treatment_sales;
      spaRetail = totals.retail_sales;
      resolvedCurrency = totals.currency;
    }
  } else {
    const totals = await spaRangeTotalsFromSales(member.stage, locationId, fromDate, toDate);
    if (totals) {
      spaTreatment = totals.treatment;
      spaRetail = totals.retail;
      resolvedCurrency = totals.currency;
    }
  }

  const locationName = lines[0]?.locationName ?? null;
  const mismatch: { treatment?: number; retail?: number } = {};
  if (hasItems && spaTreatment != null && Math.abs(itemTreatmentTotal - spaTreatment) > 1) {
    mismatch.treatment = itemTreatmentTotal - spaTreatment;
  }
  if (hasItems && spaRetail != null && Math.abs(itemRetailTotal - spaRetail) > 1) {
    mismatch.retail = itemRetailTotal - spaRetail;
  }

  return json({
    locationId,
    locationName,
    mode,
    fromDate,
    toDate,
    currency: resolvedCurrency,
    spaTreatmentTotal: spaTreatment,
    spaRetailTotal: spaRetail,
    itemTreatmentTotal: hasItems ? itemTreatmentTotal : null,
    itemRetailTotal: hasItems ? itemRetailTotal : null,
    hasItems,
    treatments,
    retail,
    mismatch: Object.keys(mismatch).length ? mismatch : null,
  });
}