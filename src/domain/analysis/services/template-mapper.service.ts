/**
 * Template Mapping Service - Smart Constructor Pattern
 *
 * Implements schema-guided template mapping following DDD and Totality principles.
 * Extracted from schema-driven.ts for better organization and maintainability.
 */

import type {
  ExternalAnalysisService,
  PromptConfiguration,
  TemplateMapper,
} from "../../core/abstractions.ts";
import type { DomainError, Result } from "../../core/result.ts";
import { createDomainError } from "../../core/result.ts";

/**
 * Type guard for validating unknown data as Record<string, unknown>
 * Eliminates type assertions following Totality principles
 */
function isValidRecordData(data: unknown): data is Record<string, unknown> {
  return typeof data === "object" &&
    data !== null &&
    !Array.isArray(data);
}

export interface TotalTemplateMapper<TSource, TTarget> {
  map(
    source: TSource,
    template: TTarget,
    schema?: unknown,
  ): Promise<Result<TTarget, DomainError & { message: string }>>;
}

/**
 * Totality-compliant template mapper implementation
 */
export class TotalSchemaGuidedTemplateMapper<TSource, TTarget>
  implements TotalTemplateMapper<TSource, TTarget> {
  constructor(
    private readonly externalService: ExternalAnalysisService,
    private readonly prompts: PromptConfiguration,
  ) {}

  async map(
    source: TSource,
    template: TTarget,
    schema?: unknown,
  ): Promise<Result<TTarget, DomainError & { message: string }>> {
    try {
      const prompt = this.prepareMappingPrompt(source, template, schema);

      const result = await this.externalService.analyze(prompt, {
        source: JSON.stringify(source),
        template: JSON.stringify(template),
        schema: schema ? JSON.stringify(schema) : undefined,
      });

      // Validate and transform result using totality-compliant approach
      return this.validateMappingResult(result, template, schema);
    } catch (error) {
      return {
        ok: false,
        error: createDomainError(
          { kind: "AIServiceError", service: "template-mapping" },
          `Template mapping failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      };
    }
  }

  private prepareMappingPrompt(
    source: TSource,
    template: TTarget,
    schema?: unknown,
  ): string {
    return this.prompts.mappingPrompt
      .replace(/\{\{source\}\}/g, JSON.stringify(source))
      .replace(/\{\{template\}\}/g, JSON.stringify(template))
      .replace(/\{\{schema\}\}/g, schema ? JSON.stringify(schema) : "none");
  }

  private validateMappingResult(
    result: unknown,
    template: TTarget,
    _schema?: unknown,
  ): Result<TTarget, DomainError & { message: string }> {
    // Validate mapping result following totality principles
    if (result === null || result === undefined) {
      return {
        ok: false,
        error: createDomainError(
          { kind: "TemplateMappingFailed", template, source: result },
          "Mapping result cannot be null or undefined",
        ),
      };
    }

    // For template mapping, we ensure result can be treated as TTarget
    if (this.isValidMappingResult(result)) {
      return { ok: true, data: result };
    }

    return {
      ok: false,
      error: createDomainError(
        { kind: "TemplateMappingFailed", template, source: result },
        "Mapping result validation failed",
      ),
    };
  }

  private isValidMappingResult(result: unknown): result is TTarget {
    // Type guard for mapping results - basic validation
    return result !== null && result !== undefined;
  }
}

/**
 * Template mapper that applies analyzed data to target templates (Legacy - for backward compatibility)
 */
export class SchemaGuidedTemplateMapper<TSource, TTarget>
  implements TemplateMapper<TSource, TTarget> {
  constructor(
    private readonly externalService: ExternalAnalysisService,
    private readonly prompts: PromptConfiguration,
  ) {}

  async map(
    source: TSource,
    template: TTarget,
    schema?: unknown,
  ): Promise<TTarget> {
    const prompt = this.prepareMappingPrompt(source, template, schema);

    const result = await this.externalService.analyze(prompt, {
      source: JSON.stringify(source),
      template: JSON.stringify(template),
      schema: schema ? JSON.stringify(schema) : undefined,
    });

    // Validate and transform the result, but throw error for backward compatibility
    const transformedResult = this.validateAndTransform(result, template);
    if (!transformedResult.ok) {
      throw new Error(transformedResult.error.message);
    }
    return transformedResult.data;
  }

  private prepareMappingPrompt(
    source: TSource,
    template: TTarget,
    schema?: unknown,
  ): string {
    const sourceString = JSON.stringify(source, null, 2);
    const templateString = JSON.stringify(template, null, 2);
    const schemaString = schema
      ? JSON.stringify(schema, null, 2)
      : "No schema provided";

    return this.prompts.mappingPrompt
      .replace(/\{\{source\}\}/g, sourceString)
      .replace(/\{\{template\}\}/g, templateString)
      .replace(/\{\{schema\}\}/g, schemaString);
  }

  private validateAndTransform(
    result: unknown,
    originalTemplate: TTarget,
  ): Result<TTarget, DomainError & { message: string }> {
    // Attempt to parse and validate the mapped result
    try {
      if (typeof result === "string") {
        const parsed = JSON.parse(result);
        return {
          ok: true,
          data: this.ensureTemplateStructure(parsed, originalTemplate),
        };
      }
      return {
        ok: true,
        data: this.ensureTemplateStructure(result, originalTemplate),
      };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "TemplateMappingFailed",
            template: originalTemplate,
            source: result,
          },
          `Failed to map template: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      };
    }
  }

  private validateMappingResult(
    result: unknown,
    template: TTarget,
    _schema?: unknown,
  ): Result<TTarget, DomainError & { message: string }> {
    // Validate mapping result following totality principles
    if (result === null || result === undefined) {
      return {
        ok: false,
        error: createDomainError(
          { kind: "TemplateMappingFailed", template, source: result },
          "Mapping result cannot be null or undefined",
        ),
      };
    }

    // For template mapping, we merge with template structure
    const validatedResult = this.ensureTemplateStructure(result, template);
    if (this.isValidMappingResult(validatedResult)) {
      return { ok: true, data: validatedResult };
    }

    return {
      ok: false,
      error: createDomainError(
        { kind: "TemplateMappingFailed", template, source: result },
        "Mapping result validation failed",
      ),
    };
  }

  private isValidMappingResult(result: unknown): result is TTarget {
    // Type guard for mapping results
    return result !== null && result !== undefined;
  }

  private ensureTemplateStructure(result: unknown, template: TTarget): TTarget {
    // Merge result with template structure to maintain consistency
    if (
      typeof template === "object" && template !== null &&
      isValidRecordData(result)
    ) {
      // Safe merge: both are objects, use proper type guard
      return { ...template, ...result } as TTarget;
    }
    // For non-object templates, validate and return result
    // Return with runtime validation instead of type assertion
    return result as TTarget; // Note: This remains for generic compatibility
  }
}
