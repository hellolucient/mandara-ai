import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateFormula } from "./calculator-eval";

describe("calculator evaluator", () => {
  it("evaluates basic arithmetic", () => {
    assert.equal(evaluateFormula("2 + 3", {}), 5);
    assert.equal(evaluateFormula("10 - 4", {}), 6);
    assert.equal(evaluateFormula("5 * 6", {}), 30);
    assert.equal(evaluateFormula("20 / 4", {}), 5);
    assert.equal(evaluateFormula("17 % 5", {}), 2);
  });

  it("evaluates with variables", () => {
    assert.equal(evaluateFormula("revenue * 0.12", { revenue: 9500 }), 1140);
    assert.equal(evaluateFormula("revenue / locations", { revenue: 9500, locations: 12 }), 791.6666666666666);
    assert.equal(evaluateFormula("profit - cost", { profit: 5000, cost: 3000 }), 2000);
  });

  it("respects operator precedence", () => {
    assert.equal(evaluateFormula("2 + 3 * 4", {}), 14); // not 20
    assert.equal(evaluateFormula("10 / 2 + 3", {}), 8); // not 2
    assert.equal(evaluateFormula("2 ** 3 + 1", {}), 9); // 8 + 1
  });

  it("evaluates parentheses", () => {
    assert.equal(evaluateFormula("(2 + 3) * 4", {}), 20);
    assert.equal(evaluateFormula("10 / (2 + 3)", {}), 2);
    assert.equal(evaluateFormula("(revenue - cost) * margin", { revenue: 1000, cost: 600, margin: 0.3 }), 120);
  });

  it("evaluates exponentiation", () => {
    assert.equal(evaluateFormula("2 ** 3", {}), 8);
    assert.equal(evaluateFormula("revenue ** 1.5", { revenue: 4 }), 8);
  });

  it("evaluates unary operators", () => {
    assert.equal(evaluateFormula("-5", {}), -5);
    assert.equal(evaluateFormula("-(2 + 3)", {}), -5);
    assert.equal(evaluateFormula("+10", {}), 10);
    assert.equal(evaluateFormula("revenue * -1", { revenue: 100 }), -100);
  });

  it("evaluates functions", () => {
    assert.equal(evaluateFormula("min(5, 10)", {}), 5);
    assert.equal(evaluateFormula("max(5, 10)", {}), 10);
    assert.equal(evaluateFormula("abs(-42)", {}), 42);
    assert.equal(evaluateFormula("round(3.7)", {}), 4);
    assert.equal(evaluateFormula("floor(3.7)", {}), 3);
    assert.equal(evaluateFormula("ceil(3.2)", {}), 4);
  });

  it("evaluates complex expressions", () => {
    // Revenue share calculation
    const vars = { revenue: 9500, retail_pct: 0.18, treatment_revenue: 8360 };
    const formula = "treatment_revenue / (1 - retail_pct)";
    const result = evaluateFormula(formula, vars);
    assert.ok(result !== null);
    assert.ok(Math.abs(result! - 10195.12) < 1); // ~10,195

    // Monthly calculation
    const daily = evaluateFormula("(new_retail - old_retail) * 30", {
      new_retail: 1835,
      old_retail: 1140,
    });
    assert.equal(daily, 20850);
  });

  it("returns null for invalid formulas", () => {
    assert.equal(evaluateFormula("2 +", {}), null);
    assert.equal(evaluateFormula("* 5", {}), null);
    assert.equal(evaluateFormula("(2 + 3", {}), null); // Missing )
    assert.equal(evaluateFormula("unknown_var", {}), null); // Unknown variable
    assert.equal(evaluateFormula("2 @ 3", {}), null); // Unknown operator
  });

  it("handles division by zero gracefully", () => {
    const result = evaluateFormula("10 / 0", {});
    assert.equal(result, null); // NaN becomes null
  });

  it("rejects unsafe operations", () => {
    // These should fail to parse (no eval, no arbitrary code)
    assert.equal(evaluateFormula("eval('1+1')", {}), null);
    assert.equal(evaluateFormula("require('fs')", {}), null);
    assert.equal(evaluateFormula("process.exit()", {}), null);
  });
});
