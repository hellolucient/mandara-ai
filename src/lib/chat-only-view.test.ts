import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { apiAllowed, canSeeContracts, pageAllowed, usesChatOnlyView } from "./access";
import { canSeeProspects } from "./prospects-access";
import { askPlaceholder } from "./ask-placeholder";
import { buildPicturePrompt, isCreativeMandaraTask, PRINTABLE_CARD_BRIEF, storedGapMessage } from "./mandara-context";
import {
  chatDisclaimer,
  chatSuggestions,
  chatTab,
  firstName,
  greeting,
  groupConversations,
  initials,
  salesAnswerMarkdown,
  splitSalesSource,
} from "./chat-view";
import { cleanTitle } from "./chat";
import { findLocation, parseSalesQuestion, storedSalesIntent } from "./sales-questions";
import { answerSales } from "./sales-answers";

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

  it("routes every Mandara card to stored figures and leaves every General card to the model", () => {
    const [sales, compare, hakuraa, budget] = chatSuggestions("mandara");
    assert.deepEqual(parseSalesQuestion(sales.prompt, STORED), { kind: "total" });
    assert.deepEqual(parseSalesQuestion(compare.prompt, STORED), { kind: "comparison", period: "this-month" });
    assert.deepEqual(parseSalesQuestion(hakuraa.prompt, STORED), { kind: "location", name: "Hakuraa Huraa" });
    assert.deepEqual(parseSalesQuestion(budget.prompt, STORED), { kind: "below-budget" });
    for (const card of chatSuggestions("general")) assert.equal(storedSalesIntent(card.prompt, STORED), null, card.id);
  });

  it("answers one spa's month to date from stored figures", () => {
    assert.deepEqual(parseSalesQuestion("How is Vadoo doing this month?", STORED), { kind: "location-month", name: "Vadoo" });
    assert.deepEqual(parseSalesQuestion("Hakuraa sales month to date", STORED), { kind: "location-month", name: "Hakuraa Huraa" });
    assert.deepEqual(parseSalesQuestion("Which spas have the highest sales this month?", STORED), { kind: "comparison", period: "this-month" });
    const day = (date: string, vadoo: number, hakuraa: number) => ({
      businessDate: date,
      source: "import" as const,
      currency: "USD",
      complete: true,
      note: "",
      lines: [
        { locationId: "vadoo", locationName: "Vadoo", netSales: vadoo, treatments: 5, budget: 500 },
        { locationId: "hakuraa-huraa", locationName: "Hakuraa Huraa", netSales: hakuraa, treatments: 20, budget: null },
      ],
    });
    const text = answerSales({ kind: "location-month", name: "Vadoo" }, [day("2026-11-01", 600, 2000), day("2026-11-02", 400, 2100), day("2026-10-31", 9999, 1)], "2026-11-03");
    assert.match(text, /Vadoo · month to date \(1 Nov – 2 Nov 2026\)/);
    assert.match(text, /Net sales: \$1,000 over 2 recorded days/);
    assert.match(text, /Treatment guests: 10/);
    assert.match(text, /Budget pace: \$1,000 against \$1,000/);
    assert.match(text, /Rank: 2 of 2 spas/);
  });

  it("tells the model to keep guest writing Maldivian, with no Bula or Aloha", () => {
    const chat = readFileSync("src/lib/chat.ts", "utf8");
    assert.match(chat, /Maldives resort/);
    assert.match(chat, /Never use greetings or phrases from other places, such as Bula, Aloha/);
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

  it("defaults unknown tabs to General", () => {
    assert.equal(chatTab("mandara"), "mandara");
    assert.equal(chatTab("general"), "general");
    assert.equal(chatTab(undefined), "general");
    assert.equal(chatTab("prospects"), "general");
  });

  it("opens a fresh empty chat when the other tab is chosen, and keeps the new placeholders", () => {
    const view = readFileSync("src/components/chat-app/chat-app.tsx", "utf8");
    // The inactive tab is a link to /chat?mode=… so the current conversation is left and no message is sent.
    assert.ok(view.includes("href={`/chat?mode=${item.id}`}"), "inactive tab links to a new empty chat");
    assert.doesNotMatch(view, /onTab=\{setTab\}/);
    assert.doesNotMatch(view, /onClick=\{\(\) => onTab\(item\.id\)\}/);
    assert.match(view, /placeholder=\{askPlaceholder\(tab\)\}/);
    assert.equal(askPlaceholder("mandara"), "What would you like to know about Mandara today?");
    assert.equal(askPlaceholder("general"), "What's on your mind?");
  });

  it("checks sales before the General-mode model in chat", () => {
    const chat = readFileSync("src/lib/chat.ts", "utf8");
    assert.match(chat, /resolveSalesIntent\(content, names/);
    assert.match(chat, /previousAssistantWasSales: previousAssistant\?\.mode === "sales"/);
    assert.match(chat, /strict: conversationMode !== "mandara"/);
  });

  it("lets a creative follow-up through and still declines a fact with no stored data", () => {
    assert.equal(isCreativeMandaraTask("pls create a nice little promo card for each of these ideas"), true);
    assert.equal(isCreativeMandaraTask("Suggest three seasonal spa promotions for December."), true);
    assert.equal(isCreativeMandaraTask("What is the price of a Balinese massage at Vadoo?"), false);
    assert.equal(isCreativeMandaraTask("How many spas do we have?"), false);
    assert.equal(isCreativeMandaraTask("How did Hakuraa do yesterday?"), false);
    const printFollowUp =
      "that's the general idea, but i just want the card///not the card placed on a counter. so i can print the image you gave me and then i can place it in the spa";
    assert.equal(isCreativeMandaraTask(printFollowUp), true);
    assert.equal(isCreativeMandaraTask("just the card, not on the counter, so I can print it"), true);
    assert.equal(isCreativeMandaraTask("make it flatter"), false);
    assert.equal(isCreativeMandaraTask("make it flatter", { priorImage: true }), true);
    assert.equal(isCreativeMandaraTask("What is the price of a Balinese massage at Vadoo?", { priorImage: true }), false);
    const printable = buildPicturePrompt(printFollowUp, [
      "Create a promo card for a couples massage sitting on a spa reception counter, with spa images and [price].",
    ]);
    assert.match(printable.prompt, /flat, front-on, edge-to-edge/i);
    assert.match(printable.prompt, /no reception counter/i);
    assert.match(printable.prompt, /\[price\]/);
    assert.match(printable.prompt, /Mandara/);
    assert.match(printable.prompt, /just want the card/i);
    assert.equal(printable.aspectRatio, "2:3");
    assert.match(PRINTABLE_CARD_BRIEF, /portrait card ratio/i);
    const chat = readFileSync("src/lib/chat.ts", "utf8");
    assert.match(chat, /!creativeTask/);
    assert.match(chat, /priorImage/);
    assert.match(chat, /Never say you cannot generate or provide image files/);
    assert.match(chat, /just-the-card version/);
    assert.match(chat, /knowledgeAnswer\(/);
    assert.match(chat, /\[price\]/);
    assert.match(chat, /```promo/);
    assert.match(chat, /do not output a promo block yet/);
    assert.match(chat, /even if the ideas already appeared earlier/);
    assert.match(storedGapMessage(null), /have not invented/);
    assert.match(storedGapMessage("Vadoo"), /Vadoo/);
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

  it("changes the composer footnote in General", () => {
    assert.equal(chatDisclaimer("mandara"), "Mandara AI can make mistakes. Check important figures against the DSR.");
    assert.equal(chatDisclaimer("general"), "Mandara AI can make mistakes.");
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
