/**
 * Safe expression evaluator for calculator formulas.
 * Only supports basic arithmetic operations, no eval() or Function().
 * 
 * Supported operations: +, -, *, /, %, ** (exponentiation), parentheses
 * Supported functions: min, max, abs, round, floor, ceil
 */

export function evaluateFormula(formula: string, variables: Record<string, number>): number | null {
  try {
    const tokens = tokenize(formula);
    const ast = parse(tokens);
    const result = evaluate(ast, variables);
    
    // Return null for NaN or Infinity
    if (!isFinite(result)) return null;
    
    return result;
  } catch {
    return null; // Invalid formula
  }
}

type Token = 
  | { type: "number"; value: number }
  | { type: "variable"; name: string }
  | { type: "operator"; op: string }
  | { type: "lparen" }
  | { type: "rparen" }
  | { type: "comma" }
  | { type: "function"; name: string };

function tokenize(formula: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < formula.length) {
    const char = formula[i];

    // Skip whitespace
    if (/\s/.test(char)) {
      i++;
      continue;
    }

    // Numbers (including decimals)
    if (/\d/.test(char) || (char === "." && /\d/.test(formula[i + 1] || ""))) {
      let num = "";
      while (i < formula.length && /[\d.]/.test(formula[i])) {
        num += formula[i];
        i++;
      }
      tokens.push({ type: "number", value: parseFloat(num) });
      continue;
    }

    // Variables and functions
    if (/[a-zA-Z_]/.test(char)) {
      let name = "";
      while (i < formula.length && /[a-zA-Z0-9_]/.test(formula[i])) {
        name += formula[i];
        i++;
      }

      // Check if it's a function (followed by '(')
      if (formula[i] === "(") {
        tokens.push({ type: "function", name });
      } else {
        tokens.push({ type: "variable", name });
      }
      continue;
    }

    // Exponentiation ** (check this before single *)
    if (char === "*" && formula[i + 1] === "*") {
      tokens.push({ type: "operator", op: "**" });
      i += 2;
      continue;
    }

    // Operators
    if (["+", "-", "*", "/", "%"].includes(char)) {
      tokens.push({ type: "operator", op: char });
      i++;
      continue;
    }

    // Parentheses
    if (char === "(") {
      tokens.push({ type: "lparen" });
      i++;
      continue;
    }

    if (char === ")") {
      tokens.push({ type: "rparen" });
      i++;
      continue;
    }

    // Comma (for function arguments)
    if (char === ",") {
      tokens.push({ type: "comma" });
      i++;
      continue;
    }

    // Unknown character - invalid
    throw new Error(`Unknown character: ${char}`);
  }

  return tokens;
}

type ASTNode =
  | { type: "number"; value: number }
  | { type: "variable"; name: string }
  | { type: "binop"; op: string; left: ASTNode; right: ASTNode }
  | { type: "unary"; op: string; arg: ASTNode }
  | { type: "function"; name: string; args: ASTNode[] };

function parse(tokens: Token[]): ASTNode {
  let pos = 0;

  function parseExpression(): ASTNode {
    return parseAddSub();
  }

  function parseAddSub(): ASTNode {
    let left = parseMulDiv();

    while (pos < tokens.length) {
      const token = tokens[pos];
      if (token.type === "operator" && (token.op === "+" || token.op === "-")) {
        pos++;
        const right = parseMulDiv();
        left = { type: "binop", op: token.op, left, right };
      } else {
        break;
      }
    }

    return left;
  }

  function parseMulDiv(): ASTNode {
    let left = parsePower();

    while (pos < tokens.length) {
      const token = tokens[pos];
      if (token.type === "operator" && (token.op === "*" || token.op === "/" || token.op === "%")) {
        pos++;
        const right = parsePower();
        left = { type: "binop", op: token.op, left, right };
      } else {
        break;
      }
    }

    return left;
  }

  function parsePower(): ASTNode {
    let left = parseUnary();

    while (pos < tokens.length) {
      const token = tokens[pos];
      if (token.type === "operator" && token.op === "**") {
        pos++;
        const right = parseUnary();
        left = { type: "binop", op: token.op, left, right };
      } else {
        break;
      }
    }

    return left;
  }

  function parseUnary(): ASTNode {
    const token = tokens[pos];

    // Unary minus or plus
    if (token?.type === "operator" && (token.op === "-" || token.op === "+")) {
      pos++;
      const arg = parseUnary();
      return { type: "unary", op: token.op, arg };
    }

    return parsePrimary();
  }

  function parsePrimary(): ASTNode {
    const token = tokens[pos];

    if (!token) {
      throw new Error("Unexpected end of expression");
    }

    // Number
    if (token.type === "number") {
      pos++;
      return { type: "number", value: token.value };
    }

    // Variable
    if (token.type === "variable") {
      pos++;
      return { type: "variable", name: token.name };
    }

    // Function call
    if (token.type === "function") {
      const name = token.name;
      pos++; // Skip function name
      pos++; // Skip '('

      const args: ASTNode[] = [];

      // Empty argument list
      if (tokens[pos]?.type === "rparen") {
        pos++;
        return { type: "function", name, args };
      }

      // Parse arguments
      while (pos < tokens.length) {
        args.push(parseExpression());

        if (tokens[pos]?.type === "comma") {
          pos++; // Skip comma
        } else if (tokens[pos]?.type === "rparen") {
          pos++; // Skip ')'
          break;
        } else {
          throw new Error("Expected comma or closing paren");
        }
      }

      return { type: "function", name, args };
    }

    // Parenthesized expression
    if (token.type === "lparen") {
      pos++; // Skip '('
      const expr = parseExpression();
      if (tokens[pos]?.type !== "rparen") {
        throw new Error("Expected closing paren");
      }
      pos++; // Skip ')'
      return expr;
    }

    throw new Error(`Unexpected token: ${token.type}`);
  }

  const ast = parseExpression();

  // Should consume all tokens
  if (pos !== tokens.length) {
    throw new Error("Unexpected tokens after expression");
  }

  return ast;
}

function evaluate(node: ASTNode, variables: Record<string, number>): number {
  if (node.type === "number") {
    return node.value;
  }

  if (node.type === "variable") {
    if (!(node.name in variables)) {
      throw new Error(`Unknown variable: ${node.name}`);
    }
    return variables[node.name];
  }

  if (node.type === "binop") {
    const left = evaluate(node.left, variables);
    const right = evaluate(node.right, variables);

    switch (node.op) {
      case "+": return left + right;
      case "-": return left - right;
      case "*": return left * right;
      case "/": return right === 0 ? NaN : left / right;
      case "%": return left % right;
      case "**": return Math.pow(left, right);
      default: throw new Error(`Unknown operator: ${node.op}`);
    }
  }

  if (node.type === "unary") {
    const arg = evaluate(node.arg, variables);
    if (node.op === "-") return -arg;
    if (node.op === "+") return arg;
    throw new Error(`Unknown unary operator: ${node.op}`);
  }

  if (node.type === "function") {
    const args = node.args.map((arg) => evaluate(arg, variables));

    switch (node.name) {
      case "min": return Math.min(...args);
      case "max": return Math.max(...args);
      case "abs": return Math.abs(args[0] ?? 0);
      case "round": return Math.round(args[0] ?? 0);
      case "floor": return Math.floor(args[0] ?? 0);
      case "ceil": return Math.ceil(args[0] ?? 0);
      default: throw new Error(`Unknown function: ${node.name}`);
    }
  }

  throw new Error(`Unknown node type`);
}
