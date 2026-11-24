import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseItemsQuery } from "./sales-items-query";

describe("sales items API query", () => {
  it("parses a single business date", () => {
    const q = parseItemsQuery({ date: "2026-11-20" });
    assert.equal(q.ok, true);
    if (!q.ok) return;
    assert.equal(q.mode, "day");
    assert.equal(q.fromDate, "2026-11-20");
  });

  it("parses an inclusive range", () => {
    const q = parseItemsQuery({ from: "2026-11-01", to: "2026-11-14" });
    assert.equal(q.ok, true);
    if (!q.ok) return;
    assert.equal(q.mode, "range");
  });

  it("rejects reversed ranges", () => {
    const q = parseItemsQuery({ from: "2026-11-10", to: "2026-11-01" });
    assert.equal(q.ok, false);
  });
});