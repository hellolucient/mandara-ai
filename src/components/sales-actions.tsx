"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function SalesActions({ canRun }: { canRun: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState<"" | "report" | "check">("");
  const [open, setOpen] = useState(false);

  if (!canRun) return <p className="text-sm text-muted-foreground">A manager can refresh the report, check the DSR sign-in, or import a file.</p>;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        disabled={pending !== ""}
        onClick={async () => {
          setPending("report");
          setError("");
          try {
            const response = await fetch("/api/agents/sales/run", { method: "POST" });
            const body = (await response.json()) as { error?: string };
            if (!response.ok) {
              setError(body.error || "The report was not created.");
              return;
            }
            router.refresh();
          } finally {
            setPending("");
          }
        }}
      >
        {pending === "report" ? "Working" : "Generate report"}
      </Button>
      <Button
        variant="outline"
        disabled={pending !== ""}
        onClick={async () => {
          setPending("check");
          setError("");
          try {
            const response = await fetch("/api/agents/sales/check", { method: "POST" });
            const body = (await response.json()) as { error?: string; ok?: boolean; summary?: string };
            if (!response.ok) {
              setError(body.error || body.summary || "The DSR sign-in was not checked.");
              return;
            }
            if (body.ok === false) setError(body.summary || body.error || "The DSR sign-in was not checked.");
            router.refresh();
          } finally {
            setPending("");
          }
        }}
      >
        {pending === "check" ? "Checking" : "Check DSR sign-in"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button variant="outline" />}>Import a file</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import one business date</DialogTitle>
            <DialogDescription>
              CSV columns: business_date, location, net_sales, treatments, budget. Leave a cell blank when the figure is unknown. Budgets are never filled in for you.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={async (event) => {
              event.preventDefault();
              setError("");
              const response = await fetch("/api/sales/import", { method: "POST", body: new FormData(event.currentTarget) });
              const body = (await response.json()) as { error?: string; issues?: string[] };
              if (!response.ok) {
                setError(body.error || "The file was not stored.");
                return;
              }
              setOpen(false);
              router.refresh();
            }}
          >
            <Input name="file" type="file" accept=".csv,.json,text/csv,application/json" required />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit">Store records</Button>
          </form>
        </DialogContent>
      </Dialog>
      {error ? <p className="w-full text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
