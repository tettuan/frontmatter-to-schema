/**
 * Core Analysis Engine - The backbone center line of the DDD architecture
 * Implements the central analysis pipeline following Schema-driven Analysis pattern
 */

import {
  type AnalysisError,
  createDomainError,
  type Result,
} from "./result.ts";
import {
  type AnalysisContext,
  FrontMatterContent,
  isSchemaAnalysis,
  type SchemaDefinition,
  type TemplateDefinition,
} from "./types.ts";
import type {
  AnalysisContext as AbstractAnalysisContext,
  SchemaBasedAnalyzer as AbstractSchemaBasedAnalyzer,
  TemplateMapper as AbstractTemplateMapper,
} from "./abstractions.ts";

/**
 * Core Analysis Domain - The gravitational center of the system
 * Following DDD backbone center line principle
 */

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
export interface InternalTemplateMapper<TSource, TTarget> {
  mapInternal(
    source: TSource,
    template: TemplateDefinition,
  ): Result<TTarget, AnalysisError & { message: string }>;
}

// Legacy namespace for backward compatibility
export const CoreAnalysisDomain = {
  // Interfaces are re-exported through the namespace for compatibility
};

/**
 * Concrete Implementation of the Core Analysis Engine
 * Central orchestrator for all analysis operations
 */
export class GenericAnalysisEngine implements AnalysisEngine {
  constructor(
    private readonly timeout: number = 30000, // 30 seconds default
  ) {}

