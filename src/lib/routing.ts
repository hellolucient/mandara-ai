/**
 * Routing logic for sales questions and web search decisions.
 * These functions determine whether a user question should be routed to
 * stored sales data or if a web search is needed.
 */

/**
 * Determines if a question should be routed to the sales data path.
 * Only routes questions that are clearly asking about stored sales figures.
 * 
 * Examples that SHOULD route:
 * - "What were total spa sales yesterday?"
 * - "Which locations need attention?"
 * - "How did Hakuraa do last week vs budget?"
 * 
 * Examples that should NOT route:
 * - "Write an Instagram caption for a spa promotion"
 * - "Calculate treatment room utilization"
 * - "Translate this message"
 * - "Create a picture of a spa"
 */
export function shouldRouteToSales(question: string, locationNames: string[]): boolean {
  const text = question.trim();
  if (!text) return false;
  
  const lower = text.toLowerCase();
  
  // Explicit exclusions: these are NOT sales questions even if they mention sales/spa words
  if (isExplicitNonSalesTask(lower)) return false;
  
  // Hypothetical or scenario questions should go to the model, not stored data
  if (isHypotheticalQuestion(lower)) return false;
  
  // Additional check: must be asking about OUR sales, not explaining concepts
  if (isConceptualQuestion(lower)) return false;
  
  // Sales-specific terms
  const hasSalesTerm = /\b(sales|revenue|budget|performance|figures?|numbers?|totals?)\b/i.test(text);
  
  // Sales-related query patterns (attention, below budget, etc. imply sales context)
  const hasSalesQuery = /\b(attention|below budget|underperform|best|worst)\b/i.test(lower);
  
  // Questions about a specific location's performance (only if asking for real data)
  const mentionsLocation = locationNames.some((name) => lower.includes(name.toLowerCase()));
  if (mentionsLocation && hasSalesTerm && hasTimeReference(lower)) return true;
  
  // Sales queries with comparison words (e.g. "Which locations need attention?")
  const hasQueryWord = /\b(what|how|show|which|report)\b/i.test(text);
  if ((hasQueryWord || hasSalesQuery) && (hasSalesTerm || hasSalesQuery)) {
    // But not if it's asking "what if", "how to calculate", or starts with "hypothetical"
    if (/\b(hypothetical|what if|what'?s the|how to|show the working)\b/i.test(lower)) return false;
    return true;
  }
  
  // Must have sales term with time reference or comparison
  const hasTime = hasTimeReference(lower);
  const hasComparison = hasComparisonWord(lower);
  
  if (hasSalesTerm && (hasTime || hasComparison)) return true;
  
  return false;
}

function isExplicitNonSalesTask(lower: string): boolean {
  // Writing tasks (create a/an/your/this catches "create a model", "create an app", etc.)
  if (/\b(write|draft|compose|create (a|an|your|this)|rewrite)\b/.test(lower)) return true;
  
  // Translation tasks
  if (/\b(translate|translation)\b/.test(lower)) return true;
  
  // Calculation/math tasks - includes both direct "calculate" and math word problems
  if (/\b(calculate|utilisation|utilization|average treatment|treatment rooms?)\b/.test(lower)) return true;
  if (/\b(show the working|work out|compute|do the math)\b/.test(lower)) return true;
  
  // Explanation tasks
  if (/\b(explain|difference between|what (is|are) the (benefits?|pros|cons))\b/.test(lower)) return true;
  
  // Picture/image requests
  if (/\b(picture|image|photo|drawing|mockup|concept)\b/.test(lower)) return true;
  
  // Email tasks
  if (/\b(email|letter|message to)\b/.test(lower)) return true;
  
  // Caption/social media
  if (/\b(caption|instagram|facebook|social media|post about)\b/.test(lower)) return true;
  
  // Memory/preference statements
  if (/\b(remember|my (favourite|favorite)|i (like|prefer|love)|tell me about|products?)\b/.test(lower)) return true;
  
  return false;
}

function isHypotheticalQuestion(lower: string): boolean {
  // Hypothetical scenarios use "if", "suppose", "imagine", "let's say", etc.
  if (/\b(if |suppose|imagine|let'?s say|assuming|what if|scenario)\b/.test(lower)) return true;
  
  // Math word problems with scenario setup
  // Pattern: "A spa does X... what's Y?" or "If X then what's Y?"
  if (/\b(a spa|an? location|we have|there (is|are)).*\?/.test(lower)) {
    // If it mentions numbers and asks "what's" or "how much", it's a calculation
    if (/\d/.test(lower) && /what'?s|how much|extra.*revenue/.test(lower)) return true;
  }
  
  return false;
}

function isConceptualQuestion(lower: string): boolean {
  // Questions about concepts, not our specific data
  return /\b(how many (rooms?|treatments?)|what (is|are) the (benefits?|difference)|gross revenue share|fixed rent|lease|operating agreement)\b/.test(lower);
}

function hasTimeReference(lower: string): boolean {
  return /\b(yesterday|today|last (week|month|quarter)|this (week|month|quarter)|month-to-date|mtd|week-to-date|ytd)\b/.test(lower);
}

function hasComparisonWord(lower: string): boolean {
  return /\b(vs|versus|compared to|against|below|above|under|over|attention|need|underperform|best|worst)\b/.test(lower);
}

/**
 * Determines if a question needs a web search.
 * Only searches for questions that need current or external facts.
 * 
 * Examples that SHOULD search:
 * - "What are the latest spa trends in 2026?"
 * - "Current price of Elemis face cream"
 * - "News about Four Seasons Maldives"
 * 
 * Examples that should NOT search:
 * - "Write an Instagram caption"
 * - "Translate this message"
 * - "Calculate this math problem"
 * - "What's my favourite treatment?"
 */
export function shouldSearchWeb(question: string): boolean {
  const text = question.trim();
  if (!text) return false;
  if (text.length < 10) return false; // "Hello", "Thanks", etc.
  
  const lower = text.toLowerCase();
  
  // Explicit exclusions: tasks that never need web search
  if (isNoWebSearchTask(lower)) return false;
  
  // Positive indicators that DO need web search
  if (needsCurrentInformation(lower)) return true;
  if (asksForCitation(lower)) return true;
  if (asksAboutNews(lower)) return true;
  if (asksAboutPrices(lower)) return true;
  if (asksForRecipes(lower)) return true;
  
  // Default to no search for general questions
  return false;
}

function isNoWebSearchTask(lower: string): boolean {
  // Writing/drafting tasks
  if (/\b(write|draft|compose|rewrite|rephrase)\b/.test(lower) && !/\b(news|article|about)\b/.test(lower)) return true;
  
  // Translation
  if (/\b(translate|translation)\b/.test(lower)) return true;
  
  // Math/calculations
  if (/\b(calculate|math|percentage|utilisation|utilization|formula|equation)\b/.test(lower)) return true;
  
  // General explanations (not requiring current facts)
  if (/\b(explain|difference between|what (is|are))\b/.test(lower) && !/\b(latest|current|recent|today|this year|news)\b/.test(lower)) return true;
  
  // Memory/personal questions
  if (/\b(my (favourite|favorite|preferred)|what('s| is) my|remember|you said|earlier)\b/.test(lower)) return true;
  
  // Email drafting
  if (/\b(email|letter|message to|draft a)\b/.test(lower) && !/\b(news|article|about)\b/.test(lower)) return true;
  
  // Summaries of provided content
  if (/\b(summarize|summary of|attached|document)\b/.test(lower)) return true;
  
  return false;
}

function needsCurrentInformation(lower: string): boolean {
  return /\b(latest|current|recent|today|this (year|month|week)|trends?|2026|2027)\b/.test(lower);
}

function asksForCitation(lower: string): boolean {
  return /\b(cite|citation|sources?|references?|according to|research)\b/.test(lower);
}

function asksAboutNews(lower: string): boolean {
  return /\b(news|announcement|recently|just (announced|launched|opened))\b/.test(lower);
}

function asksAboutPrices(lower: string): boolean {
  return /\b(price|cost|how much|exchange rate)\b/.test(lower) && /\b(current|today|latest|now)\b/.test(lower);
}

function asksForRecipes(lower: string): boolean {
  return /\b(recipe|how to (make|prepare|create))\b/.test(lower) && /\b(scrub|lotion|oil|blend|mixture)\b/.test(lower);
}
