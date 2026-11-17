export type SalesSource = "sample" | "import" | "dsr";

export type SalesLine = {
  locationId: string;
  locationName: string;
  netSales: number | null;
  treatments: number | null;
  budget: number | null;
};

export type LoadedDay = {
  businessDate: string;
  source: SalesSource;
  currency: string;
  complete: boolean;
  note: string;
  lines: SalesLine[];
};

export type SalesIntent =
  | { kind: "total" }
  | { kind: "best-worst" }
  | { kind: "below-budget" }
  | { kind: "mtd" }
  | { kind: "week" }
  | { kind: "attention" }
  | { kind: "location"; name: string }
  | { kind: "overview" }
  | { kind: "last-month" }
  | { kind: "this-month" }
  | { kind: "named-month"; month: string }
  | { kind: "comparison"; period: "last-month" | "this-month" | "week" | "yesterday" };

export type ExtractRow = {
  location: string;
  netSales: number | null;
  treatments: number | null;
  budget: number | null;
};

export type SalesExtract = {
  businessDate: string;
  currency: string;
  rows: ExtractRow[];
  issues: string[];
  complete: boolean;
};
