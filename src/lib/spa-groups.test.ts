import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { groupSpasByBrand, spaDisplayName, sortSpaNamesByBrand } from "@/lib/spa-groups";

describe("spa-groups", () => {
  it("shows NOOE label for Kunaavashi only in display", () => {
    assert.equal(spaDisplayName("Kunaavashi"), "NOOE Kunaavashi");
    assert.equal(spaDisplayName("Vadoo"), "Vadoo");
  });

  it("groups and sorts by revenue within brand", () => {
    const rows = [
      { spa: "Vadoo", usd: 100 },
      { spa: "Dhonveli", usd: 500 },
      { spa: "Ellaidhoo", usd: 200 },
      { spa: "Hakuraa Huraa", usd: 300 },
      { spa: "Nasandhura", usd: 50 },
    ];
    const grouped = groupSpasByBrand(
      rows,
      (r) => r.usd,
      (r) => r.spa,
    );
    assert.equal(grouped[0]?.groupLabel, "Cinnamon");
    assert.deepEqual(
      grouped[0]?.items.map((r) => r.spa),
      ["Dhonveli", "Hakuraa Huraa", "Ellaidhoo"],
    );
    assert.equal(grouped[1]?.groupLabel, "Adaaran");
    assert.deepEqual(grouped[1]?.items.map((r) => r.spa), ["Vadoo"]);
    assert.equal(grouped[2]?.groupLabel, "Single resorts");
    assert.deepEqual(grouped[2]?.items.map((r) => r.spa), ["Nasandhura"]);
  });

  it("sortSpaNamesByBrand flattens grouped order", () => {
    const order = sortSpaNamesByBrand(
      ["Dhonveli", "Vadoo", "Ellaidhoo"],
      new Map([
        ["Dhonveli", 1],
        ["Vadoo", 50],
        ["Ellaidhoo", 40],
      ]),
    );
    assert.deepEqual(order, ["Ellaidhoo", "Dhonveli", "Vadoo"]);
  });
});