import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rejectCrossOrigin } from "./http";

function post(headers: Record<string, string>): Request {
  return new Request("https://internal.local/api/chat", { method: "POST", headers });
}

describe("cross origin", () => {
  it("allows the app's own send when the proxy host differs from the public address", () => {
    const blocked = rejectCrossOrigin(
      post({
        origin: "https://mandara.apps.grok.bot",
        host: "internal.local",
        "sec-fetch-site": "same-origin",
      }),
    );
    assert.equal(blocked, null);
  });

  it("allows the public host the platform forwards", () => {
    const blocked = rejectCrossOrigin(
      post({
        origin: "https://mandara.apps.grok.bot",
        host: "internal.local",
        "x-forwarded-host": "mandara.apps.grok.bot",
      }),
    );
    assert.equal(blocked, null);
  });

  it("refuses a request from another site", async () => {
    const blocked = rejectCrossOrigin(
      post({
        origin: "https://evil.example",
        host: "mandara.apps.grok.bot",
        "sec-fetch-site": "cross-site",
      }),
    );
    assert.ok(blocked);
    assert.equal(blocked.status, 403);
    const body = (await blocked.json()) as { error?: string };
    assert.equal(body.error, "Cross-origin request refused.");
  });
});
