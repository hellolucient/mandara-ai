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
  | typeof UNMAPPED_LABEL;

/** Treatment menu sections from the spa menu (plus Unmapped). */
export type TreatmentSection =
  | "Packages"
  | "Elemis"
  | "Face of Mandara"
  | "Body of Mandara"
  | "Enhancements"
  | "More of Mandara"
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
  UNMAPPED_LABEL,
];

export const TREATMENT_SECTION_ORDER: readonly TreatmentSection[] = [
  "Packages",
  "Elemis",
  "Face of Mandara",
  "Body of Mandara",
  "Enhancements",
  "More of Mandara",
  UNMAPPED_LABEL,
];

export const RETAIL_BRAND_COLORS: Record<RetailBrand, GroupColorDef> = {
  Elemis: { label: "Elemis", color: "#1B5E20" },
  "Mandara Spa (Alodia)": { label: "Mandara Spa (Alodia)", color: "#F57C00" },
  "Milk Shake": { label: "Milk Shake", color: "#1565C0" },
  "We Are Feel Good": { label: "We Are Feel Good", color: "#7B1FA2" },
  Cosmerc: { label: "Cosmerc", color: "#F9A825" },
  SUD: { label: "SUD", color: "#00838F" },
  Unmapped: { label: UNMAPPED_LABEL, color: "#BDBDBD" },
};

export const TREATMENT_SECTION_COLORS: Record<TreatmentSection, GroupColorDef> = {
  Packages: { label: "Packages", color: "#1B5E20" },
  Elemis: { label: "Elemis", color: "#F57C00" },
  "Face of Mandara": { label: "Face of Mandara", color: "#1565C0" },
  "Body of Mandara": { label: "Body of Mandara", color: "#7B1FA2" },
  Enhancements: { label: "Enhancements", color: "#F9A825" },
  "More of Mandara": { label: "More of Mandara", color: "#00838F" },
  Unmapped: { label: UNMAPPED_LABEL, color: "#BDBDBD" },
};

type KeywordRule<T extends string> = { pattern: RegExp; group: T };

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
};

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
  { pattern: /\bmandara\b/i, group: "Mandara Spa (Alodia)" },
  {
    pattern:
      /\b(frangipani|monoi|kakadu|sea\s*salt\s*bath|toner|cleansing\s*balm|marine\s*cleanser|shower\s*cream|body\s*scrub\s*cream|body\s*lotion|body\s*mask|lip\s*balm|essential\s*oil|after\s*sun|refreshing\s*gel|hand\s*&\s*body\s*wash)\b/i,
    group: "Elemis",
  },
];

function normalizeItemName(name: string): string {
  return name.trim().toLowerCase();
}

export function mapTreatmentSection(itemName: string): TreatmentSection {
  const key = normalizeItemName(itemName);
  const override = TREATMENT_OVERRIDES[key];
  if (override) return override;
  for (const rule of TREATMENT_KEYWORD_RULES) {
    if (rule.pattern.test(itemName)) return rule.group;
  }
  return UNMAPPED_LABEL;
}

export function mapRetailBrand(itemName: string): RetailBrand {
  const key = normalizeItemName(itemName);
  const override = RETAIL_OVERRIDES[key];
  if (override) return override;
  for (const rule of RETAIL_KEYWORD_RULES) {
    if (rule.pattern.test(itemName)) return rule.group;
  }
  return UNMAPPED_LABEL;
}

export function mapItemToGroup(category: ItemCategory, itemName: string): RevenueMixGroup {
  return category === "retail" ? mapRetailBrand(itemName) : mapTreatmentSection(itemName);
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

export type ItemLineInput = { category: ItemCategory; itemName: string; netSales: number };

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
      const section = mapTreatmentSection(line.itemName);
      treatments[section] = (treatments[section] ?? 0) + line.netSales;
      if (section === UNMAPPED_LABEL) unmappedTreatments.add(line.itemName);
    } else {
      const brand = mapRetailBrand(line.itemName);
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