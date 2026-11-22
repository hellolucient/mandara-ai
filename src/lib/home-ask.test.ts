import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it, beforeEach } from "node:test";
import {
  beginHomeAsk,
  homeAskStarted,
  parseHomeAsk,
  resetHomeAskForTests,
  shouldAdoptNewConversation,
  stripHomeAskFromUrl,
} from "./home-ask.js";

describe("home ask from the dashboard", () => {
  beforeEach(() => {
    resetHomeAskForTests();
    try {
      sessionStorage.clear();
    } catch {
      /* node has no sessionStorage */
    }
  });

  it("reads the question, mode and one-time ask id from the chat URL", () => {
    assert.deepEqual(parseHomeAsk({ q: "How is Hakuraa doing?", mode: "mandara", ask: "abc-123" }), {
      q: "How is Hakuraa doing?",
      mode: "mandara",
      ask: "abc-123",
    });
    assert.equal(parseHomeAsk({ q: "Hello", mode: "general" }).mode, "general");
    assert.equal(parseHomeAsk({}).mode, "general");
    assert.equal(parseHomeAsk({ q: ["x"], mode: "other" }).q, "");
    assert.equal(parseHomeAsk({ q: "x".repeat(3000) }).q.length, 2000);
  });

  it("auto-sends a Home question only once, including the same text twice", () => {
    assert.equal(beginHomeAsk("ask-1", "  What is today's sales?  "), "What is today's sales?");
    assert.equal(homeAskStarted("ask-1", "What is today's sales?"), true);
    assert.equal(beginHomeAsk("ask-1", "What is today's sales?"), null);
    assert.equal(beginHomeAsk("ask-2", "What is today's sales?"), "What is today's sales?");
    assert.equal(beginHomeAsk("", "   "), null);
    assert.equal(homeAskStarted("", "   "), false);
  });

  it("does not jump to a new conversation id after the person switches tabs", () => {
    assert.equal(
      shouldAdoptNewConversation({ currentConversationId: "", pathname: "/chat", search: "?mode=general", sentMode: "general" }),
      true,
    );
    assert.equal(
      shouldAdoptNewConversation({ currentConversationId: "", pathname: "/chat", search: "?mode=mandara", sentMode: "general" }),
      false,
    );
    assert.equal(
      shouldAdoptNewConversation({ currentConversationId: "", pathname: "/chat", search: "?mode=general", sentMode: "mandara" }),
      false,
    );
    assert.equal(
      shouldAdoptNewConversation({ currentConversationId: "", pathname: "/chat", search: "", sentMode: "general" }),
      true,
    );
    assert.equal(
      shouldAdoptNewConversation({ currentConversationId: "", pathname: "/chat", search: "", sentMode: "mandara" }),
      false,
    );
    assert.equal(
      shouldAdoptNewConversation({ currentConversationId: "c1", pathname: "/chat/c1", search: "", sentMode: "general" }),
      true,
    );
    assert.equal(
      shouldAdoptNewConversation({ currentConversationId: "c1", pathname: "/chat", search: "?mode=mandara", sentMode: "general" }),
      false,
    );
    assert.equal(
      shouldAdoptNewConversation({ currentConversationId: "c1", pathname: "/chat/c2", search: "", sentMode: "general" }),
      false,
    );
  });

  it("strips q and ask from the URL and keeps the mode", () => {
    const calls: string[] = [];
    const original = globalThis.window;
    const href = "http://127.0.0.1:4327/chat?q=Hello%20there&mode=general&ask=xyz";
    const state = { from: "next" };
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        location: { href },
        history: {
          state,
          replaceState(_s: unknown, _t: string, url: string) {
            calls.push(url);
          },
        },
      },
    });
    try {
      stripHomeAskFromUrl();
      assert.deepEqual(calls, ["/chat?mode=general"]);
    } finally {
      if (original === undefined) {
        Reflect.deleteProperty(globalThis, "window");
      } else {
        Object.defineProperty(globalThis, "window", { configurable: true, value: original });
      }
    }
  });

  it("wires Home Ask and both chat views to auto-send once and open a fresh chat on tab switch", () => {
    const tile = readFileSync("src/components/ask-tile.tsx", "utf8");
    assert.match(tile, /action="\/chat"/);
    assert.match(tile, /name="q"/);
    assert.match(tile, /name="mode"/);
    assert.match(tile, /name="ask"/);
    assert.match(tile, /crypto\.randomUUID\(\)/);

    const page = readFileSync("src/app/(app)/chat/page.tsx", "utf8");
    assert.match(page, /parseHomeAsk/);
    assert.doesNotMatch(page, /never auto-send/);
    assert.match(page, /initialDraft=\{q\}/);
    assert.match(page, /askId=\{ask\}/);

    const panel = readFileSync("src/components/chat-panel.tsx", "utf8");
    assert.match(panel, /beginHomeAsk/);
    assert.match(panel, /stripHomeAskFromUrl/);
    assert.match(panel, /shouldAdoptNewConversation/);
    assert.match(panel, /href=\{`\/chat\?mode=\$\{item\.id\}`\}/);
    assert.doesNotMatch(panel, /onClick=\{\(\) => setMode\("general"\)\}/);
    assert.doesNotMatch(panel, /onClick=\{\(\) => setMode\("mandara"\)\}/);

    const app = readFileSync("src/components/chat-app/chat-app.tsx", "utf8");
    assert.match(app, /beginHomeAsk/);
    assert.match(app, /stripHomeAskFromUrl/);
    assert.match(app, /shouldAdoptNewConversation/);
    assert.match(app, /href=\{`\/chat\?mode=\$\{item\.id\}`\}/);
    assert.match(app, /key=\{conversationId \|\| `new-\$\{tab\}`\}/);
    assert.match(page, /<ChatPanel key=\{mode\}/);
  });
});
