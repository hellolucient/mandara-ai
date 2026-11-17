/**
 * Calculator specification for interactive financial models.
 * The model outputs a safe declarative spec that the UI renders as sliders and computed outputs.
 */

export type CalculatorInput = {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
  unit?: string; // e.g. "$", "%", "rooms"
};

export type CalculatorOutput = {
  id: string;
  label: string;
  formula: string; // Expression over input IDs, e.g. "revenue * 0.12"
  unit?: string;
  format?: "currency" | "number" | "percent";
};

export type CalculatorBar = {
  parts: Array<{
    label: string;
    formula: string; // Must sum to 100 for percentage bars
    color?: string; // Optional color hint
  }>;
  note?: string; // Assumptions note
};

export type CalculatorSpec = {
  title?: string;
  inputs: CalculatorInput[];
  outputs: CalculatorOutput[];
  bar?: CalculatorBar;
};

/**
 * Validates a calculator spec from the model.
 * Returns error message if invalid, null if valid.
 */
export function validateCalculatorSpec(spec: unknown): string | null {
  if (!spec || typeof spec !== "object") {
    return "Calculator spec must be an object";
  }

  const s = spec as Partial<CalculatorSpec>;

  // Inputs validation
  if (!Array.isArray(s.inputs) || s.inputs.length === 0) {
    return "Calculator must have at least one input";
  }

  if (s.inputs.length > 10) {
    return "Calculator cannot have more than 10 inputs";
  }

  const inputIds = new Set<string>();
  for (const input of s.inputs) {
    if (!input.id || typeof input.id !== "string" || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.id)) {
      return "Input IDs must be valid identifiers (a-z, A-Z, 0-9, _)";
    }

    if (inputIds.has(input.id)) {
      return `Duplicate input ID: ${input.id}`;
    }
    inputIds.add(input.id);

    if (!input.label || typeof input.label !== "string" || input.label.length > 50) {
      return "Input labels must be 1-50 characters";
    }

    if (typeof input.min !== "number" || typeof input.max !== "number" || typeof input.step !== "number" || typeof input.default !== "number") {
      return "Input min/max/step/default must be numbers";
    }

    if (input.min >= input.max) {
      return `Input ${input.id}: min must be less than max`;
    }

    if (input.default < input.min || input.default > input.max) {
      return `Input ${input.id}: default must be between min and max`;
    }

    if (input.unit && (typeof input.unit !== "string" || input.unit.length > 10)) {
      return "Input units must be 1-10 characters";
    }
  }

  // Outputs validation
  if (!Array.isArray(s.outputs) || s.outputs.length === 0) {
    return "Calculator must have at least one output";
  }

  if (s.outputs.length > 8) {
    return "Calculator cannot have more than 8 outputs";
  }

  const outputIds = new Set<string>();
  for (const output of s.outputs) {
    if (!output.id || typeof output.id !== "string" || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(output.id)) {
      return "Output IDs must be valid identifiers";
    }

    if (outputIds.has(output.id)) {
      return `Duplicate output ID: ${output.id}`;
    }
    outputIds.add(output.id);

    if (!output.label || typeof output.label !== "string" || output.label.length > 50) {
      return "Output labels must be 1-50 characters";
    }

    if (!output.formula || typeof output.formula !== "string" || output.formula.length > 200) {
      return "Output formulas must be 1-200 characters";
    }

    // Formula must only reference input IDs
    const formulaVars = extractVariables(output.formula);
    for (const v of formulaVars) {
      if (!inputIds.has(v)) {
        return `Output ${output.id} formula references unknown variable: ${v}`;
      }
    }

    if (output.unit && (typeof output.unit !== "string" || output.unit.length > 10)) {
      return "Output units must be 1-10 characters";
    }

    if (output.format && !["currency", "number", "percent"].includes(output.format)) {
      return "Output format must be currency, number, or percent";
    }
  }

  // Bar validation (optional)
  if (s.bar) {
    if (!Array.isArray(s.bar.parts) || s.bar.parts.length === 0) {
      return "Bar must have at least one part";
    }

    if (s.bar.parts.length > 5) {
      return "Bar cannot have more than 5 parts";
    }

    for (const part of s.bar.parts) {
      if (!part.label || typeof part.label !== "string" || part.label.length > 30) {
        return "Bar part labels must be 1-30 characters";
      }

      if (!part.formula || typeof part.formula !== "string" || part.formula.length > 100) {
        return "Bar part formulas must be 1-100 characters";
      }

      const partVars = extractVariables(part.formula);
      for (const v of partVars) {
        if (!inputIds.has(v)) {
          return `Bar part formula references unknown variable: ${v}`;
        }
      }
    }

    if (s.bar.note && (typeof s.bar.note !== "string" || s.bar.note.length > 200)) {
      return "Bar note must be 1-200 characters";
    }
  }

  return null; // Valid
}

/**
 * Extracts variable names from a formula string.
 * Only matches valid identifiers (a-z, A-Z, 0-9, _).
 */
function extractVariables(formula: string): Set<string> {
  const vars = new Set<string>();
  const matches = formula.matchAll(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g);
  for (const match of matches) {
    vars.add(match[1]);
  }
  return vars;
}
