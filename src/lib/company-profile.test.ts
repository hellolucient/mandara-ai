import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { companyPrompt, EMPTY_PROFILE, parseCompanyProfile, profileFromForm, profileToForm } from "./company-profile";
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
    assert.equal(profileFromForm(form).spas[0]?.aliases.join(","), "Vadoo,Vadou");
    assert.equal(profileFromForm(form).people[0]?.role, "Spa director");
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

  it("offers a web search instead of inventing a missing company answer", () => {
    const message = storedGapMessage("Adaaran Prestige Vadoo");
    assert.match(message, /Adaaran Prestige Vadoo/);
    assert.match(message, /have not invented/);
    assert.match(message, /search the web/);
    assert.doesNotMatch(message, /I don't have that in any company record/);
  });
});
