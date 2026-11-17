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
});
