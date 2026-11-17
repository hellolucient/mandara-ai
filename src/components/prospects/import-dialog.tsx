"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type ImportResponse = {
  error?: string;
  created?: number;
  updated?: number;
  signalsAdded?: number;
  signalsDuplicate?: number;
  signalsUnmatched?: string[];
  skipped?: string[];
};

export function formatProspectImport(body: ImportResponse): string {
  const parts = [`${body.created ?? 0} new`, `${body.updated ?? 0} refreshed`];
  if ((body.signalsAdded ?? 0) || (body.signalsDuplicate ?? 0)) {
    parts.push(`${body.signalsAdded ?? 0} signal${body.signalsAdded === 1 ? "" : "s"} added`);
    if (body.signalsDuplicate) parts.push(`${body.signalsDuplicate} already there`);
  }
  if (body.signalsUnmatched?.length) parts.push(`${body.signalsUnmatched.length} signal(s) for an unknown prospect`);
  if (body.skipped?.length) parts.push(`${body.skipped.length} row(s) skipped`);
  return `Saved · ${parts.join(" · ")}`;
}

export function ProspectImportDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setError("");
          setSaved("");
        }
      }}
    >
      <DialogTrigger render={<Button variant="outline" className="h-9 gap-2 rounded-xl px-3.5" />}>
        <FileUp className="size-4" strokeWidth={1.75} /> Import workbook
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import prospects or signals</DialogTitle>
          <DialogDescription>
            Choose the prospects JSON built from the resort intel workbook, or a signals file from the weekly watch.
            Importing again refreshes the workbook facts. Stages, notes and signals you have set are kept.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            setSaved("");
            setPending(true);
            try {
              const response = await fetch("/api/prospects/import", { method: "POST", body: new FormData(event.currentTarget) });
              const body = (await response.json()) as ImportResponse;
              if (!response.ok) {
                setError(body.error || "The file was not stored.");
                return;
              }
              setSaved(formatProspectImport(body));
              router.refresh();
            } catch {
              setError("The file was not stored.");
            } finally {
              setPending(false);
            }
          }}
        >
          <Input name="file" type="file" accept=".json,application/json" required />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {saved ? <p className="text-sm text-foreground">{saved}</p> : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Importing" : "Import"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
