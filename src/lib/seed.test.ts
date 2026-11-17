import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sql } from "./db";
import { ensureSeed } from "./seed";
import { getSettings } from "./settings";
import { getCompanyProfile } from "./company-profile";

describe("seed functionality", () => {
  it("seeds default settings including reasoning model on fresh stage", async () => {
    // REGRESSION: Bug #2 - Reasoning model setting was missing in fresh DB
    const testStage = `test-${Date.now()}`;
    
    // Ensure seed runs
    await ensureSeed(testStage);
    
    // Verify settings were created
    const settings = await getSettings(testStage);
    assert.equal(settings.model, "deepseek/deepseek-v4.1-flash", "Default model should be seeded");
    assert.equal(settings.reasoningModel, "deepseek/deepseek-v4-pro", "Reasoning model should be seeded");
    assert.equal(settings.imageModel, "google/gemini-2.5-flash-image", "Image model should be seeded");
    assert.equal(settings.currency, "USD", "Currency should be seeded");
    assert.equal(settings.companyName, "Mandara Spa Maldives", "Company name should be seeded");
    
    // Clean up
    await sql("delete from settings where stage = $1", [testStage]);
    await sql("delete from documents where stage = $1", [testStage]);
    await sql("delete from chunks where stage = $1", [testStage]);
    await sql("delete from locations where stage = $1", [testStage]);
    await sql("delete from sales_days where stage = $1", [testStage]);
  });

  it("seeds company profile from Trent's draft on fresh stage", async () => {
    // REGRESSION: Bug #3 - Company profile wasn't appearing in Admin
    const testStage = `test-${Date.now()}`;
    
    // Ensure seed runs
    await ensureSeed(testStage);
    
    // Verify company profile was seeded
    const profile = await getCompanyProfile(testStage);
    assert.ok(profile.description.includes("Mandara Spa (Maldives)"), "Profile description should be seeded");
    assert.ok(profile.spas.length > 0, "Spas should be seeded");
    assert.ok(profile.people.length > 0, "People should be seeded");
    assert.ok(profile.contacts.length > 0, "Contacts should be seeded");
    assert.ok(profile.contracts.length > 0, "Contracts should be seeded");
    assert.ok(profile.keywords.length > 0, "Keywords should be seeded");
    
    // Verify specific spa entries
    const vadoo = profile.spas.find(spa => spa.name.includes("Vadoo"));
    assert.ok(vadoo, "Vadoo spa should be in seeded profile");
    assert.equal(vadoo?.status, "open", "Vadoo should be marked as open");
    
    // Clean up
    await sql("delete from settings where stage = $1", [testStage]);
    await sql("delete from documents where stage = $1", [testStage]);
    await sql("delete from chunks where stage = $1", [testStage]);
    await sql("delete from locations where stage = $1", [testStage]);
    await sql("delete from sales_days where stage = $1", [testStage]);
  });
});
