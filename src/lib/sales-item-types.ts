export type ItemCategory = "treatment" | "retail";

export type ItemLineRow = {
  location: string;
  category: ItemCategory;
  name: string;
  quantity: number;
  netSales: number;
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
};

export type AggregatedItemLine = {
  itemName: string;
  quantity: number;
  netSales: number;
};