import { complete } from "./openrouter";

/**
 * Model-based classifier for sales routing.
 * Uses a cheap LLM to decide if a message is asking about stored sales data vs. anything else.
 * 
 * Cost: ~0.02¢ per message (DeepSeek V3 at $0.14/$0.55 per 1M tokens, ~150 tokens per call)
 */

const SYSTEM_PROMPT = `You are a routing classifier for a spa management assistant.

Your ONLY job is to decide if a user message is asking for STORED SALES DATA vs anything else.

STORED SALES DATA queries:
- Asking for actual reported sales figures for real dates/locations
- Examples: "What were spa sales yesterday?", "How did Hakuraa perform last week?", "Show me November revenue", "Which locations are below budget?"

NOT stored sales data (route to general assistant):
- Hypothetical calculations: "If we make $50k/month, what's annual revenue?"
- Math problems with user-supplied figures: "A spa does $9,500/day. If retail rises from 12% to 18%, what's the change?"
- Creating models/calculators: "Create an interactive financial model"
- Drafting content: "Write an email", "Draft a caption"
- General questions: "What are the benefits of hot stone massage?"
- Questions about documents/procedures: "Show me the SOP"
- ANY question that asks you to calculate, model, or reason about hypothetical scenarios

When in doubt, route to general assistant (safer default).

Respond with ONLY one word:
- "SALES" if asking for stored sales data
- "GENERAL" for everything else

Do not explain your reasoning. Just output one word.`;

interface ClassificationResult {
  isSalesQuery: boolean;
  confidence: "high" | "medium" | "low";
  rawResponse: string;
}

/**
 * Fast keyword pre-filter to skip model call for obvious cases.
 * Returns null if model classification is needed.
 */
function quickPreFilter(message: string): boolean | null {
  const lower = message.toLowerCase().trim();
  
  // Empty or very short messages
  if (lower.length < 5) return false;
  
  // Obvious non-sales tasks (skip model call)
  if (/^(write|draft|compose|create|translate|explain|tell me about|what (is|are) the (benefit|difference))/i.test(message)) {
    return false;
  }
  
  // Obvious hypothetical calculations (skip model call)
  if (/^hypothetical:/i.test(message)) return false;
  if (/\$\s*[0-9,]+/.test(message) && /\b(if|suppose|imagine|calculate|what would)\b/i.test(message)) {
    return false;
  }
  
  // Explicit calculation requests (skip model call)
  if (/\b(show the working|work out|do the math|calculate|compute)\b/i.test(lower)) {
    return false;
  }
  
  // Obvious sales queries with time references (high confidence, but use model for safety)
  // Don't skip - let model confirm
  
  return null; // Need model classification
}

/**
 * Classify a user message using a cheap LLM.
 * Returns whether the message is asking for stored sales data.
 */
export async function classifySalesIntent(message: string): Promise<ClassificationResult> {
  // Quick pre-filter
  const quickResult = quickPreFilter(message);
  if (quickResult !== null) {
    return {
      isSalesQuery: quickResult,
      confidence: "high",
      rawResponse: quickResult ? "SALES" : "GENERAL",
    };
  }
  
  // Use model for uncertain cases
  try {
    const response = await complete(
      "deepseek/deepseek-chat", // Cheap model: $0.14/$0.55 per 1M tokens
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: message },
      ],
      false, // web = false
      false  // pictures = false
    );
    
    const text = response.text?.trim().toUpperCase() || "";
    const isSalesQuery = text.includes("SALES");
    
    // Determine confidence based on response clarity
    const confidence: "high" | "medium" | "low" = 
      text === "SALES" || text === "GENERAL" ? "high" :
      text.includes("SALES") || text.includes("GENERAL") ? "medium" :
      "low";
    
    return {
      isSalesQuery,
      confidence,
      rawResponse: text,
    };
  } catch (error) {
    console.error("Sales classifier error:", error);
    // Fail safe to general assistant
    return {
      isSalesQuery: false,
      confidence: "low",
      rawResponse: "ERROR",
    };
  }
}

/**
 * Legacy keyword-based classifier (kept for comparison/fallback).
 * NOT USED in production - use classifySalesIntent instead.
 */
export function shouldRouteToSalesLegacy(question: string, locationNames: string[]): boolean {
  const text = question.trim();
  const lower = text.toLowerCase();
  
  // Explicit non-sales tasks always go to general assistant
  if (isExplicitNonSalesTask(lower)) return false;
  
  // Hypothetical questions go to general assistant
  if (isHypotheticalQuestion(lower)) return false;
  
  // User-supplied dollar figures suggest calculation/modeling
  if (hasDollarFigures(text) && isHypotheticalQuestion(lower)) return false;
  
  // Check for sales-related terms
  const hasSalesTerm = /\b(sales|revenue|budget|performance|figures?|numbers?|totals?)\b/i.test(text);
  const hasSalesQuery = /\b(attention|below budget|underperform|best|worst)\b/i.test(lower);
  
  // Location + sales term + time = likely sales query
  const mentionsLocation = locationNames.some((name) => lower.includes(name.toLowerCase()));
  if (mentionsLocation && hasSalesTerm && hasTimeReference(lower)) return true;
  
  // Sales queries with comparison words
  const hasQueryWord = /\b(what|how|show|which|report)\b/i.test(text);
  if ((hasQueryWord || hasSalesQuery) && (hasSalesTerm || hasSalesQuery)) {
    if (/\b(hypothetical|what if|what'?s the|how to|show the working)\b/i.test(lower)) return false;
    return true;
  }
  
  const hasTime = hasTimeReference(lower);
  const hasComparison = hasComparisonWord(lower);
  
  if (hasSalesTerm && (hasTime || hasComparison)) return true;
  
  return false;
}

function isExplicitNonSalesTask(lower: string): boolean {
  if (/\b(write|draft|compose|create (a|an|your|this)|rewrite)\b/.test(lower)) return true;
  if (/\b(translate|translation)\b/.test(lower)) return true;
  if (/\b(calculate|utilisation|utilization|average treatment|treatment rooms?)\b/.test(lower)) return true;
  if (/\b(show the working|work out|compute|do the math)\b/.test(lower)) return true;
  if (/\b(explain|difference between|what (is|are) the (benefits?|pros|cons))\b/.test(lower)) return true;
  if (/\b(picture|image|photo|drawing|mockup|concept)\b/.test(lower)) return true;
  if (/\b(email|letter|message to)\b/.test(lower)) return true;
  if (/\b(caption|instagram|facebook|social media|post about)\b/.test(lower)) return true;
  if (/\b(remember|my (favourite|favorite)|i (like|prefer|love)|tell me about|products?)\b/.test(lower)) return true;
  return false;
}

function isHypotheticalQuestion(lower: string): boolean {
  if (/\b(if |suppose|imagine|let'?s say|assuming|what if|scenario)\b/.test(lower)) return true;
  if (/\b(would|could|should).{0,30}\b(if|when|assuming)\b/.test(lower)) return true;
  return false;
}

function hasDollarFigures(text: string): boolean {
  return /\$\s*[0-9,]+/.test(text);
}

function hasTimeReference(lower: string): boolean {
  return /\b(yesterday|today|last (week|month|quarter)|this (week|month|quarter)|november|january|february|march|april|may|june|july|august|september|october|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec|q[1-4]|[0-9]{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)|week ending|month ending|ytd|year.to.date)\b/.test(lower);
}

function hasComparisonWord(lower: string): boolean {
  return /\b(best|worst|top|bottom|compare|comparison|versus|vs|better|worse)\b/.test(lower);
}
