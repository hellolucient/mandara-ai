import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { isItemLinesImport, validateItemLinesExtract } from "./sales-item-validate";
import { aggregateItemLines } from "./sales-item-store";

describe("sales item lines import", () => {
  it("detects item-lines JSON by items array", () => {
    assert.equal(isItemLinesImport({ businessDate: "2026-11-01", items: [] }), true);
    assert.equal(isItemLinesImport({ businessDate: "2026-11-01", rows: [] }), false);
  });

  it("validates the fixture shape", () => {
    const raw = JSON.parse(readFileSync("fixtures/sales-item-lines-sample.json", "utf8"));
    const result = validateItemLinesExtract(raw);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.extract.businessDate, "2026-11-20");
    assert.equal(result.extract.items.length, 5);
    assert.equal(result.extract.items[0].category, "treatment");
    const mandara = result.extract.items.find((i) => i.name === "Mandara Body Lotion");
    assert.equal(mandara?.itemCode, "26MS01");
    assert.equal(mandara?.supplier, "Mandara Spa");
  });

  it("accepts sku alias and optional supplier", () => {
    const result = validateItemLinesExtract({
      businessDate: "2026-11-01",
      currency: "USD",
      items: [
        { location: "Vadoo", category: "retail", name: "Glow bath", quantity: 1, netSales: 10, sku: "26MS33" },
      ],
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.extract.items[0].itemCode, "26MS33");
  });

  it("rejects duplicate item keys on the same day", () => {
    const result = validateItemLinesExtract({
      businessDate: "2026-11-01",
      currency: "USD",
      items: [
        { location: "Vadoo", category: "treatment", name: "Massage", quantity: 1, netSales: 10 },
        { location: "Vadoo", category: "treatment", name: "Massage", quantity: 2, netSales: 20 },
      ],
    });
    assert.equal(result.ok, false);
  });

  it("aggregates range rows by name sorted by sales", () => {
    const { treatments, retail } = aggregateItemLines(
      [
        {
          id: "1",
          businessDate: "2026-11-01",
          locationId: "vadoo",
          locationName: "Vadoo",
          category: "treatment",
          itemName: "Massage A",
          quantity: 1,
          netSales: 50,
          currency: "USD",
        },
        {
          id: "2",
          businessDate: "2026-11-02",
          locationId: "vadoo",
          locationName: "Vadoo",
          category: "treatment",
          itemName: "Massage A",
          quantity: 2,
          netSales: 120,
          currency: "USD",
        },
        {
          id: "3",
          businessDate: "2026-11-02",
          locationId: "vadoo",
          locationName: "Vadoo",
          category: "retail",
          itemName: "Lotion",
          quantity: 1,
          netSales: 30,
          currency: "USD",
        },
      ],
      false,
    );
    assert.equal(treatments.length, 1);
    assert.equal(treatments[0].quantity, 3);
    assert.equal(treatments[0].netSales, 170);
    assert.equal(retail[0].netSales, 30);
  });
});