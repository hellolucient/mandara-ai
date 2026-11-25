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

export type PromoCategoryDef = {
  id: PromoCategoryId;
  label: string;
  /** Tailwind background class for bars and legend swatches */
  barClass: string;
  codes: readonly string[];
};

export const PROMO_CATEGORIES: readonly PromoCategoryDef[] = [
  {
    id: "stay_discounts",
    label: "Stay discounts",
    barClass: "bg-primary",
    codes: ["RI15", "T15", "RI20", "HNY20", "SR20"],
  },
  {
    id: "cinnamon_discovery",
    label: "Cinnamon Discovery",
    barClass: "bg-amber-600",
    codes: ["CD15", "GHA"],
  },
  {
    id: "adaaran_spa_credit",
    label: "Adaaran spa credit",
    barClass: "bg-cyan-800",
    codes: ["CR50", "CRD20", "SCPAI", "SCSP", "SCSF"],
  },
  {
    id: "massage_credit",
    label: "Massage credit",
    barClass: "bg-emerald-700",
    codes: ["MC"],
  },
  {
    id: "full_price",
    label: "Full price",
    barClass: "bg-slate-600",
    codes: ["FP"],
  },
  {
    id: "other",
    label: "Other",
    barClass: "bg-muted-foreground/45",
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

/** Stable stack order for bars and legends (excludes zero segments at render time). */
export const PROMO_CATEGORY_ORDER: readonly PromoCategoryId[] = PROMO_CATEGORIES.map((c) => c.id);

export type CategoryUsdSlice = {
  id: PromoCategoryId;
  label: string;
  barClass: string;
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
      barClass: def.barClass,
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