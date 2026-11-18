import type { PromoCard } from "@/lib/promo-cards";

/** Styled promo cards in Mandara colours, rendered from a model's ```promo block. */
export function PromoCards({ cards }: { cards: PromoCard[] }) {
  if (cards.length === 0) return null;
  return (
    <div className="mt-4 grid gap-3">
      {cards.map((card, index) => (
        <article
          key={`${card.headline}-${index}`}
          className="overflow-hidden rounded-2xl bg-primary text-primary-foreground shadow-sm"
        >
          <div className="px-5 py-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary-foreground/75">{card.brand}</p>
            <h3 className="mt-2 font-heading text-[22px] leading-tight tracking-[-0.015em]">{card.headline}</h3>
            {card.line ? <p className="mt-1.5 text-[14.5px] leading-5 text-primary-foreground/90">{card.line}</p> : null}
            <p className="mt-3 inline-block rounded-full bg-primary-foreground/15 px-3 py-1 text-sm font-medium">{card.offer}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
