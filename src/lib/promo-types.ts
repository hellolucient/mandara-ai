export type PromoKind = "treatment" | "retail";

export type PromoLineRow = {
  spa: string;
  promoCode: string;
  description: string;
  qty: number;
  usd: number;
};

export type PromoSpaTotals = Record<string, { qty: number; usd: number }>;

export type PromoTotals = {
  totalQty: number;
  guest: number;
  nett: number;
  tax: number;
  service: number;
  totalUsd: number;
  perSpa: PromoSpaTotals;
};

export type PromotionsExtract = {
  periodFrom: string;
  periodTo: string;
  kind: PromoKind;
  currency: string;
  rows: PromoLineRow[];
  totals: PromoTotals;
  issues: string[];
};

export type StoredPromoPeriod = {
  periodFrom: string;
  periodTo: string;
  kind: PromoKind;
  currency: string;
  totalUsd: number;
  totalQty: number | null;
  guest: number | null;
  nett: number | null;
  tax: number | null;
  service: number | null;
  spaTotals: PromoSpaTotals;
  importedAt: string;
};

export type StoredPromoLine = {
  periodFrom: string;
  periodTo: string;
  kind: PromoKind;
  locationId: string;
  locationName: string;
  promoCode: string;
  description: string;
  qty: number;
  usd: number;
};