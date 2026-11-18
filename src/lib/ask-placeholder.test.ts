import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { askPlaceholder, GENERAL_ASK_PLACEHOLDER, MANDARA_ASK_PLACEHOLDER } from "./ask-placeholder.js";

describe("ask placeholder", () => {
  it("keeps the Hakuraa sample when Mandara is selected", () => {
    assert.equal(askPlaceholder("mandara"), "How did Hakuraa do yesterday?");
    assert.equal(askPlaceholder("mandara"), MANDARA_ASK_PLACEHOLDER);
  });

  it("switches to a general, non-Mandara sample when General is selected", () => {
    assert.equal(askPlaceholder("general"), "What's the weather in Malé?");
    assert.equal(askPlaceholder("general"), GENERAL_ASK_PLACEHOLDER);
    assert.doesNotMatch(askPlaceholder("general"), /Hakuraa|Mandara|spa|sales/i);
  });
});
