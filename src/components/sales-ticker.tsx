"use client";

import { useEffect, useRef, useState } from "react";

type SpaData = {
  name: string;
  treatment: number;
  retail: number;
  total: number;
};

type TickerData = {
  spas: SpaData[];
  date?: string;
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function SalesTicker() {
  const [data, setData] = useState<TickerData | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handler = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };
    
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    let mounted = true;
    let timeoutId: ReturnType<typeof setTimeout>;

    async function fetchData() {
      try {
        const response = await fetch("/api/sales-ticker");
        if (!response.ok) throw new Error("Failed to fetch");
        const json = (await response.json()) as TickerData;
        if (mounted) {
          setData(json);
          timeoutId = setTimeout(fetchData, 5 * 60 * 1000);
        }
      } catch {
        if (mounted) {
          setData({ spas: [] });
          timeoutId = setTimeout(fetchData, 60 * 1000);
        }
      }
    }

    void fetchData();
    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  }, []);

  if (!data || data.spas.length === 0) {
    return null;
  }

  return (
    <div className="sales-ticker border-b bg-gradient-to-r from-primary/5 to-primary/10" aria-label="Daily sales">
      <div 
        ref={containerRef}
        className={prefersReducedMotion ? "ticker-static" : "ticker-scroll"}
      >
        <div className="ticker-content">
          {data.spas.map((spa, index) => (
            <div key={`${spa.name}-${index}`} className="ticker-item">
              <span className="ticker-spa-name">{spa.name}:</span>
              <span className="ticker-value">Treatments {formatMoney(spa.treatment)}</span>
              <span className="ticker-separator">•</span>
              <span className="ticker-value">Retail {formatMoney(spa.retail)}</span>
            </div>
          ))}
        </div>
        {!prefersReducedMotion && (
          <div className="ticker-content" aria-hidden="true">
            {data.spas.map((spa, index) => (
              <div key={`${spa.name}-dup-${index}`} className="ticker-item">
                <span className="ticker-spa-name">{spa.name}:</span>
                <span className="ticker-value">Treatments {formatMoney(spa.treatment)}</span>
                <span className="ticker-separator">•</span>
                <span className="ticker-value">Retail {formatMoney(spa.retail)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
