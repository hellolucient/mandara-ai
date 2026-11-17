import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { asksForPicture, gatewayBody, readModalityImages, sourcesFromAnnotations } from "./openrouter";

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
  it("sends Auto on the middle tier and keeps web search", () => {
    const body = gatewayBody("openrouter/auto", [{ role: "user", content: "Who runs Nvidia?" }], true, false);
    assert.equal(body.model, "openrouter/auto");
    assert.deepEqual(body.plugins, [
      { id: "auto-router", cost_tier: "medium" },
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

describe("image generation", () => {
  it("extracts base64 images from modality response", () => {
    const images = readModalityImages([
      { image_url: { url: "data:image/png;base64,iVBORw0KGgoAAAANS" } },
      { image_url: { url: "data:image/jpeg;base64,/9j/4AAQSkZJRg" } },
      { image_url: { url: "https://example.com/image.png" } },
      { image_url: { url: "javascript:alert(1)" } },
      { other: "field" },
    ]);
    assert.equal(images.length, 2);
    assert.ok(images[0].startsWith("data:image/png;base64,"));
    assert.ok(images[1].startsWith("data:image/jpeg;base64,"));
  });

  it("limits to two images", () => {
    const images = readModalityImages([
      { image_url: { url: "data:image/png;base64,a" } },
      { image_url: { url: "data:image/png;base64,b" } },
      { image_url: { url: "data:image/png;base64,c" } },
    ]);
    assert.equal(images.length, 2);
  });

  it("handles empty or invalid data", () => {
    assert.deepEqual(readModalityImages(null), []);
    assert.deepEqual(readModalityImages([]), []);
    assert.deepEqual(readModalityImages([{ not: "an image" }]), []);
  });
});
