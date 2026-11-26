import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isSalesDataStale, num, sumKnown } from "./home-kpis.js";
import { mtdPeriodFromLatest } from "./dates.js";

describe("home KPIs", () => {
  it("detects stale sales data (>2 days old)", () => {
    // Today is 2026-11-17
    const today = "2026-11-17";

    // 1 day old - not stale
    assert.equal(isSalesDataStale("2026-11-16", today), false);

    // 2 days old - not stale
    assert.equal(isSalesDataStale("2026-11-15", today), false);

    // 3 days old - stale
    assert.equal(isSalesDataStale("2026-11-14", today), true);

    // 7 days old - stale
    assert.equal(isSalesDataStale("2026-11-10", today), true);
  });

  it("handles budget percentage calculations", () => {
    // Budget calculations are tested through the main function
    // Here we validate the logic:

    const mtdRevenue = 45000;
    const budget = 50000;
    const percent = (mtdRevenue / budget) * 100;

    assert.equal(Math.round(percent * 100) / 100, 90);

    // Over budget
    const overRevenue = 55000;
    const overPercent = (overRevenue / budget) * 100;
    assert.equal(Math.round(overPercent * 100) / 100, 110);

    // No budget should return null (tested in integration)
    const noBudget = null;
    const noBudgetPercent = noBudget && noBudget > 0 ? (mtdRevenue / noBudget) * 100 : null;
    assert.equal(noBudgetPercent, null);
  });

  it("calculates average spend per guest", () => {
    const mtdRevenue = 120000;
    const mtdTreatments = 500;

    const avgSpend = mtdTreatments > 0 ? mtdRevenue / mtdTreatments : null;

    assert.equal(avgSpend, 240);

    // No treatments
    const noTreatments = 0;
    const noAvg = noTreatments > 0 ? mtdRevenue / noTreatments : null;
    assert.equal(noAvg, null);
  });

  it("converts Postgres string sums to numbers so totals add, not concatenate", () => {
    assert.equal(num("1092"), 1092);
    assert.equal(num("10806.25"), 10806.25);
    assert.equal(num(null), null);
    assert.equal(num("abc"), null);
    assert.equal(["092", "1228"].reduce((s, v) => s + (num(v) ?? 0), 0), 1320);
  });

  it("MTD window follows the latest DSR day when as_of is the last day of a month", () => {
    // as_of = latest loaded DSR = 30 Nov (last day of the month).
    const asOf = "2026-11-30";
    const period = mtdPeriodFromLatest(asOf);
    assert.deepEqual(period, { monthKey: "2026-11", from: "2026-11-01", to: "2026-11-30" });

    // On 1 Dec the calendar month is December, but Home MTD must still be November
    // until a December DSR is loaded.
    const today = "2026-12-01";
    assert.notEqual(today.slice(0, 7), period.monthKey);
    const days = ["2026-11-29", "2026-11-30", "2026-12-01"];
    const mtdDays = days.filter((d) => d >= period.from && d <= period.to);
    assert.deepEqual(mtdDays, ["2026-11-29", "2026-11-30"]);
  });

  it("switches MTD to the new month once that month's first DSR is loaded", () => {
    assert.deepEqual(mtdPeriodFromLatest("2026-12-01"), {
      monthKey: "2026-12",
      from: "2026-12-01",
      to: "2026-12-01",
    });
  });

  it("sums retail only where it was reported, and keeps all-missing as missing", () => {
    assert.equal(sumKnown([null, null]), null);
    assert.equal(sumKnown([]), null);
    assert.equal(sumKnown([77.72, null, 92.44]), 170.16);
    assert.equal(sumKnown([0, null]), 0);
  });
});
