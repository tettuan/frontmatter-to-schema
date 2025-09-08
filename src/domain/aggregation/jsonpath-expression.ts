/**
 * JSONPath Expression Value Object
 *
 * Smart Constructor for JSONPath expressions that validates
 * syntax at creation time to ensure totality.
 */

import type { Result } from "../core/result.ts";

/**
 * Validated JSONPath expression
 */
export class JSONPathExpression {
  private constructor(
    private readonly expression: string,
    private readonly parts: ExpressionPart[],
  ) {}

  /**
   * Create a validated JSONPath expression
   */
  static create(
    expression: string,
  ): Result<JSONPathExpression, { kind: string; message: string }> {
    // Validate empty
    if (!expression || expression.trim().length === 0) {
      return {
        ok: false,
        error: {
          kind: "EmptyExpression",
          message: "JSONPath expression cannot be empty",
        },
      };
    }

    const trimmed = expression.trim();

    // Validate syntax
    const syntaxResult = JSONPathExpression.validateSyntax(trimmed);
    if (!syntaxResult.ok) {
      return syntaxResult;
    }

    // Parse expression
    const parseResult = JSONPathExpression.parseExpression(trimmed);
    if (!parseResult.ok) {
      return parseResult;
    }

    return {
      ok: true,
      data: new JSONPathExpression(trimmed, parseResult.data),
    };
  }

  /**
   * Validate JSONPath syntax
   */
  private static validateSyntax(
    expression: string,
  ): Result<void, { kind: string; message: string }> {
    // Check for invalid characters (allow $ for JSONPath root)
    if (/[^a-zA-Z0-9_\[\]\.\*\$]/.test(expression)) {
      return {
        ok: false,
        error: {
          kind: "InvalidCharacters",
          message: `Invalid characters in JSONPath expression: ${expression}`,
        },
      };
    }

    // Check for consecutive dots
    if (/\.\./.test(expression)) {
      return {
        ok: false,
        error: {
          kind: "ConsecutiveDots",
          message: "JSONPath expression cannot contain consecutive dots",
        },
      };
    }

    // Check for empty brackets
    if (/\[\s*\]/.test(expression.replace("[]", "temp"))) {
      return {
        ok: false,
        error: {
          kind: "EmptyBrackets",
          message: "Invalid empty brackets in JSONPath expression",
        },
      };
    }

    // Check bracket balance
    const openBrackets = (expression.match(/\[/g) || []).length;
    const closeBrackets = (expression.match(/\]/g) || []).length;
    if (openBrackets !== closeBrackets) {
      return {
        ok: false,
        error: {
          kind: "UnbalancedBrackets",
          message: "Unbalanced brackets in JSONPath expression",
        },
      };
    }

    // Check for invalid array notation - allow [], [*], or [number]
    const arrayPattern = /\[([^\]]*)\]/g;
    let arrayMatch;
    while ((arrayMatch = arrayPattern.exec(expression)) !== null) {
      const content = arrayMatch[1];
      if (content !== "" && content !== "*" && !/^\d+$/.test(content)) {
        return {
          ok: false,
          error: {
            kind: "InvalidArrayNotation",
            message: `Invalid array notation: [${content}]`,
          },
        };
      }
    }

    return { ok: true, data: undefined };
  }

  /**
   * Parse expression into navigable parts
   */
  private static parseExpression(
    expression: string,
  ): Result<ExpressionPart[], { kind: string; message: string }> {
    const parts: ExpressionPart[] = [];
    const tokens = expression.split(/(?=\[)|(?=\.)/);

    for (const token of tokens) {
      if (token.startsWith("[]")) {
        // Array iterator
        parts.push({ type: "array", value: "[]" });
        // Handle property after []
        const remainder = token.substring(2);
        if (remainder.startsWith(".")) {
          const propName = remainder.substring(1);
          if (propName) {
            parts.push({ type: "property", value: propName });
          }
        } else if (remainder.length > 0) {
          return {
            ok: false,
            error: {
              kind: "InvalidSyntax",
              message: `Invalid syntax after array notation: ${remainder}`,
            },
          };
        }
      } else if (token.startsWith("[")) {
        // Array index or slice
        const match = token.match(/^\[(\d+|\*)\]$/);
        if (match) {
          parts.push({ type: "index", value: match[1] });
        } else if (token === "[]") {
          parts.push({ type: "array", value: "[]" });
        } else {
          return {
            ok: false,
            error: {
              kind: "InvalidArrayIndex",
              message: `Invalid array index notation: ${token}`,
            },
          };
        }
      } else if (token.startsWith(".")) {
        // Property access
        const propName = token.substring(1);
        if (!propName) {
          return {
            ok: false,
            error: {
              kind: "EmptyProperty",
              message: "Property name cannot be empty after dot",
            },
          };
        }
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(propName)) {
          return {
            ok: false,
            error: {
              kind: "InvalidPropertyName",
              message: `Invalid property name: ${propName}`,
            },
          };
        }
        parts.push({ type: "property", value: propName });
      } else if (token) {
        // First property (no leading dot) or root symbol ($)
        if (token === "$") {
          parts.push({ type: "root", value: "$" });
        } else if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(token)) {
          return {
            ok: false,
            error: {
              kind: "InvalidPropertyName",
              message: `Invalid property name: ${token}`,
            },
          };
        } else {
          parts.push({ type: "property", value: token });
        }
      }
    }

    if (parts.length === 0) {
      return {
        ok: false,
        error: {
          kind: "EmptyParts",
          message: "JSONPath expression resulted in no valid parts",
        },
      };
    }

    return { ok: true, data: parts };
  }

  /**
   * Get the raw expression string
   */
  getExpression(): string {
    return this.expression;
  }

  /**
   * Get the parsed parts
   */
  getParts(): ExpressionPart[] {
    return [...this.parts];
  }

  /**
   * Check if expression contains array operations
   */
  hasArrayOperations(): boolean {
    return this.parts.some((p) => p.type === "array" || p.type === "index");
  }

  /**
   * Get the depth of the expression
   */
  getDepth(): number {
    return this.parts.filter((p) => p.type === "property").length;
  }
}

/**
 * Represents a part of an expression
 */
export interface ExpressionPart {
  type: "property" | "array" | "index" | "root";
  value: string;
}
