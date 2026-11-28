/**
 * Promo code families for reporting (Tenille / spa director view).
 * Five promotion / discount categories plus Full Price. Full price (FP) is not a promotion: it is never part of the
 * Promotions section's bars or totals, and only appears in the "revenue = promotions + full price + ..." line.
 */

export type PromoCategoryId =
  | "stay_discounts"
  | "spa_credit"
  | "jet_lag_recovery"
  | "massage_credit"
  | "other"
  | "full_price";

export const PROMO_CATEGORY_COLORS: Record<PromoCategoryId, string> = {
  stay_discounts: "#1B5E20",
  spa_credit: "#1565C0",
  jet_lag_recovery: "#00838F",
  massage_credit: "#7B1FA2",
  other: "#BDBDBD",
  full_price: "#F9A825",
};

export type PromoCategoryDef = {
  id: PromoCategoryId;
  label: string;
  color: string;
  codes: readonly string[];
};

export const PROMO_CATEGORIES: readonly PromoCategoryDef[] = [
  {
    id: "stay_discounts",
    label: "Stay discounts 15%, 20%, 15% Discovery",
    color: PROMO_CATEGORY_COLORS.stay_discounts,
    codes: ["RI15", "T15", "RI20", "HNY20", "SR20", "CD15", "GHA"],
  },
  {
    id: "spa_credit",
    label: "$50 Spa Credit",
    color: PROMO_CATEGORY_COLORS.spa_credit,
    codes: ["CR50", "CRD20", "SCPAI", "SCSP", "SCSF"],
  },
  {
    id: "jet_lag_recovery",
    label: "Jet Lag Recovery",
    color: PROMO_CATEGORY_COLORS.jet_lag_recovery,
    codes: ["JLR"],
  },
  {
    id: "massage_credit",
    label: "Massage Credit Packages",
    color: PROMO_CATEGORY_COLORS.massage_credit,
    codes: ["MC"],
  },
  {
    id: "other",
    label: "Other (pre-sale, low-rate, off-list)",
    color: PROMO_CATEGORY_COLORS.other,
    codes: ["PSPR", "ASP", "CP", "TOP", "WOTM", "DEPRO", "POTD", "UPG", "AI30", "AI45", "AM", "SD"],
  },
  {
    id: "full_price",
    label: "Full Price",
    color: PROMO_CATEGORY_COLORS.full_price,
    // FP = rack rate; MV/GM = local outside-market full-paying guests (spa/gym membership).
    // LWR = Little Wellness Rituals, an ordinary menu line that is "not applicable with any discounts or promotions".
    // AC (airline crew) is in-house hotel guests and stays in Other, not Full Price.
    // Full Price is NOT a promotion (Tenille Keats, 28 Nov 2026): the Promotions section never shows it.
    codes: ["FP", "MV", "GM", "LWR"],
  },
] as const;

/** Categories 1–5: discounted / low-rate (excludes Full Price). */
export const PROMO_DISCOUNT_CATEGORY_ORDER: readonly PromoCategoryId[] = [
  "stay_discounts",
  "spa_credit",
  "jet_lag_recovery",
  "massage_credit",
  "other",
];

export const PROMO_FULL_PRICE_CATEGORY: PromoCategoryId = "full_price";

export const PROMO_CATEGORY_ORDER: readonly PromoCategoryId[] = [
  ...PROMO_DISCOUNT_CATEGORY_ORDER,
  PROMO_FULL_PRICE_CATEGORY,
];

const CODE_TO_CATEGORY = new Map<string, PromoCategoryId>();
for (const cat of PROMO_CATEGORIES) {
  for (const code of cat.codes) {
    CODE_TO_CATEGORY.set(code.toUpperCase(), cat.id);
  }
}

const CATEGORY_BY_ID = new Map(PROMO_CATEGORIES.map((c) => [c.id, c]));

export function promoCategoryForCode(promoCode: string): PromoCategoryId {
  const folded = promoCode.trim().toUpperCase();
  if (!folded) return "other";
  return CODE_TO_CATEGORY.get(folded) ?? "other";
}

