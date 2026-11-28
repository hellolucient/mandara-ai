/**
 * Retail brands and treatment menu sections for revenue-mix reporting.
 * Edit explicit overrides and keyword rules when item names or brands change.
 *
 * TODO(Tenille): Confirm retail brand assignments (especially boutique lines that
 * are not clearly Elemis vs Mandara) and any spa-specific menu sections.
 */

import type { ItemCategory } from "@/lib/sales-item-types";

export const UNMAPPED_LABEL = "Unmapped";

/** Retail boutique brands (plus Unmapped). */
export type RetailBrand =
  | "Elemis"
  | "Mandara Spa (Alodia)"
  | "Milk Shake"
  | "We Are Feel Good"
  | "Cosmerc"
  | "SUD"
  | "Samapura"
  | typeof UNMAPPED_LABEL;

/** Treatment menu sections from the spa menu (plus Unmapped). */
export type TreatmentSection =
  | "Packages"
  | "Elemis"
  | "Face of Mandara"
  | "Body of Mandara"
  | "Enhancements"
  | "More of Mandara"
  | "Wellness Programs"
  | "Little Wellness Rituals"
  | typeof UNMAPPED_LABEL;

export type RevenueMixGroup = RetailBrand | TreatmentSection;

export type GroupColorDef = {
  label: string;
  /** Hex fill for bars and legend */
  color: string;
};

export const RETAIL_BRAND_ORDER: readonly RetailBrand[] = [
  "Elemis",
  "Mandara Spa (Alodia)",
  "Milk Shake",
  "We Are Feel Good",
  "Cosmerc",
  "SUD",
  "Samapura",
  UNMAPPED_LABEL,
];

export const TREATMENT_SECTION_ORDER: readonly TreatmentSection[] = [
  "Packages",
  "Elemis",
  "Face of Mandara",
  "Body of Mandara",
  "Enhancements",
  "More of Mandara",
  "Wellness Programs",
  "Little Wellness Rituals",
  UNMAPPED_LABEL,
];

export const RETAIL_BRAND_COLORS: Record<RetailBrand, GroupColorDef> = {
  Elemis: { label: "Elemis", color: "#1B5E20" },
  "Mandara Spa (Alodia)": { label: "Mandara Spa (Alodia)", color: "#F57C00" },
  "Milk Shake": { label: "Milk Shake", color: "#1565C0" },
  "We Are Feel Good": { label: "We Are Feel Good", color: "#7B1FA2" },
  Cosmerc: { label: "Cosmerc", color: "#F9A825" },
  SUD: { label: "SUD", color: "#00838F" },
  Samapura: { label: "Samapura", color: "#AD1457" },
  Unmapped: { label: UNMAPPED_LABEL, color: "#BDBDBD" },
};

export const TREATMENT_SECTION_COLORS: Record<TreatmentSection, GroupColorDef> = {
  Packages: { label: "Packages", color: "#1B5E20" },
  Elemis: { label: "Elemis", color: "#F57C00" },
  "Face of Mandara": { label: "Face of Mandara", color: "#1565C0" },
  "Body of Mandara": { label: "Body of Mandara", color: "#7B1FA2" },
  Enhancements: { label: "Enhancements", color: "#F9A825" },
  "More of Mandara": { label: "More of Mandara", color: "#00838F" },
  "Wellness Programs": { label: "Wellness Programs", color: "#AD1457" },
  "Little Wellness Rituals": { label: "Little Wellness Rituals", color: "#6D4C41" },
  Unmapped: { label: UNMAPPED_LABEL, color: "#BDBDBD" },
};

type KeywordRule<T extends string> = { pattern: RegExp; group: T };

export type RetailBrandContext = {
  itemCode?: string | null;
  supplier?: string | null;
};

export type TreatmentContext = {
  itemCode?: string | null;
};

