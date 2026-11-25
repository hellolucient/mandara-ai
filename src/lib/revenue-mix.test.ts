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