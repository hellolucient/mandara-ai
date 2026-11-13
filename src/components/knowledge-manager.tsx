"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function KnowledgeManager({ canRestrict, canDelete }: { canRestrict: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="space-y-3 rounded-xl border bg-card p-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        const response = await fetch("/api/knowledge", { method: "POST", body: new FormData(event.currentTarget) });
        const body = (await response.json()) as { error?: string };
        setBusy(false);
        if (!response.ok) {
          setError(body.error || "The document was not stored.");
          return;
        }
        event.currentTarget.reset();
        router.refresh();
      }}
    >
      <div>
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" placeholder="Housekeeping SOP" className="mt-1 h-10" />
      </div>
      <div>
        <Label htmlFor="file">File</Label>
        <Input id="file" name="file" type="file" accept=".pdf,.docx,.txt,.md,.csv" required className="mt-1 h-10" />
      </div>
      <div>
        <Label htmlFor="visibility">Who can use it in answers</Label>
        <select id="visibility" name="visibility" className="mt-1 h-10 w-full rounded-lg border bg-background px-3 text-sm" defaultValue="company">
          <option value="company">All staff</option>
          {canRestrict ? <option value="restricted">Managers and administrators</option> : null}
        </select>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={busy}>
        {busy ? "Reading" : "Add document"}
      </Button>
      {!canDelete ? <p className="text-xs text-muted-foreground">You can remove documents you uploaded.</p> : null}
    </form>
  );
}

export function DeleteDocument({ id }: { id: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  return (
    <div>
      <button
        type="button"
        className="text-xs text-muted-foreground hover:text-destructive"
        onClick={async () => {
          const response = await fetch(`/api/knowledge/${id}`, { method: "DELETE" });
          if (!response.ok) {
            const body = (await response.json()) as { error?: string };
            setError(body.error || "It could not be removed.");
            return;
          }
          router.refresh();
        }}
      >
        Remove
      </button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
