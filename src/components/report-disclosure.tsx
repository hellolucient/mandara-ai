"use client";

import { useId, useState } from "react";
import { ChevronDown, FileDown } from "lucide-react";
import { cn } from "cn";

/** The Sales page management report, collapsed until asked for, with an Export PDF link that works open or closed. */
export function ReportDisclosure({ exportHref, children }: { exportHref: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <section className="mt-6 rounded-xl border bg-card">
      <div className="flex items-center gap-2 p-2 pl-1 sm:pl-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((value) => !value)}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 text-left [@media(hover:hover)]:hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <ChevronDown
            aria-hidden="true"
            className={cn("size-5 shrink-0 text-muted-foreground transition-transform duration-200", open ? "rotate-0" : "-rotate-90")}
            strokeWidth={1.75}
          />
          <span className="min-w-0">
            <span className="block font-heading text-lg leading-tight whitespace-nowrap sm:text-2xl">Management report</span>
            <span className="block text-xs text-muted-foreground">{open ? "Hide the full report" : "Show the full report"}</span>
          </span>
        </button>
        <a
          href={exportHref}
          target="_blank"
          rel="noopener"
          aria-label="Export PDF"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border bg-background px-2.5 text-sm font-medium hover:bg-muted sm:px-3"
        >
          <FileDown aria-hidden="true" className="size-4" strokeWidth={1.75} />
          <span aria-hidden="true">
            <span className="hidden sm:inline">Export </span>PDF
          </span>
        </a>
      </div>
      <div id={id} hidden={!open} className="border-t p-3 sm:p-4">
        {children}
      </div>
    </section>
  );
}
