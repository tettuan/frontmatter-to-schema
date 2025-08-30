/**
 * Schema-driven analysis engine with template mapping capabilities
 *
 * This module implements the core analysis engine that uses external schemas
 * to guide frontmatter parsing and template application.
 */

import type {
  AnalysisContext,
  ExternalAnalysisService,
  ProcessingResult,
  PromptConfiguration,
  SchemaBasedAnalyzer,
  TemplateMapper,
} from "../core/abstractions.ts";
import { FrontMatterContent } from "../models/value-objects.ts";
import type { DomainError, Result } from "../core/result.ts";
import { createDomainError } from "../core/result.ts";

// Totality-compliant interfaces (with Result types)
export interface TotalSchemaBasedAnalyzer<TSchema, TResult> {
  analyze(
    data: unknown,
    schema: TSchema,
    context?: AnalysisContext,
  ): Promise<Result<TResult, DomainError & { message: string }>>;
}

export interface TotalTemplateMapper<TSource, TTarget> {
  map(
    source: TSource,
    template: TTarget,
    schema?: unknown,
  ): Promise<Result<TTarget, DomainError & { message: string }>>;
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

      // Return Result type for totality compliance
      return { ok: true, data: result as TResult };
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

      // Validate and transform the result, but throw error for backward compatibility
      const transformedResult = this.transformResult(result, schema);
      if (!transformedResult.ok) {
        throw new Error(transformedResult.error.message);
      }
      return transformedResult.data;
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

  private transformResult(
    result: unknown,
    schema: TSchema,
  ): Result<TResult, DomainError & { message: string }> {
    // Apply schema-based transformation/validation
    if (this.isValidResult(result, schema)) {
      return { ok: true, data: result as TResult };
    }
    return {
      ok: false,
      error: createDomainError(
        { kind: "SchemaValidationFailed", schema, data: result },
        `Analysis result does not conform to schema: ${JSON.stringify(result)}`,
      ),
    };
  }

  private isValidResult(result: unknown, _schema: TSchema): boolean {
    // Basic validation - can be extended with proper schema validation
    return result !== null && result !== undefined;
  }
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

      // Return Result type for totality compliance
      return { ok: true, data: result as TTarget };
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

  private ensureTemplateStructure(result: unknown, template: TTarget): TTarget {
    // Merge result with template structure to maintain consistency
    if (
      typeof template === "object" && template !== null &&
      typeof result === "object" && result !== null
    ) {
      return { ...template, ...result } as TTarget;
    }
    return result as TTarget;
  }
}

/**
 * Comprehensive analysis processor that combines schema analysis and template mapping
 */
export class SchemaAnalysisProcessor<TInput, TSchema, TOutput> {
  constructor(
    private readonly analyzer: TotalSchemaBasedAnalyzer<TSchema, unknown>,
    private readonly mapper: TotalTemplateMapper<unknown, TOutput>,
    private readonly schema: TSchema,
    private readonly template: TOutput,
  ) {}

  async process(
    input: TInput,
    context: AnalysisContext = {},
  ): Promise<ProcessingResult<TOutput>> {
    // Step 1: Schema-driven analysis
    const analysisResult = await this.analyzer.analyze(
      input,
      this.schema,
      context,
    );

    if (!analysisResult.ok) {
      return {
        data: this.template,
        metadata: new Map(context.metadata),
        isValid: false,
        errors: [analysisResult.error.message],
      };
    }

    // Step 2: Template mapping
    const mappedResult = await this.mapper.map(
      analysisResult.data,
      this.template,
      this.schema,
    );

    if (!mappedResult.ok) {
      return {
        data: this.template,
        metadata: new Map(context.metadata),
        isValid: false,
        errors: [mappedResult.error.message],
      };
    }

    return {
      data: mappedResult.data,
      metadata: new Map(context.metadata),
      isValid: true,
      errors: [],
    };
  }

  async processMany(
    inputs: TInput[],
    baseContext: AnalysisContext = {},
  ): Promise<ProcessingResult<TOutput>[]> {
    const results: ProcessingResult<TOutput>[] = [];

    for (let i = 0; i < inputs.length; i++) {
      const context = {
        ...baseContext,
        metadata: new Map(baseContext.metadata),
        options: { ...baseContext.options, index: i },
      };

      const result = await this.process(inputs[i], context);
      results.push(result);
    }

    return results;
  }
}

/**
 * Factory for creating schema-driven analysis components
 *
 * @deprecated Use AnalysisDomainFactory from component-factory.ts for better domain separation
 */
export class SchemaAnalysisFactory {
  static createAnalyzer<TSchema, TResult>(
    externalService: ExternalAnalysisService,
    prompts: PromptConfiguration,
  ): SchemaBasedAnalyzer<TSchema, TResult> {
    return new GenericSchemaAnalyzer<TSchema, TResult>(
      externalService,
      prompts,
    );
  }

  static createMapper<TSource, TTarget>(
    externalService: ExternalAnalysisService,
    prompts: PromptConfiguration,
  ): TemplateMapper<TSource, TTarget> {
    return new SchemaGuidedTemplateMapper<TSource, TTarget>(
      externalService,
      prompts,
    );
  }

  static createProcessor<TInput, TSchema, TOutput>(
    externalService: ExternalAnalysisService,
    prompts: PromptConfiguration,
    schema: TSchema,
    template: TOutput,
  ): SchemaAnalysisProcessor<TInput, TSchema, TOutput> {
    const analyzer = new TotalGenericSchemaAnalyzer<TSchema, unknown>(
      externalService,
      prompts,
    );
    const mapper = new TotalSchemaGuidedTemplateMapper<unknown, TOutput>(
      externalService,
      prompts,
    );

    return new SchemaAnalysisProcessor(analyzer, mapper, schema, template);
  }
}
