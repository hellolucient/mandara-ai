export type PromoCard = { headline: string; line: string; offer: string; brand: string };

const FENCE = /```promo(?:-cards)?\s*\n([\s\S]*?)\n```/;

/** Pull a fenced promo JSON block out of a model reply. Invalid or empty blocks are ignored. */
export function parsePromoCards(text: string): { cards: PromoCard[]; body: string } {
  const match = String(text ?? "").match(FENCE);
  if (!match) return { cards: [], body: text };
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[1]);
  } catch {
    return { cards: [], body: text };
  }
  const rows = Array.isArray(parsed) ? parsed : [parsed];
  const cards: PromoCard[] = [];
  for (const row of rows.slice(0, 8)) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const headline = clean(rec.headline);
    if (!headline) continue;
    cards.push({
      headline,
      line: clean(rec.line),
      offer: clean(rec.offer) || "[price]",
      brand: clean(rec.brand) || "Mandara",
    });
  }
  return { cards, body: cards.length ? text.replace(FENCE, "").trim() : text };
}

function clean(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 160);
}
