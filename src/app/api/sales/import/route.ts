import { canManage } from "@/lib/members";
import { importTotals } from "@/lib/sales-import";
import { isItemLinesImport, validateItemLinesExtract } from "@/lib/sales-item-validate";
import { saveItemLines } from "@/lib/sales-item-store";
import { isPromotionsImport, validatePromotionsExtract } from "@/lib/promo-validate";
import { savePromotions } from "@/lib/promo-store";
import { parseCsv, validateExtract } from "@/lib/sales-validate";
import { saveExtract } from "@/lib/sales-store";
import { json, rejectCrossOrigin } from "@/lib/http";
import { isResponse, requireMember } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const blocked = rejectCrossOrigin(request);
  if (blocked) return blocked;
  const member = await requireMember(request);
  if (isResponse(member)) return member;
  if (!canManage(member.role)) return json({ error: "A manager or administrator can import sales." }, 403);
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const raw = await request.text();
    if (raw.length > 500_000) return json({ error: "That file is too large." }, 413);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return json({ error: "The file was not valid JSON." }, 400);
    }
    if (isItemLinesImport(parsed)) return storeItemLines(member.stage, parsed);
    if (isPromotionsImport(parsed)) return storePromotionsResponse(member.stage, parsed);
    const validated = validateExtract(parsed);
    if (!validated.ok) return json({ error: validated.error }, 422);
    await saveExtract(member.stage, validated.extract, "import");
    const totals = importTotals(validated.extract.rows);
    return json({
      ok: true,
      kind: "totals",
      issues: validated.extract.issues,
      businessDate: validated.extract.businessDate,
      locations: totals.locations,
      netSales: totals.netSales,
    });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "Choose a CSV or JSON file." }, 400);
  if (file.size > 500_000) return json({ error: "That file is too large." }, 413);
  const text = await file.text();
  if (file.name.toLowerCase().endsWith(".json")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return json({ error: "The file was not valid JSON." }, 400);
    }
    if (isItemLinesImport(parsed)) return storeItemLines(member.stage, parsed);
    if (isPromotionsImport(parsed)) return storePromotionsResponse(member.stage, parsed);
    const validated = validateExtract(parsed);
    if (!validated.ok) return json({ error: validated.error }, 422);
    await saveExtract(member.stage, validated.extract, "import");
    const totals = importTotals(validated.extract.rows);
    return json({
      ok: true,
      kind: "totals",
      issues: validated.extract.issues,
      businessDate: validated.extract.businessDate,
      locations: totals.locations,
      netSales: totals.netSales,
    });
  }
  const validated = parseCsv(text);
  if (!validated.ok) return json({ error: validated.error }, 422);
  await saveExtract(member.stage, validated.extract, "import");
  const totals = importTotals(validated.extract.rows);
  return json({
    ok: true,
    kind: "totals",
    issues: validated.extract.issues,
    businessDate: validated.extract.businessDate,
    locations: totals.locations,
    netSales: totals.netSales,
  });
}

async function storePromotionsResponse(stage: string, parsed: unknown) {
  const validated = validatePromotionsExtract(parsed);
  if (!validated.ok) return json({ error: validated.error }, 422);
  const saved = await savePromotions(stage, validated.extract);
  return json({
    ok: true,
    kind: "promotions",
    issues: validated.extract.issues,
    periodFrom: validated.extract.periodFrom,
    periodTo: validated.extract.periodTo,
    promoKind: validated.extract.kind,
    locations: saved.spas,
    lines: saved.lines,
    netSales: validated.extract.totals.totalUsd,
  });
}

async function storeItemLines(stage: string, parsed: unknown) {
  const validated = validateItemLinesExtract(parsed);
  if (!validated.ok) return json({ error: validated.error }, 422);
  const saved = await saveItemLines(stage, validated.extract);
  const treatmentSales = validated.extract.items
    .filter((i) => i.category === "treatment")
    .reduce((s, i) => s + i.netSales, 0);
  const retailSales = validated.extract.items
    .filter((i) => i.category === "retail")
    .reduce((s, i) => s + i.netSales, 0);
  return json({
    ok: true,
    kind: "items",
    issues: validated.extract.issues,
    businessDate: validated.extract.businessDate,
    locations: saved.locations,
    lines: saved.lines,
    treatmentSales,
    retailSales,
  });
}
