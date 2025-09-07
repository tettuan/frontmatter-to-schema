/**
 * Expression Evaluator for Aggregation
 *
 * Evaluates expressions like "commands[].c1" to extract values from data structures.
 * Supports array navigation, property access, and filtering.
 */

import type { Result } from "../core/result.ts";

/**
 * Evaluates expressions against data objects
 */
export class ExpressionEvaluator {
  /**
   * Evaluate an expression against a data object
   * Examples:
   * - "commands[].c1" - Extract all c1 values from commands array
   * - "tools.availableConfigs" - Access nested property
   * - "items[].properties.name" - Navigate through array of objects
   */
  evaluate(
    data: unknown,
    expression: string,
  ): Result<unknown[], { kind: string; message: string }> {
    if (!expression || expression.trim().length === 0) {
      return {
        ok: false,
        error: {
          kind: "InvalidExpression",
          message: "Expression cannot be empty",
        },
      };
    }

    try {
      const parts = this.parseExpression(expression);
      const result = this.evaluateParts(data, parts);
      return { ok: true, data: result };
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "EvaluationError",
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Parse expression into navigable parts
   */
  private parseExpression(expression: string): ExpressionPart[] {
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
        }
      } else if (token.startsWith("[")) {
        // Array index or slice
        const match = token.match(/\[(\d+|\*)\]/);
        if (match) {
          parts.push({ type: "index", value: match[1] });
        } else if (token === "[]") {
          parts.push({ type: "array", value: "[]" });
        }
      } else if (token.startsWith(".")) {
        // Property access
        const propName = token.substring(1);
        if (propName) {
          parts.push({ type: "property", value: propName });
        }
      } else if (token) {
        // First property (no leading dot)
        parts.push({ type: "property", value: token });
      }
    }

    return parts;
  }

  /**
   * Evaluate parsed expression parts against data
   */
  private evaluateParts(data: unknown, parts: ExpressionPart[]): unknown[] {
    if (parts.length === 0) {
      return [data];
    }

    let current: unknown[] = [data];

    for (const part of parts) {
      const next: unknown[] = [];

      for (const item of current) {
        if (item === null || item === undefined) {
          continue;
        }

        switch (part.type) {
          case "property": {
            if (
              typeof item === "object" &&
              part.value in (item as Record<string, unknown>)
            ) {
              next.push((item as Record<string, unknown>)[part.value]);
            }
            break;
          }

          case "array": {
            if (Array.isArray(item)) {
              // Flatten array items
              next.push(...item);
            }
            break;
          }

          case "index": {
            if (Array.isArray(item)) {
              if (part.value === "*") {
                // All items
                next.push(...item);
              } else {
                const index = parseInt(part.value, 10);
                if (index >= 0 && index < item.length) {
                  next.push(item[index]);
                }
              }
            }
            break;
          }
        }
      }

      current = next;
    }

    return current;
  }

  /**
   * Extract unique values from expression evaluation
   */
  extractUnique(
    data: unknown[],
    expression: string,
  ): Result<unknown[], { kind: string; message: string }> {
    const evalResult = this.evaluate(data, expression);
    if (!evalResult.ok) {
      return evalResult;
    }

    const uniqueValues = new Set<unknown>();
    const result: unknown[] = [];

    for (const value of evalResult.data.flat()) {
      const key = this.getUniqueKey(value);
      if (!uniqueValues.has(key)) {
        uniqueValues.add(key);
        result.push(value);
      }
    }

    return { ok: true, data: result };
  }

  /**
   * Generate a unique key for value comparison
   */
  private getUniqueKey(value: unknown): string {
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (typeof value === "object") {
      return JSON.stringify(value);
    }
    return String(value);
  }
}

/**
 * Represents a part of an expression
 */
interface ExpressionPart {
  type: "property" | "array" | "index";
  value: string;
}

/**
 * Factory function to create an expression evaluator
 */
export function createExpressionEvaluator(): ExpressionEvaluator {
  return new ExpressionEvaluator();
}
