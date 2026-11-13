import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { needsReasoningModel } from "./question-complexity";

describe("question complexity detection", () => {
  it("detects calculations with numbers", () => {
    assert.equal(needsReasoningModel("A spa does $9,500 net revenue a day. If retail is 12% and we lift it to 18%, what's the extra monthly revenue?", false, 0), true);
    assert.equal(needsReasoningModel("Calculate the ROI if we invest $50k in new equipment", false, 0), true);
    assert.equal(needsReasoningModel("What's the impact of a 15% price increase on profit?", false, 0), true);
    assert.equal(needsReasoningModel("How much extra revenue from 3 more treatment rooms?", false, 0), true);
  });

  it("detects business what-if scenarios", () => {
    assert.equal(needsReasoningModel("If we increase prices by 10%, what would revenue be?", false, 0), true);
    assert.equal(needsReasoningModel("Suppose we open 5 more locations. What's the cost?", false, 0), true);
    assert.equal(needsReasoningModel("What if retail becomes 25% of sales?", false, 0), true);
    assert.equal(needsReasoningModel("Imagine we expand to 20 spas. What's the management fee?", false, 0), true);
  });

  it("detects legal and contract analysis", () => {
    assert.equal(needsReasoningModel("Explain gross revenue share vs fixed rent in a spa lease", false, 0), true);
    assert.equal(needsReasoningModel("What is a target net working capital true-up in an acquisition?", false, 0), true);
    assert.equal(needsReasoningModel("Review this management agreement for liability clauses", false, 0), true);
    assert.equal(needsReasoningModel("What are the termination terms in a typical spa contract?", false, 0), true);
  });

  it("detects multi-step analysis", () => {
    assert.equal(needsReasoningModel("Compare the pros and cons of owning vs managing a spa", false, 0), true);
    assert.equal(needsReasoningModel("What's the best strategy for expanding to new markets?", false, 0), true);
    assert.equal(needsReasoningModel("Evaluate whether we should hire more therapists or raise prices", false, 0), true);
    assert.equal(needsReasoningModel("Break down the steps to open a new spa location", false, 0), true);
  });

  it("detects long document analysis", () => {
    assert.equal(needsReasoningModel("Summarize this", true, 5000), true);
    assert.equal(needsReasoningModel("What does this say?", true, 4000), true);
  });

  it("does not trigger reasoning for simple questions", () => {
    assert.equal(needsReasoningModel("What were spa sales yesterday?", false, 0), false);
    assert.equal(needsReasoningModel("Write an Instagram caption for a spa promotion", false, 0), false);
    assert.equal(needsReasoningModel("Translate 'Welcome to Mandara Spa' into French", false, 0), false);
    assert.equal(needsReasoningModel("What are the benefits of hot stone massage?", false, 0), false);
    assert.equal(needsReasoningModel("Tell me about Elemis products", false, 0), false);
    assert.equal(needsReasoningModel("Create a picture of a spa at sunset", false, 0), false);
  });

  it("does not trigger reasoning for short attachments", () => {
    assert.equal(needsReasoningModel("Summarize this", true, 1000), false);
    assert.equal(needsReasoningModel("What does this say?", true, 500), false);
  });
});
