import type { CompanyProfile } from "@/lib/company-profile";
import { isKnowledgeQuestion } from "@/lib/sales-questions";

/**
 * Deterministic company-vs-web routing. No model call.
 * A question is Mandara-specific when it names a stored spa (including a short
 * form or a close misspelling), a profile term, or talks about our own menu,
 * treatments, people, or sales. Everything else may use the web.
 */

const STOP = new Set([
  "spa",
  "spas",
  "resort",
  "resorts",
  "hotel",
  "hotels",
  "the",
  "and",
  "for",
  "with",
  "from",
  "maldives",
  "island",
  "islands",
  "beach",
  "prestige",
  "atoll",
  "house",
  "sample",
  "demonstration",
]);

const GENERIC = new Set([
  ...STOP,
  "menu",
  "treatment",
  "treatments",
  "facial",
  "facials",
  "massage",
  "massages",
  "package",
  "packages",
  "price",
  "prices",
  "list",
  "opening",
  "room",
  "rooms",
  "retail",
  "product",
  "products",
  "therapist",
  "therapists",
  "signature",
  "special",
  "luxury",
  "classic",
  "traditional",
  "experience",
  "ritual",
  "premium",
  "deluxe",
  "balinese",
  "swedish",
  "shiatsu",
  "aromatherapy",
  "hydrafacial",
  "lomi",
]);

export type Lexicon = {
  places: Array<{ form: string; name: string }>;
  terms: string[];
  /** Company words that count only together with we/our/us or a known spa. */
  contextTerms: string[];
};

export const EMPTY_LEXICON: Lexicon = { places: [], terms: [], contextTerms: [] };

const CONTEXT_ONLY = new Set([
  "guest",
  "guests",
  "occupancy",
  "visa",
  "visas",
  "budget",
  "forecast",
  "promotion",
  "promotions",
  "payroll",
  "treatment",
  "treatments",
  "facial",
  "facials",
  "massage",
  "massages",
  "package",
  "packages",
  "retail",
  "menu",
  "menus",
  "therapist",
  "therapists",
  "ytd",
  "gop",
  "gor",
]);

const CONTRACT_NOISE = new Set(["private", "limited", "company", "services", "investments", "investment", "properties", "world", "travel", "holding", "unique"]);

export type QuestionRoute = {
  lane: "company" | "general";
  web: boolean;
  place: string | null;
};

export function buildLexicon(input: {
  locations?: string[];
  profile?: CompanyProfile;
  companyName?: string;
  menuTitles?: string[];
}): Lexicon {
  const places: Array<{ form: string; name: string }> = [];
  const terms = new Set<string>();
  const contextTerms = new Set<string>();
  const addPlace = (name: string, extras: string[] = []) => {
    const clean = name.trim();
    if (!clean) return;
    for (const form of aliasesFromName(clean)) places.push({ form, name: clean });
    for (const extra of extras) {
      const form = fold(extra);
      if (form.length >= 3) places.push({ form, name: clean });
    }
  };
  for (const name of input.locations ?? []) addPlace(name);
  for (const spa of input.profile?.spas ?? []) addPlace(spa.name, spa.aliases);
  if (input.companyName) {
    for (const token of distinctiveTokens(input.companyName)) terms.add(token);
  }
  for (const person of input.profile?.people ?? []) addNamedTerms(person.name, person.aliases ?? [], terms);
  for (const contact of input.profile?.contacts ?? []) addNamedTerms(contact.name, contact.aliases ?? [], terms);
  for (const contract of input.profile?.contracts ?? []) {
    addContractTerms(contract.name, terms);
    addContractTerms((contract.partner.split(".")[0] ?? "").slice(0, 80), terms);
  }
  for (const keyword of input.profile?.keywords ?? []) {
    const form = fold(keyword);
    if (form.length < 3) continue;
    if (CONTEXT_ONLY.has(form)) contextTerms.add(form);
    else terms.add(form);
  }
  for (const title of input.menuTitles ?? []) {
    for (const token of distinctiveTokens(title)) terms.add(token);
  }
  return { places, terms: [...terms], contextTerms: [...contextTerms] };
}

function addNamedTerms(name: string, aliases: string[], terms: Set<string>): void {
  const phrase = fold(name);
  if (phrase.length >= 5) terms.add(phrase);
  const parts = phrase.split(" ").filter(Boolean);
  const last = parts[parts.length - 1];
  if (last && last.length >= 5 && !GENERIC.has(last)) terms.add(last);
  for (const alias of aliases) {
    const form = fold(alias);
    if (form.length >= 3) terms.add(form);
  }
}

