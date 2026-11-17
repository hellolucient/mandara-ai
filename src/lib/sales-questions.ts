import type { SalesIntent } from "@/lib/sales-types";

export function parseSalesQuestion(text: string, locationNames: string[]): SalesIntent | null {
  const question = text.trim();
  if (!question) return null;
  const lower = question.toLowerCase();
  if (
    /\b(operating agreement|sop|procedure|policy|insurance|certificate|handbook|treatment room)\b/i.test(question) &&
    !/\b(sales|revenue|budget)\b/i.test(question)
  ) {
    return null;
  }
  const location = locationNames.find((name) => lower.includes(name.toLowerCase()));
  // Only match explicit sales/revenue terms, not just "spa" or "location"
  const hasSalesTerm = /\b(sales|revenue|budget|takings)\b/i.test(question);
  // Sales-specific patterns that don't need explicit "sales" term
  const hasSalesPattern = /\b(underperform|month-to-date|mtd|below budget|under budget|need attention|which (locations?|spas?))\b/i.test(question);
  // Time periods must be combined with business context
  const hasTimeWithContext = /\b(yesterday|last week|previous week)\b/i.test(question) && (/\b(sales|revenue|takings|perform|budget|spa|location)\b/i.test(question) || location);
  const hasComparison = /\b(best|worst|attention)\b/i.test(question) && (/\b(spa|location|perform|sales)\b/i.test(question) || location);
  const salesish = hasSalesTerm || hasSalesPattern || hasTimeWithContext || hasComparison;
  if (!salesish && !location) return null;
  if (location && !salesish && !/\b(perform|performing|did|how did|sales|revenue)\b/i.test(question)) return null;
  if (/\bbelow budget\b|\bunder budget\b|\bunderperform/i.test(question)) return { kind: "below-budget" };
  if (/\bmonth-to-date\b|\bmtd\b|\bthis month\b/i.test(question)) return { kind: "mtd" };
  if (/\blast week\b|\bprevious week\b|\bmajor changes\b/i.test(question)) return { kind: "week" };
  if (/\battention\b|\bunusual\b|\bexception/i.test(question)) return { kind: "attention" };
  if (/\bbest\b|\bworst\b/i.test(question)) return { kind: "best-worst" };
  if (location) return { kind: "location", name: location };
  if (/\btotal\b|\byesterday\b|\bsales\b|\brevenue\b/i.test(question)) return { kind: "total" };
  return { kind: "overview" };
}

export function isKnowledgeQuestion(text: string): boolean {
  return /\b(operating agreement|sop|handbook|company policy|our policy|insurance note|insurance certificate|insurance clause|treatment room opening)\b/i.test(text);
}
