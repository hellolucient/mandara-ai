import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { apiAllowed, canSeeContracts, pageAllowed, usesChatOnlyView } from "./access";
import { canSeeProspects } from "./prospects-access";
import {
  chatSuggestions,
  firstName,
  greeting,
  groupConversations,
  initials,
  salesAnswerMarkdown,
  splitSalesSource,
} from "./chat-view";
import { cleanTitle } from "./chat";
import { findLocation, parseSalesQuestion, storedSalesIntent } from "./sales-questions";

const STORED = ["Dhonveli", "Hakuraa Huraa", "Rannalhi", "Meedhupparu", "Vadoo", "Kunaavashi"];

describe("chat-only view: who gets it", () => {
  it("is for chat-only Management and Spa people, never for Admin", () => {
    assert.equal(usesChatOnlyView({ role: "manager", chatOnly: true }), true);
    assert.equal(usesChatOnlyView({ role: "staff", chatOnly: true }), true);
    assert.equal(usesChatOnlyView({ role: "manager", chatOnly: false }), false);
    assert.equal(usesChatOnlyView({ role: "staff" }), false);
    assert.equal(usesChatOnlyView({ role: "admin", chatOnly: true }), false);
    assert.equal(usesChatOnlyView({ role: "admin" }), false);
  });

  it("sends chat-only people away from every dashboard page", () => {
    const demo = { role: "manager", chatOnly: true };
    for (const path of ["/", "/sales", "/knowledge", "/agents", "/memories", "/prospects", "/prospects/abc", "/admin", "/print/sales"]) {
      assert.equal(pageAllowed(demo, path), false, path);
    }
    for (const path of ["/chat", "/chat/abc", "/account/password"]) assert.equal(pageAllowed(demo, path), true, path);
  });

  it("refuses prospects, JC notes, admin, sales and knowledge APIs for chat-only people", () => {
    const demo = { role: "manager", chatOnly: true };
    for (const path of [
      "/api/prospects",
      "/api/prospects/abc",
      "/api/prospects/abc/notes",
      "/api/prospects/abc/signals",
      "/api/prospects/import",
      "/api/admin",
      "/api/admin/users",
      "/api/admin/export",
      "/api/sales/import",
      "/api/knowledge",
      "/api/budgets",
      "/api/agents/sales/run",
    ]) {
      assert.equal(apiAllowed(demo, path), false, path);
    }
    for (const path of ["/api/chat", "/api/conversations/abc", "/api/memories", "/api/auth/logout", "/api/auth/password"]) {
      assert.equal(apiAllowed(demo, path), true, path);
    }
  });

  it("keeps the admin dashboard and APIs open to Admin", () => {
    const trent = { role: "admin", chatOnly: false };
    for (const path of ["/", "/sales", "/prospects", "/admin", "/chat"]) assert.equal(pageAllowed(trent, path), true, path);
    for (const path of ["/api/prospects", "/api/admin/users", "/api/admin/export"]) assert.equal(apiAllowed(trent, path), true, path);
  });

  it("follows the role for data inside chat: prospects never, contracts for Management only", () => {
    assert.equal(canSeeProspects("manager"), false);
    assert.equal(canSeeProspects("staff"), false);
    assert.equal(canSeeContracts("manager"), true);
    assert.equal(canSeeContracts("staff"), false);
  });

  it("wires the app layout, chat pages and APIs to the guard", () => {
    const layout = readFileSync("src/app/(app)/layout.tsx", "utf8");
    assert.match(layout, /pageAllowed\(member, path\)\) redirect\("\/chat"\)/);
    assert.match(layout, /usesChatOnlyView\(member\)\) return <>\{children\}<\/>/);
    // The guard runs before the shell is skipped, so a chat-only person never renders a dashboard page bare.
    assert.ok(layout.indexOf("pageAllowed(member, path)") < layout.indexOf("usesChatOnlyView(member)"));
    for (const page of ["src/app/(app)/chat/page.tsx", "src/app/(app)/chat/[id]/page.tsx"]) {
      assert.match(readFileSync(page, "utf8"), /usesChatOnlyView\(member\)/);
    }
    const conversation = readFileSync("src/app/api/conversations/[id]/route.ts", "utf8");
    assert.match(conversation, /export async function PATCH/);
    assert.equal((conversation.match(/requireMember\(request\)/g) ?? []).length, 2);
    assert.equal((conversation.match(/rejectCrossOrigin\(request\)/g) ?? []).length, 2);
    // Chat never reads prospects.
    assert.doesNotMatch(readFileSync("src/lib/chat.ts", "utf8"), /prospect/i);
  });
});

