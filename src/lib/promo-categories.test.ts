import assert from "node:assert/strict";
import test from "node:test";
import { promoCategoryForCode, promoCategoryLabel, slicesFromUsdByCategory } from "@/lib/promo-categories";

test("maps credit families distinctly", () => {
  assert.equal(promoCategoryForCode("CR50"), "adaaran_spa_credit");
  assert.equal(promoCategoryForCode("SCPAI"), "adaaran_spa_credit");
  assert.equal(promoCategoryForCode("MC"), "massage_credit");
  assert.equal(promoCategoryLabel("MC"), "Massage credit");
  assert.equal(promoCategoryLabel("CR50"), "Adaaran spa credit");
});

test("stay and discovery codes", () => {
  assert.equal(promoCategoryForCode("RI15"), "stay_discounts");
  assert.equal(promoCategoryForCode("CD15"), "cinnamon_discovery");
  assert.equal(promoCategoryForCode("FP"), "full_price");
});

test("blank and unknown map to other", () => {
  assert.equal(promoCategoryForCode(""), "other");
  assert.equal(promoCategoryForCode("ZZ99"), "other");
});

test("slices omit zero segments", () => {
  const slices = slicesFromUsdByCategory({
    massage_credit: 100,
    adaaran_spa_credit: 50,
    other: 0,
  });
  assert.equal(slices.length, 2);
  assert.equal(slices.find((s) => s.id === "massage_credit")?.usd, 100);
});