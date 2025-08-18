/**
 * Core Analysis Engine - The backbone center line of the DDD architecture
 * Implements the central analysis pipeline following Schema-driven Analysis pattern
 */

import { Result, AnalysisError, createDomainError } from "./result.ts";
import {
  AnalysisContext,
  AnalysisContextGuards,
  FrontMatterContent,
  SchemaDefinition,
  AnalysisOptions,
  TemplateDefinition,
} from "./types.ts";

/**
 * Core Analysis Domain - The gravitational center of the system
 * Following DDD backbone center line principle
 */
export namespace CoreAnalysisDomain {
  /**
   * Central Analysis Engine - Longest lifetime, highest frequency component
   */
  export interface AnalysisEngine {
    analyze<TInput, TOutput>(
      input: TInput,
      strategy: AnalysisStrategy<TInput, TOutput>,
    ): Promise<Result<TOutput, AnalysisError & { message: string }>>;
  }

  /**
   * Analysis Strategy - Pluggable analysis behavior
   */
  export interface AnalysisStrategy<TInput, TOutput> {
    readonly name: string;
    execute(
      input: TInput,
      context: AnalysisContext,
    ): Promise<Result<TOutput, AnalysisError & { message: string }>>;
  }

  /**
   * Schema-based Analyzer - Type-safe schema processing
   */
  export interface SchemaBasedAnalyzer<TSchema, TResult> {
    process(
      data: FrontMatterContent,
      schema: SchemaDefinition<TSchema>,
    ): Promise<Result<TResult, AnalysisError & { message: string }>>;
  }

  /**
   * Template Mapper - Result transformation with templates
   */
  export interface TemplateMapper<TSource, TTarget> {
    map(
      source: TSource,
      template: TemplateDefinition,
    ): Result<TTarget, AnalysisError & { message: string }>;
  }
}

/**
 * Concrete Implementation of the Core Analysis Engine
 * Central orchestrator for all analysis operations
 */
export class GenericAnalysisEngine implements CoreAnalysisDomain.AnalysisEngine {
  constructor(
    private readonly timeout: number = 30000, // 30 seconds default
  ) {}

  async analyze<TInput, TOutput>(
    input: TInput,
    strategy: CoreAnalysisDomain.AnalysisStrategy<TInput, TOutput>,
  ): Promise<Result<TOutput, AnalysisError & { message: string }>> {
    // Input validation
    if (!input) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ExtractionStrategyFailed",
          strategy: strategy.name,
          input,
        }),
      };
    }

    try {
      // Timeout handling for robust operation
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Analysis timeout")), this.timeout)
      );

      const analysisPromise = strategy.execute(input, {
        kind: "BasicExtraction",
        options: { includeMetadata: true },
      });

      const result = await Promise.race([analysisPromise, timeoutPromise]);
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
}

/**
 * Schema-based Analyzer Implementation
 * Core component for schema-driven analysis
 */
export class RobustSchemaAnalyzer<TSchema, TResult>
  implements CoreAnalysisDomain.SchemaBasedAnalyzer<TSchema, TResult> {
  async process(
    data: FrontMatterContent,
    schema: SchemaDefinition<TSchema>,
  ): Promise<Result<TResult, AnalysisError & { message: string }>> {
    // Validate schema first
    const schemaValidation = schema.validate(data.data);
    if (!schemaValidation.ok) {
      return {
        ok: false,
        error: createDomainError({
          kind: "SchemaValidationFailed",
          schema: schema.schema,
          data: data.data,
        }),
      };
    }

    try {
      // Basic transformation - can be enhanced with complex logic
      const result = data.data as unknown as TResult;
      return { ok: true, data: result };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "SchemaValidationFailed",
          schema: schema.schema,
          data: data.data,
        }),
      };
    }
  }
}

/**
 * Template Mapper Implementation
 * Handles transformation from source to target using templates
 */
export class RobustTemplateMapper<TSource, TTarget>
  implements CoreAnalysisDomain.TemplateMapper<TSource, TTarget> {
  map(
    source: TSource,
    template: TemplateDefinition,
  ): Result<TTarget, AnalysisError & { message: string }> {
    if (!source) {
      return {
        ok: false,
        error: createDomainError({
          kind: "TemplateMappingFailed",
          template: template.structure,
          source,
        }),
      };
    }

    try {
      // Basic template mapping - can be enhanced with complex transformation rules
      const mappedResult = this.transformWithTemplate(source, template);
      return { ok: true, data: mappedResult };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "TemplateMappingFailed",
          template: template.structure,
          source,
        }),
      };
    }
  }

  private transformWithTemplate(
    source: TSource,
    template: TemplateDefinition,
  ): TTarget {
    // Basic transformation logic - merge source with template structure
    const result = {
      ...template.structure,
      ...(typeof source === "object" && source !== null ? source : {}),
    };

    return result as TTarget;
  }
}

/**
 * Context-aware Analysis Processor
 * Handles different analysis contexts with exhaustive pattern matching
 */
