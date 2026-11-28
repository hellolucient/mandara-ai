import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allSpasCategoryBar,
  buildSpaCategoryBarsForDateRange,
  formatHomePromoHeading,
  withPromoReconciliation,
} from "@/lib/promo-analytics";
import type { StoredPromoLine } from "@/lib/promo-types";
import type { LoadedDay } from "@/lib/sales-types";

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

describe("Promotions section shows promotions only and reconciles to revenue (Tenille Keats, 28 Nov 2026)", () => {
  const promo = (spa: string, code: string, usd: number, day = "2026-11-01"): StoredPromoLine => ({
    kind: "treatment",
    locationId: spa.toLowerCase(),
    locationName: spa,
    promoCode: code,
    description: "",
    qty: 1,
    usd,
    periodFrom: day,
    periodTo: day,
  });
  const day = (businessDate: string, lines: Array<[string, number, number]>): LoadedDay => ({
    businessDate,
    source: "dsr",
    currency: "USD",
    complete: true,
    note: "",
    lines: lines.map(([locationName, netSales, retailSales]) => ({
      locationId: locationName.toLowerCase(),
      locationName,
      netSales,
      treatments: netSales - retailSales,
      budget: null,
      treatmentSales: netSales - retailSales,
      retailSales,
    })),
  });

  it("leaves Full Price (FP, MV, GM, LWR) out of the bars and the promotions total", () => {
    const lines = [promo("Vadoo", "RI15", 100), promo("Vadoo", "CR50", 50), promo("Vadoo", "FP", 400), promo("Vadoo", "LWR", 20), promo("Vadoo", "MV", 30)];
    const [row] = buildSpaCategoryBarsForDateRange(lines, "2026-11-01", "2026-11-01");
    assert.equal(row?.totalUsd, 150);
    assert.equal(row?.fullPriceUsd, 450);
    assert.ok(row?.slices.every((s) => s.segment === "discount"));
    assert.equal(row?.slices.reduce((s, x) => s + x.usd, 0), 150);
  });

  it("splits revenue into promotions + full price + retail + other treatments that add up exactly", () => {
    const lines = [promo("Vadoo", "RI15", 100), promo("Vadoo", "FP", 400)];
    const days = [day("2026-11-01", [["Vadoo", 1000, 80]])];
    const [row] = withPromoReconciliation(buildSpaCategoryBarsForDateRange(lines, "2026-11-01", "2026-11-01"), days, "2026-11-01", "2026-11-01");
    const r = row!.reconciliation!;
    assert.deepEqual(r, { revenueUsd: 1000, promoUsd: 100, fullPriceUsd: 400, retailUsd: 80, otherTreatmentUsd: 420 });
    assert.equal(r.promoUsd + r.fullPriceUsd + r.retailUsd + r.otherTreatmentUsd, r.revenueUsd);
  });

  it("keeps a spa that has revenue but no promotion lines, and totals every spa", () => {
    const lines = [promo("Vadoo", "RI15", 100)];
    const days = [day("2026-11-01", [["Vadoo", 500, 50], ["Nasandhura", 300, 30]])];
    const rows = withPromoReconciliation(buildSpaCategoryBarsForDateRange(lines, "2026-11-01", "2026-11-01"), days, "2026-11-01", "2026-11-01");
    const nasa = rows.find((r) => r.spa === "Nasandhura");
    assert.equal(nasa?.totalUsd, 0);
    assert.equal(nasa?.reconciliation?.otherTreatmentUsd, 270);
    const all = allSpasCategoryBar(rows);
    assert.equal(all?.reconciliation?.revenueUsd, 800);
    assert.equal(all?.totalUsd, 100);
  });
});