describe("chat-only view: sales routing", () => {
  it("finds a spa from its short name", () => {
    assert.equal(findLocation("How did Hakuraa do yesterday?", STORED), "Hakuraa Huraa");
    assert.equal(findLocation("hakuraa huraa sales", STORED), "Hakuraa Huraa");
    assert.equal(findLocation("Sales at Vadoo", STORED), "Vadoo");
    assert.equal(findLocation("How is the spa doing?", STORED), undefined);
    assert.equal(findLocation("Kudahuvadhoo", ["Vadoo"]), undefined);
  });

  it("answers both phrasings of a Hakuraa question from stored figures, in both modes", () => {
    for (const question of ["How did Hakuraa do yesterday?", "Hakuraa sales yesterday"]) {
      assert.deepEqual(parseSalesQuestion(question, STORED), { kind: "location", name: "Hakuraa Huraa" }, question);
      assert.deepEqual(storedSalesIntent(question, STORED), { kind: "location", name: "Hakuraa Huraa" }, question);
    }
  });

  it("routes every sales suggestion card to stored figures and leaves the writing cards to the model", () => {
    const [sales, compare, guest, ideas] = chatSuggestions();
    assert.deepEqual(storedSalesIntent(sales.prompt, STORED), { kind: "total" });
    assert.deepEqual(storedSalesIntent(compare.prompt, STORED), { kind: "comparison", period: "this-month" });
    assert.equal(storedSalesIntent(guest.prompt, STORED), null);
    assert.equal(storedSalesIntent(ideas.prompt, STORED), null);
  });

  it("does not hijack tasks that only mention sales", () => {
    for (const question of [
      "Give me ideas to lift sales this month",
      "Write a message to the team about yesterday's sales",
      "If Hakuraa sales doubled, what would the month total be?",
      "Draft a promotion for Vadoo",
    ]) {
      assert.equal(storedSalesIntent(question, STORED), null, question);
    }
  });

  it("reads month to date with or without hyphens", () => {
    assert.deepEqual(parseSalesQuestion("Compare spa sales month to date", STORED), { kind: "mtd" });
    assert.deepEqual(parseSalesQuestion("sales month-to-date", STORED), { kind: "mtd" });
  });

  it("checks sales before the General-mode model in chat", () => {
    const chat = readFileSync("src/lib/chat.ts", "utf8");
    assert.match(chat, /conversationMode === "mandara" \? parseSalesQuestion\(content, names\) : storedSalesIntent\(content, names\)/);
  });
});

describe("chat-only view: helpers", () => {
  const now = new Date("2026-11-18T05:00:00Z"); // 10:00 in the Maldives

  it("groups history into Today, Previous 7 days and Older in Maldives time", () => {
    const groups = groupConversations(
      [
        { id: "a", title: "A", updated_at: "2026-11-18 01:00:00+00" },
        { id: "b", title: "B", updated_at: "2026-11-17T20:30:00Z" }, // 01:30 on the 18th in the Maldives
        { id: "c", title: "C", updated_at: "2026-11-15 09:00:00.5+00" },
        { id: "d", title: "D", updated_at: "2026-11-01 09:00:00+00" },
        { id: "e", title: "E" },
      ],
      now,
    );
    assert.deepEqual(
      groups.map((group) => [group.label, group.items.map((item) => item.id)]),
      [
        ["Today", ["a", "b"]],
        ["Previous 7 days", ["c"]],
        ["Older", ["d", "e"]],
      ],
    );
    assert.deepEqual(groupConversations([], now), []);
  });

  it("greets by first name and time of day", () => {
    assert.equal(greeting("Tenille Demo", now), "Good morning, Tenille");
    assert.equal(greeting("tenille (test)", new Date("2026-11-18T09:00:00Z")), "Good afternoon, Tenille");
    assert.equal(greeting("", new Date("2026-11-18T14:00:00Z")), "Good evening");
    assert.equal(firstName("someone@example.com"), "");
  });

  it("makes avatar initials", () => {
    assert.equal(initials("Tenille Demo"), "TD");
    assert.equal(initials("Trent Munday"), "TM");
    assert.equal(initials("tenille"), "TE");
    assert.equal(initials(""), "M");
  });

  it("cleans conversation titles", () => {
    assert.equal(cleanTitle("  Hakuraa \n numbers  "), "Hakuraa numbers");
    assert.equal(cleanTitle("x".repeat(120)).length, 80);
    assert.equal(cleanTitle("   "), "");
  });

  it("turns stored sales lines into readable Markdown with a table", () => {
    const text = [
      "Sales for 17 Nov 2026.",
      "Source: Steiners DSR, imported from the daily export.",
      "Recorded net sales are $10,234 across 4 locations.",
      "Dhonveli: $1,375. $37 above the stored budget of $1,339.",
      "Hakuraa Huraa: $2,118. No budget is stored.",
      "Ellaidhoo: $445. $324 below the stored budget of $769.",
      "Vadoo: $729. $119 above the stored budget of $610.",
      "Needs attention",
      "Ellaidhoo is below budget.",
    ].join("\n");
    const { body, source } = splitSalesSource(text);
    assert.equal(source, "Source: Steiners DSR, imported from the daily export.");
    const md = salesAnswerMarkdown(body);
    assert.match(md, /\| Spa \| Sales \| vs budget \|/);
    assert.match(md, /\| Dhonveli \| \$1,375 \| \+\$37 \|/);
    assert.match(md, /\| Hakuraa Huraa \| \$2,118 \| — \|/);
    assert.match(md, /\| Ellaidhoo \| \$445 \| −\$324 \|/);
    assert.match(md, /\*\*Needs attention\*\*/);
    assert.match(md, /Sales for 17 Nov 2026\. {2}\n/);
  });
});
