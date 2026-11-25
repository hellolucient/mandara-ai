/**
 * Promo code families for reporting (Tenille / spa director view).
 * Edit this map when standing offers change; unmapped codes fall into "other".
 */

export type PromoCategoryId =
  | "stay_discounts"
  | "cinnamon_discovery"
  | "adaaran_spa_credit"
  | "massage_credit"
  | "full_price"
  | "other";

export const PROMO_CATEGORY_COLORS: Record<PromoCategoryId, string> = {
  stay_discounts: "#1B5E20",
  cinnamon_discovery: "#F57C00",
  adaaran_spa_credit: "#1565C0",
  massage_credit: "#7B1FA2",
  full_price: "#F9A825",
  other: "#BDBDBD",
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
    label: "Stay discounts",
    color: PROMO_CATEGORY_COLORS.stay_discounts,
    codes: ["RI15", "T15", "RI20", "HNY20", "SR20"],
  },
  {
    id: "cinnamon_discovery",
    label: "Cinnamon Discovery",
    color: PROMO_CATEGORY_COLORS.cinnamon_discovery,
    codes: ["CD15", "GHA"],
  },
  {
    id: "adaaran_spa_credit",
    label: "Adaaran spa credit",
    color: PROMO_CATEGORY_COLORS.adaaran_spa_credit,
    codes: ["CR50", "CRD20", "SCPAI", "SCSP", "SCSF"],
  },
  {
    id: "massage_credit",
    label: "Massage credit",
    color: PROMO_CATEGORY_COLORS.massage_credit,
    codes: ["MC"],
  },
  {
    id: "full_price",
    label: "Full price",
    color: PROMO_CATEGORY_COLORS.full_price,
    codes: ["FP"],
  },
  {
    id: "other",
    label: "Other",
    color: PROMO_CATEGORY_COLORS.other,
    codes: [
      "JLR",
      "PSPR",
      "ASP",
      "CP",
      "TOP",
      "WOTM",
      "DEPRO",
      "POTD",
      "UPG",
      "AI30",
      "AI45",
      "AM",
      "SD",
    ],
  },
] as const;

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

/** Stable stack order for bars and legends (excludes zero segments at render time). */
export const PROMO_CATEGORY_ORDER: readonly PromoCategoryId[] = PROMO_CATEGORIES.map((c) => c.id);

export type CategoryUsdSlice = {
  id: PromoCategoryId;
  label: string;
  color: string;
  usd: number;
  sharePct: number;
};

export function slicesFromUsdByCategory(
  totals: Partial<Record<PromoCategoryId, number>>,
): CategoryUsdSlice[] {
  const grand = PROMO_CATEGORY_ORDER.reduce((s, id) => s + (totals[id] ?? 0), 0);
  return PROMO_CATEGORY_ORDER.map((id) => {
    const def = promoCategoryDef(id);
    const usd = totals[id] ?? 0;
    return {
      id,
      label: def.label,
      color: def.color,
      usd,
      sharePct: grand > 0 ? Math.round((usd / grand) * 1000) / 10 : 0,
    };
  }).filter((s) => s.usd > 0);
}

export function addUsdToCategory(
  bucket: Partial<Record<PromoCategoryId, number>>,
  promoCode: string,
  usd: number,
): void {
  const id = promoCategoryForCode(promoCode);
  bucket[id] = (bucket[id] ?? 0) + usd;
}