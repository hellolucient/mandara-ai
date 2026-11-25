export type ItemCategory = "treatment" | "retail";

export type ItemLineRow = {
  location: string;
  category: ItemCategory;
  name: string;
  quantity: number;
  netSales: number;
  /** SKU / item code from Steiners Statistic summary when present. */
  itemCode?: string | null;
  supplier?: string | null;
};

export type SalesItemsExtract = {
  businessDate: string;
  currency: string;
  items: ItemLineRow[];
  issues: string[];
};

export type StoredItemLine = {
  id: string;
  businessDate: string;
  locationId: string;
  locationName: string;
  category: ItemCategory;
  itemName: string;
  quantity: number;
  netSales: number;
  currency: string;
  itemCode?: string | null;
  supplier?: string | null;
};

export type AggregatedItemLine = {
  itemName: string;
  quantity: number;
  netSales: number;
};