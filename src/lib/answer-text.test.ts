import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { answerPieces, safeImageSrc } from "./answer-text";

describe("answer text", () => {
  it("turns a long markdown citation into a short link", () => {
    const raw =
      "Outlook is down [economictimes.indiatimes.com](https://economictimes.indiatimes.com/news/international/us/outlook-down-downdetector-shows-over-129000-error-reports-as-outlook-teams-and-copilot-services-face-disruptions-heres-how-to-fix-issues/articleshow/135781556.cms).";
    const pieces = answerPieces(raw);
    assert.equal(pieces.some((piece) => piece.kind === "text" && piece.text.includes("articleshow")), false);
    const link = pieces.find((piece) => piece.kind === "link");
    assert.ok(link && link.kind === "link");
    assert.equal(link.text, "economictimes.indiatimes.com");
    assert.match(link.href, /^https:\/\/economictimes\.indiatimes\.com\//);
  });

  it("shortens a bare address and ignores a script link", () => {
    const pieces = answerPieces("See https://apnews.com/article/microsoft-outage-outlook and [bad](javascript:alert(1)).");
    const link = pieces.find((piece) => piece.kind === "link");
    assert.ok(link && link.kind === "link");
    assert.equal(link.text, "apnews.com");
    assert.equal(pieces.some((piece) => piece.kind === "link" && piece.href.startsWith("javascript:")), false);
  });

  it("accepts a generated image and rejects other data urls", () => {
    assert.match(safeImageSrc("data:image/png;base64,aaaa"), /^data:image\/png/);
    assert.equal(safeImageSrc("data:text/html;base64,aaaa"), "");
  });
});
