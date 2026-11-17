"use client";

import { useState } from "react";

export function BudgetForm() {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      setStatus("Please enter budget data");
      return;
    }

    setIsSubmitting(true);
    setStatus("");

    try {
      const response = await fetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const result = await response.json();

      if (response.ok) {
        setStatus(`✓ Imported ${result.count} budget${result.count === 1 ? "" : "s"}`);
        setText("");
      } else {
        setStatus(`Error: ${result.error || "Failed to import budgets"}`);
      }
    } catch (error) {
      setStatus(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="budget-text" className="block text-sm font-medium mb-1">
          Budget Data (one per line)
        </label>
        <p className="text-xs text-muted-foreground mb-2">
          Format: <code className="rounded bg-muted px-1 py-0.5">location_id, YYYY-MM, amount</code> or{" "}
          <code className="rounded bg-muted px-1 py-0.5">location_name, YYYY-MM, amount</code>
        </p>
        <textarea
          id="budget-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Example:&#10;Vadoo, 2026-11, 50000&#10;Dhigali, 2026-11, 65000"
          rows={6}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isSubmitting ? "Importing..." : "Import Budgets"}
        </button>
        {status && (
          <p className={`text-sm ${status.startsWith("✓") ? "text-green-600" : "text-red-600"}`}>
            {status}
          </p>
        )}
      </div>
    </form>
  );
}
