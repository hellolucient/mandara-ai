import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aggregateMixTotals,
  mapRetailBrand,
  mapRetailBrandByCode,
  mapTreatmentSection,
  UNMAPPED_LABEL,
} from "@/lib/item-groups";

const KNOWN_TREATMENTS = [
  "AI Stress Relief",
  "Abhyanga 60 min",
  "Asian Foot Massage 60 Min",
  "Asian Head Massage",
  "Asian Head Massage 60",
  "BALINESE MASSAGE 60MINS",
  "Back Neck and Scalp Massage",
  "Balinese Massage 60",
  "Balinese Massage 90",
  "Chavana Massage 1 hr / 60 mins",
  "Elemis Body Nectar Nourishing Wrap - Frangipani",
  "Elemis Intensely Cleansing Salt Scrub - Lime and",
  "Elemis Pro-Collagen Age Defy",
  "Elemis Pro-Glow Smooth",
  "Express Massage",
  "Fancy Foot Work 60",
  "Foot Massage",
  "Frangipani Body Glow",
  "Harmony 1 hr 45 Mins",
  "Heaven And Earth",
  "Honeymoon Package",
  "Mandara Massage 60",
  "Mandara Massage 90 Min",
  "Pure Nature Facial 60",
  "SHIROBHYANGAM",
  "Spa Discovery",
  "Spa Membership Card",
  "Tension Relief Massage 90",
  "Traditional Body Treatment 45 min",
  "Warm Stone Massage 60",
  "Yin and Yang",
] as const;

/** Names that still map via explicit overrides or clear family keywords (no SKU). */
const KNOWN_RETAIL_BY_NAME = [
  "balinese herbal massage oil 100ml with box",
  "kit: pro-collagen prep & replenish routine",
  "mandara lavender massage & body oil 100ml",
  "mandara lemongrass massage & body oil 100ml",
  "mandara mango massage & body oil 100ml",
  "mandara sakura massage & body oil 100ml",
  "mandara spice massage",
  "ms flower power conditioner 300ml",
  "ms flower power shampoo 300ml",
  "ms flower power spray 350ml",
  "pro-collagen black cherry cleansing balm 100g",
  "pro-collagen energising marine cleanser 150ml",
  "pro-radiance hand and nail cream 100 ml",
] as const;

/** Legacy name-only rows that should no longer fall through to Elemis. */
const NAME_ONLY_UNMAPPED_RETAIL = [
  "aloe vera after sun body gel 200g",
  "balancing lavender toner 200ml",
  "calm sea salt bath 200 g",
  "coconut body scrub cream 200g",
  "frangipani fragrant oil 15ml",
  "frangipani monoi body cream 200ml",
  "frangipani monoi salt glow body scrub 490g",
  "glow sea salt bath 200 g",
  "instant refreshing gel 150 ml",
  "jasmine body lotion 250ml",
  "kakadu plum lip balm spf50+ 10ml",
  "lemongrass essential oil 15ml",
  "mango body lotion 250ml",
  "mango body scrub cream 200g",
  "mango hand & body wash 200ml",
  "rose geranium essential oil 15ml",
  "skin nourishing shower cream 300 ml",
  "tropical blossom sea salt bath 200 g",
  "tropical body mask cream 200g",
] as const;

describe("item-groups treatment mapping", () => {
  it("maps known menu packages and Elemis treatments", () => {
    assert.equal(mapTreatmentSection("Yin and Yang"), "Packages");
    assert.equal(mapTreatmentSection("Honeymoon Package"), "Packages");
    assert.equal(mapTreatmentSection("Elemis Pro-Collagen Age Defy"), "Elemis");
    assert.equal(mapTreatmentSection("Pure Nature Facial 60"), "Face of Mandara");
    assert.equal(mapTreatmentSection("Balinese Massage 60"), "Body of Mandara");
    assert.equal(mapTreatmentSection("Express Massage"), "Enhancements");
    assert.equal(mapTreatmentSection("SHIROBHYANGAM"), "More of Mandara");
  });

  it("maps every known treatment name away from Unmapped", () => {
    const unmapped: string[] = [];
    for (const name of KNOWN_TREATMENTS) {
      const section = mapTreatmentSection(name);
      if (section === UNMAPPED_LABEL) unmapped.push(name);
    }
    assert.deepEqual(unmapped, [], `Unmapped treatments: ${unmapped.join(", ")}`);
  });
});

describe("item-groups retail mapping", () => {
  it("maps Mandara, Elemis, and Milk Shake lines by name", () => {
    assert.equal(mapRetailBrand("mandara mango massage & body oil 100ml"), "Mandara Spa (Alodia)");
    assert.equal(mapRetailBrand("pro-collagen energising marine cleanser 150ml"), "Elemis");
    assert.equal(mapRetailBrand("ms flower power shampoo 300ml"), "Milk Shake");
  });

  it("maps retail by SKU prefix when present", () => {
    assert.equal(mapRetailBrand("tropical blossom sea salt bath 200 g", { itemCode: "26MS34" }), "Mandara Spa (Alodia)");
    assert.equal(mapRetailBrand("glow sea salt bath 200 g", { itemCode: "26MS33" }), "Mandara Spa (Alodia)");
    assert.equal(
      mapRetailBrand("kakadu plum lip balm spf50+ 10ml", { itemCode: "WAFG003" }),
      "We Are Feel Good",
    );
    assert.equal(mapRetailBrand("pro-collagen energising marine cleanser 150ml", { itemCode: "ELMRRP001" }), "Elemis");
    assert.equal(
      mapRetailBrand("ms flower power conditioner 300ml", { itemCode: "MSH002", supplier: "Mandaraspa" }),
      "Milk Shake",
    );
    assert.equal(mapRetailBrandByCode("ALO1001"), "Mandara Spa (Alodia)");
    assert.equal(mapRetailBrandByCode("782910"), "Elemis");
  });

  it("maps every known retail name (clear families) away from Unmapped", () => {
    const unmapped: string[] = [];
    for (const name of KNOWN_RETAIL_BY_NAME) {
      const brand = mapRetailBrand(name);
      if (brand === UNMAPPED_LABEL) unmapped.push(name);
    }
    assert.deepEqual(unmapped, [], `Unmapped retail: ${unmapped.join(", ")}`);
  });

  it("leaves ambiguous legacy name-only rows as Unmapped", () => {
    for (const name of NAME_ONLY_UNMAPPED_RETAIL) {
      assert.equal(mapRetailBrand(name), UNMAPPED_LABEL, name);
    }
  });
});

describe("aggregateMixTotals", () => {
  it("rolls up net sales and lists unmapped names", () => {
    const result = aggregateMixTotals([
      { category: "treatment", itemName: "Balinese Massage 60", netSales: 100 },
      { category: "retail", itemName: "mandara mango massage & body oil 100ml", netSales: 40 },
      { category: "treatment", itemName: "Unknown Menu Line", netSales: 10 },
    ]);
    assert.equal(result.treatments["Body of Mandara"], 100);
    assert.equal(result.retail["Mandara Spa (Alodia)"], 40);
    assert.deepEqual(result.unmappedTreatmentNames, ["Unknown Menu Line"]);
    assert.deepEqual(result.unmappedRetailNames, []);
  });

  it("uses SKU when aggregating retail mix", () => {
    const result = aggregateMixTotals([
      {
        category: "retail",
        itemName: "glow sea salt bath 200 g",
        itemCode: "26MS33",
        netSales: 25,
      },
    ]);
    assert.equal(result.retail["Mandara Spa (Alodia)"], 25);
    assert.deepEqual(result.unmappedRetailNames, []);
  });
});