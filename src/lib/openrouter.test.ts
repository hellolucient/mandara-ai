import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sourcesFromAnnotations } from "./openrouter";

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
