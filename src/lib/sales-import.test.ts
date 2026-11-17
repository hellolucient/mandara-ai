import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatImportConfirmation, importTotals } from "./sales-import.js";

describe("formatImportConfirmation", () => {
  it("formats the 16 Nov 2026 import the way the dialog should show it", () => {
    assert.equal(
      formatImportConfirmation({ businessDate: "2026-11-16", locations: 10, netSales: 7819.46 }),
      "Saved 16 Nov 2026 · 10 spas · $7,819",
    );
  });

  it("uses a singular spa label and does not shift the date", () => {
    assert.equal(
      formatImportConfirmation({ businessDate: "2026-01-01", locations: 1, netSales: 0 }),
      "Saved 1 Jan 2026 · 1 spa · $0",
    );
  });
});

describe("importTotals", () => {
  it("counts every row and sums known net sales", () => {
    assert.deepEqual(
      importTotals([{ netSales: 1235.51 }, { netSales: null }, { netSales: 6583.95 }]),
      { locations: 3, netSales: 7819.46 },
    );
  });
});
