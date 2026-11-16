import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldRouteToSales, shouldSearchWeb } from "./routing";

const LOCATIONS = ["Hakuraa", "Olhuveli", "Sheraton"];

describe("sales routing", () => {
  it("routes genuine sales questions to sales path", () => {
    // Real data lookups with time references or comparisons
    assert.equal(shouldRouteToSales("What were total spa sales yesterday?", LOCATIONS), true);
    assert.equal(shouldRouteToSales("Which locations need attention?", LOCATIONS), true);
    assert.equal(shouldRouteToSales("How did Hakuraa do last week vs budget?", LOCATIONS), true);
    assert.equal(shouldRouteToSales("Show me yesterday's sales by location", LOCATIONS), true);
    assert.equal(shouldRouteToSales("What are this month's sales figures?", LOCATIONS), true);
    assert.equal(shouldRouteToSales("Which spas are below budget?", LOCATIONS), true);
    assert.equal(shouldRouteToSales("Sales report for 12 Nov", LOCATIONS), true);
    assert.equal(shouldRouteToSales("Sales at Hakuraa last week", LOCATIONS), true);
    assert.equal(shouldRouteToSales("What were yesterday's sales?", LOCATIONS), true);
  });

  it("does not route general prompts to sales path", () => {
    assert.equal(shouldRouteToSales("Hi, I'm Trent. I run Mandara Spa Maldives. Please remember that my favourite treatment is the Balinese massage and our best-selling retail line is Elemis.", LOCATIONS), false);
    assert.equal(shouldRouteToSales("Write a 120-word Instagram caption for a Christmas spa promotion at a Maldives resort, warm and premium, no more than 3 hashtags.", LOCATIONS), false);
    assert.equal(shouldRouteToSales("A spa has 6 treatment rooms open 10am-10pm, average treatment 75 minutes plus 15 minutes turnover. Last month it did 1,150 treatments over 30 days. What was the utilisation %? Show the working.", LOCATIONS), false);
    assert.equal(shouldRouteToSales("Explain in plain English the difference between gross revenue share and a fixed rent in a hotel spa lease, with a pros/cons table.", LOCATIONS), false);
    assert.equal(shouldRouteToSales("Create a picture: a serene overwater spa pavilion at sunset, Maldives, for a menu cover.", LOCATIONS), false);
    assert.equal(shouldRouteToSales("Draft a polite email to a resort GM proposing a meeting to discuss taking over their spa operation. Keep it under 150 words.", LOCATIONS), false);
    assert.equal(shouldRouteToSales("Translate this into Russian and Chinese: 'Welcome to Mandara Spa. Your treatment begins in 10 minutes.'", LOCATIONS), false);
    assert.equal(shouldRouteToSales("What are the benefits of hot stone massage?", LOCATIONS), false);
    assert.equal(shouldRouteToSales("How many treatment rooms should a 100-room resort have?", LOCATIONS), false);
    assert.equal(shouldRouteToSales("Tell me about Elemis products", LOCATIONS), false);
  });

  it("does not route hypothetical calculations to sales path", () => {
    // Regression test for issue #1: hypothetical calculation was routed to sales
    assert.equal(
      shouldRouteToSales(
        "A spa does $9,500 net revenue a day across 12 locations. If retail is 12% of revenue and we lift it to 18% with no change in treatment revenue, what's the extra monthly revenue? Show the working.",
        LOCATIONS
      ),
      false
    );
    
    // Other hypothetical scenarios
    assert.equal(shouldRouteToSales("If we increase prices by 10%, what would revenue be?", LOCATIONS), false);
    assert.equal(shouldRouteToSales("Suppose a location does $5,000 a day. What's the annual total?", LOCATIONS), false);
    assert.equal(shouldRouteToSales("Imagine we open 3 more spas. What's the impact on revenue?", LOCATIONS), false);
    assert.equal(shouldRouteToSales("Let's say retail becomes 20% of sales. What's the change?", LOCATIONS), false);
  });

  it("does not route production failure cases from 16 Nov 2026", () => {
    // REGRESSION: All 4 test prompts incorrectly routed to sales in production after main 28d3525 deployment
    
    // Test 2: Hypothetical prompt with "Hypothetical:" prefix
    assert.equal(
      shouldRouteToSales(
        "Hypothetical: a spa does $8,360 a day in treatment revenue and retail is currently $1,140 a day. If treatment revenue stays the same but retail rises to 18% of total revenue, how much extra revenue per day is that, and per 30 days?",
        LOCATIONS
      ),
      false,
      "Bug: 'Hypothetical:' prefix wasn't excluded from sales routing"
    );

    // Test 3: Math problem with "Show the working"
    assert.equal(
      shouldRouteToSales(
        "A spa does $9,500 net revenue a day. If retail is 12% of revenue and we lift it to 18% with no change in treatment revenue, what's the extra monthly revenue? Show the working.",
        LOCATIONS
      ),
      false,
      "'Show the working' should trigger isExplicitNonSalesTask"
    );

    // Test 4: Calculator generation prompt - the "create an" bug
    assert.equal(
      shouldRouteToSales(
        "Create an interactive financial model for a Maldives resort with 100 villas. Show management fees with adjustable inputs: occupancy (50-100%), average room rate ($300-$800), operating margin (20-40%), base management fee (1-3%), and incentive fee on GOP (5-15%). Display annual resort revenue, operating profit, management fees, and remaining profit after fees. Include a split bar. Assume room revenue is 65% of total revenue.",
        LOCATIONS
      ),
      false,
      "Bug: 'create an' didn't match the regex that only checked 'create a'"
    );
  });

  it("handles edge cases correctly", () => {
    assert.equal(shouldRouteToSales("", LOCATIONS), false);
    assert.equal(shouldRouteToSales("spa", LOCATIONS), false);
    assert.equal(shouldRouteToSales("Mandara", LOCATIONS), false);
    assert.equal(shouldRouteToSales("resort", LOCATIONS), false);
    assert.equal(shouldRouteToSales("treatment", LOCATIONS), false);
    assert.equal(shouldRouteToSales("12 Nov", LOCATIONS), false);
    assert.equal(shouldRouteToSales("What time is it?", LOCATIONS), false);
  });
});