function addContractTerms(value: string, terms: Set<string>): void {
  const lead = value.trim();
  if (!lead) return;
  const phrase = fold(lead);
  if (phrase.length >= 5 && phrase.length <= 70) terms.add(phrase);
  if (!/\b(ltd|limited|pvt|private)\b/i.test(lead)) return;
  for (const token of distinctiveTokens(lead)) {
    if (!CONTRACT_NOISE.has(token)) terms.add(token);
  }
}

export function routeQuestion(question: string, lexicon: Lexicon = EMPTY_LEXICON): QuestionRoute {
  const text = question.trim();
  const folded = fold(text);
  if (!text || isGreeting(text) || isSelfContained(folded)) {
    return { lane: "general", web: false, place: null };
  }
  if (/\b(search|check) the web\b/.test(folded)) {
    return { lane: "general", web: true, place: matchPlace(folded, lexicon) };
  }
  const place = matchPlace(folded, lexicon);
  if (isOutsideWorld(folded)) {
    return { lane: "general", web: true, place };
  }
  if (place && (isOurOffering(folded) || isCompanySignal(folded) || isPossessiveCatalog(folded))) {
    return { lane: "company", web: false, place };
  }
  if (isPossessiveCatalog(folded) || isCompanySignal(folded) || isStoredSalesQuestion(folded) || matchesTerm(folded, lexicon.terms) || matchesContextTerm(folded, lexicon)) {
    return { lane: "company", web: false, place };
  }
  if (place) return { lane: "company", web: false, place };
  return { lane: "general", web: true, place: null };
}

export function shouldSearchWeb(question: string, lexicon: Lexicon = EMPTY_LEXICON): boolean {
  return routeQuestion(question, lexicon).web;
}

export function storedGapMessage(place: string | null): string {
  const where = place ? ` for ${place}` : "";
  return `Nothing stored for the company covers that${where}, so I have not invented a price, menu, or policy. Reply "search the web" if you want a public source.`;
}

export type CreativeTaskContext = { priorImage?: boolean };

/** Visual brief added to a print or "just the card" picture request. */
export const PRINTABLE_CARD_BRIEF =
  "Flat, front-on, edge-to-edge printable artwork of the promo card only. No reception counter, no scene, no props, no furniture, no perspective or environmental background. The card fills the frame. Portrait card ratio. Keep the existing card text and the [price] placeholder. Mandara spa branding, warm and polished for a Maldives resort.";

/**
 * Drafting and idea work in Mandara mode: write, rewrite, suggest, promo cards,
 * pictures, and follow-ups that refine a picture already made. Facts about the
 * company are not this.
 */
export function isCreativeMandaraTask(question: string, context: CreativeTaskContext = {}): boolean {
  const folded = fold(question);
  if (!folded) return false;
  if (isStoredSalesQuestion(folded) && !/\b(write|draft|compose|rewrite|caption|card|cards)\b/.test(folded)) return false;
  if (/\b(write|draft|compose|rewrite|rephrase|paraphrase|translate|caption)\b/.test(folded)) return true;
  if (/\b(create|make|design|draw)\b/.test(folded) && /\b(card|cards|promo|poster|graphic|picture|image|caption|email|letter|message|post)\b/.test(folded)) return true;
  if (/\b(promo card|promotional card|instagram|social media)\b/.test(folded)) return true;
  if (/\b(suggest|brainstorm|come up with|ideas for|idea for)\b/.test(folded)) return true;
  if (/\b(these|those|the above|each of (them|these|those)|the ideas)\b/.test(folded) && /\b(create|make|write|draft|design|card|cards|promo)\b/.test(folded)) return true;
  if (isImageRefineOrPrintTask(folded)) return true;
  if (context.priorImage && isShortImageFollowUp(folded)) return true;
  return false;
}

