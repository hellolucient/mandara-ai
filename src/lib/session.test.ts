import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("session module structure", () => {
  it("exports currentMember as a function", async () => {
    const { currentMember } = await import("./session.js");
    assert.equal(typeof currentMember, "function");
  });
  
  it("exports requireMember as a function", async () => {
    const { requireMember } = await import("./session.js");
    assert.equal(typeof requireMember, "function");
  });
  
  it("exports isResponse type guard", async () => {
    const { isResponse } = await import("./session.js");
    assert.equal(typeof isResponse, "function");
    
    // Test the type guard with a Response
    const response = new Response("test");
    assert.equal(isResponse(response), true);
    
    // Test with a non-Response object
    const notResponse = { role: "admin" };
    assert.equal(isResponse(notResponse), false);
  });
});