describe("web search decision", () => {
  it("searches for current and external facts", () => {
    assert.equal(shouldSearchWeb("What are the latest spa trends in 2026?"), true);
    assert.equal(shouldSearchWeb("Who won the Maldives tourism award this year?"), true);
    assert.equal(shouldSearchWeb("What's the current price of Elemis face cream?"), true);
    assert.equal(shouldSearchWeb("Cite sources on CBD massage legality in the Maldives"), true);
    assert.equal(shouldSearchWeb("What are today's exchange rates?"), true);
    assert.equal(shouldSearchWeb("How to make a lemongrass scrub"), true);
    assert.equal(shouldSearchWeb("News about Four Seasons Maldives"), true);
  });

  it("does not search for tasks that don't need external data", () => {
    assert.equal(shouldSearchWeb("Write a 120-word Instagram caption for a Christmas spa promotion"), false);
    assert.equal(shouldSearchWeb("Translate this into Russian and Chinese: 'Welcome'"), false);
    assert.equal(shouldSearchWeb("Calculate 1,150 treatments / 30 days / 6 rooms"), false);
    assert.equal(shouldSearchWeb("Explain the difference between gross revenue share and fixed rent"), false);
    assert.equal(shouldSearchWeb("Draft an email to a resort GM about taking over their spa"), false);
    assert.equal(shouldSearchWeb("What's my favourite treatment?"), false);
    assert.equal(shouldSearchWeb("Rewrite this more formally: 'Hi there'"), false);
    assert.equal(shouldSearchWeb("Summarize the attached document"), false);
  });

  it("handles edge cases", () => {
    assert.equal(shouldSearchWeb(""), false);
    assert.equal(shouldSearchWeb("Hello"), false);
    assert.equal(shouldSearchWeb("Thanks"), false);
  });
});