/** Case-insensitive explicit overrides (normalized key = trim + lower). */
const TREATMENT_OVERRIDES: Record<string, TreatmentSection> = {
  "couples ritual 90": "Packages",
  "deep tissue 45": "Body of Mandara",
  "yin and yang": "Packages",
  "honeymoon package": "Packages",
  "harmony 1 hr 45 mins": "Packages",
  "heaven and earth": "Packages",
  "frangipani body glow": "Packages",
  "spa discovery": "Packages",
  "pure nature facial 60": "Face of Mandara",
  "elemis pro-collagen age defy": "Elemis",
  "elemis pro-glow smooth": "Elemis",
  "elemis body nectar nourishing wrap - frangipani": "Elemis",
  "elemis intensely cleansing salt scrub - lime and": "Elemis",
  "express massage": "Enhancements",
  "foot massage": "Enhancements",
  "back neck and scalp massage": "Enhancements",
  "spa membership card": "More of Mandara",
  shirobhyangam: "More of Mandara",
  "ai stress relief": "More of Mandara",
  // Wellness Programs: ordinary menu offerings, not promotions (Tenille Keats, 27 Nov 2026).
  "island coconut reset": "Wellness Programs",
  "island rejuvenation ritual": "Wellness Programs",
  "island wellness escape experience": "Wellness Programs",
  "royal healing retreat": "Wellness Programs",
  "soul harmony healing": "Wellness Programs",
  // Little Wellness Rituals (kids menu, Chavana Spa menu 300326). Includes spellings seen in the DSR.
  "mother and daughter moment": "Little Wellness Rituals",
  "mother and daugther moment": "Little Wellness Rituals",
  "father and son timeout": "Little Wellness Rituals",
  "father & son timeout": "Little Wellness Rituals",
  "little star journey": "Little Wellness Rituals",
  "litter star journey": "Little Wellness Rituals",
  "island fruity glow": "Little Wellness Rituals",
  "tropical toes": "Little Wellness Rituals",
  "heavenly hands": "Little Wellness Rituals",
  "cucumber hydrating facial": "Little Wellness Rituals",
  "soothing coconut scrub & conditioner": "Little Wellness Rituals",
  "back, neck & scalp massage": "Little Wellness Rituals",
  "back, neck, scalp massage": "Little Wellness Rituals",
  "shoulder, hand & foot massage": "Little Wellness Rituals",
  "shoulder, hand, foot massage": "Little Wellness Rituals",
  "coconut oil head & shoulder massage": "Little Wellness Rituals",
  "coconut oil head, shoulder massage": "Little Wellness Rituals",
  "bubble bath": "Little Wellness Rituals",
  "soothing coconut scrub and conditioner": "Little Wellness Rituals",
  // Wellness Programs: the rest of the Steiners master list (WL… codes), so a new property that sells one is filed
  // correctly by name even when the SKU is missing from a report.
  "chakra awakening journey": "Wellness Programs",
  "chavana therapy journey": "Wellness Programs",
  "chavana wellness experience": "Wellness Programs",
  "detox reset program": "Wellness Programs",
  "harmony haven": "Wellness Programs",
  "rebalance body": "Wellness Programs",
  "rebalance and renew": "Wellness Programs",
  "relax, reset, glow": "Wellness Programs",
  "reset and restore": "Wellness Programs",
  "serenity shift": "Wellness Programs",
  "signature chavana ritual": "Wellness Programs",
  "the core alignment reset": "Wellness Programs",
  "the elemental serenity journey": "Wellness Programs",
  "the peace practise": "Wellness Programs",
  "the peace practice": "Wellness Programs",
  "the vitality sequence": "Wellness Programs",
  // Tenille Keats, 28 Nov 2026: ordinary spa treatments, never promotions.
  // Sultry Citrus Body Buff (Steiners P44, group PACKAGE) is a menu package.
  "sultry citrus body buff": "Packages",
  // Smooth Down 15 mnt (B09) is the charge for upgrading a guest from 45 to 60 minutes: an add-on line.
  "smooth down 15 mnt": "Enhancements",
  "smooth down 15 min": "Enhancements",
  "smooth down": "Enhancements",
  // Jet Lag Recovery (Normatec). Some spas book it as "Flight Recovery" (Steiners HYRICE03); same treatment.
  "jet lag recovery": "Packages",
  "flight recovery": "Packages",
  "jet lag": "Packages",
  // Other Normatec (Hyperice) recovery treatments.
  "normatec recovery boots": "More of Mandara",
  "quick fix muscle release": "More of Mandara",
};

