/**
 * Expression Evaluator for Aggregation
 *
 * Evaluates expressions like "commands[].c1" to extract values from data structures.
 * Supports array navigation, property access, and filtering.
 */

import type { Result } from "../core/result.ts";
import {
  type ExpressionPart,
  JSONPathExpression,
} from "./jsonpath-expression.ts";

/**
 * Type guard for validating unknown data as Record<string, unknown>
 * Eliminates type assertions following Totality principles
 */
function isValidRecordData(data: unknown): data is Record<string, unknown> {
  return typeof data === "object" &&
    data !== null &&
    !Array.isArray(data);
}

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
    // Validate expression using Smart Constructor
    const exprResult = JSONPathExpression.create(expression);
    if (!exprResult.ok) {
      return {
        ok: false,
        error: {
          kind: "InvalidExpression",
          message: exprResult.error.message,
        },
      };
    }

    try {
      const result = this.evaluateParts(data, exprResult.data.getParts());
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
          case "root": {
            // Root selector just passes through the current item
            next.push(item);
            break;
          }

          case "property": {
            if (isValidRecordData(item) && part.value in item) {
              next.push(item[part.value]);
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
 * Factory function to create an expression evaluator
 */
export function createExpressionEvaluator(): ExpressionEvaluator {
  return new ExpressionEvaluator();
}
