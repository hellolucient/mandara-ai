import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { asksForPicture, gatewayBody, sourcesFromAnnotations } from "./openrouter";

describe("web sources", () => {
  it("keeps distinct http sources and drops anything else", () => {
    const sources = sourcesFromAnnotations([
      { type: "url_citation", url_citation: { url: "https://nvidianews.nvidia.com/news/nvidia-announces-ceo-transition", title: "NVIDIA Announces CEO Transition" } },
      { type: "url_citation", url_citation: { url: "https://nvidianews.nvidia.com/news/nvidia-announces-ceo-transition", title: "Duplicate" } },
      { type: "url_citation", url_citation: { url: "javascript:alert(1)", title: "Bad" } },
      { type: "url_citation", url_citation: { url: "not a url", title: "Also bad" } },
      { note: "ignored" },
    ]);
    assert.deepEqual(sources, [
      {
        title: "NVIDIA Announces CEO Transition",
        url: "https://nvidianews.nvidia.com/news/nvidia-announces-ceo-transition",
      },
    ]);
  });
});

describe("model routing", () => {
  it("sends Auto on the high capability tier and keeps web search", () => {
    const body = gatewayBody("openrouter/auto", [{ role: "user", content: "Who runs Nvidia?" }], true, false);
    assert.equal(body.model, "openrouter/auto");
    assert.deepEqual(body.plugins, [
      { id: "auto-router", cost_tier: "high" },
      { id: "web", engine: "exa", max_results: 5 },
    ]);
    assert.equal("tools" in body, false);
  });

  it("does not attach the auto router to a model an administrator chose", () => {
    const body = gatewayBody("google/gemini-2.5-flash", [{ role: "user", content: "Hello" }], false, false);
    assert.equal("plugins" in body, false);
  });

  it("recognises a request for a concept drawing", () => {
    assert.equal(asksForPicture("Can you create a concept drawing of that menu card, front and back?"), true);
    assert.equal(asksForPicture("Who is the chief executive of Nvidia?"), false);
  });
});
