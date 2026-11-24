"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatImportConfirmation } from "@/lib/sales-import";

type ImportResponse = {
  error?: string;
  issues?: string[];
  ok?: boolean;
  businessDate?: string;
  locations?: number;
  netSales?: number;
};

export function SalesActions({ canRun }: { canRun: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState<"" | "report" | "check" | "import">("");
  const [open, setOpen] = useState(false);
  const [importError, setImportError] = useState("");
  const [importSaved, setImportSaved] = useState("");
  const [savedNotice, setSavedNotice] = useState("");

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
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) {
            setImportError("");
            setImportSaved("");
          }
        }}
      >
        <DialogTrigger render={<Button variant="outline" />}>Import a file</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import one business date</DialogTitle>
            <DialogDescription>
              Daily totals: CSV with business_date, location, net_sales, treatments, budget; or the usual location-rows JSON. Item lines: JSON with
              businessDate, currency, and an items array (location, category treatment or retail, name, quantity, netSales). Re-importing a date replaces
              that date&apos;s rows for the spas in the file.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={async (event) => {
              event.preventDefault();
              setImportError("");
              setImportSaved("");
              setPending("import");
              try {
                const response = await fetch("/api/sales/import", { method: "POST", body: new FormData(event.currentTarget) });
                const body = (await response.json()) as ImportResponse;
                if (!response.ok) {
                  setImportError(body.error || "The file was not stored.");
                  return;
                }
                const confirmation =
                  body.businessDate && body.locations != null && body.netSales != null
                    ? formatImportConfirmation({
                        businessDate: body.businessDate,
                        locations: body.locations,
                        netSales: body.netSales,
                      })
                    : "Saved.";
                const withIssues =
                  body.issues && body.issues.length > 0 ? `${confirmation}. ${body.issues.join(" ")}` : confirmation;
                setImportSaved(withIssues);
                setSavedNotice(confirmation);
                router.refresh();
              } catch {
                setImportError("The file was not stored.");
              } finally {
                setPending("");
              }
            }}
          >
            <Input name="file" type="file" accept=".csv,.json,text/csv,application/json" required />
            {importError ? <p className="text-sm text-destructive">{importError}</p> : null}
            {importSaved ? <p className="text-sm text-foreground">{importSaved}</p> : null}
            <Button type="submit" disabled={pending !== ""}>
              {pending === "import" ? "Saving" : "Store records"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      {savedNotice ? <p className="w-full text-sm text-foreground">{savedNotice}</p> : null}
      {error ? <p className="w-full text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
