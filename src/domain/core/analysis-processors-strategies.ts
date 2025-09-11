/**
 * Analysis Processors and Strategies
 *
 * Contains context-aware processors and concrete analysis strategy implementations
 * following exhaustive pattern matching and Totality principles.
 */

import { createDomainError, type Result } from "./result.ts";
import type { AnalysisError } from "./result.ts";
import { DEFAULT_ERROR_CONTEXT_LIMIT } from "../shared/constants.ts";
import type { AnalysisContext } from "./types.ts";
import { isSchemaAnalysis } from "./types.ts";
import type {
  FrontMatterContent,
  SchemaDefinition,
} from "../models/value-objects.ts";
import { FrontMatterContent as FrontMatterContentClass } from "../models/value-objects.ts";
import type {
  SchemaBasedAnalyzer as AbstractSchemaBasedAnalyzer,
} from "./abstractions.ts";
import type {
  AnalysisEngine,
  AnalysisStrategy,
  InternalTemplateMapper,
} from "./analysis-interfaces.ts";
import { RobustSchemaAnalyzer } from "./analysis-engine-core.ts";

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
          data.toJSON(),
          context.schema as unknown,
        );
        return { ok: true as const, data: result };
      }

      case "TemplateMapping": {
        const schemaResult = context.schema
          ? {
            ok: true as const,
            data: await this.schemaAnalyzer.analyze(
              data.toJSON(),
              context.schema as unknown,
            ),
          }
          : { ok: true as const, data: data.toJSON() };

        if (!schemaResult.ok) {
          return schemaResult;
        }

        return this.templateMapper.mapInternal(
          schemaResult.data,
          context.template,
        );
      }

      case "ValidationOnly": {
        const validationResult = (context.schema as {
          validate: (
            data: unknown,
          ) => { ok: boolean; data?: unknown; error?: unknown };
        }).validate(data.toJSON());
        if (!validationResult.ok) {
          return {
            ok: false,
            error: createDomainError({
              kind: "SchemaValidationFailed",
              schema: (context.schema as { schema?: unknown }).schema,
              data: data.toJSON(),
            }),
          };
        }

        return { ok: true, data: data.toJSON() };
      }

      case "BasicExtraction": {
        // Basic extraction with minimal processing
        const jsonData = data.toJSON();
        const extractedData = {
          ...(typeof jsonData === "object" && jsonData !== null
            ? jsonData
            : {}),
          extractionMetadata: {
            extractedAt: new Date().toISOString(),
            keyCount: data.keys().length,
            includeMetadata: context.options?.includeMetadata || false,
          },
        };

        return { ok: true, data: extractedData };
      }

      // Default case should never be reached with proper discriminated union
      default: {
        const _exhaustive: never = context;
        return {
          ok: false,
          error: createDomainError({
            kind: "InvalidAnalysisContext",
            context: _exhaustive,
          }),
        };
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
          input: DEFAULT_ERROR_CONTEXT_LIMIT.truncateContent(input), // Truncate for error message
        }),
      };
    }

    const yamlContent = frontMatterMatch[1];

    // Handle empty frontmatter case - create empty FrontMatterContent
    if (!yamlContent || yamlContent.trim().length === 0) {
      const emptyResult = FrontMatterContentClass.fromObject({});
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

    const yamlResult = FrontMatterContentClass.fromYaml(yamlContent);

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
    return await analyzer.process(input, context.schema as SchemaDefinition);
  }
}

// Legacy AnalysisStrategies namespace for backward compatibility
export const AnalysisStrategies = {
  FrontMatterExtractionStrategy,
  SchemaMappingStrategy,
};
