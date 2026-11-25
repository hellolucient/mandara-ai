import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatPromoSegmentCaption,
  planPromoBarSegmentLabels,
  PROMO_IN_BAR_LABEL_MIN_PCT,
} from "@/lib/promo-bar-labels";

describe("promo bar labels", () => {
  it("formats dollar and percent caption", () => {
    assert.equal(formatPromoSegmentCaption(1310, 59.6), "$1,310  (60%)");
    assert.equal(formatPromoSegmentCaption(42, 4.2), "$42  (4%)");
    assert.equal(formatPromoSegmentCaption(1496, 69.2), "$1,496  (69%)");
  });

  it("plans in-bar vs breakdown segments on desktop", () => {
    const plan = planPromoBarSegmentLabels(
      [
        { id: "elemis", label: "Elemis", color: "#000", usd: 80 },
        { id: "enhancements", label: "Enhancements", color: "#111", usd: 50 },
        { id: "tiny", label: "Tiny", color: "#222", usd: 20 },
        { id: "rest", label: "Rest", color: "#333", usd: 850 },
      ],
      1000,
    );
    assert.equal(plan.length, 4);
    const eight = plan.find((p) => p.id === "elemis");
    const five = plan.find((p) => p.id === "enhancements");
    const under = plan.find((p) => p.id === "tiny");
    assert.ok(eight && eight.showInBar);
    assert.equal(Math.round(eight.sharePct), 8);
    assert.ok(five && five.showInBar);
    assert.equal(Math.round(five.sharePct), 5);
    assert.ok(under && !under.showInBar);
    assert.ok(under.sharePct < PROMO_IN_BAR_LABEL_MIN_PCT);
  });

  it("forces all segments to breakdown on mobile", () => {
    const plan = planPromoBarSegmentLabels(
      [{ id: "a", label: "Category A", color: "#000", usd: 900 }],
      1000,
      { forceBreakdown: true },
    );
    assert.equal(plan[0]?.showInBar, false);
  });
});