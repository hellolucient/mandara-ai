export type SalesSource = "sample" | "import" | "dsr";

export type SalesLine = {
  locationId: string;
  locationName: string;
  netSales: number | null;
  treatments: number | null;
  budget: number | null;
  /** Treatment revenue for the day, when the source splits it out. */
  treatmentSales?: number | null;
  /** Retail (product) revenue for the day, when the source splits it out. */
  retailSales?: number | null;
};

export type LoadedDay = {
  businessDate: string;
  source: SalesSource;
  currency: string;
  complete: boolean;
  note: string;
  lines: SalesLine[];
};

type SalesIntentKind =
  | { kind: "total" }
  | { kind: "mix"; yesterday: boolean; mtd: boolean }
  | { kind: "best-worst" }
  | { kind: "below-budget" }
  | { kind: "mtd" }
  | { kind: "week" }
  | { kind: "attention" }
  | { kind: "location"; name: string }
  | { kind: "location-month"; name: string }
  | { kind: "overview" }
  | { kind: "last-month" }
  | { kind: "this-month" }
  | { kind: "named-month"; month: string }
  | { kind: "comparison"; period: "last-month" | "this-month" | "week" | "yesterday" };

/** dayOffset shifts a single-day answer from yesterday: -1 is the day before. */
export type SalesIntent = SalesIntentKind & { dayOffset?: number };

export type ExtractRow = {
  location: string;
  netSales: number | null;
  treatments: number | null;
  budget: number | null;
  treatmentSales?: number | null;
  retailSales?: number | null;
};

export type SalesExtract = {
  businessDate: string;
  currency: string;
  rows: ExtractRow[];
  issues: string[];
  complete: boolean;
};
