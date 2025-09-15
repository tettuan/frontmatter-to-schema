import { JmesPath } from "@halvardm/jmespath";
import { err, ok, Result } from "../../shared/types/result.ts";
import { createError } from "../../shared/types/errors.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";

/**
 * JMESPath filter-related errors
 */
export type JMESPathFilterError =
  | {
    readonly kind: "JMESPathCompilationFailed";
    readonly expression: string;
    readonly message: string;
  }
  | {
    readonly kind: "JMESPathExecutionFailed";
    readonly expression: string;
    readonly message: string;
  }
  | {
    readonly kind: "InvalidJMESPathResult";
    readonly expression: string;
    readonly result: unknown;
  };

/**
 * Service for applying JMESPath filters to FrontmatterData
 * Follows DDD principles by encapsulating JMESPath filtering logic within the Schema domain
 */
export class JMESPathFilterService {
  private constructor() {
    // Stateless service - no instance data needed
  }

  /**
   * Smart constructor following Totality principles
   */
  static create(): Result<JMESPathFilterService, never> {
    return ok(new JMESPathFilterService());
  }

  /**
   * Apply JMESPath filter to FrontmatterData
   *
   * @param data - The FrontmatterData to filter
   * @param expression - JMESPath expression to apply
   * @returns Filtered data as unknown type (to be validated by caller)
   */
  applyFilter(
    data: FrontmatterData,
    expression: string,
  ): Result<unknown, JMESPathFilterError & { message: string }> {
    try {
      // Convert FrontmatterData to plain object for JMESPath processing
      const dataObject = this.convertToPlainObject(data);

      // Create JmesPath instance with the data and apply filter
      // Cast to unknown then to the expected type for JmesPath
      const jmespath = new JmesPath(dataObject as any);
      const result = jmespath.search(expression);

      return ok(result);
    } catch (error) {
      // Handle JMESPath compilation or execution errors
      return this.handleJMESPathError(error, expression);
    }
  }

  /**
   * Validate JMESPath expression syntax without executing it
   *
   * @param expression - JMESPath expression to validate
   * @returns Success result if valid, error if invalid
   */
  validateExpression(
    expression: string,
  ): Result<void, JMESPathFilterError & { message: string }> {
    try {
      // Try to create JmesPath instance and search with empty object
      const jmespath = new JmesPath({} as any);
      jmespath.search(expression);
      return ok(undefined);
    } catch (error) {
      return this.handleJMESPathError(error, expression);
    }
  }

  /**
   * Convert FrontmatterData to plain object for JMESPath processing
   * Uses the internal structure of FrontmatterData while respecting encapsulation
   */
  private convertToPlainObject(data: FrontmatterData): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    // Get all available keys from FrontmatterData
    const keys = data.getAllKeys();

    for (const key of keys) {
      const valueResult = data.get(key);
      if (valueResult.ok) {
        // Handle nested object paths (e.g., "meta.author")
        this.setNestedValue(result, key, valueResult.data);
      }
    }

    return result;
  }

  /**
   * Set nested value in object using dot notation path
   * Example: setNestedValue(obj, "meta.author", "John") sets obj.meta.author = "John"
   */
  private setNestedValue(
    obj: Record<string, unknown>,
    path: string,
    value: unknown,
  ): void {
    const parts = path.split(".");
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (
        !(part in current) || typeof current[part] !== "object" ||
        current[part] === null
      ) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    const lastPart = parts[parts.length - 1];
    current[lastPart] = value;
  }

  /**
   * Handle JMESPath errors with proper error mapping
   */
  private handleJMESPathError(
    error: unknown,
    expression: string,
  ): Result<never, JMESPathFilterError & { message: string }> {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Determine error type based on error message patterns
    if (errorMessage.includes("syntax") || errorMessage.includes("parse")) {
      return err(createError({
        kind: "JMESPathCompilationFailed",
        expression,
        message: errorMessage,
      }));
    }

    return err(createError({
      kind: "JMESPathExecutionFailed",
      expression,
      message: errorMessage,
    }));
  }
}
