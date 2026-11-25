import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSpaCategoryBarsForDateRange, formatHomePromoHeading } from "@/lib/promo-analytics";
import type { StoredPromoLine } from "@/lib/promo-types";

describe("home promo headings", () => {
  it("formats MTD and daily titles", () => {
    assert.equal(formatHomePromoHeading("mtd", "2026-11-01", "2026-11-24"), "TREATMENT PROMOS · MTD 1–24 NOV 2026");
    assert.equal(formatHomePromoHeading("daily", "2026-11-24", "2026-11-24"), "TREATMENT PROMOS · 24 NOV 2026");
  });
});

describe("buildSpaCategoryBarsForDateRange", () => {
  it("aggregates single-day lines across the calendar range", () => {
    const lines: StoredPromoLine[] = [
      {
        kind: "treatment",
        locationName: "Ellaidhoo",
        promoCode: "RI15",
        description: "",
        qty: 1,
        usd: 50,
        periodFrom: "2026-11-01",
        periodTo: "2026-11-01",
      },
      {
        kind: "treatment",
        locationName: "Ellaidhoo",
        promoCode: "RI15",
        description: "",
        qty: 1,
        usd: 30,
        periodFrom: "2026-11-02",
        periodTo: "2026-11-02",
      },
    ];
    const rows = buildSpaCategoryBarsForDateRange(lines, "2026-11-01", "2026-11-05");
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.spa, "Ellaidhoo");
    assert.equal(rows[0]?.totalUsd, 80);
  });
});