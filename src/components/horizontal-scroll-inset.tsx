import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  /** When set, used by tests and capture scripts to find the scrollport. */
  scrollId?: string;
  /** Right-edge fade hint on small screens that more content scrolls horizontally. */
  edgeFade?: boolean;
};

/**
 * Wide tables stay inside the page: horizontal scroll only inside this inset card,
 * not on the document body (avoids flex default min-width:auto blowing out mobile layout).
 */
export function HorizontalScrollInset({ children, className = "", scrollId, edgeFade = true }: Props) {
  return (
    <div className={`relative w-full max-w-full min-w-0 ${className}`}>
      <div
        data-table-scroll={scrollId}
        className="overflow-x-auto overscroll-x-contain rounded-2xl border border-black/[0.06] bg-card shadow-[0_1px_2px_rgba(20,40,35,0.04)] [-webkit-overflow-scrolling:touch] dark:border-white/10"
      >
        {children}
      </div>
      {edgeFade ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 z-30 w-7 rounded-r-2xl bg-gradient-to-l from-card from-30% to-transparent md:hidden"
        />
      ) : null}
    </div>
  );
}