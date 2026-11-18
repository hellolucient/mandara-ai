import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePromoCards } from "./promo-cards.js";

describe("promo cards", () => {
  it("reads a fenced promo block and leaves the surrounding text", () => {
    const text = [
      "Here are cards for those December ideas.",
      "```promo",
      '[{"headline":"Sunset Ritual","line":"A warm evening treatment.","offer":"[price]","brand":"Mandara"}]',
      "```",
      "I can also make a picture of a card if you want one.",
    ].join("\n");
    const { cards, body } = parsePromoCards(text);
    assert.deepEqual(cards, [
      { headline: "Sunset Ritual", line: "A warm evening treatment.", offer: "[price]", brand: "Mandara" },
    ]);
    assert.match(body, /Here are cards for those December ideas/);
    assert.match(body, /I can also make a picture/);
    assert.doesNotMatch(body, /```promo/);
  });

  it("ignores broken JSON and empty headlines", () => {
    assert.deepEqual(parsePromoCards("Just a thought.").cards, []);
    assert.equal(parsePromoCards("```promo\nnot json\n```").cards.length, 0);
    assert.equal(parsePromoCards('```promo\n[{"headline":"","offer":"$10"}]\n```').cards.length, 0);
  });
});
