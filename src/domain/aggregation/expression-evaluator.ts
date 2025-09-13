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
            // Root selector should handle arrays specially
            if (Array.isArray(item)) {
              // For root selector on arrays, expand the array items
              next.push(...item);
            } else {
              // For non-array items, pass through
              next.push(item);
            }
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

          case "function": {
            // Function parts are synthetic and should not be processed in normal evaluation
            // They are handled separately in count() and average() methods
            next.push(item);
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
   * Count items that match the expression across all data items
   */
  count(
    data: unknown[],
    expression: string,
  ): Result<number, { kind: string; message: string }> {
    let totalCount = 0;

    // Evaluate expression against each data item separately
    for (const item of data) {
      const evalResult = this.evaluate(item, expression);
      if (evalResult.ok) {
        // Count non-null/undefined values from this item
        const itemCount = evalResult.data.flat().filter((value) =>
          value !== null && value !== undefined
        ).length;
        totalCount += itemCount;
      }
    }

    return { ok: true, data: totalCount };
  }

  /**
   * Calculate average of numeric values that match the expression across all data items
   */
  average(
    data: unknown[],
    expression: string,
  ): Result<number, { kind: string; message: string }> {
    const allNumericValues: number[] = [];

    // Evaluate expression against each data item separately
    for (const item of data) {
      const evalResult = this.evaluate(item, expression);
      if (evalResult.ok) {
        // Filter and convert to numbers from this item
        const itemNumericValues = evalResult.data.flat()
          .map((value) => {
            if (typeof value === "number" && !isNaN(value)) {
              return value;
            }
            if (typeof value === "string") {
              const parsed = parseFloat(value);
              return !isNaN(parsed) ? parsed : null;
            }
            return null;
          })
          .filter((value): value is number => value !== null);

        allNumericValues.push(...itemNumericValues);
      }
    }

    if (allNumericValues.length === 0) {
      return {
        ok: false,
        error: {
          kind: "NoNumericValues",
          message: "No valid numeric values found for average calculation",
        },
      };
    }

    const sum = allNumericValues.reduce((acc, val) => acc + val, 0);
    const average = sum / allNumericValues.length;

    return { ok: true, data: average };
  }

  /**
   * Count items that match both the expression and a condition
   */
  countWhere(
    data: unknown[],
    expression: string,
    condition: string,
  ): Result<number, { kind: string; message: string }> {
    let totalCount = 0;

    // Evaluate expression against each data item separately
    for (const item of data) {
      const evalResult = this.evaluate(item, expression);
      if (evalResult.ok) {
        // Count items that match the condition
        const matchingItems = evalResult.data.flat().filter((value) => {
          if (value === null || value === undefined) {
            return false;
          }

          // Parse condition (simplified implementation)
          // Support basic conditions like "property === value" or "property !== value"
          const conditionMatch = condition.match(
            /^(\w+)\s*(===|!==|==|!=|>=|<=|>|<)\s*(.+)$/,
          );
          if (!conditionMatch) {
            return false;
          }

          const [, propName, operator, expectedValue] = conditionMatch;

          // Get the property value from the item
          let actualValue: unknown;
          if (isValidRecordData(value) && propName in value) {
            actualValue = value[propName];
          } else {
            return false;
          }

          // Parse expected value
          let parsedExpected: unknown;
          if (expectedValue === "true") {
            parsedExpected = true;
          } else if (expectedValue === "false") {
            parsedExpected = false;
          } else if (expectedValue === "null") {
            parsedExpected = null;
          } else if (/^["'].*["']$/.test(expectedValue)) {
            parsedExpected = expectedValue.slice(1, -1); // Remove quotes (both single and double)
          } else if (/^\d+(\.\d+)?$/.test(expectedValue)) {
            parsedExpected = parseFloat(expectedValue);
          } else {
            parsedExpected = expectedValue;
          }

          // Apply condition
          switch (operator) {
            case "===":
            case "==":
              return actualValue === parsedExpected;
            case "!==":
            case "!=":
              return actualValue !== parsedExpected;
            case ">":
              return typeof actualValue === "number" &&
                typeof parsedExpected === "number" &&
                actualValue > parsedExpected;
            case "<":
              return typeof actualValue === "number" &&
                typeof parsedExpected === "number" &&
                actualValue < parsedExpected;
            case ">=":
              return typeof actualValue === "number" &&
                typeof parsedExpected === "number" &&
                actualValue >= parsedExpected;
            case "<=":
              return typeof actualValue === "number" &&
                typeof parsedExpected === "number" &&
                actualValue <= parsedExpected;
            default:
              return false;
          }
        });

        totalCount += matchingItems.length;
      }
    }

    return { ok: true, data: totalCount };
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
