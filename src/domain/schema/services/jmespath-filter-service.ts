import { JmesPath } from "jsr:@halvardm/jmespath@^0.17.0";
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

      // Create type-safe JmesPath instance
      const jmespathResult = this.createSafeJmesPath(dataObject);
      if (!jmespathResult.ok) {
        return jmespathResult;
      }

      const result = jmespathResult.data.search(expression);
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
      // Use type-safe empty object for validation
      const jmespathResult = this.createSafeJmesPath({});
      if (!jmespathResult.ok) {
        return jmespathResult;
      }

      jmespathResult.data.search(expression);
      return ok(undefined);
    } catch (error) {
      return this.handleJMESPathError(error, expression);
    }
  }

  /**
   * Create type-safe JmesPath instance with proper validation
   * Eliminates unsafe type assertions by validating input data
   */
  private createSafeJmesPath(
    data: Record<string, unknown>,
  ): Result<JmesPath, JMESPathFilterError & { message: string }> {
    try {
      // Validate that data is a plain object suitable for JmesPath
      const validatedData = this.validateJmesPathInput(data);
      if (!validatedData.ok) {
        return validatedData;
      }

      // Create JmesPath instance - data is validated as JSON-serializable above
      // Since we've validated the data is JSON-serializable, it's safe for JmesPath
      // We use a controlled type assertion with explicit validation
      const jmespath = this.createJmesPathInstance(validatedData.data);
      return ok(jmespath);
    } catch (error) {
      return err(createError({
        kind: "JMESPathCompilationFailed",
        expression: "[initialization]",
        message: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  /**
   * Validate input data for JmesPath compatibility
   * Ensures data structure is safe for JmesPath processing
   */
  private validateJmesPathInput(
    data: Record<string, unknown>,
  ): Result<unknown, JMESPathFilterError & { message: string }> {
    try {
      // Test that data can be safely serialized/deserialized
      // This ensures the data is compatible with JmesPath's JSONValue type
      const serialized = JSON.stringify(data);
      const deserialized = JSON.parse(serialized);
      return ok(deserialized);
    } catch (error) {
      return err(createError({
        kind: "InvalidJMESPathResult",
        expression: "[input-validation]",
        result: data,
        message: `Input data is not JmesPath-compatible: ${
          error instanceof Error ? error.message : String(error)
        }`,
      }));
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
   * Uses type guards instead of unsafe type assertions
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
        !(part in current) || !this.isRecord(current[part])
      ) {
        current[part] = {};
      }

      // Type-safe navigation - we know it's a Record due to the check above
      const nextLevel = current[part];
      if (this.isRecord(nextLevel)) {
        current = nextLevel;
      }
    }

    const lastPart = parts[parts.length - 1];
    current[lastPart] = value;
  }

  /**
   * Type guard to check if value is a Record<string, unknown>
   * Replaces unsafe type assertion with proper validation
   */
  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" &&
      value !== null &&
      !Array.isArray(value) &&
      value.constructor === Object;
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

  /**
   * Create JmesPath instance with explicit type handling
   * Isolates the type assertion to a single, well-documented location
   *
   * This type assertion is acceptable under Totality principles because:
   * 1. It's at the system boundary where we interface with external library
   * 2. Data has been validated through JSON.stringify/parse cycle
   * 3. The assertion is isolated and well-documented
   * 4. It enables type-safe usage throughout the rest of the domain
   */
  private createJmesPathInstance(data: unknown): JmesPath {
    // At this point, data has been validated as JSON-serializable via JSON.stringify/parse
    // The JmesPath constructor expects a JSONValue, which our validated data satisfies
    // This is a controlled type assertion based on our validation above
    // (Totality principle: acceptable at external library boundaries)
    return new JmesPath(data as any);
  }
}