export function promoCategoryDef(id: PromoCategoryId): PromoCategoryDef {
  return CATEGORY_BY_ID.get(id) ?? CATEGORY_BY_ID.get("other")!;
}

export function promoCategoryLabel(promoCode: string): string {
  return promoCategoryDef(promoCategoryForCode(promoCode)).label;
}

export function promoCategoryColor(promoCode: string): string {
  return promoCategoryDef(promoCategoryForCode(promoCode)).color;
}

export function isFullPriceCategory(id: PromoCategoryId): boolean {
  return id === PROMO_FULL_PRICE_CATEGORY;
}

export function isFullPriceCode(promoCode: string): boolean {
  return isFullPriceCategory(promoCategoryForCode(promoCode));
}

export function discountedPromoUsd(totals: Partial<Record<PromoCategoryId, number>>): number {
  return PROMO_DISCOUNT_CATEGORY_ORDER.reduce((s, id) => s + (totals[id] ?? 0), 0);
}

export function fullPricePromoUsd(totals: Partial<Record<PromoCategoryId, number>>): number {
  return totals[PROMO_FULL_PRICE_CATEGORY] ?? 0;
}

export function promoUsdForShare(totals: Partial<Record<PromoCategoryId, number>>): number {
  return discountedPromoUsd(totals);
}

export function promoUsdAllCategories(totals: Partial<Record<PromoCategoryId, number>>): number {
  return discountedPromoUsd(totals) + fullPricePromoUsd(totals);
}

export type CategoryUsdSlice = {
  id: PromoCategoryId;
  label: string;
  color: string;
  usd: number;
  sharePct: number;
  segment: "discount" | "full_price";
};

function sliceForId(id: PromoCategoryId, usd: number, shareBasis: number): CategoryUsdSlice {
  const def = promoCategoryDef(id);
  const segment = isFullPriceCategory(id) ? "full_price" : "discount";
  return {
    id,
    label: def.label,
    color: def.color,
    usd,
    sharePct: shareBasis > 0 ? Math.round((usd / shareBasis) * 1000) / 10 : 0,
    segment,
  };
}

export function slicesFromUsdByCategory(
  totals: Partial<Record<PromoCategoryId, number>>,
): CategoryUsdSlice[] {
  const allTotal = promoUsdAllCategories(totals);
  const discountSlices = PROMO_DISCOUNT_CATEGORY_ORDER.map((id) => sliceForId(id, totals[id] ?? 0, allTotal)).filter(
    (s) => s.usd > 0,
  );
  const fullUsd = fullPricePromoUsd(totals);
  const fullSlice = fullUsd > 0 ? [sliceForId(PROMO_FULL_PRICE_CATEGORY, fullUsd, allTotal)] : [];
  return [...discountSlices, ...fullSlice];
}

export function addUsdToCategory(
  bucket: Partial<Record<PromoCategoryId, number>>,
  promoCode: string,
  usd: number,
): void {
  const id = promoCategoryForCode(promoCode);
  bucket[id] = (bucket[id] ?? 0) + usd;
}

/** Table sort: categories 1–5 first (PROMO_CATEGORY_ORDER), Full Price last. */
export function promoCategorySortKey(promoCode: string): string {
  const id = promoCategoryForCode(promoCode);
  const index = PROMO_CATEGORY_ORDER.indexOf(id);
  const rank = index >= 0 ? index : PROMO_DISCOUNT_CATEGORY_ORDER.length;
  return `${String(rank).padStart(2, "0")}-${promoCategoryLabel(promoCode)}`;
}

export function promoCategoriesForLegend(): {
  discount: readonly PromoCategoryDef[];
  fullPrice: PromoCategoryDef;
} {
  const fullPrice = promoCategoryDef(PROMO_FULL_PRICE_CATEGORY);
  const discount = PROMO_CATEGORIES.filter((c) => c.id !== PROMO_FULL_PRICE_CATEGORY);
  return { discount, fullPrice };
}