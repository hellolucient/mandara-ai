import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatPromoSegmentCaption } from "@/lib/promo-bar-labels";
import {
  formatVariancePct,
  fullMonthsBeforeAsOf,
  fullMonthsBeforeAsOfLastYear,
  lyMtdRange,
  variance,
} from "@/lib/spa-comparison";

describe("spa comparison dates", () => {
  it("builds LY MTD range aligned to calendar day", () => {
    assert.deepEqual(lyMtdRange("2026-11-24"), { from: "2025-11-01", to: "2025-11-24" });
  });

  it("lists full months before November for YTD chunks", () => {
    const months = fullMonthsBeforeAsOf("2026-11-24");
    assert.equal(months.length, 10);
    assert.deepEqual(months[0], { from: "2026-01-01", to: "2026-01-31" });
    assert.deepEqual(months[9], { from: "2026-10-01", to: "2026-10-31" });
    assert.deepEqual(fullMonthsBeforeAsOfLastYear("2026-11-24")[9], {
      from: "2025-10-01",
      to: "2025-10-31",
    });
  });
});

describe("spa comparison variance", () => {
  it("formats variance pct and handles null LY", () => {
    assert.deepEqual(variance(120, 100), { usd: 20, pct: 20 });
    assert.equal(formatVariancePct(null), "n/a");
    assert.equal(formatPromoSegmentCaption(100, 25), "$100  (25%)");
  });
});