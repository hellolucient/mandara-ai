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

function formatDay(date?: string): string | null {
  if (!date) return null;
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(d);
}

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
  const contentRef = useRef<HTMLDivElement>(null);
  const [durationSec, setDurationSec] = useState<number | null>(null);

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
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    async function fetchData() {
      clearTimeout(timeoutId);
      try {
        const response = await fetch(`/api/sales-ticker?t=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Failed to fetch");
        const json = (await response.json()) as TickerData;
        if (mounted) {
          setData(json);
          timeoutId = setTimeout(fetchData, 5 * 60 * 1000);
        }
      } catch {
        if (mounted) {
          setData((prev) => prev ?? { spas: [] });
          timeoutId = setTimeout(fetchData, 60 * 1000);
        }
      }
    }

    // Phones pause pages in the background; refresh the moment the app is opened again.
    const onVisible = () => {
      if (document.visibilityState === "visible") void fetchData();
    };
    const onPageShow = () => void fetchData();

    void fetchData();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  // Keep a constant scroll speed (pixels per second) on every screen size.
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const PX_PER_SEC = 70;
    const update = () => {
      const width = el.offsetWidth;
      if (width > 0) setDurationSec(Math.max(6, width / PX_PER_SEC));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [data, prefersReducedMotion]);

  if (!data || data.spas.length === 0) {
    return null;
  }

  return (
    <div className="sales-ticker border-b bg-gradient-to-r from-primary/5 to-primary/10" aria-label="Daily sales">
      <div 
        ref={containerRef}
        className={prefersReducedMotion ? "ticker-static" : "ticker-scroll"}
        style={!prefersReducedMotion && durationSec ? { animationDuration: `${durationSec}s` } : undefined}
      >
        <div className="ticker-content" ref={contentRef}>
          {formatDay(data.date) && (
            <div className="ticker-item">
              <span className="ticker-spa-name">Sales {formatDay(data.date)}</span>
            </div>
          )}
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
            {formatDay(data.date) && (
            <div className="ticker-item">
              <span className="ticker-spa-name">Sales {formatDay(data.date)}</span>
            </div>
          )}
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
