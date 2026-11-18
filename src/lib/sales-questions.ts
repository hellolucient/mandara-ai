import type { SalesIntent } from "@/lib/sales-types";

export function parseSalesQuestion(text: string, locationNames: string[]): SalesIntent | null {
  const question = text.trim();
  if (!question) return null;
  if (
    /\b(operating agreement|sop|procedure|policy|insurance|certificate|handbook|treatment room)\b/i.test(question) &&
    !/\b(sales|revenue|budget)\b/i.test(question)
  ) {
    return null;
  }
  const location = findLocation(question, locationNames);
  // Only match explicit sales/revenue terms, not just "spa" or "location"
  const hasSalesTerm = /\b(sales|revenue|budget|takings)\b/i.test(question);
  // Sales-specific patterns that don't need explicit "sales" term
  const hasSalesPattern = /\b(underperform|month-to-date|month to date|mtd|below budget|under budget|need attention|which (locations?|spas?))\b/i.test(question);
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
  if (/\bthis month\b/i.test(question) && !/\bmonth-to-date\b|\bmonth to date\b|\bmtd\b/i.test(question)) {
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
  if (/\bmonth-to-date\b|\bmonth to date\b|\bmtd\b/i.test(question)) return { kind: "mtd" };
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

const GENERIC_NAME_WORDS = new Set(["spa", "spas", "resort", "resorts", "island", "islands", "maldives", "hotel", "beach", "villa", "villas", "retreat", "mandara", "prestige", "adaaran", "the"]);

function fold(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/**
 * The stored location a question names. The full name wins ("Hakuraa Huraa"); otherwise a distinctive word
 * of a name counts on its own, so "How did Hakuraa do yesterday?" finds "Hakuraa Huraa".
 */
export function findLocation(text: string, locationNames: string[]): string | undefined {
  const folded = fold(text);
  const full = locationNames.find((name) => name.trim() && folded.includes(fold(name.trim())));
  if (full) return full;
  for (const name of locationNames) {
    const words = fold(name)
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length >= 5 && !GENERIC_NAME_WORDS.has(word));
    if (words.some((word) => new RegExp(`\\b${word}\\b`).test(folded))) return name;
  }
  return undefined;
}

/**
 * Sales questions asked in General mode (the chat-only view has no mode switch) go to stored figures too,
 * unless the message is really a task that merely mentions sales: writing, ideas, calculations, what-ifs.
 */
export function storedSalesIntent(text: string, locationNames: string[]): SalesIntent | null {
  const lower = text.toLowerCase();
  if (
    /\b(write|draft|compose|rewrite|translate|caption|email|letter|message|post|create|design|picture|image|idea|ideas|suggest|suggestions?|improve|increase|boost|lift|grow|strategy|strategies|plan|campaign|promotion|promotions|calculate|compute|work out|explain|forecast|predict|project|model)\b/.test(lower)
  ) {
    return null;
  }
  if (/\b(if|suppose|imagine|assuming|scenario|hypothetical)\b|let'?s say|what if/.test(lower)) return null;
  return parseSalesQuestion(text, locationNames);
}
