import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sql } from "./db";
import { ensureSeed } from "./seed";
import { getSettings } from "./settings";
import { getCompanyProfile } from "./company-profile";

describe("seed functionality", () => {
  it("never seeds sample data into production stage", async () => {
    // Ensure seed is called for production
    await ensureSeed("production");
    
    // Verify no sample sales days exist
    const sampleDays = await sql<{ count: number }>(
      "select count(*)::int as count from sales_days where stage = 'production' and source = 'sample'",
    );
    assert.equal(sampleDays[0]?.count, 0, "Production should have no sample sales days");
    
    // Verify no sample documents exist
    const sampleDocs = await sql<{ count: number }>(
      "select count(*)::int as count from documents where stage = 'production' and sample = true",
    );
    assert.equal(sampleDocs[0]?.count, 0, "Production should have no sample documents");
    
    // Verify no sample locations exist
    const sampleLocs = await sql<{ count: number }>(
      `select count(*)::int as count from locations 
       where stage = 'production' and id in ('velifushi', 'north-male', 'south-ari', 'baa', 'male-house')`,
    );
    assert.equal(sampleLocs[0]?.count, 0, "Production should have no sample locations");
  });
  
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
    assert.equal(settings.visionModel, "google/gemini-2.5-flash", "Vision model should be seeded");
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
