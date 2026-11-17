"use client";

import { useEffect, useState } from "react";

export function WorldClocks() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const bangkokTime = time.toLocaleTimeString("en-US", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const maldivesTime = time.toLocaleTimeString("en-US", {
    timeZone: "Indian/Maldives",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const currentDate = time.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
      <div className="flex items-center gap-2">
        <span className="font-medium text-foreground">Bangkok</span>
        <span>{bangkokTime}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-medium text-foreground">Maldives</span>
        <span>{maldivesTime}</span>
      </div>
      <div className="ml-auto">{currentDate}</div>
    </div>
  );
}
