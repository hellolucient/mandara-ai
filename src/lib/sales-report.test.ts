import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { buildSalesReport } from "./sales-report";
import type { LoadedDay } from "./sales-types";

const day = (businessDate: string, lines: Array<[string, number | null, number | null, number | null, number | null]>): LoadedDay => ({
  businessDate,
  source: "import",
  currency: "USD",
  complete: true,
  note: "",
  lines: lines.map(([name, netSales, budget, treatments, retailSales]) => ({
    locationId: name.toLowerCase(),
    locationName: name,
    netSales,
    budget,
    treatments,
    retailSales,
  })),
});

describe("sales report for the PDF export", () => {
  const days = [
    day("2026-11-09", [["Dhonveli", 1000, 900, 10, null], ["Hakuraa", 2000, null, 12, null], ["Rannalhi", 500, 600, 5, null]]),
    day("2026-11-15", [["Dhonveli", 800, 900, 8, 50], ["Hakuraa", 1000, null, 10, 20], ["Rannalhi", 600, 600, 6, 10]]),
    day("2026-11-16", [["Dhonveli", 1200, 1000, 15, 78], ["Hakuraa", 1500, null, 15, 92], ["Rannalhi", null, 614, null, null]]),
  ];
  const report = buildSalesReport(days[2], days);

  it("totals net sales, guests and retail, and keeps missing figures missing", () => {
    assert.equal(report.totals.netSales, 2700);
    assert.equal(report.totals.guests, 30);
    assert.equal(report.totals.retailSales, 170);
    assert.equal(report.hasRetail, true);
    assert.equal(report.source, "Steiners DSR (imported)");
    const rannalhi = report.lines.find((line) => line.name === "Rannalhi");
    assert.equal(rannalhi?.netSales, null);
    assert.equal(rannalhi?.variance, null);
    assert.deepEqual(report.missing, ["Rannalhi"]);
  });

  it("works out variance only where a budget is stored", () => {
    assert.equal(report.lines[0].variance, 200);
    assert.equal(report.lines[0].variancePercent, 20);
    assert.equal(report.lines[1].variance, null);
    assert.equal(report.totals.variance, 200);
    assert.equal(report.totals.variancePercent, 20);
  });

  it("compares with the previous day and the same weekday last week", () => {
    assert.equal(report.previousDay?.netSales, 2400);
    assert.equal(report.weekEarlier?.netSales, 3500);
    assert.equal(Math.round((report.lines[0].weekChange ?? 0) * 10) / 10, 20);
    assert.equal(report.lines[1].weekChange, -25);
  });

  it("paces month to date against budget only for spa-days that have both", () => {
    assert.equal(report.monthToDate.days, 3);
    assert.equal(report.monthToDate.netSales, 8600);
    // Paired spa-days: Dhonveli 1000/900, Rannalhi 500/600, Dhonveli 800/900, Rannalhi 600/600, Dhonveli 1200/1000.
    assert.equal(report.monthToDate.budget, 4000);
    assert.ok(Math.abs((report.monthToDate.budgetPercent ?? 0) - 102.5) < 1e-9);
  });

  it("lists the needs-attention notes from the stored figures", () => {
    assert.ok(report.attention.some((note) => /Rannalhi has no sales figure/.test(note)));
  });

  it("gives the printable report the same access as the Sales page", () => {
    const print = readFileSync("src/app/print/sales/page.tsx", "utf8");
    const sales = readFileSync("src/app/(app)/sales/page.tsx", "utf8");
    assert.match(print, /const member = await currentMember\(\);\s+if \(!member\) return <SignedOut \/>;/);
    assert.match(print, /loadDays\(member\.stage\)/);
    assert.match(sales, /if \(!member\) redirect\("\/"\);/);
    assert.doesNotMatch(sales, /Treatments<\/th>/);
  });
});
