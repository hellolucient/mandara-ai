"use client";

import { useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { askPlaceholder, type AskMode } from "@/lib/ask-placeholder";

const MODES: Array<{ value: AskMode; label: string }> = [
  { value: "mandara", label: "Mandara" },
  { value: "general", label: "General" },
];

export function AskTile() {
  const [mode, setMode] = useState<AskMode>("mandara");

  return (
    <div className="mt-4 flex flex-1 flex-col rounded-2xl border border-black/[0.06] bg-card p-5 shadow-[0_1px_2px_rgba(20,40,35,0.04)] md:p-6 dark:border-white/10">
      <form
        action="/chat"
        method="get"
        onSubmit={(event) => {
          const ask = event.currentTarget.elements.namedItem("ask");
          if (ask instanceof HTMLInputElement) ask.value = crypto.randomUUID();
        }}
      >
        <input type="hidden" name="ask" value="" />
        <div className="flex items-center gap-2 rounded-xl border border-input bg-background p-1.5 pl-3.5 transition-shadow focus-within:border-primary/40 focus-within:shadow-[0_0_0_4px_rgba(40,90,85,0.08)]">
          <Sparkles aria-hidden="true" className="size-[18px] shrink-0 text-primary/70" strokeWidth={1.5} />
          <input
            type="text"
            name="q"
            placeholder={askPlaceholder(mode)}
            className="min-w-0 flex-1 bg-transparent py-2 text-[15px] placeholder:text-muted-foreground/70 focus:outline-none"
          />
          <button
            type="submit"
            aria-label="Start conversation"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <ArrowRight className="size-4" strokeWidth={1.75} />
          </button>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div role="radiogroup" aria-label="Mode" className="inline-flex rounded-full bg-secondary p-0.5 text-[12.5px]">
            {MODES.map((item) => (
              <label key={item.value} className="cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  value={item.value}
                  checked={mode === item.value}
                  onChange={() => setMode(item.value)}
                  className="peer sr-only"
                />
                <span className="block rounded-full px-3 py-1 text-muted-foreground transition-colors peer-checked:bg-card peer-checked:text-foreground peer-checked:shadow-[0_1px_2px_rgba(20,40,35,0.12)] peer-focus-visible:ring-2 peer-focus-visible:ring-ring/40">
                  {item.label}
                </span>
              </label>
            ))}
          </div>
          {mode === "mandara" ? (
            <span className="hidden text-[12px] text-muted-foreground/80 sm:inline">Mandara answers from company records</span>
          ) : null}
        </div>
      </form>
    </div>
  );
}
