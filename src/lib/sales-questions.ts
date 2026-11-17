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
  // Month-based queries with financial context
  const hasMonthWithContext = /\b(last month|this month|january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(question) && /\b(how much|revenue|sales|make|made|earn|total)\b/i.test(question);
  const salesish = hasSalesTerm || hasSalesPattern || hasTimeWithContext || hasComparison || hasMonthWithContext;
  if (!salesish && !location) return null;
  if (location && !salesish && !/\b(perform|performing|did|how did|sales|revenue)\b/i.test(question)) return null;
  // Period detection (more specific first)
  if (/\blast month\b/i.test(question)) {
    if (/\b(which|highest|lowest|best|worst|top|compare|rank)\b/i.test(question)) {
      return { kind: "comparison", period: "last-month" };
    }
    return { kind: "last-month" };
  }
  if (/\bthis month\b/i.test(question) && !/\bmonth-to-date\b|\bmtd\b/i.test(question)) {
    if (/\b(which|highest|lowest|best|worst|top|compare|rank)\b/i.test(question)) {
      return { kind: "comparison", period: "this-month" };
    }
    return { kind: "this-month" };
  }
  
  // Check for named months (January, February, etc.)
  const namedMonth = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i.exec(question);
  if (namedMonth) {
    return { kind: "named-month", month: namedMonth[1].toLowerCase() };
  }
  
  // Existing patterns
  if (/\bbelow budget\b|\bunder budget\b|\bunderperform/i.test(question)) return { kind: "below-budget" };
  if (/\bmonth-to-date\b|\bmtd\b/i.test(question)) return { kind: "mtd" };
  if (/\blast week\b|\bprevious week\b|\bmajor changes\b/i.test(question)) return { kind: "week" };
  if (/\battention\b|\bunusual\b|\bexception/i.test(question)) return { kind: "attention" };
  if (/\bbest\b|\bworst\b/i.test(question)) {
    if (/\byesterday\b/i.test(question)) {
      return { kind: "comparison", period: "yesterday" };
    }
    return { kind: "best-worst" };
  }
  if (location) return { kind: "location", name: location };
  if (/\btotal\b|\byesterday\b|\bsales\b|\brevenue\b/i.test(question)) return { kind: "total" };
  return { kind: "overview" };
}

export function isKnowledgeQuestion(text: string): boolean {
  return /\b(operating agreement|sop|handbook|company policy|our policy|insurance note|insurance certificate|insurance clause|treatment room opening)\b/i.test(text);
}
