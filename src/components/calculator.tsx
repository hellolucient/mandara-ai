"use client";

import { useState, useMemo } from "react";
import { evaluateFormula } from "@/lib/calculator-eval";
import type { CalculatorSpec } from "@/lib/calculator-spec";
import { Label } from "@/components/ui/label";

export function Calculator({ spec }: { spec: CalculatorSpec }) {
  // Initialize state from default values
  const initialValues = useMemo(() => {
    const values: Record<string, number> = {};
    for (const input of spec.inputs) {
      values[input.id] = input.default;
    }
    return values;
  }, [spec.inputs]);

  const [values, setValues] = useState(initialValues);

  // Compute all outputs
  const outputs = useMemo(() => {
    return spec.outputs.map((output) => {
      const result = evaluateFormula(output.formula, values);
      return {
        id: output.id,
        label: output.label,
        value: result,
        unit: output.unit,
        format: output.format,
      };
    });
  }, [spec.outputs, values]);

  // Compute bar parts if present
  const barParts = useMemo(() => {
    if (!spec.bar) return null;

    const parts = spec.bar.parts.map((part) => {
      const value = evaluateFormula(part.formula, values);
      return {
        label: part.label,
        value: value ?? 0,
        color: part.color,
      };
    });

    const total = parts.reduce((sum, p) => sum + p.value, 0);
    return { parts, total, note: spec.bar.note };
  }, [spec.bar, values]);

  function formatValue(value: number | null, format?: string, unit?: string): string {
    if (value === null) return "—";

    let formatted: string;
    if (format === "currency") {
      formatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    } else if (format === "percent") {
      formatted = `${value.toFixed(1)}%`;
    } else {
      formatted = value.toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
    }

    return unit && format !== "currency" && format !== "percent" ? `${formatted} ${unit}` : formatted;
  }

  return (
    <div className="my-4 rounded-xl border bg-card p-4 sm:p-6">
      {spec.title && (
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{spec.title}</h3>
          <span className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">Illustrative</span>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Inputs */}
        <div className="space-y-4">
          {spec.inputs.map((input) => (
            <div key={input.id}>
              <div className="mb-2 flex items-baseline justify-between">
                <Label htmlFor={input.id} className="text-sm font-medium">
                  {input.label}
                </Label>
                <span className="text-lg font-semibold">
                  {input.unit && ["$", "€", "£"].includes(input.unit) ? input.unit : ""}
                  {values[input.id].toLocaleString()}
                  {input.unit && !["$", "€", "£"].includes(input.unit) ? input.unit : ""}
                </span>
              </div>
              <input
                type="range"
                id={input.id}
                min={input.min}
                max={input.max}
                step={input.step}
                value={values[input.id]}
                onChange={(e) => setValues((prev) => ({ ...prev, [input.id]: parseFloat(e.target.value) }))}
                className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-primary"
              />
            </div>
          ))}
        </div>

        {/* Outputs */}
        <div className="space-y-3">
          {outputs.map((output) => (
            <div key={output.id} className="flex items-baseline justify-between rounded-lg bg-muted p-3">
              <span className="text-sm text-muted-foreground">{output.label}</span>
              <span className="text-lg font-semibold">{formatValue(output.value, output.format, output.unit)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bar chart */}
      {barParts && (
        <div className="mt-6">
          <p className="mb-2 text-sm font-medium">Allocation of illustrative operating profit</p>
          <div className="flex h-10 overflow-hidden rounded-lg">
            {barParts.parts.map((part, idx) => {
              const percentage = barParts.total > 0 ? (part.value / barParts.total) * 100 : 0;
              const colors = [
                "bg-slate-900 dark:bg-slate-700",
                "bg-emerald-500 dark:bg-emerald-600",
                "bg-blue-500 dark:bg-blue-600",
                "bg-amber-500 dark:bg-amber-600",
                "bg-purple-500 dark:bg-purple-600",
              ];
              const color = part.color || colors[idx % colors.length];

              return (
                <div
                  key={idx}
                  className={`${color} flex items-center justify-center text-white text-xs font-medium transition-all`}
                  style={{ width: `${percentage}%` }}
                  title={`${part.label}: ${percentage.toFixed(1)}%`}
                >
                  {percentage > 8 && <span>{part.label} {percentage.toFixed(0)}%</span>}
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
            {barParts.parts.map((part, idx) => {
              const percentage = barParts.total > 0 ? (part.value / barParts.total) * 100 : 0;
              return (
                <div key={idx} className="flex items-center gap-1.5">
                  <div className={`h-3 w-3 rounded-sm ${["bg-slate-900", "bg-emerald-500", "bg-blue-500", "bg-amber-500", "bg-purple-500"][idx % 5]}`} />
                  <span>{part.label} {percentage.toFixed(0)}%</span>
                </div>
              );
            })}
          </div>
          {barParts.note && (
            <p className="mt-3 text-xs text-muted-foreground italic">{barParts.note}</p>
          )}
        </div>
      )}
    </div>
  );
}
