/**
 * Schema Analysis Service - Smart Constructor Pattern
 *
 * Implements schema-driven analysis following DDD and Totality principles.
 * Extracted from schema-driven.ts for better organization and maintainability.
 */

import type {
  AnalysisContext,
  ExternalAnalysisService,
  PromptConfiguration,
  SchemaBasedAnalyzer,
} from "../../core/abstractions.ts";
import { FrontMatterContent } from "../../models/value-objects.ts";
import type { DomainError, Result } from "../../core/result.ts";
import { createDomainError } from "../../core/result.ts";

// Totality-compliant interfaces (with Result types)
export interface TotalSchemaBasedAnalyzer<TSchema, TResult> {
  analyze(
    data: unknown,
    schema: TSchema,
    context?: AnalysisContext,
  ): Promise<Result<TResult, DomainError & { message: string }>>;
}

/**
 * Totality-compliant schema analyzer implementation
 */
export class TotalGenericSchemaAnalyzer<TSchema, TResult>
  implements TotalSchemaBasedAnalyzer<TSchema, TResult> {
  constructor(
    private readonly externalService: ExternalAnalysisService,
    private readonly prompts: PromptConfiguration,
  ) {}

  async analyze(
    data: unknown,
    schema: TSchema,
    context: AnalysisContext = {},
  ): Promise<Result<TResult, DomainError & { message: string }>> {
    try {
      // Prepare the analysis prompt with schema context
      const prompt = this.prepareAnalysisPrompt(data, schema, context);

      // Use external service (e.g., Claude) for analysis
      const result = await this.externalService.analyze(prompt, {
        schema: JSON.stringify(schema),
        sourceFile: context.sourceFile,
        ...context.options,
      });

      // Transform and validate result using totality-compliant approach
      return this.transformResult(result, schema);
    } catch (error) {
      return {
        ok: false,
        error: createDomainError(
          { kind: "AIServiceError", service: "analysis" },
          error instanceof Error ? error.message : String(error),
        ),
      };
    }
  }

  private prepareAnalysisPrompt(
    data: unknown,
    schema: TSchema,
    context: AnalysisContext,
  ): string {
    const dataString = this.serializeData(data);
    const schemaString = JSON.stringify(schema, null, 2);

    return this.prompts.extractionPrompt
      .replace(/\{\{data\}\}/g, dataString)
      .replace(/\{\{schema\}\}/g, schemaString)
      .replace(/\{\{sourceFile\}\}/g, context.sourceFile || "unknown")
      .replace(/\{\{options\}\}/g, JSON.stringify(context.options || {}));
  }

  private serializeData(data: unknown): string {
    if (typeof data === "string") return data;
    return JSON.stringify(data, null, 2);
  }

  private transformResult(
    result: unknown,
    schema: TSchema,
  ): Result<TResult, DomainError & { message: string }> {
    // Apply schema-based transformation/validation
    if (this.isValidResult(result, schema)) {
      // Type guard ensures result is TResult, no assertion needed
      return { ok: true, data: result };
    }
    return {
      ok: false,
      error: createDomainError(
        { kind: "SchemaValidationFailed", schema, data: result },
        `Analysis result does not conform to schema: ${JSON.stringify(result)}`,
      ),
    };
  }

  private isValidResult(result: unknown, _schema: TSchema): result is TResult {
    // Enhanced validation following totality principles
    if (result === null || result === undefined) {
      return false;
    }

    // Basic structural validation - can be extended with schema-specific validation
    // For now, we check that result is an object (most analysis results are objects)
    if (typeof result !== "object") {
      return false;
    }

    // Additional validation can be added here based on schema requirements
    // This is a type guard that helps TypeScript understand the type safety
    return true;
  }
}

/**
 * Generic schema-driven analyzer implementation (Legacy - for backward compatibility)
 */
export class GenericSchemaAnalyzer<TSchema, TResult>
  implements SchemaBasedAnalyzer<TSchema, TResult> {
  constructor(
    private readonly externalService: ExternalAnalysisService,
    private readonly prompts: PromptConfiguration,
  ) {}

  async analyze(
    data: unknown,
    schema: TSchema,
    context: AnalysisContext = {},
  ): Promise<TResult> {
    try {
      // Prepare the analysis prompt with schema context
      const prompt = this.prepareAnalysisPrompt(data, schema, context);

      // Use external service (e.g., Claude) for analysis
      const result = await this.externalService.analyze(prompt, {
        schema: JSON.stringify(schema),
        sourceFile: context.sourceFile,
        ...context.options,
      });

      // Totality-compliant validation with necessary type assertion for generics
      if (result === null || result === undefined) {
        throw new Error(
          `Analysis result cannot be null or undefined: ${
            JSON.stringify(result)
          }`,
        );
      }
      // Generic type assertion necessary for TResult compatibility
      return result as TResult;
    } catch (error) {
      // For backward compatibility, throw the error instead of returning Result
      // Preserve original error message for test compatibility
      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error(String(error));
      }
    }
  }

  private prepareAnalysisPrompt(
    data: unknown,
    schema: TSchema,
    context: AnalysisContext,
  ): string {
    const dataString = this.serializeData(data);
    const schemaString = JSON.stringify(schema, null, 2);

    return this.prompts.extractionPrompt
      .replace(/\{\{data\}\}/g, dataString)
      .replace(/\{\{schema\}\}/g, schemaString)
      .replace(/\{\{sourceFile\}\}/g, context.sourceFile || "unknown")
      .replace(/\{\{options\}\}/g, JSON.stringify(context.options || {}));
  }

  private serializeData(data: unknown): string {
    if (data instanceof FrontMatterContent) {
      return JSON.stringify(data.toJSON(), null, 2);
    }
    if (typeof data === "object" && data !== null) {
      return JSON.stringify(data, null, 2);
    }
    return String(data);
  }
}
