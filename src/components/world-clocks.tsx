"use client";

import { useEffect, useState } from "react";

type Zone = { city: string; timeZone: string; offset: string };

const ZONES: Zone[] = [
  { city: "Bangkok", timeZone: "Asia/Bangkok", offset: "GMT+7" },
  { city: "Maldives", timeZone: "Indian/Maldives", offset: "GMT+5" },
];

type Parts = { h: number; m: number; s: number; weekday: string };

function partsIn(date: Date, timeZone: string): Parts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  return { h: Number(get("hour")) % 24, m: Number(get("minute")), s: Number(get("second")), weekday: get("weekday") };
}

/** Live analogue clocks for Bangkok and the Maldives. Hands render only after mount, so server and client HTML match. */
export function WorldClocks() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    let interval: ReturnType<typeof setInterval> | undefined;
    // Align ticks to the start of each second.
    const align = setTimeout(() => {
      setNow(new Date());
      interval = setInterval(() => setNow(new Date()), 1000);
    }, 1000 - (Date.now() % 1000));
    return () => {
      clearTimeout(align);
      if (interval) clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex items-center gap-6 sm:gap-8">
      {ZONES.map((zone) => (
        <Clock key={zone.timeZone} zone={zone} parts={now ? partsIn(now, zone.timeZone) : null} />
      ))}
    </div>
  );
}

function Clock({ zone, parts }: { zone: Zone; parts: Parts | null }) {
  const night = parts ? parts.h < 6 || parts.h >= 18 : false;
  const hourAngle = parts ? (parts.h % 12) * 30 + parts.m * 0.5 : 0;
  const minuteAngle = parts ? parts.m * 6 + parts.s * 0.1 : 0;
  const secondAngle = parts ? parts.s * 6 : 0;
  const digital = parts ? `${String(parts.h).padStart(2, "0")}:${String(parts.m).padStart(2, "0")}` : "--:--";

  return (
    <div className="flex items-center gap-3">
      <svg
        viewBox="0 0 64 64"
        className={`size-[60px] shrink-0 rounded-full shadow-[0_1px_2px_rgba(30,40,35,0.08),0_6px_16px_-6px_rgba(30,40,35,0.18)] transition-colors duration-700 ${
          night ? "text-[#f3eee3]" : "text-primary"
        }`}
        role="img"
        aria-label={parts ? `${zone.city} ${digital}` : `${zone.city} clock`}
      >
        <circle cx="32" cy="32" r="31.5" className={night ? "fill-primary" : "fill-card"} />
        <circle cx="32" cy="32" r="31" fill="none" stroke="currentColor" strokeOpacity="0.14" />
        {Array.from({ length: 12 }, (_, i) => {
          const major = i % 3 === 0;
          return (
            <line
              key={i}
              x1="32"
              y1={major ? 5.5 : 6.5}
              x2="32"
              y2={major ? 10.5 : 9}
              stroke="currentColor"
              strokeOpacity={major ? 0.75 : 0.35}
              strokeWidth={major ? 1.6 : 1}
              strokeLinecap="round"
              transform={`rotate(${i * 30} 32 32)`}
            />
          );
        })}
        {parts ? (
          <g strokeLinecap="round">
            <line x1="32" y1="34.5" x2="32" y2="19" stroke="currentColor" strokeWidth="2.2" transform={`rotate(${hourAngle} 32 32)`} />
            <line x1="32" y1="36" x2="32" y2="11" stroke="currentColor" strokeWidth="1.4" transform={`rotate(${minuteAngle} 32 32)`} />
            <g transform={`rotate(${secondAngle} 32 32)`} className="text-[#b08a5a]">
              <line x1="32" y1="39" x2="32" y2="9" stroke="currentColor" strokeWidth="0.8" />
            </g>
            <circle cx="32" cy="32" r="2.1" fill="currentColor" />
            <circle cx="32" cy="32" r="1" fill="#b08a5a" />
          </g>
        ) : null}
      </svg>
      <div className="leading-tight">
        <p className="text-[13px] font-medium text-foreground">{zone.city}</p>
        <p className="mt-0.5 text-[13px] tabular-nums text-muted-foreground" suppressHydrationWarning>
          {digital}
          <span className="ml-1.5 text-[11px] tracking-wide text-muted-foreground/70">{zone.offset}</span>
        </p>
      </div>
    </div>
  );
}
