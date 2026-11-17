import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { companyPrompt, EMPTY_PROFILE, isPlaceholderProfile, parseCompanyProfile, profileFromForm, profileToForm } from "./company-profile";
import { initialCompanyProfile } from "./company-profile-seed";
import { sql } from "./db";
import { splitSql } from "./schema-source";
import { buildLexicon, routeQuestion, storedGapMessage } from "./mandara-context";

describe("company profile", () => {
  it("round-trips the admin form and ignores a broken saved value", () => {
    const profile = profileFromForm({
      description: "We operate hotel spas in the Maldives.",
      spasText: "Adaaran Prestige Vadoo | Vadoo, Vadou\nHakuraa",
      peopleText: "Amina Shah | Spa director",
      contractsText: "Adaaran management agreement | Adaaran",
      keywordsText: "elemis\nmandara menu",
    });
    const form = profileToForm(profile);
    assert.equal(profileFromForm(form).spas[0]?.status, "open");
    assert.equal(profileFromForm(form).spas[0]?.aliases.join(","), "Vadoo,Vadou");
    assert.equal(profileFromForm(form).people[0]?.role, "Spa director");
    const withStatus = profileFromForm({ spasText: "Thulusdhoo | declined | VISSNA, Visana" });
    assert.equal(withStatus.spas[0]?.status, "declined");
    assert.equal(withStatus.spas[0]?.aliases.join(","), "VISSNA,Visana");
    assert.equal(parseCompanyProfile("not json").description, "");
    assert.deepEqual(parseCompanyProfile("not json").spas, []);
    assert.equal(EMPTY_PROFILE.keywords.length, 0);
  });

  it("puts the description in the prompt and leaves an empty profile quiet", () => {
    assert.equal(companyPrompt(EMPTY_PROFILE, []), "");
    const text = companyPrompt(
      profileFromForm({ description: "Hotel spas across the Maldives.", spasText: "Hakuraa" }),
      ["Cinnamon Velifushi"],
    );
    assert.match(text, /Hotel spas across the Maldives/);
    assert.match(text, /Hakuraa/);
    assert.match(text, /Cinnamon Velifushi/);
    assert.match(text, /not an instruction/);
  });

  it("merges profile aliases with stored locations and menu names", () => {
    const lexicon = buildLexicon({
      locations: ["Cinnamon Velifushi"],
      menuTitles: ["Elemis ritual menu"],
      profile: profileFromForm({
        spasText: "Adaaran Prestige Vadoo | Vadoo",
        peopleText: "Amina Shah | Spa director",
        keywordsText: "gold ritual",
      }),
    });
    assert.equal(routeQuestion("retail at Velifushi", lexicon).lane, "company");
    assert.equal(routeQuestion("ask Amina Shah about the roster", lexicon).lane, "company");
    assert.equal(routeQuestion("What is the gold ritual?", lexicon).lane, "company");
    assert.equal(routeQuestion("Do we sell Elemis?", lexicon).lane, "company");
    assert.equal(routeQuestion("What is a hydrafacial?", lexicon).lane, "general");
  });

  it("loads Trent's draft without showing the unchecked notes to the model", () => {
    const profile = initialCompanyProfile();
    const prompt = companyPrompt(profile);
    assert.equal(profile.spas.length, 18);
    assert.equal(profile.people.length, 8);
    assert.equal(profile.contacts.length, 7);
    assert.equal(profile.contracts.length, 12);
    assert.match(profile.description, /C-0321\/2000/);
    assert.match(profile.description, /21 October 2026/);
    assert.equal(profile.spas.find((spa) => spa.name.includes("Vadoo"))?.status, "open");
    assert.equal(profile.spas.find((spa) => spa.name.includes("Whale Lagoon"))?.status, "closed");
    assert.equal(profile.spas.find((spa) => spa.name === "Thulusdhoo"), undefined);
    assert.ok(profile.spas.find((spa) => spa.name.includes("Vadoo"))?.aliases.includes("Vaadhoo"));
    assert.equal(profile.people.find((person) => person.name.startsWith("Tenille"))?.aliases.includes("Tenille"), true);
    assert.match(profile.adminNotes, /Still to confirm/);
    assert.doesNotMatch(prompt, /Still to confirm/);
    assert.doesNotMatch(prompt, /\[check\]/i);
    assert.match(prompt, /Tenille Jade Keats/);
    assert.match(prompt, /Tranquility/);
    // Prospects and deals live in the admin-only Prospects tab, never in the profile the assistant reads.
    assert.doesNotMatch(JSON.stringify(profile), /manhattan|hulhumal|thulusdhoo|vissna|visana|naeem|thompey|guest-house|negotiation|prospect/i);
    const lexicon = buildLexicon({ profile });
    assert.equal(routeQuestion("At Vadoo, what's the price of a Balinese massage?", lexicon).lane, "company");
    assert.equal(routeQuestion("What's the weather in Vadoo?", lexicon).web, true);
    assert.equal(routeQuestion("What is a hydrafacial?", lexicon).lane, "general");
    assert.equal(routeQuestion("what visa do I need for Switzerland?", lexicon).lane, "general");
    assert.equal(routeQuestion("Who is Tenille?", lexicon).lane, "company");
    assert.equal(routeQuestion("what's our capture rate?", lexicon).lane, "company");
  });

  it("does not treat a saved profile as the empty placeholder", () => {
    assert.equal(isPlaceholderProfile(""), true);
    assert.equal(isPlaceholderProfile('{"description":"","spas":[],"people":[],"contracts":[],"keywords":[]}'), true);
    assert.equal(isPlaceholderProfile('{"description":"We operate spas.","spas":[],"people":[],"contacts":[],"contracts":[],"keywords":[],"adminNotes":""}'), false);
    assert.equal(isPlaceholderProfile("not json"), false);
    const migration = readFileSync("migrations/008_company_profile_seed.sql", "utf8");
    assert.match(migration, /companyProfile/);
    assert.match(migration, /not exists/);
    assert.doesNotMatch(migration, /do update set value/);
    assert.match(migration, /\$profile\$/);
  });

  it("offers a web search instead of inventing a missing company answer", () => {
    const message = storedGapMessage("Adaaran Prestige Vadoo");
    assert.match(message, /Adaaran Prestige Vadoo/);
    assert.match(message, /have not invented/);
    assert.match(message, /search the web/);
    assert.doesNotMatch(message, /I don't have that in any company record/);
  });
});

describe("migration 015: prospects out of the stored profile", () => {
  const stored = (): string => {
    const migration = readFileSync("migrations/008_company_profile_seed.sql", "utf8");
    const match = /\$profile\$([\s\S]*?)\$profile\$/.exec(migration);
    assert.ok(match);
    return match[1];
  };
  const run = async () => {
    for (const statement of splitSql(readFileSync("migrations/015_profile_remove_prospects.sql", "utf8"))) await sql(statement);
  };
  const read = async (stage: string) =>
    (await sql<{ value: string }>("select value from settings where stage = $1 and key = 'companyProfile'", [stage]))[0]?.value ?? "";

  it("turns the profile migration 008 stored into today's seed, and is idempotent", async () => {
    await sql("insert into settings (stage, key, value) values ('m015-seed', 'companyProfile', $1)", [stored()]);
    await run();
    const once = await read("m015-seed");
    assert.deepEqual(parseCompanyProfile(once), initialCompanyProfile());
    await run();
    assert.equal(await read("m015-seed"), once);
  });

  it("removes only deal lines from a profile Trent edited, keeping his own changes", async () => {
    const edited = JSON.parse(stored()) as Record<string, unknown> & { keywords: string[]; adminNotes: string; description: string };
    edited.description += " Trent added this sentence.";
    edited.keywords = [...edited.keywords, "Trent keyword"];
    edited.adminNotes += "\n- Trent's own note.";
    await sql("insert into settings (stage, key, value) values ('m015-edit', 'companyProfile', $1)", [JSON.stringify(edited)]);
    await run();
    const after = parseCompanyProfile(await read("m015-edit"));
    assert.match(after.description, /Trent added this sentence\.$/);
    assert.ok(after.keywords.includes("Trent keyword"));
    assert.match(after.adminNotes, /- Trent's own note\.$/);
    assert.doesNotMatch(JSON.stringify(after), /manhattan|hulhumal|thulusdhoo|vissna|visana|naeem|thompey|guest-house/i);
    assert.equal(after.spas.length, 18);
    assert.equal(after.contacts.length, 7);
    assert.equal(after.contracts.length, 12);
    assert.match(after.adminNotes, /Madifushi was a Mandara spa/);
  });

  it("leaves a profile with nothing to remove byte for byte as it was", async () => {
    const clean = '{"description":"We operate spas.","spas":[],"people":[],"contacts":[],"contracts":[],"keywords":["DSR"],"adminNotes":""}';
    await sql("insert into settings (stage, key, value) values ('m015-clean', 'companyProfile', $1)", [clean]);
    await run();
    assert.equal(await read("m015-clean"), clean);
  });
});
