"use client";

import { useEffect } from "react";
import { ArrowLeft, Printer } from "lucide-react";

/** Screen-only toolbar for the printable report. With auto, opens the browser's print dialog (Save as PDF) once fonts are ready. */
export function PrintControls({ auto, backHref }: { auto: boolean; backHref: string }) {
  useEffect(() => {
    if (!auto) return;
    let cancelled = false;
    const ready = document.fonts?.ready ?? Promise.resolve();
    ready.then(() => {
      if (!cancelled) setTimeout(() => window.print(), 250);
    });
    return () => {
      cancelled = true;
    };
  }, [auto]);
  return (
    <div className="mx-auto flex max-w-[210mm] items-center justify-between gap-3 px-4 py-4 print:hidden">
      <a href={backHref} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="size-4" strokeWidth={1.75} /> Back to Sales
      </a>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        <Printer className="size-4" strokeWidth={1.75} /> Save as PDF
      </button>
    </div>
  );
}
