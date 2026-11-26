import assert from "node:assert/strict";
import test from "node:test";
import { buildRevenueMixPeriod } from "@/lib/revenue-mix";
import type { StoredItemLine } from "@/lib/sales-item-types";

test("buildRevenueMixPeriod groups treatment and retail slices", () => {
  const lines: StoredItemLine[] = [
    {
      id: "1",
      businessDate: "2026-11-20",
      locationId: "vadoo",
      locationName: "Vadoo",
      category: "treatment",
      itemName: "Balinese Massage 60",
      quantity: 2,
      netSales: 240,
      currency: "USD",
    },
    {
      id: "2",
      businessDate: "2026-11-20",
      locationId: "vadoo",
      locationName: "Vadoo",
      category: "retail",
      itemName: "mandara mango massage & body oil 100ml",
      quantity: 1,
      netSales: 45,
      currency: "USD",
    },
  ];
  const period = buildRevenueMixPeriod(lines);
  assert.equal(period.treatmentTotal, 240);
  assert.equal(period.retailTotal, 45);
  assert.ok(period.treatmentSlices.some((s) => s.id === "Body of Mandara"));
  assert.ok(period.retailSlices.some((s) => s.label.includes("Mandara")));
});
test("composeRangeItemLines uses the Statistic range then later DSR days only", async () => {
  const { composeRangeItemLines } = await import("@/lib/revenue-mix-view");
  const mk = (businessDate: string, category: "treatment" | "retail", netSales: number, periodFrom?: string): StoredItemLine => ({
    id: `${businessDate}-${category}-${netSales}`,
    businessDate,
    periodFrom: periodFrom ?? null,
    locationId: "hakuraa-huraa",
    locationName: "Hakuraa Huraa",
    category,
    itemName: category === "treatment" ? "Balinese Massage 60" : "elemis cleansing balm",
    quantity: 1,
    netSales,
    currency: "USD",
  });
  const periodLines = [mk("2026-11-24", "treatment", 48548, "2026-11-01"), mk("2026-11-24", "retail", 3256, "2026-11-01")];
  const daily = [mk("2026-11-23", "treatment", 1500), mk("2026-11-24", "treatment", 3200), mk("2026-11-25", "treatment", 3213), mk("2026-11-25", "retail", 38)];
  const { lines, coveredTo } = composeRangeItemLines(periodLines, daily, "2026-11-01", "2026-11-25");
  assert.equal(coveredTo.treatment, "2026-11-24");
  const period = buildRevenueMixPeriod(lines);
  assert.equal(period.treatmentTotal, 48548 + 3213);
  assert.equal(period.retailTotal, 3256 + 38);
});

test("retail brand falls back to the Statistic supplier when the SKU has no known prefix", async () => {
  const { mapRetailBrand } = await import("@/lib/item-groups");
  assert.equal(mapRetailBrand("tropical sunscreen lotion", { itemCode: "X1", supplier: "We Are Feel Good Inc" }), "We Are Feel Good");
  assert.equal(mapRetailBrand("some balm", { itemCode: "", supplier: "Elemis" }), "Elemis");
  assert.equal(mapRetailBrand("moringa oil", { itemCode: "MOR1", supplier: "Moringa" }), "Unmapped");
});
