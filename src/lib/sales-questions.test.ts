import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSalesQuestion } from "./sales-questions.js";

const LOCATIONS = ["Vadoo", "Hakuraa", "Dhonveli"];

describe("sales question parsing", () => {
  it("matches explicit sales queries", () => {
    assert.ok(parseSalesQuestion("What were sales yesterday?", LOCATIONS));
    assert.ok(parseSalesQuestion("Show me revenue for last week", LOCATIONS));
    assert.ok(parseSalesQuestion("Which locations need attention?", LOCATIONS));
    assert.ok(parseSalesQuestion("What were our sales yesterday?", LOCATIONS));
    assert.ok(parseSalesQuestion("How did Hakuraa perform last week?", LOCATIONS));
  });

  it("does not match menu/price questions (Bug #4 regression)", () => {
    // REGRESSION: This went to sales incorrectly in Mandara mode
    assert.equal(parseSalesQuestion("How much is a Balinese massage at the Vadoo spa?", LOCATIONS), null);
    assert.equal(parseSalesQuestion("What's the price of a hot stone massage?", LOCATIONS), null);
    assert.equal(parseSalesQuestion("Do we offer couples packages at Hakuraa?", LOCATIONS), null);
    assert.equal(parseSalesQuestion("What treatments are available at the Dhonveli spa?", LOCATIONS), null);
  });

  it("does not match general spa questions", () => {
    assert.equal(parseSalesQuestion("What are the benefits of aromatherapy?", LOCATIONS), null);
    assert.equal(parseSalesQuestion("How many treatment rooms should a resort have?", LOCATIONS), null);
    assert.equal(parseSalesQuestion("Explain the difference between Swedish and Thai massage", LOCATIONS), null);
  });

  it("does not match hypothetical calculations", () => {
    assert.equal(parseSalesQuestion("If a spa did $8,360 in retail, what's the daily average?", LOCATIONS), null);
    assert.equal(parseSalesQuestion("Build me an interactive model for a 100-villa resort spa", LOCATIONS), null);
  });

  it("matches location-based performance queries", () => {
    assert.ok(parseSalesQuestion("How is Vadoo performing?", LOCATIONS));
    assert.ok(parseSalesQuestion("Did Hakuraa do well last week?", LOCATIONS));
  });

  it("matches sales patterns without location", () => {
    assert.ok(parseSalesQuestion("Which spas are below budget?", LOCATIONS));
    assert.ok(parseSalesQuestion("Show me yesterday's revenue", LOCATIONS));
    assert.ok(parseSalesQuestion("Month-to-date sales totals", LOCATIONS));
  });

  it("handles period-based queries (Bug from retest - last month routing)", () => {
    // REGRESSION: "last month" was not recognized and defaulted to "yesterday"
    const lastMonth = parseSalesQuestion("Which of our spas had the highest revenue last month?", LOCATIONS);
    assert.ok(lastMonth);
    assert.equal(lastMonth.kind, "comparison");
    assert.equal((lastMonth as { period?: string }).period, "last-month");

    const thisMonth = parseSalesQuestion("What were sales this month?", LOCATIONS);
    assert.ok(thisMonth);
    assert.equal(thisMonth.kind, "this-month");

    const namedMonth = parseSalesQuestion("How much did we make in October?", LOCATIONS);
    assert.ok(namedMonth);
    assert.equal(namedMonth.kind, "named-month");
    assert.equal((namedMonth as { month?: string }).month, "october");
  });

  it("distinguishes last month from mtd", () => {
    const lastMonth = parseSalesQuestion("Show me last month's sales", LOCATIONS);
    assert.ok(lastMonth);
    assert.equal(lastMonth.kind, "last-month");

    const mtd = parseSalesQuestion("Show me month-to-date sales", LOCATIONS);
    assert.ok(mtd);
    assert.equal(mtd.kind, "mtd");
  });

  it("routes a treatment and retail breakdown, including where-we-are-at budget, as a mix question", () => {
    const question =
      "I need a breakdown of treatment sales yesterday and retail sales yesterday and then compare them to where we're at budget";
    assert.deepEqual(parseSalesQuestion(question, LOCATIONS), { kind: "mix", yesterday: true, mtd: true });
    assert.deepEqual(parseSalesQuestion("What were total spa sales yesterday?", LOCATIONS), { kind: "total" });
    assert.deepEqual(parseSalesQuestion("Show me treatment sales yesterday", LOCATIONS), { kind: "mix", yesterday: true, mtd: false });
    assert.deepEqual(parseSalesQuestion("Retail sales this month versus budget", LOCATIONS), { kind: "mix", yesterday: false, mtd: true });
  });
});