/**
 * Steiners SKUs that decide the menu section first. Jet Lag Recovery is booked under different names at
 * different spas ("Flight Recovery" at Kunaavashi and Vadoo, HYRICE03), so the name is made the same everywhere.
 */
const TREATMENT_CODE_SECTIONS: Record<string, TreatmentSection> = {
  P44: "Packages", // Sultry Citrus Body Buff
  B09: "Enhancements", // Smooth Down 15 mnt (45 -> 60 minute upgrade)
  HYRICE03: "Packages", // Jet Lag Recovery / Flight Recovery (Normatec)
  HYRICE01: "More of Mandara", // Normatec Recovery Boots
  HYRICE02: "More of Mandara", // Quick Fix Muscle Release
};

export const JET_LAG_RECOVERY_NAME = "Jet Lag Recovery";

/** One name for treatments that spas record differently. Everything else keeps the name as booked. */
export function canonicalTreatmentName(itemName: string, itemCode?: string | null): string {
  const code = normalizeItemCode(itemCode ?? "");
  if (code === "HYRICE03" || /^(flight|jet\s*lag)\s+recovery\b/i.test(itemName.trim()) || /^jet\s*lag$/i.test(itemName.trim())) {
    return JET_LAG_RECOVERY_NAME;
  }
  return itemName;
}

const RETAIL_OVERRIDES: Record<string, RetailBrand> = {
  "kit: pro-collagen prep & replenish routine": "Elemis",
  "balinese herbal massage oil 100ml with box": "Mandara Spa (Alodia)",
  "spa gift set": "Mandara Spa (Alodia)",
  "mandara body lotion": "Mandara Spa (Alodia)",
};

const TREATMENT_KEYWORD_RULES: KeywordRule<TreatmentSection>[] = [
  { pattern: /\belemis\b/i, group: "Elemis" },
  { pattern: /\b(package|honeymoon|harmony|yin\s*(and|&)\s*yang|spa\s*discovery|indulgence|retreat|ritual|journey|bliss)\b/i, group: "Packages" },
  { pattern: /\b(facial|pure\s*nature)\b/i, group: "Face of Mandara" },
  { pattern: /\b(express|refresher\s*facial|scalp|add-?on)\b/i, group: "Enhancements" },
  { pattern: /\b(manicure|pedicure|gel\s*polish|yoga|meditation|membership|shirodhara|padabhyangam|ayurved)\b/i, group: "More of Mandara" },
  { pattern: /\b(massage|abhyanga|shiatsu|balinese|mandara\s*massage|stone|scrub|wrap|lulur|gua\s*sha|tension|foot\s*work|foot-work|body\s*treatment|chavana|shirobhyangam)\b/i, group: "Body of Mandara" },
];

const RETAIL_KEYWORD_RULES: KeywordRule<RetailBrand>[] = [
  { pattern: /\belemis\b/i, group: "Elemis" },
  { pattern: /\b(pro-collagen|pro-radiance|pro-glow)\b/i, group: "Elemis" },
  { pattern: /\bmilk\s*shake\b|^ms\s+/i, group: "Milk Shake" },
  { pattern: /\bfeel\s*good\b/i, group: "We Are Feel Good" },
  { pattern: /\bcosmerc\b/i, group: "Cosmerc" },
  { pattern: /\bsud\b/i, group: "SUD" },
  { pattern: /\bsamapura\b/i, group: "Samapura" },
  { pattern: /\bmandara\b/i, group: "Mandara Spa (Alodia)" },
];

