/**
 * Core Analysis Engine Implementation
 *
 * Contains the main analysis engine and schema analyzer implementations
 * following DDD principles and Totality patterns for robust error handling.
 */

import { createDomainError, type Result } from "./result.ts";
import type { AnalysisError } from "./result.ts";
import type {
  FrontMatterContent,
  SchemaDefinition,
} from "../models/value-objects.ts";
import type {
  AnalysisContext as AbstractAnalysisContext,
  SchemaBasedAnalyzer as AbstractSchemaBasedAnalyzer,
} from "./abstractions.ts";
import type {
  AnalysisEngine,
  AnalysisStrategy,
  InputValidationResult,
  SchemaBasedAnalyzer,
  SchemaValidationCapability,
  TimeoutState,
} from "./analysis-interfaces.ts";

/**
 * Generic Analysis Engine Implementation
 * Core component that coordinates analysis strategies with timeout handling
 */
export class GenericAnalysisEngine implements AnalysisEngine {
  constructor(
    private readonly timeout: number = 30000, // 30 seconds default
  ) {}

  async analyze<TInput, TOutput>(
    input: TInput,
    strategy: AnalysisStrategy<TInput, TOutput>,
  ): Promise<Result<TOutput, AnalysisError & { message: string }>> {
    // Input validation using Totality patterns
    const validationResult = this.validateInput(input);
    switch (validationResult.kind) {
      case "Invalid":
        return {
          ok: false,
          error: createDomainError({
            kind: "ExtractionStrategyFailed",
            strategy: strategy.name,
            input,
          }),
        };
      case "Valid":
        // Continue with valid input
        break;
    }

    try {
      // Timeout handling using Totality patterns
      let activeTimeoutId: number | undefined;

      const timeoutPromise = new Promise<never>((_, reject) => {
        activeTimeoutId = setTimeout(
          () => reject(new Error("Analysis timeout")),
          this.timeout,
        );
      });

      const analysisPromise = strategy.execute(validationResult.value, {
        document: "analysis",
        kind: "BasicExtraction",
        options: { includeMetadata: true },
      });

      const result = await Promise.race([analysisPromise, timeoutPromise]);

      // Clear timeout if analysis completes first using Totality pattern
      const timeoutState = this.createTimeoutState(activeTimeoutId);
      this.cleanupTimeout(timeoutState);

      return result;
    } catch (error) {
      if (error instanceof Error && error.message === "Analysis timeout") {
        return {
          ok: false,
          error: createDomainError({
            kind: "AnalysisTimeout",
            timeoutMs: this.timeout,
          }),
        };
      }

      return {
        ok: false,
        error: createDomainError({
          kind: "ExtractionStrategyFailed",
          strategy: strategy.name,
          input,
        }),
      };
    }
  }

  /**
   * Validate input using Totality patterns
   */
  private validateInput<T>(input: T): InputValidationResult<T> {
    if (!input) {
      return { kind: "Invalid", reason: "Input is falsy" };
    }
    return { kind: "Valid", value: input };
  }

  /**
   * Create timeout state from optional timeout ID
   */
  private createTimeoutState(timeoutId: number | undefined): TimeoutState {
    if (timeoutId !== undefined) {
      return { kind: "Active", id: timeoutId };
    }
    return { kind: "NotSet" };
  }

  /**
   * Cleanup timeout using discriminated union pattern
   */
  private cleanupTimeout(timeoutState: TimeoutState): void {
    switch (timeoutState.kind) {
      case "Active":
        clearTimeout(timeoutState.id);
        break;
      case "NotSet":
      case "Cleared":
        // No cleanup needed
        break;
    }
  }
}

/**
 * Schema-based Analyzer Implementation
 * Core component for schema-driven analysis
 */
export class RobustSchemaAnalyzer<TSchema, TResult>
  implements
    AbstractSchemaBasedAnalyzer<TSchema, TResult>,
    SchemaBasedAnalyzer<TSchema, TResult> {
  // Implementation of SchemaBasedAnalyzer interface
  analyze(
    data: unknown,
    _schema: TSchema,
    _context?: AbstractAnalysisContext,
  ): Promise<TResult> {
    // Validate that data is an object before returning
    // This is a simplified implementation - in production, schema validation should be used
    if (!this.isValidResultType(data)) {
      // Return empty object as TResult - safer than casting unknown
      return Promise.resolve({} as TResult);
    }
    // Data has been validated to match expected structure
    return Promise.resolve(data as TResult);
  }

  /**
   * Type guard to validate data matches expected result type
   */
  private isValidResultType(data: unknown): data is TResult {
    // Basic validation - ensure data is an object
    return typeof data === "object" && data !== null && !Array.isArray(data);
  }

  /**
   * Type guard to check if schema has validation method
   */
  private hasValidationMethod(
    schema: unknown,
  ): schema is {
    validate: (
      data: unknown,
    ) => { ok: boolean; data?: unknown; error?: unknown };
  } {
    return (
      typeof schema === "object" &&
      schema !== null &&
      "validate" in schema &&
      typeof (schema as { validate: unknown }).validate === "function"
    );
  }

  async process(
    data: FrontMatterContent,
    schema: SchemaDefinition,
  ): Promise<Result<TResult, AnalysisError & { message: string }>> {
    // Validate schema first using Totality patterns
    const dataJson = data.toJSON();
    const validationCapability = this.extractSchemaValidationCapability(schema);

    const schemaValidation = this.performSchemaValidation(
      validationCapability,
      dataJson,
    );
    if (!schemaValidation.ok) {
      return {
        ok: false,
        error: createDomainError({
          kind: "SchemaValidationFailed",
          schema: schema,
          data: dataJson,
        }),
      };
    }

    try {
      // Validate and transform data according to totality principle
      if (!this.isValidResultType(dataJson)) {
        return {
          ok: false,
          error: createDomainError({
            kind: "SchemaValidationFailed",
            schema: schema.getRawDefinition(),
            data: dataJson,
          }),
        };
      }
      // Data has been validated to match expected structure
      const result = dataJson as TResult;
      // Ensure async consistency
      await Promise.resolve();
      return { ok: true, data: result };
    } catch (_error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "SchemaValidationFailed",
          schema: schema,
          data: dataJson,
        }),
      };
    }
  }

  /**
   * Extract schema validation capability using Totality patterns
   */
  private extractSchemaValidationCapability(
    schema: SchemaDefinition,
  ): SchemaValidationCapability {
    // Type-safe check for validation capability
    if (this.hasValidationMethod(schema)) {
      return {
        kind: "HasValidation",
        validate: schema.validate,
      };
    }

    return { kind: "NoValidation" };
  }

  /**
   * Perform schema validation using discriminated union pattern
   */
  private performSchemaValidation(
    capability: SchemaValidationCapability,
    data: unknown,
  ): { ok: boolean; data?: unknown; error?: unknown } {
    switch (capability.kind) {
      case "HasValidation":
        return capability.validate(data);
      case "NoValidation":
        return { ok: true, data };
    }
  }
}