/** Print, flatten, or "a version of that picture" requests, from the message alone. */
export function isImageRefineOrPrintTask(question: string): boolean {
  const folded = fold(question);
  if (!folded) return false;
  const visual = /\b(card|cards|promo|poster|graphic|picture|image|images|artwork|photo)\b/.test(folded);
  if (visual && /\b(print|printable|print out|to print|for print)\b/.test(folded)) return true;
  if (/\b(just the card|just want the card|only the card|the card only|card only not)\b/.test(folded)) return true;
  if (visual && /\b(flat|flatten|flattened|front on|edge to edge)\b/.test(folded)) return true;
  if (/\b(not (the card )?(placed |sitting |shown )?(on a )?(counter|desk|table|scene)|without (the )?(counter|scene|background|props)|no (counter|scene|background|props))\b/.test(folded)) return true;
  if (/\b((the|that|this) (image|picture|photo) you (gave|made|created|generated|drew)|the image you gave|version of (it|that|the|this)|another version)\b/.test(folded)) return true;
  if (/\b(change|tweak|adjust|refine|redo|revise|edit|crop|remove)\b/.test(folded) && /\b(image|picture|photo|card|cards|poster|graphic|artwork|counter|background|scene)\b/.test(folded)) return true;
  return false;
}

/** Short follow-ups that only make sense once a picture has already been made. */
export function isShortImageFollowUp(question: string): boolean {
  const folded = fold(question);
  if (!folded) return false;
  if (isImageRefineOrPrintTask(folded)) return true;
  if (/\b(just the card|only the card|the card only|just the image|only the image)\b/.test(folded)) return true;
  if (/\b(flat|flatten|flattened|front on|edge to edge|printable|to print)\b/.test(folded)) return true;
  if (/\b(try again|another go|redo it|do it again|once more)\b/.test(folded)) return true;
  if (/\b(make it|change it|tweak it|adjust it|remove the|without the|not on|not the)\b/.test(folded)) return true;
  return false;
}

/**
 * Visual prompt for a new or refined picture, using earlier conversation
 * requests plus the current change. Printable-card asks get a flat, front-on brief.
 */
export function buildPicturePrompt(current: string, priorTurns: string[] = []): { prompt: string; aspectRatio: string } {
  const folded = fold(current);
  const printable = isImageRefineOrPrintTask(folded) && (
    /\b(print|printable|print out|to print|for print|just the card|just want the card|only the card|the card only|flat|flatten|flattened|front on|edge to edge|counter)\b/.test(folded)
  );
  const prior = priorTurns.map((turn) => turn.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n");
  const parts = printable
    ? [PRINTABLE_CARD_BRIEF, prior ? `Previous picture request and card text:\n${prior}` : "", `Requested change: ${current.trim()}`]
    : [prior ? `Previous picture description:\n${prior}` : "", current.trim()];
  const prompt = parts.filter(Boolean).join("\n\n").slice(0, 2000);
  return { prompt, aspectRatio: printable ? "2:3" : "3:2" };
}

function isGreeting(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 10) return true;
  return /^(hi|hello|hey|thanks|thank you|ok|okay|good morning|good afternoon|good evening)\b/i.test(trimmed);
}

function isSelfContained(folded: string): boolean {
  if (/\b(translate|translation|rewrite|rephrase|paraphrase)\b/.test(folded)) return true;
  if (/\b(summarize|summary of)\b/.test(folded) && /\b(attached|this|document|text|message|email|note)\b/.test(folded)) return true;
  if (/\b(my favourite|my favorite|what s my|what is my|remember that|you said|earlier)\b/.test(folded)) return true;
  if (/\b(create|draw|make|design)\b/.test(folded) && /\b(picture|image|photo|drawing|mockup)\b/.test(folded)) return true;
  if (isUserSuppliedMath(folded)) return true;
  const writing = /\b(write|draft|compose|caption)\b/.test(folded) || (/\b(draft|write)\b/.test(folded) && /\b(email|letter|message)\b/.test(folded));
  if (writing && !isPossessiveCatalog(folded) && !isOutsideWorld(folded)) return true;
  return false;
}

function isUserSuppliedMath(folded: string): boolean {
  if (/\b(calculate|compute|equation|formula|utilisation|utilization|show the working|work out|do the math)\b/.test(folded)) return true;
  const amounts = folded.match(/\d+(?:\.\d+)?%?/g) ?? [];
  const currency = /[$€£]\s*\d/.test(folded);
  const computing = /\b(if|suppose|assuming|hypothetical|extra|what would|per day|per month|daily average|what s the|average|total)\b/.test(folded);
  // Math word problems with user-supplied numbers: needs both numbers and computation language
  if ((currency || amounts.length >= 2) && computing) return true;
  // Explicit "if X then what's Y" patterns (hypothetical math scenarios)
  if (/\b(a spa|an? resort|if (a|an|we|you)).*\d.*what/.test(folded)) return true;
  return /\d[\d,]*\s*\/\s*\d/.test(folded);
}

