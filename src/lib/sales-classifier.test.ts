import assert from "node:assert/strict";
import { describe, it } from "node:test";

// NOTE: These tests require OPENROUTER_API_KEY to be configured.
// They make real API calls to test the classifier end-to-end.
// The classifier uses DeepSeek V3 (~$0.02¢ per classification).

const RUN_LIVE_TESTS = Boolean(process.env.OPENROUTER_API_KEY?.trim());

describe("model-based sales classifier", () => {
  it("classifies genuine sales queries as SALES", async () => {
    if (!RUN_LIVE_TESTS) {
      console.log("  Skipping live API test (no OPENROUTER_API_KEY)");
      return;
    }
    
    const { classifySalesIntent } = await import("./sales-classifier");

    const queries = [
      "What were total spa sales yesterday?",
      "How did Hakuraa perform last week?",
      "Show me yesterday's sales by location",
      "Which locations need attention?",
      "Sales report for 12 Nov",
      "What are this month's sales figures?",
      "Which spas are below budget?",
      "Revenue at Olhuveli last week",
    ];
    
    for (const query of queries) {
      const result = await classifySalesIntent(query);
      assert.equal(
        result.isSalesQuery,
        true,
        `Expected SALES for: "${query}" but got ${result.rawResponse}`
      );
    }
  });

  it("classifies hypothetical calculations as GENERAL", async () => {
    if (!RUN_LIVE_TESTS) {
      console.log("  Skipping live API test (no OPENROUTER_API_KEY)");
      return;
    }
    
    const { classifySalesIntent } = await import("./sales-classifier");

    const queries = [
      "Hypothetical: a spa does $8,360 a day in treatment revenue and retail is currently $1,140 a day. If treatment revenue stays the same but retail rises to 18% of total revenue, how much extra revenue per day is that, and per 30 days?",
      "A spa does $9,500 net revenue a day. If retail is 12% of revenue and we lift it to 18% with no change in treatment revenue, what's the extra monthly revenue? Show the working.",
      "If we increase prices by 10%, what would revenue be?",
      "Suppose a location does $5,000 a day. What's the annual total?",
      "Imagine we open 3 more spas. What's the impact on revenue?",
    ];
    
    for (const query of queries) {
      const result = await classifySalesIntent(query);
      assert.equal(
        result.isSalesQuery,
        false,
        `Expected GENERAL for: "${query.substring(0, 60)}..." but got ${result.rawResponse}`
      );
    }
  });

  it("classifies calculator/model generation as GENERAL", async () => {
    if (!RUN_LIVE_TESTS) {
      console.log("  Skipping live API test (no OPENROUTER_API_KEY)");
      return;
    }
    
    const { classifySalesIntent } = await import("./sales-classifier");

    const queries = [
      "Create an interactive financial model for a Maldives resort with 100 villas. Show management fees with adjustable inputs: occupancy (50-100%), average room rate ($300-$800), operating margin (20-40%), base management fee (1-3%), and incentive fee on GOP (5-15%). Display annual resort revenue, operating profit, management fees, and remaining profit after fees.",
      "Build a calculator for spa profitability",
      "Make an interactive revenue estimator",
      "Create a pricing model",
    ];
    
    for (const query of queries) {
      const result = await classifySalesIntent(query);
      assert.equal(
        result.isSalesQuery,
        false,
        `Expected GENERAL for: "${query.substring(0, 60)}..." but got ${result.rawResponse}`
      );
    }
  });

  it("classifies content creation tasks as GENERAL", async () => {
    if (!RUN_LIVE_TESTS) {
      console.log("  Skipping live API test (no OPENROUTER_API_KEY)");
      return;
    }
    
    const { classifySalesIntent } = await import("./sales-classifier");

    const queries = [
      "Write a 120-word Instagram caption for a Christmas spa promotion",
      "Draft a polite email to a resort GM",
      "Translate this into Russian: Welcome to Mandara Spa",
      "Create a picture: a serene overwater spa pavilion",
    ];
    
    for (const query of queries) {
      const result = await classifySalesIntent(query);
      assert.equal(
        result.isSalesQuery,
        false,
        `Expected GENERAL for: "${query.substring(0, 60)}..." but got ${result.rawResponse}`
      );
    }
  });

  it("classifies general knowledge questions as GENERAL", async () => {
    if (!RUN_LIVE_TESTS) {
      console.log("  Skipping live API test (no OPENROUTER_API_KEY)");
      return;
    }
    
    const { classifySalesIntent } = await import("./sales-classifier");

    const queries = [
      "What are the benefits of hot stone massage?",
      "Tell me about Elemis products",
      "Explain the difference between gross revenue share and fixed rent",
      "How many treatment rooms should a 100-room resort have?",
      "What is the standard spa commission rate?",
    ];
    
    for (const query of queries) {
      const result = await classifySalesIntent(query);
      assert.equal(
        result.isSalesQuery,
        false,
        `Expected GENERAL for: "${query}" but got ${result.rawResponse}`
      );
    }
  });

  it("handles exact production failure cases from 16 Nov 2026", async () => {
    if (!RUN_LIVE_TESTS) {
      console.log("  Skipping live API test (no OPENROUTER_API_KEY)");
      return;
    }
    
    const { classifySalesIntent } = await import("./sales-classifier");
    
    // Test 1: Sales question (should be SALES)
    let result = await classifySalesIntent("What were spa sales yesterday?");
    assert.equal(result.isSalesQuery, true, "Test 1 should be SALES");
    
    // Test 2: Hypothetical prompt
    result = await classifySalesIntent(
      "Hypothetical: a spa does $8,360 a day in treatment revenue and retail is currently $1,140 a day. If treatment revenue stays the same but retail rises to 18% of total revenue, how much extra revenue per day is that, and per 30 days?"
    );
    assert.equal(result.isSalesQuery, false, "Test 2 should be GENERAL");
    
    // Test 3: Math with "Show the working"
    result = await classifySalesIntent(
      "A spa does $9,500 net revenue a day. If retail is 12% of revenue and we lift it to 18% with no change in treatment revenue, what's the extra monthly revenue? Show the working."
    );
    assert.equal(result.isSalesQuery, false, "Test 3 should be GENERAL");
    
    // Test 4: Calculator generation
    result = await classifySalesIntent(
      "Create an interactive financial model for a Maldives resort with 100 villas. Show management fees with adjustable inputs: occupancy (50-100%), average room rate ($300-$800), operating margin (20-40%), base management fee (1-3%), and incentive fee on GOP (5-15%). Display annual resort revenue, operating profit, management fees, and remaining profit after fees. Include a split bar. Assume room revenue is 65% of total resort revenue."
    );
    assert.equal(result.isSalesQuery, false, "Test 4 should be GENERAL");
  });

  it("handles edge cases with sales-like words but non-sales intent", async () => {
    if (!RUN_LIVE_TESTS) {
      console.log("  Skipping live API test (no OPENROUTER_API_KEY)");
      return;
    }
    
    const { classifySalesIntent } = await import("./sales-classifier");

    const queries = [
      "A spa does $9,500 net revenue - calculate the breakdown", // has "revenue" but is calculation
      "If revenue doubles, what changes?", // has "revenue" but is hypothetical
      "Show the revenue model assumptions", // has "revenue" but asking about models
      "What impacts spa revenue?", // general question about revenue drivers
    ];
    
    for (const query of queries) {
      const result = await classifySalesIntent(query);
      assert.equal(
        result.isSalesQuery,
        false,
        `Expected GENERAL for: "${query}" but got ${result.rawResponse}`
      );
    }
  });

  it("distinguishes actual data requests from hypothetical scenarios", async () => {
    if (!RUN_LIVE_TESTS) {
      console.log("  Skipping live API test (no OPENROUTER_API_KEY)");
      return;
    }
    
    const { classifySalesIntent } = await import("./sales-classifier");
    
    // Actual data requests (SALES)
    let result = await classifySalesIntent("What was Hakuraa revenue last week?");
    assert.equal(result.isSalesQuery, true, "Actual data request should be SALES");
    
    result = await classifySalesIntent("Show November sales totals");
    assert.equal(result.isSalesQuery, true, "Historical data request should be SALES");
    
    // Hypothetical scenarios (GENERAL)
    result = await classifySalesIntent("If Hakuraa revenue doubled, what would the total be?");
    assert.equal(result.isSalesQuery, false, "Hypothetical should be GENERAL");
    
    result = await classifySalesIntent("Suppose November sales were $100k, what's the margin?");
    assert.equal(result.isSalesQuery, false, "Hypothetical with actual location should be GENERAL");
  });

  it("uses quick pre-filter for obvious cases (skip model)", async () => {
    if (!RUN_LIVE_TESTS) {
      console.log("  Skipping live API test (no OPENROUTER_API_KEY)");
      return;
    }
    
    const { classifySalesIntent } = await import("./sales-classifier");
    
    // These should be caught by pre-filter (isSalesQuery = false, high confidence)
    const obviousGeneral = [
      "Write an email",
      "Create a calculator",
      "Hypothetical: if revenue is $50k",
      "Show the working for this calculation",
    ];
    
    for (const query of obviousGeneral) {
      const result = await classifySalesIntent(query);
      assert.equal(result.isSalesQuery, false);
      // Note: Can't reliably check confidence without mocking, but pre-filter should handle these
    }
  });
  
  it("documents expected classification behavior (no API call)", () => {
    // This test documents expected behavior without making API calls
    const salesQueries = [
      "What were spa sales yesterday?",
      "How did Hakuraa perform last week?",
      "Which locations are below budget?",
      "Show November revenue totals",
    ];
    
    const generalQueries = [
      "Hypothetical: if revenue doubles",
      "A spa does $9,500/day - show the working",
      "Create an interactive financial model",
      "Write an Instagram caption",
      "What are the benefits of hot stone massage?",
    ];
    
    // Assert that we have documented test cases for both categories
    assert.ok(salesQueries.length > 0, "Should have sales query examples");
    assert.ok(generalQueries.length > 0, "Should have general query examples");
    
    // The actual classification happens in the live tests above
    console.log("  Documented:", salesQueries.length, "sales examples,", generalQueries.length, "general examples");
  });
});
