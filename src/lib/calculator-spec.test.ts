import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateCalculatorSpec, type CalculatorSpec } from "./calculator-spec";

describe("calculator spec validation", () => {
  it("accepts valid spec", () => {
    const spec: CalculatorSpec = {
      title: "Revenue Calculator",
      inputs: [
        { id: "revenue", label: "Daily revenue", min: 0, max: 50000, step: 100, default: 9500, unit: "$" },
        { id: "retail_pct", label: "Retail %", min: 0, max: 100, step: 1, default: 12, unit: "%" },
      ],
      outputs: [
        { id: "retail", label: "Retail revenue", formula: "revenue * retail_pct / 100", unit: "$", format: "currency" },
        { id: "treatment", label: "Treatment revenue", formula: "revenue * (1 - retail_pct / 100)", unit: "$", format: "currency" },
      ],
    };

    assert.equal(validateCalculatorSpec(spec), null);
  });

  it("rejects missing inputs", () => {
    const spec = { outputs: [] };
    assert.ok(validateCalculatorSpec(spec)?.includes("at least one input"));
  });

  it("rejects invalid input IDs", () => {
    const spec = {
      inputs: [{ id: "123invalid", label: "Test", min: 0, max: 100, step: 1, default: 50 }],
      outputs: [],
    };
    assert.ok(validateCalculatorSpec(spec)?.includes("valid identifiers"));
  });

  it("rejects duplicate input IDs", () => {
    const spec = {
      inputs: [
        { id: "revenue", label: "Rev 1", min: 0, max: 100, step: 1, default: 50 },
        { id: "revenue", label: "Rev 2", min: 0, max: 100, step: 1, default: 50 },
      ],
      outputs: [{ id: "out", label: "Output", formula: "revenue" }],
    };
    assert.ok(validateCalculatorSpec(spec)?.includes("Duplicate input ID"));
  });

  it("rejects invalid input ranges", () => {
    const spec = {
      inputs: [{ id: "revenue", label: "Revenue", min: 100, max: 50, step: 1, default: 75 }],
      outputs: [{ id: "out", label: "Output", formula: "revenue" }],
    };
    assert.ok(validateCalculatorSpec(spec)?.includes("min must be less than max"));
  });

  it("rejects output formulas with unknown variables", () => {
    const spec = {
      inputs: [{ id: "revenue", label: "Revenue", min: 0, max: 100, step: 1, default: 50 }],
      outputs: [{ id: "out", label: "Output", formula: "unknown_var * 2" }],
    };
    assert.ok(validateCalculatorSpec(spec)?.includes("unknown variable"));
  });

  it("accepts valid bar spec", () => {
    const spec: CalculatorSpec = {
      inputs: [
        { id: "revenue", label: "Revenue", min: 0, max: 100, step: 1, default: 100 },
        { id: "operator_pct", label: "Operator %", min: 0, max: 100, step: 1, default: 13 },
      ],
      outputs: [{ id: "out", label: "Output", formula: "revenue" }],
      bar: {
        parts: [
          { label: "Operator", formula: "operator_pct" },
          { label: "Remaining", formula: "100 - operator_pct" },
        ],
        note: "Assumes room revenue is 65% of total",
      },
    };

    assert.equal(validateCalculatorSpec(spec), null);
  });

  it("rejects too many inputs", () => {
    const spec = {
      inputs: Array.from({ length: 11 }, (_, i) => ({
        id: `input${i}`,
        label: `Input ${i}`,
        min: 0,
        max: 100,
        step: 1,
        default: 50,
      })),
      outputs: [{ id: "out", label: "Output", formula: "input0" }],
    };
    assert.ok(validateCalculatorSpec(spec)?.includes("more than 10 inputs"));
  });

  it("rejects too many outputs", () => {
    const spec = {
      inputs: [{ id: "revenue", label: "Revenue", min: 0, max: 100, step: 1, default: 50 }],
      outputs: Array.from({ length: 9 }, (_, i) => ({
        id: `output${i}`,
        label: `Output ${i}`,
        formula: "revenue",
      })),
    };
    assert.ok(validateCalculatorSpec(spec)?.includes("more than 8 outputs"));
  });
});
