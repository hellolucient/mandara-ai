"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PROSPECT_STATUSES, SIGNAL_LABELS, SIGNAL_TYPES, STATUS_LABELS, type ProspectStatus } from "@/lib/prospects-types";

const field =
  "w-full rounded-xl border border-input bg-background px-3 py-2 text-[14px] focus:border-primary/40 focus:shadow-[0_0_0_4px_rgba(40,90,85,0.08)] focus:outline-none";

function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Indian/Maldives", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

async function send(url: string, method: string, body: unknown): Promise<string> {
  try {
    const response = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (response.ok) return "";
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    return data.error || "That was not saved.";
  } catch {
    return "That was not saved.";
  }
}

export function StageControl({ id, status }: { id: string; status: ProspectStatus }) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <div>
      <label className="block text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase" htmlFor="stage">
        Stage
      </label>
      <select
        id="stage"
        value={value}
        disabled={pending}
        onChange={async (event) => {
          const next = event.target.value as ProspectStatus;
          const previous = value;
          setValue(next);
          setPending(true);
          setError("");
          const failed = await send(`/api/prospects/${id}`, "PATCH", { status: next, date: today() });
          setPending(false);
          if (failed) {
            setValue(previous);
            setError(failed);
            return;
          }
          router.refresh();
        }}
        className={`${field} mt-1.5 h-10 font-medium md:w-56`}
      >
        {PROSPECT_STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      {error ? <p className="mt-1.5 text-[12.5px] text-destructive">{error}</p> : null}
    </div>
  );
}

export function NoteForm({ id }: { id: string }) {
  const router = useRouter();
  const [date, setDate] = useState(today);
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="space-y-2.5"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        const failed = await send(`/api/prospects/${id}/notes`, "POST", { date, body });
        setPending(false);
        if (failed) return setError(failed);
        setBody("");
        router.refresh();
      }}
    >
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        required
        rows={3}
        placeholder="What happened, who you spoke to, what's next"
        aria-label="Note"
        className={`${field} resize-y`}
      />
      <div className="flex flex-wrap items-center gap-2">
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required aria-label="Note date" className={`${field} h-9 w-auto py-1`} />
        <Button type="submit" disabled={pending || !body.trim()} className="h-9 gap-1.5 rounded-xl px-3.5">
          <Plus className="size-4" strokeWidth={1.75} /> {pending ? "Saving" : "Add note"}
        </Button>
      </div>
      {error ? <p className="text-[12.5px] text-destructive">{error}</p> : null}
    </form>
  );
}

export function SignalForm({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today);
  const [type, setType] = useState<string>("news");
  const [summary, setSummary] = useState("");
  const [url, setUrl] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)} className="h-9 gap-1.5 rounded-xl px-3.5">
        <Plus className="size-4" strokeWidth={1.75} /> Add signal
      </Button>
    );
  }
  return (
    <form
      className="space-y-2.5 rounded-xl border border-black/[0.06] bg-background/60 p-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        setNotice("");
        try {
          const response = await fetch(`/api/prospects/${id}/signals`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ date, type, summary, url }),
          });
          const data = (await response.json().catch(() => ({}))) as { error?: string; duplicate?: boolean };
          if (!response.ok) return setError(data.error || "That was not saved.");
          if (data.duplicate) return setNotice("That signal is already recorded.");
          setSummary("");
          setUrl("");
          setOpen(false);
          router.refresh();
        } catch {
          setError("That was not saved.");
        } finally {
          setPending(false);
        }
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required aria-label="Signal date" className={`${field} h-9 py-1`} />
        <select value={type} onChange={(event) => setType(event.target.value)} aria-label="Signal type" className={`${field} h-9 py-1`}>
          {SIGNAL_TYPES.map((t) => (
            <option key={t} value={t}>
              {SIGNAL_LABELS[t]}
            </option>
          ))}
        </select>
      </div>
      <textarea
        value={summary}
        onChange={(event) => setSummary(event.target.value)}
        required
        rows={2}
        placeholder="e.g. New GM appointed from Cinnamon"
        aria-label="Signal summary"
        className={`${field} resize-y`}
      />
      <input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="Source link (https://…)" aria-label="Source link" className={`${field} h-9 py-1`} />
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending || !summary.trim()} className="h-9 rounded-xl px-3.5">
          {pending ? "Saving" : "Save signal"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="h-9 rounded-xl px-3">
          Cancel
        </Button>
      </div>
      {error ? <p className="text-[12.5px] text-destructive">{error}</p> : null}
      {notice ? <p className="text-[12.5px] text-muted-foreground">{notice}</p> : null}
    </form>
  );
}
