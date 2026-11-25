import assert from "node:assert/strict";
import test from "node:test";
import {
  PROMO_CATEGORY_ORDER,
  PROMO_DISCOUNT_CATEGORY_ORDER,
  discountedPromoUsd,
  fullPricePromoUsd,
  isFullPriceCode,
  promoCategoryForCode,
  promoCategoryLabel,
  promoCategorySortKey,
  slicesFromUsdByCategory,
} from "@/lib/promo-categories";

test("Tenille category order is fixed (6 categories, Full Price last)", () => {
  assert.deepEqual(PROMO_CATEGORY_ORDER, [
    "stay_discounts",
    "spa_credit",
    "jet_lag_recovery",
    "massage_credit",
    "other",
    "full_price",
  ]);
  assert.equal(PROMO_DISCOUNT_CATEGORY_ORDER.length, 5);
  assert.ok(!PROMO_DISCOUNT_CATEGORY_ORDER.includes("full_price"));
});

test("maps stay + discovery codes into one category", () => {
  assert.equal(promoCategoryForCode("RI15"), "stay_discounts");
  assert.equal(promoCategoryForCode("CD15"), "stay_discounts");
  assert.equal(promoCategoryForCode("GHA"), "stay_discounts");
  assert.equal(promoCategoryLabel("CD15"), "Stay discounts 15%, 20%, 15% Discovery");
});

test("maps spa credit, jet lag, massage, full price", () => {
  assert.equal(promoCategoryForCode("CR50"), "spa_credit");
  assert.equal(promoCategoryLabel("CR50"), "$50 Spa Credit");
  assert.equal(promoCategoryForCode("JLR"), "jet_lag_recovery");
  assert.equal(promoCategoryLabel("JLR"), "Jet Lag Recovery");
  assert.equal(promoCategoryForCode("MC"), "massage_credit");
  assert.equal(promoCategoryLabel("MC"), "Massage Credit Packages");
  assert.equal(promoCategoryForCode("FP"), "full_price");
  assert.equal(promoCategoryLabel("FP"), "Full Price");
  assert.equal(promoCategoryForCode("MV"), "full_price");
  assert.equal(promoCategoryForCode("GM"), "full_price");
  assert.equal(isFullPriceCode("MV"), true);
  assert.equal(isFullPriceCode("GM"), true);
});

test("airline crew stays in Other, not Full Price", () => {
  assert.equal(promoCategoryForCode("AC"), "other");
  assert.equal(isFullPriceCode("AC"), false);
});

test("blank and unknown map to other", () => {
  assert.equal(promoCategoryForCode(""), "other");
  assert.equal(promoCategoryForCode("ZZ99"), "other");
});

test("discount totals exclude Full Price", () => {
  const totals = { stay_discounts: 100, full_price: 40, other: 10 };
  assert.equal(discountedPromoUsd(totals), 110);
  assert.equal(fullPricePromoUsd(totals), 40);
  assert.equal(isFullPriceCode("FP"), true);
  assert.equal(isFullPriceCode("MC"), false);
});

test("slices keep Full Price last with segment marker", () => {
  const slices = slicesFromUsdByCategory({
    spa_credit: 50,
    full_price: 40,
    massage_credit: 100,
  });
  assert.equal(slices.length, 3);
  assert.equal(slices.at(-1)?.id, "full_price");
  assert.equal(slices.at(-1)?.segment, "full_price");
  assert.equal(slices[0]?.segment, "discount");
});

test("sort key puts Full Price after discounted categories", () => {
  assert.ok(promoCategorySortKey("RI15").localeCompare(promoCategorySortKey("FP")) < 0);
  assert.ok(promoCategorySortKey("MC").localeCompare(promoCategorySortKey("FP")) < 0);
});