const MANDARA_CODE_PREFIXES = ["26MS", "ALO", "BL-MOR"] as const;
const MILK_SHAKE_CODE_PREFIX = "MSH";
const FEEL_GOOD_CODE_PREFIX = "WAFG";
/** We Are Feel Good sun-care SKUs that are posted as SS101..SS106 (supplier is We Are Feel Good Inc in the Statistic export). */
const FEEL_GOOD_SS_CODE = /^SS10\d$/;
const SAMAPURA_CODE_PREFIX = "BRCS";
const ELEMIS_CODE_PREFIX = "ELMRRP";
// TODO(Tenille): Confirm Cosmerc SKU prefix from Steiners Statistic export.
const COSMERC_CODE_PREFIXES = ["COS"] as const;
// TODO(Tenille): Confirm SUD SKU prefix from Steiners Statistic export.
const SUD_CODE_PREFIXES = ["SUD"] as const;

function normalizeItemName(name: string): string {
  return name.trim().toLowerCase();
}

function normalizeItemCode(code: string): string {
  return code.trim().toUpperCase();
}

function startsWithAny(code: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => code.startsWith(prefix));
}

/** Steiners numeric product codes for Elemis retail (when no Mandara/WAFG/MSH prefix applies). */
function isNumericElemisSku(code: string): boolean {
  return /^\d{4,}$/.test(code);
}

export function mapRetailBrandByCode(itemCode: string): RetailBrand | null {
  const code = normalizeItemCode(itemCode);
  if (!code) return null;
  if (startsWithAny(code, MANDARA_CODE_PREFIXES)) return "Mandara Spa (Alodia)";
  if (code.startsWith(MILK_SHAKE_CODE_PREFIX)) return "Milk Shake";
  if (code.startsWith(FEEL_GOOD_CODE_PREFIX) || FEEL_GOOD_SS_CODE.test(code)) return "We Are Feel Good";
  if (code.startsWith(SAMAPURA_CODE_PREFIX)) return "Samapura";
  if (code.startsWith(ELEMIS_CODE_PREFIX) || isNumericElemisSku(code)) return "Elemis";
  if (startsWithAny(code, COSMERC_CODE_PREFIXES)) return "Cosmerc";
  if (startsWithAny(code, SUD_CODE_PREFIXES)) return "SUD";
  return null;
}

/** Steiners Statistic supplier names that clearly identify a boutique brand (fallback after SKU prefixes). */
const SUPPLIER_BRANDS: Record<string, RetailBrand> = {
  elemis: "Elemis",
  mandaraspa: "Mandara Spa (Alodia)",
  "mandara spa": "Mandara Spa (Alodia)",
  alodia: "Mandara Spa (Alodia)",
  "we are feel good inc": "We Are Feel Good",
  "we are feel good": "We Are Feel Good",
  wafg: "We Are Feel Good",
  samapura: "Samapura",
  "cosmerc trading": "Cosmerc",
  cosmerc: "Cosmerc",
};

export function mapRetailBrandBySupplier(supplier: string | null | undefined): RetailBrand | null {
  const key = (supplier ?? "").trim().toLowerCase();
  if (!key) return null;
  return SUPPLIER_BRANDS[key] ?? null;
}

/**
 * Wellness Programs (codes WL…, e.g. WLICR, WLIWSE, WLRHR, WLRR1) and Little Wellness Rituals (codes LWR01, LWR011…)
 * are ordinary menu treatments, never promotions. The SKU decides first, so a new item on those menus lands in
 * the right section even before its name is added above.
 */
export function mapTreatmentSectionByCode(itemCode: string | null | undefined): TreatmentSection | null {
  const code = normalizeItemCode(itemCode ?? "");
  if (!code) return null;
  if (/^LWR\d+$/.test(code)) return "Little Wellness Rituals";
  if (/^WL[A-Z]{2,}\d*$/.test(code)) return "Wellness Programs"; // WLRR1 and WLRR2 end in a digit
  return TREATMENT_CODE_SECTIONS[code] ?? null;
}

