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
  if (location && !salesish && !/\b(perform|performing|did|how did|doing|going|tracking|sales|revenue)\b/i.test(question)) return null;
  // One spa over the month so far: "How is Vadoo doing this month?", "Hakuraa sales month to date".
  if (location && /\b(this month|month-to-date|month to date|mtd)\b/i.test(question) && !/\b(which|compare|rank|best|worst|highest|lowest)\b/i.test(question)) {
    return { kind: "location-month", name: location };
  }
  // Period detection (more specific first)
  if (/\blast month\b/i.test(question)) {
    if (/\b(which|highest|lowest|best|worst|top|compare|rank)\b/i.test(question)) {
      return { kind: "comparison", period: "last-month" };
    }
    return { kind: "last-month" };
  }
  // Treatment/retail breakdowns, including "where we're at" month-to-date, before the plain total/MTD answers.
  const mix = salesMixIntent(question);
  if (mix && !location) return mix;
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


function isSalesMixQuestion(question: string): boolean {
  const treatmentSales = /\btreatment(?:s)?\s+sales\b|\bsales\s+(?:from\s+|of\s+)?treatments?\b/i.test(question);
  const retail = /\bretail(?:\s+sales)?\b/i.test(question);
  return treatmentSales || retail;
}

function hasMtdLanguage(question: string): boolean {
  if (/\b(where we(?:'re| are) at|month[ -]?to[ -]?date|\bmtd\b|\bthis month\b|\bthe month\b)/i.test(question)) return true;
  return /\bmonth\b/i.test(question) && !/\b(?:last|next) month\b/i.test(question);
}

/** Treatment and/or retail sales: a split table, plus month-to-date when the question asks where we stand. */
export function salesMixIntent(question: string): Extract<SalesIntent, { kind: "mix" }> | null {
  if (!isSalesMixQuestion(question)) return null;
  const mtd = hasMtdLanguage(question);
  const yesterday = /\byesterday\b/i.test(question) || !mtd;
  return { kind: "mix", yesterday, mtd };
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

function isMonthLevel(intent: SalesIntent): boolean {
  return intent.kind === "mtd" || intent.kind === "this-month" || intent.kind === "location-month" || (intent.kind === "mix" && intent.mtd && !intent.yesterday);
}

function isDayLevel(intent: SalesIntent): boolean {
  return (
    intent.kind === "total" ||
    intent.kind === "best-worst" ||
    intent.kind === "below-budget" ||
    intent.kind === "attention" ||
    intent.kind === "overview" ||
    intent.kind === "location" ||
    (intent.kind === "mix" && intent.yesterday) ||
    (intent.kind === "comparison" && intent.period === "yesterday")
  );
}

function looksLikeCreativeOrKnowledgeFollowUp(text: string): boolean {
  const folded = text.toLowerCase();
  if (/\b(write|draft|compose|rewrite|rephrase|translate|caption|email|letter|promo card|picture|image|photo)\b/.test(folded)) return true;
  if (/\b(company profile|operating agreement|sop|handbook|company policy|our policy|insurance)\b/.test(folded)) return true;
  if (/^(thanks|thank you|ok|okay|cheers|got it|cool)[\s!.]*$/i.test(text.trim())) return true;
  return false;
}

function asksForSplit(text: string): boolean {
  return isSalesMixQuestion(text);
}

function asksForDayBefore(text: string): boolean {
  return /\b((the )?day before( that)?|previous day)\b/i.test(text);
}

/**
 * A short follow-up that modifies a previous stored-sales answer: include retail,
 * add MTD, just one spa, the day before, and similar. Generic or creative
 * follow-ups return false, so they stay on the normal path.
 */
export function isSalesFollowUp(text: string, locationNames: string[]): boolean {
  const question = text.trim();
  if (!question || looksLikeCreativeOrKnowledgeFollowUp(question)) return false;
  if (asksForSplit(question)) return true;
  if (/\b(include|add|show|split|with|plus|and)\b/i.test(question) && /\b(retail|treatments?|budget|guests?|mtd|month[ -]?to[ -]?date)\b/i.test(question)) return true;
  if (/\b(retail|treatments?|budget|guests?)\b/i.test(question) && /\b(too|as well|also|please|pls)\b/i.test(question)) return true;
  const short = question.length <= 80;
  if (short && /\b(mtd|month[ -]?to[ -]?date|this month|where we(?:'re| are) at|guests?|budget)\b/i.test(question)) return true;
  if (asksForDayBefore(question)) return true;
  if (short && /\b(and |what about |how about )?(last week|previous week|yesterday|last month)\b/i.test(question)) return true;
  return isLocationFollowUp(question, locationNames);
}

/** True when the message is really just naming a spa, such as "just Vadoo". */
function isLocationFollowUp(question: string, locationNames: string[]): boolean {
  const location = findLocation(question, locationNames);
  if (!location) return false;
  const leftover = fold(question)
    .replace(fold(location), " ")
    .replace(/\b(just|only|and|what about|how about|for|please|pls|show me|show)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return leftover.length === 0;
}

function withDayOffset(intent: SalesIntent, extra: number): SalesIntent {
  const dayOffset = (intent.dayOffset ?? 0) + extra;
  return dayOffset ? { ...intent, dayOffset } : { ...intent };
}

/**
 * Combine a sales follow-up with the previous sales question, keeping the
 * earlier date and scope and applying the new request (retail split, a spa,
 * another day, and so on).
 */
export function mergeSalesFollowUp(followUp: string, previousQuestion: string, locationNames: string[]): SalesIntent | null {
  if (!isSalesFollowUp(followUp, locationNames)) return null;
  const previous = parseSalesQuestion(previousQuestion, locationNames);
  const combined = `${previousQuestion} ${followUp}`.trim();
  const dayBefore = asksForDayBefore(followUp);
  const offset = dayBefore ? -1 : 0;

  if (asksForSplit(followUp) || asksForSplit(combined)) {
    const prevMix = previous?.kind === "mix" ? previous : null;
    const mtd = Boolean(prevMix?.mtd || hasMtdLanguage(followUp) || (previous && isMonthLevel(previous)));
    let yesterday: boolean;
    if (prevMix) yesterday = prevMix.yesterday || /\byesterday\b/i.test(followUp) || !mtd;
    else if (previous && isMonthLevel(previous) && !/\byesterday\b/i.test(followUp) && !/\byesterday\b/i.test(previousQuestion)) yesterday = false;
    else yesterday = !mtd || Boolean(previous && isDayLevel(previous)) || /\byesterday\b/i.test(followUp) || /\byesterday\b/i.test(previousQuestion);
    if (!yesterday && !mtd) yesterday = true;
    const intent: SalesIntent = { kind: "mix", yesterday, mtd };
    return offset ? withDayOffset(intent, offset) : intent;
  }

  const fromCombined = parseSalesQuestion(combined, locationNames);
  const fromFollowUp = parseSalesQuestion(followUp, locationNames);
  // Prefer the follow-up's period when it names a new one, otherwise keep the
  // combined parse so a spa or sales term from the previous question is kept.
  let intent = fromFollowUp && fromFollowUp.kind !== "overview" && fromFollowUp.kind !== "total"
    ? fromFollowUp
    : fromCombined ?? fromFollowUp ?? previous;
  if (!intent) {
    const location = findLocation(followUp, locationNames) ?? findLocation(previousQuestion, locationNames);
    if (location) intent = previous && isMonthLevel(previous) ? { kind: "location-month", name: location } : { kind: "location", name: location };
    else if (/\bguests?\b/i.test(followUp)) intent = previous ?? { kind: "overview" };
  }
  if (!intent) return null;
  return offset ? withDayOffset(intent, offset) : intent;
}

/** Resolve a sales intent, including a follow-up after a stored-sales answer. */
export function resolveSalesIntent(
  content: string,
  locationNames: string[],
  context: { previousAssistantWasSales?: boolean; previousUserQuestion?: string; strict?: boolean } = {},
): SalesIntent | null {
  const direct = context.strict ? storedSalesIntent(content, locationNames) : parseSalesQuestion(content, locationNames);
  if (direct) return direct;
  if (context.previousAssistantWasSales && context.previousUserQuestion) {
    return mergeSalesFollowUp(content, context.previousUserQuestion, locationNames);
  }
  return null;
}