export class ContextualAnalysisProcessor {
  constructor(
    private readonly engine: CoreAnalysisDomain.AnalysisEngine,
    private readonly schemaAnalyzer: CoreAnalysisDomain.SchemaBasedAnalyzer<unknown, unknown>,
    private readonly templateMapper: CoreAnalysisDomain.TemplateMapper<unknown, unknown>,
  ) {}

  async processWithContext(
    data: FrontMatterContent,
    context: AnalysisContext,
  ): Promise<Result<unknown, AnalysisError & { message: string }>> {
    // Exhaustive pattern matching - no default case needed (Totality principle)
    switch (context.kind) {
      case "SchemaAnalysis": {
        return await this.schemaAnalyzer.process(data, context.schema);
      }

      case "TemplateMapping": {
        const schemaResult = context.schema
          ? await this.schemaAnalyzer.process(data, context.schema)
          : { ok: true as const, data: data.data };

        if (!schemaResult.ok) {
          return schemaResult;
        }

        return this.templateMapper.map(schemaResult.data, context.template);
      }

      case "ValidationOnly": {
        const validationResult = context.schema.validate(data.data);
        if (!validationResult.ok) {
          return {
            ok: false,
            error: createDomainError({
              kind: "SchemaValidationFailed",
              schema: context.schema.schema,
              data: data.data,
            }),
          };
        }

        return { ok: true, data: data.data };
      }

      case "BasicExtraction": {
        // Basic extraction with minimal processing
        const extractedData = {
          ...data.data,
          extractionMetadata: {
            extractedAt: new Date().toISOString(),
            keyCount: data.keys().length,
            includeMetadata: context.options.includeMetadata || false,
          },
        };

        return { ok: true, data: extractedData };
      }
    }
  }
}

/**
 * Factory for creating Analysis Engine components
 * Implements dependency injection for the backbone system
 */
export class AnalysisEngineFactory {
  static createDefault(): {
    engine: CoreAnalysisDomain.AnalysisEngine;
    processor: ContextualAnalysisProcessor;
  } {
    const engine = new GenericAnalysisEngine();
    const schemaAnalyzer = new RobustSchemaAnalyzer();
    const templateMapper = new RobustTemplateMapper();

    const processor = new ContextualAnalysisProcessor(
      engine,
      schemaAnalyzer,
      templateMapper,
    );

    return { engine, processor };
  }

  static createWithTimeout(timeoutMs: number): {
    engine: CoreAnalysisDomain.AnalysisEngine;
    processor: ContextualAnalysisProcessor;
  } {
    const engine = new GenericAnalysisEngine(timeoutMs);
    const schemaAnalyzer = new RobustSchemaAnalyzer();
    const templateMapper = new RobustTemplateMapper();

    const processor = new ContextualAnalysisProcessor(
      engine,
      schemaAnalyzer,
      templateMapper,
    );

    return { engine, processor };
  }
}

/**
 * Analysis Strategy Implementations
 * Concrete strategies for different analysis types
 */
export namespace AnalysisStrategies {
  /**
   * FrontMatter Extraction Strategy
   */
  export class FrontMatterExtractionStrategy
    implements CoreAnalysisDomain.AnalysisStrategy<string, FrontMatterContent> {
    readonly name = "FrontMatterExtractionStrategy";

    async execute(
      input: string,
      context: AnalysisContext,
    ): Promise<Result<FrontMatterContent, AnalysisError & { message: string }>> {
      // Extract frontmatter from markdown content
      const frontMatterMatch = input.match(/^---\n([\s\S]*?)\n---/);

      if (!frontMatterMatch) {
        return {
          ok: false,
          error: createDomainError({
            kind: "ExtractionStrategyFailed",
            strategy: this.name,
            input: input.slice(0, 100) + "...", // Truncate for error message
          }),
        };
      }

      const yamlResult = FrontMatterContent.fromYaml(frontMatterMatch[1]);
      
      // Map ValidationError to AnalysisError
      if (!yamlResult.ok) {
        return {
          ok: false,
          error: createDomainError({
            kind: "ExtractionStrategyFailed",
            strategy: this.name,
            input: frontMatterMatch[1],
          }),
        };
      }

      return yamlResult;
    }
  }

  /**
   * Schema Mapping Strategy
   */
  export class SchemaMappingStrategy<TResult>
    implements CoreAnalysisDomain.AnalysisStrategy<FrontMatterContent, TResult> {
    readonly name = "SchemaMappingStrategy";

    constructor(private readonly schema: SchemaDefinition) {}

    async execute(
      input: FrontMatterContent,
      context: AnalysisContext,
    ): Promise<Result<TResult, AnalysisError & { message: string }>> {
      if (!AnalysisContextGuards.isSchemaAnalysis(context)) {
        return {
          ok: false,
          error: createDomainError({
            kind: "InvalidAnalysisContext",
            context,
          }),
        };
      }

      const analyzer = new RobustSchemaAnalyzer<unknown, TResult>();
      return await analyzer.process(input, context.schema);
    }
  }
}