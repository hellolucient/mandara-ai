import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ATTACHMENT_MAX_BYTES,
  VISION_MODEL_DEFAULT,
  imageKindFromBytes,
  isDeclaredImage,
  modelForAttachment,
  modelSupportsVision,
  readChatImage,
} from "./chat-images";

function jpeg(): Uint8Array {
  return Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]);
}

function png(): Uint8Array {
  return Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00]);
}

function webp(): Uint8Array {
  const bytes = new Uint8Array(12);
  bytes.set(Buffer.from("RIFF"), 0);
  bytes.set(Buffer.from("WEBP"), 8);
  return bytes;
}

function heic(brand = "heic"): Uint8Array {
  const bytes = new Uint8Array(16);
  bytes.set(Buffer.from("ftyp"), 4);
  bytes.set(Buffer.from(brand), 8);
  return bytes;
}

describe("image attachment validation", () => {
  it("detects jpeg, png, webp and heic from magic bytes", () => {
    assert.equal(imageKindFromBytes(jpeg()), "jpeg");
    assert.equal(imageKindFromBytes(png()), "png");
    assert.equal(imageKindFromBytes(webp()), "webp");
    assert.equal(imageKindFromBytes(heic()), "heic");
    assert.equal(imageKindFromBytes(heic("mif1")), "heic");
  });

  it("rejects svg, html, text and truncated bytes", () => {
    assert.equal(imageKindFromBytes(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>")), null);
    assert.equal(imageKindFromBytes(Buffer.from("<!DOCTYPE html><html></html>")), null);
    assert.equal(imageKindFromBytes(Buffer.from("hello")), null);
    assert.equal(imageKindFromBytes(new Uint8Array([0xff, 0xd8])), null);
  });

  it("treats common photo names and image mime types as declared images", () => {
    assert.equal(isDeclaredImage("pool.jpg", ""), true);
    assert.equal(isDeclaredImage("note.HEIC", ""), true);
    assert.equal(isDeclaredImage("shot", "image/webp"), true);
    assert.equal(isDeclaredImage("notes.pdf", "application/pdf"), false);
    assert.equal(isDeclaredImage("notes.txt", "text/plain"), false);
  });

  it("encodes a valid photo as a matching data URL", () => {
    const result = readChatImage("spa.jpg", "image/jpeg", jpeg());
    assert.equal(result.kind, "jpeg");
    assert.match(result.dataUrl, /^data:image\/jpeg;base64,/);
  });

  it("rejects an empty or oversized photo, and a mislabeled non-image", () => {
    assert.throws(() => readChatImage("empty.png", "image/png", new Uint8Array()), /empty/i);
    assert.throws(
      () => readChatImage("huge.jpg", "image/jpeg", new Uint8Array(ATTACHMENT_MAX_BYTES + 1)),
      /2 MB/,
    );
    assert.throws(() => readChatImage("fake.png", "image/png", Buffer.from("not-an-image")), /JPEG, PNG, WebP or HEIC/);
  });
});

describe("vision model routing", () => {
  it("does not treat the default chat or reasoning DeepSeek models as vision-capable", () => {
    assert.equal(modelSupportsVision("deepseek/deepseek-v4.1-flash"), false);
    assert.equal(modelSupportsVision("deepseek/deepseek-v4-pro"), false);
    assert.equal(modelSupportsVision("google/gemini-2.5-flash-image"), false);
  });

  it("recognises common vision-capable model families", () => {
    assert.equal(modelSupportsVision("google/gemini-2.5-flash"), true);
    assert.equal(modelSupportsVision("google/gemini-2.0-flash-001"), true);
    assert.equal(modelSupportsVision("openai/gpt-4o-mini"), true);
    assert.equal(modelSupportsVision("anthropic/claude-sonnet-4.5"), true);
    assert.equal(modelSupportsVision("qwen/qwen3-vl-8b"), true);
  });

  it("keeps the preferred model when it can see images", () => {
    assert.equal(
      modelForAttachment({
        chatModel: "google/gemini-2.5-flash",
        reasoningModel: "deepseek/deepseek-v4-pro",
        visionModel: VISION_MODEL_DEFAULT,
        useReasoning: false,
        hasImage: true,
      }),
      "google/gemini-2.5-flash",
    );
  });

  it("routes an image on the default DeepSeek chat model to Gemini 2.5 Flash", () => {
    assert.equal(
      modelForAttachment({
        chatModel: "deepseek/deepseek-v4.1-flash",
        reasoningModel: "deepseek/deepseek-v4-pro",
        visionModel: VISION_MODEL_DEFAULT,
        useReasoning: false,
        hasImage: true,
      }),
      "google/gemini-2.5-flash",
    );
  });

  it("routes an image that would have used the reasoning model to the vision model when that model cannot see images", () => {
    assert.equal(
      modelForAttachment({
        chatModel: "deepseek/deepseek-v4.1-flash",
        reasoningModel: "deepseek/deepseek-v4-pro",
        visionModel: VISION_MODEL_DEFAULT,
        useReasoning: true,
        hasImage: true,
      }),
      "google/gemini-2.5-flash",
    );
  });

  it("leaves text-only routing unchanged", () => {
    assert.equal(
      modelForAttachment({
        chatModel: "deepseek/deepseek-v4.1-flash",
        reasoningModel: "deepseek/deepseek-v4-pro",
        visionModel: VISION_MODEL_DEFAULT,
        useReasoning: true,
        hasImage: false,
      }),
      "deepseek/deepseek-v4-pro",
    );
  });

  it("uses a configured vision model id when the preferred model cannot see images", () => {
    assert.equal(
      modelForAttachment({
        chatModel: "deepseek/deepseek-v4.1-flash",
        reasoningModel: "deepseek/deepseek-v4-pro",
        visionModel: "openai/gpt-4o-mini",
        useReasoning: false,
        hasImage: true,
      }),
      "openai/gpt-4o-mini",
    );
  });
});