function isOutsideWorld(folded: string): boolean {
  if (/\b(weather|forecast|flight|flights|airfare|air fare|biz class|business class|airline|airport|visa|exchange rate|news|5 star|five star)\b/.test(folded)) {
    return true;
  }
  return /\bhotel\b/.test(folded) && !/\b(our|the) hotel\b/.test(folded);
}

function isStoredSalesQuestion(folded: string): boolean {
  if (/\b(which locations|locations need attention|below budget|under budget|sales figures|sales report|spa sales)\b/.test(folded)) return true;
  const sales = /\b(sales|revenue|budget|takings|dsr)\b/.test(folded);
  const period = /\b(yesterday|today|last week|last month|this week|this month|mtd|ytd|by location)\b/.test(folded);
  return sales && period;
}

function isOurOffering(folded: string): boolean {
  return /\b(price|prices|cost|menu|treatment|treatments|facial|facials|massage|massages|package|packages|therapist|therapists|retail|product|products|booking|rate card)\b/.test(folded);
}

function isPossessiveCatalog(folded: string): boolean {
  const possessive = /\b(we|our|ours|us)\b/.test(folded);
  if (!possessive) return false;
  return /\b(facial|facials|massage|massages|treatment|treatments|package|packages|menu|retail|product|products|price|prices|therapist|therapists|room|rooms|sales|revenue|budget|spa|spas|dsr)\b/.test(folded);
}

function isCompanySignal(folded: string): boolean {
  return /\bdsr\b/.test(folded) || /\b(our|the) spas?\b/.test(folded) || isKnowledgeQuestion(folded);
}

function matchPlace(folded: string, lexicon: Lexicon): string | null {
  const padded = ` ${folded} `;
  const words: string[] = folded.match(/[a-z0-9]+/g) ?? [];
  for (const place of lexicon.places) {
    if (place.form.includes(" ")) {
      if (padded.includes(` ${place.form} `)) return place.name;
      continue;
    }
    if (words.includes(place.form)) return place.name;
    if (place.form.length < 5) continue;
    for (const word of words) {
      if (word.length < 5) continue;
      if (Math.abs(word.length - place.form.length) > 2) continue;
      const limit = Math.max(word.length, place.form.length) >= 8 ? 2 : 1;
      if (editDistance(word, place.form) <= limit) return place.name;
    }
  }
  return null;
}

function matchesContextTerm(folded: string, lexicon: Lexicon): boolean {
  if (!matchesTerm(folded, lexicon.contextTerms)) return false;
  return /\b(we|our|ours|us)\b/.test(folded) || matchPlace(folded, lexicon) !== null;
}

function matchesTerm(folded: string, terms: string[]): boolean {
  const padded = ` ${folded} `;
  const words = new Set<string>(folded.match(/[a-z0-9]+/g) ?? []);
  for (const term of terms) {
    if (!term) continue;
    if (term.includes(" ")) {
      if (padded.includes(` ${term} `)) return true;
      continue;
    }
    if (words.has(term)) return true;
  }
  return false;
}

function aliasesFromName(name: string): string[] {
  const forms = new Set<string>();
  const folded = fold(name);
  if (folded.length >= 4) forms.add(folded);
  const tokens = distinctiveTokens(name);
  for (const token of tokens) forms.add(token);
  const stripped = tokens.filter((token) => !token.endsWith("spa"));
  const glued = tokens.flatMap((token) => {
    if (!token.endsWith("spa") || token.length < 8) return [];
    const stem = token.slice(0, -3);
    return stem.length >= 5 ? [stem] : [];
  });
  for (const stem of glued) forms.add(stem);
  if (stripped.length >= 2) forms.add(stripped.join(" "));
  return [...forms];
}

function distinctiveTokens(value: string): string[] {
  return (fold(value).match(/[a-z0-9]+/g) ?? []).filter((token) => token.length >= 5 && !GENERIC.has(token) && !STOP.has(token));
}

export function fold(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function editDistance(left: string, right: string): number {
  if (left === right) return 0;
  const rows = left.length + 1;
  const cols = right.length + 1;
  const matrix: number[] = new Array(cols);
  for (let col = 0; col < cols; col += 1) matrix[col] = col;
  for (let row = 1; row < rows; row += 1) {
    let previous = matrix[0];
    matrix[0] = row;
    for (let col = 1; col < cols; col += 1) {
      const current = matrix[col];
      const cost = left[row - 1] === right[col - 1] ? 0 : 1;
      matrix[col] = Math.min(matrix[col] + 1, matrix[col - 1] + 1, previous + cost);
      previous = current;
    }
  }
  return matrix[cols - 1];
}
