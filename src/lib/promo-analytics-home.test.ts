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
describe("MTD promo coverage (range report + later single days)", () => {
  const line = (periodFrom: string, periodTo: string, promoCode: string, usd: number): StoredPromoLine => ({
    kind: "treatment",
    locationId: "hakuraa-huraa",
    locationName: "Hakuraa Huraa",
    promoCode,
    description: "",
    qty: 1,
    usd,
    periodFrom,
    periodTo,
  });

  it("uses the 1–24 range plus 25th single day, without double counting the 24th", () => {
    const lines = [
      line("2026-11-01", "2026-11-24", "MC", 24341.93),
      line("2026-11-01", "2026-11-24", "RI15", 13873.54),
      line("2026-11-24", "2026-11-24", "MC", 543.15),
      line("2026-11-25", "2026-11-25", "MC", 2172.57),
    ];
    const rows = buildSpaCategoryBarsForDateRange(lines, "2026-11-01", "2026-11-25");
    assert.equal(rows.length, 1);
    assert.equal(Math.round(rows[0]!.totalUsd * 100) / 100, 40388.04);
  });

  it("ignores range reports that do not start on the range start or end after it", () => {
    const lines = [
      line("2026-10-01", "2026-10-31", "MC", 9999),
      line("2026-11-01", "2026-11-30", "MC", 8888),
      line("2026-11-25", "2026-11-25", "MC", 100),
    ];
    const rows = buildSpaCategoryBarsForDateRange(lines, "2026-11-01", "2026-11-25");
    assert.equal(rows[0]?.totalUsd, 100);
  });
});