  async analyze<TInput, TOutput>(
    input: TInput,
    strategy: AnalysisStrategy<TInput, TOutput>,
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
      let timeoutId: number | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error("Analysis timeout")),
          this.timeout,
        );
      });

      const analysisPromise = strategy.execute(input, {
        kind: "BasicExtraction",
        options: { includeMetadata: true },
      });

      const result = await Promise.race([analysisPromise, timeoutPromise]);

      // Clear timeout if analysis completes first
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
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
  implements AbstractSchemaBasedAnalyzer<TSchema, TResult> {
  // Implementation of SchemaBasedAnalyzer interface
  analyze(
    data: unknown,
    _schema: TSchema,
    _context?: AbstractAnalysisContext,
  ): Promise<TResult> {
    // Simple implementation that casts the data to the expected result type
    return Promise.resolve(data as unknown as TResult);
  }

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
      // Ensure async consistency
      await Promise.resolve();
      return { ok: true, data: result };
    } catch (_error) {
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
  implements
    AbstractTemplateMapper<TSource, TTarget>,
    InternalTemplateMapper<TSource, TTarget> {
  // Implementation of external TemplateMapper interface from abstractions.ts
  map(
    _source: TSource,
    template: TTarget,
    _schema?: unknown,
  ): Promise<TTarget> {
    // Simple implementation that returns the template
    return Promise.resolve(template);
  }

  // Implementation of internal TemplateMapper interface (this file)
  mapInternal(
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
    } catch (_error) {
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
    // Start with template structure as base
    const result = { ...template.structure };

    // Handle FrontMatterContent instances by extracting their data
    let sourceObj: Record<string, unknown>;
    if (
      source && typeof source === "object" && "data" in source &&
      "get" in source
    ) {
      // This is a FrontMatterContent instance
      sourceObj = (source as { data: Record<string, unknown> }).data;
    } else if (typeof source === "object" && source !== null) {
      sourceObj = source as Record<string, unknown>;
    } else {
      return result as TTarget;
    }

    // Apply mapping rules if they exist
    if (template.mappingRules) {
      for (
        const [targetKey, sourceKey] of Object.entries(template.mappingRules)
      ) {
        const sourceKeyStr = sourceKey as string;
        if (sourceKeyStr in sourceObj) {
          // Support dot notation for nested properties (simplified)
          if (targetKey.includes(".")) {
            // For now, just set direct properties
            const keys = targetKey.split(".");
            if (keys.length === 2) {
              if (!result[keys[0]]) result[keys[0]] = {};
              (result[keys[0]] as Record<string, unknown>)[keys[1]] =
                sourceObj[sourceKeyStr];
            }
          } else {
            result[targetKey] = sourceObj[sourceKeyStr];
          }
        }
      }
    }

    // Merge any remaining properties from source, overriding template defaults
    for (const [key, value] of Object.entries(sourceObj)) {
      result[key] = value;
    }

    return result as TTarget;
  }
}

/**
 * Context-aware Analysis Processor
 * Handles different analysis contexts with exhaustive pattern matching
 */
export class ContextualAnalysisProcessor {
  constructor(
    private readonly engine: AnalysisEngine,
    private readonly schemaAnalyzer: AbstractSchemaBasedAnalyzer<
      unknown,
      unknown
    >,
    private readonly templateMapper: InternalTemplateMapper<unknown, unknown>,
  ) {}

  async processWithContext(
    data: FrontMatterContent,
    context: AnalysisContext,
  ): Promise<Result<unknown, AnalysisError & { message: string }>> {
    // Exhaustive pattern matching - no default case needed (Totality principle)
    switch (context.kind) {
      case "SchemaAnalysis": {
        const result = await this.schemaAnalyzer.analyze(
          data.data,
          context.schema,
        );
        return { ok: true as const, data: result };
      }

      case "TemplateMapping": {
        const schemaResult = context.schema
          ? {
            ok: true as const,
            data: await this.schemaAnalyzer.analyze(data.data, context.schema),
          }
          : { ok: true as const, data: data.data };

        if (!schemaResult.ok) {
          return schemaResult;
        }

        return this.templateMapper.mapInternal(
          schemaResult.data,
          context.template,
        );
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
 * Analysis Strategy Implementations
 * Concrete strategies for different analysis types
 */

/**
 * FrontMatter Extraction Strategy
 */
export class FrontMatterExtractionStrategy
  implements AnalysisStrategy<string, FrontMatterContent> {
  readonly name = "FrontMatterExtractionStrategy";

  async execute(
    input: string,
    _context: AnalysisContext,
  ): Promise<Result<FrontMatterContent, AnalysisError & { message: string }>> {
    // Extract frontmatter from markdown content
    const frontMatterMatch = input.match(/^---\s*([\s\S]*?)\s*---/);

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

    const yamlContent = frontMatterMatch[1];

    // Handle empty frontmatter case - create empty FrontMatterContent
    if (!yamlContent || yamlContent.trim().length === 0) {
      const emptyResult = FrontMatterContent.fromObject({});
      if (!emptyResult.ok) {
        return {
          ok: false,
          error: createDomainError({
            kind: "ExtractionStrategyFailed",
            strategy: this.name,
            input: yamlContent,
          }),
        };
      }
      // Ensure async consistency
      await Promise.resolve();
      return emptyResult;
    }

    const yamlResult = FrontMatterContent.fromYaml(yamlContent);

    // Map ValidationError to AnalysisError
    if (!yamlResult.ok) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ExtractionStrategyFailed",
          strategy: this.name,
          input: yamlContent,
        }),
      };
    }

    // Ensure async consistency
    await Promise.resolve();
    return yamlResult;
  }
}

/**
 * Schema Mapping Strategy
 */
export class SchemaMappingStrategy<TResult>
  implements AnalysisStrategy<FrontMatterContent, TResult> {
  readonly name = "SchemaMappingStrategy";

  constructor(private readonly schema: SchemaDefinition) {}

  async execute(
    input: FrontMatterContent,
    context: AnalysisContext,
  ): Promise<Result<TResult, AnalysisError & { message: string }>> {
    if (!isSchemaAnalysis(context)) {
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

// Legacy AnalysisStrategies namespace for backward compatibility
export const AnalysisStrategies = {
  FrontMatterExtractionStrategy,
  SchemaMappingStrategy,
};
