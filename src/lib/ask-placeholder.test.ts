import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { askPlaceholder, GENERAL_ASK_PLACEHOLDER, MANDARA_ASK_PLACEHOLDER } from "./ask-placeholder.js";

describe("ask placeholder", () => {
  it("asks what they want to know about Mandara when Mandara is selected", () => {
    assert.equal(askPlaceholder("mandara"), "What would you like to know about Mandara today?");
    assert.equal(askPlaceholder("mandara"), MANDARA_ASK_PLACEHOLDER);
  });

  it("asks what's on their mind when General is selected", () => {
    assert.equal(askPlaceholder("general"), "What's on your mind?");
    assert.equal(askPlaceholder("general"), GENERAL_ASK_PLACEHOLDER);
    assert.doesNotMatch(askPlaceholder("general"), /Hakuraa|Mandara|spa|sales/i);
  });
});