export function mapTreatmentSection(itemName: string, context?: TreatmentContext): TreatmentSection {
  const fromCode = mapTreatmentSectionByCode(context?.itemCode);
  if (fromCode) return fromCode;
  const key = normalizeItemName(itemName);
  const override = TREATMENT_OVERRIDES[key];
  if (override) return override;
  for (const rule of TREATMENT_KEYWORD_RULES) {
    if (rule.pattern.test(itemName)) return rule.group;
  }
  return UNMAPPED_LABEL;
}

export function mapRetailBrand(itemName: string, context?: RetailBrandContext): RetailBrand {
  const code = context?.itemCode?.trim() ?? "";
  if (code) {
    const fromCode = mapRetailBrandByCode(code);
    if (fromCode) return fromCode;
  }
  const key = normalizeItemName(itemName);
  const override = RETAIL_OVERRIDES[key];
  if (override) return override;
  const fromSupplier = mapRetailBrandBySupplier(context?.supplier);
  if (fromSupplier) return fromSupplier;
  for (const rule of RETAIL_KEYWORD_RULES) {
    if (rule.pattern.test(itemName)) return rule.group;
  }
  return UNMAPPED_LABEL;
}

export function mapItemToGroup(
  category: ItemCategory,
  itemName: string,
  context?: RetailBrandContext,
): RevenueMixGroup {
  return category === "retail" ? mapRetailBrand(itemName, context) : mapTreatmentSection(itemName, context);
}

export type MixSlice = {
  id: string;
  label: string;
  color: string;
  netSales: number;
  sharePct: number;
};

export function buildMixSlices(
  category: ItemCategory,
  totals: Partial<Record<RevenueMixGroup, number>>,
): MixSlice[] {
  const order = category === "retail" ? RETAIL_BRAND_ORDER : TREATMENT_SECTION_ORDER;
  const colors = category === "retail" ? RETAIL_BRAND_COLORS : TREATMENT_SECTION_COLORS;
  const grand = order.reduce((s, id) => s + (totals[id] ?? 0), 0);
  return order
    .map((id) => {
      const def = colors[id as keyof typeof colors];
      const netSales = totals[id] ?? 0;
      return {
        id,
        label: def.label,
        color: def.color,
        netSales,
        sharePct: grand > 0 ? Math.round((netSales / grand) * 1000) / 10 : 0,
      };
    })
    .filter((s) => s.netSales > 0);
}

export type ItemLineInput = {
  category: ItemCategory;
  itemName: string;
  netSales: number;
  itemCode?: string | null;
  supplier?: string | null;
};

export function aggregateMixTotals(lines: ItemLineInput[]): {
  treatments: Partial<Record<TreatmentSection, number>>;
  retail: Partial<Record<RetailBrand, number>>;
  unmappedTreatmentNames: string[];
  unmappedRetailNames: string[];
} {
  const treatments: Partial<Record<TreatmentSection, number>> = {};
  const retail: Partial<Record<RetailBrand, number>> = {};
  const unmappedTreatments = new Set<string>();
  const unmappedRetail = new Set<string>();

  for (const line of lines) {
    if (line.category === "treatment") {
      const section = mapTreatmentSection(line.itemName, { itemCode: line.itemCode });
      treatments[section] = (treatments[section] ?? 0) + line.netSales;
      if (section === UNMAPPED_LABEL) unmappedTreatments.add(line.itemName);
    } else {
      const brand = mapRetailBrand(line.itemName, {
        itemCode: line.itemCode,
        supplier: line.supplier,
      });
      retail[brand] = (retail[brand] ?? 0) + line.netSales;
      if (brand === UNMAPPED_LABEL) unmappedRetail.add(line.itemName);
    }
  }

  return {
    treatments,
    retail,
    unmappedTreatmentNames: [...unmappedTreatments].sort((a, b) => a.localeCompare(b)),
    unmappedRetailNames: [...unmappedRetail].sort((a, b) => a.localeCompare(b)),
  };
}