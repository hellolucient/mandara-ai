import { cn } from "cn";
import { PRIORITY_LABELS, SIGNAL_LABELS, STATUS_LABELS, type Priority, type ProspectStatus, type SignalType } from "@/lib/prospects-types";

const STATUS_TONE: Record<ProspectStatus, { dot: string; pill: string }> = {
  watching: { dot: "bg-foreground/30", pill: "border-black/[0.07] bg-background text-muted-foreground" },
  researching: { dot: "bg-[#6f9c97]", pill: "border-[#6f9c97]/25 bg-[#6f9c97]/[0.08] text-[#3d6d68]" },
  ready: { dot: "bg-primary", pill: "border-primary/20 bg-primary/[0.08] text-primary" },
  in_talks: { dot: "bg-[#b08a5a]", pill: "border-[#b08a5a]/30 bg-[#b08a5a]/[0.1] text-[#7a5a30]" },
  proposal: { dot: "bg-[#c2703d]", pill: "border-[#c2703d]/25 bg-[#c2703d]/[0.08] text-[#9a5226]" },
  won: { dot: "bg-emerald-600", pill: "border-emerald-600/20 bg-emerald-600/[0.08] text-emerald-800" },
  lost: { dot: "bg-foreground/20", pill: "border-black/[0.05] bg-muted text-muted-foreground/80" },
};

export function StatusDot({ status, className }: { status: ProspectStatus; className?: string }) {
  return <span aria-hidden="true" className={cn("inline-block size-1.5 shrink-0 rounded-full", STATUS_TONE[status].dot, className)} />;
}

export function StatusPill({ status, className }: { status: ProspectStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-medium whitespace-nowrap",
        STATUS_TONE[status].pill,
        className,
      )}
    >
      <StatusDot status={status} />
      <span>{STATUS_LABELS[status]}</span>
    </span>
  );
}

const PRIORITY_TONE: Record<Priority, string> = {
  A: "bg-primary text-primary-foreground",
  B: "bg-primary/[0.1] text-primary",
  C: "bg-[#b08a5a]/[0.14] text-[#7a5a30]",
  X: "bg-foreground/[0.06] text-muted-foreground",
  "": "bg-foreground/[0.04] text-muted-foreground/70",
};

export function PriorityBadge({ priority, withLabel = false }: { priority: Priority; withLabel?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2" title={`Priority ${priority || "–"}: ${PRIORITY_LABELS[priority]}`}>
      <span
        className={cn(
          "inline-flex size-6 items-center justify-center rounded-md text-[12px] font-semibold tabular-nums",
          PRIORITY_TONE[priority],
        )}
      >
        {priority || "–"}
      </span>
      {withLabel ? <span className="text-[12.5px] text-muted-foreground">{PRIORITY_LABELS[priority]}</span> : null}
    </span>
  );
}

export function SignalTypeTag({ type }: { type: SignalType }) {
  return (
    <span className="inline-flex rounded-md bg-primary/[0.07] px-1.5 py-0.5 text-[11px] font-medium tracking-wide text-primary uppercase">
      {SIGNAL_LABELS[type]}
    </span>
  );
}
