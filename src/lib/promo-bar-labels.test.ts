import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatPromoSegmentCaption,
  planPromoBarSegmentLabels,
  PROMO_IN_BAR_LABEL_MIN_PCT,
} from "@/lib/promo-bar-labels";

describe("promo bar labels", () => {
  it("formats dollar and percent caption", () => {
    assert.equal(formatPromoSegmentCaption(1310, 59.6), "$1,310 · 60%");
    assert.equal(formatPromoSegmentCaption(42, 4.2), "$42 · 4%");
  });

  it("plans in-bar vs breakdown segments on desktop", () => {
    const plan = planPromoBarSegmentLabels(
      [
        { id: "a", label: "Category A", color: "#000", usd: 1310 },
        { id: "b", label: "Category B", color: "#111", usd: 200 },
      ],
      1510,
    );
    assert.equal(plan.length, 2);
    const large = plan.find((p) => p.id === "a");
    assert.ok(large && large.showInBar);
    const small = plan.find((p) => p.id === "b");
    assert.ok(small && !small.showInBar);
    assert.ok(small.sharePct < PROMO_IN_BAR_LABEL_MIN_PCT);
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