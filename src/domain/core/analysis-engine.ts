/**
 * Core Analysis Engine - The backbone center line of the DDD architecture
 * Implements the central analysis pipeline following Schema-driven Analysis pattern
 * Follows Totality principles: discriminated unions, Result types, no partial functions
 */

import {
  type AnalysisError,
  createDomainError,
  type Result,
} from "./result.ts";

// Totality-compliant discriminated unions for analysis engine states
type InputValidationResult<T> = {
  kind: "Valid";
  value: T;
} | {
  kind: "Invalid";
  reason: string;
};

type TimeoutState = {
  kind: "Active";
  id: number;
} | {
  kind: "Cleared";
} | {
  kind: "NotSet";
};

type SchemaValidationCapability = {
  kind: "HasValidation";
  validate: (data: unknown) => { ok: boolean; data?: unknown; error?: unknown };
} | {
  kind: "NoValidation";
};

type TemplateParsingResult = {
  kind: "Parsed";
  structure: Record<string, unknown>;
  mappingRules: MappingRulesResult;
} | {
  kind: "ParseFailed";
  fallbackStructure: Record<string, unknown>;
  mappingRules: MappingRulesResult;
};

type MappingRulesResult = {
  kind: "Present";
  rules: Record<string, string>;
} | {
  kind: "NotPresent";
};
import {
  type AnalysisContext,
  isSchemaAnalysis,
  type TemplateDefinition,
} from "./types.ts";
import { FrontMatterContent } from "../models/value-objects.ts";
import type { SchemaDefinition } from "../models/value-objects.ts";
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
    schema: SchemaDefinition,
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
  implements AbstractSchemaBasedAnalyzer<TSchema, TResult> {
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
    schema: unknown
  ): schema is {
    validate: (data: unknown) => { ok: boolean; data?: unknown; error?: unknown };
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
    // Check if template has TemplateDefinition structure
    if (this.isTemplateDefinition(template)) {
      // If template has structure property, return as-is
      if (template.structure) {
        return Promise.resolve(template as TTarget);
      }

      // If template has variables but no structure, create structure from variables
      if (template.variables && !template.structure) {
        const result = {
          ...template,
          structure: { ...template.variables },
        };
        // Safe to cast after transformation
        return Promise.resolve(result as TTarget);
      }
    }

    // Default: return template as-is
    return Promise.resolve(template);
  }

  /**
   * Type guard to check if value is a TemplateDefinition
   */
  private isTemplateDefinition(
    value: unknown
  ): value is TemplateDefinition {
    return (
      typeof value === "object" &&
      value !== null &&
      ("structure" in value || "variables" in value)
    );
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
          template: template.template || template,
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
          template: template.template || template,
          source,
        }),
      };
    }
  }

  private transformWithTemplate(
    source: TSource,
    template: TemplateDefinition,
  ): TTarget {
    // Parse template using Totality patterns
    const parsingResult = this.parseTemplateDefinition(template);

    // Start with template structure as base
    const templateStructure = this.extractTemplateStructure(parsingResult);
    const result: Record<string, unknown> = { ...templateStructure };

    // Handle FrontMatterContent instances by extracting their data
    let sourceObj: Record<string, unknown>;
    if (
      source && typeof source === "object" && "toJSON" in source &&
      typeof (source as { toJSON?: () => unknown }).toJSON === "function"
    ) {
      // This is a FrontMatterContent instance
      sourceObj = (source as { toJSON: () => Record<string, unknown> })
        .toJSON();
    } else if (typeof source === "object" && source !== null) {
      sourceObj = source as Record<string, unknown>;
    } else {
      return result as TTarget;
    }

    // Apply mapping rules using discriminated union pattern
    this.applyMappingRules(parsingResult.mappingRules, sourceObj, result);

    // Merge any remaining properties from source, overriding template defaults
    for (const [key, value] of Object.entries(sourceObj)) {
      result[key] = value;
    }

    return result as TTarget;
  }

  /**
   * Parse template definition using Totality patterns
   */
  private parseTemplateDefinition(
    template: TemplateDefinition,
  ): TemplateParsingResult {
    try {
      // If template.template is a string that looks like JSON, try to parse it
      if (
        typeof template.template === "string" &&
        template.template.startsWith("{")
      ) {
        const parsedTemplate = JSON.parse(template.template);
        return {
          kind: "Parsed",
          structure: parsedTemplate.structure || {},
          mappingRules: this.extractMappingRules(
            parsedTemplate.mappingRules || template.mappingRules,
          ),
        };
      } else {
        // Use template structure directly, or merge with variables for simple string templates
        let structure = template.structure || {};

        // For simple string templates like "default", use variables directly
        if (
          typeof template.template === "string" &&
          Object.keys(structure).length === 0 && template.variables
        ) {
          structure = { ...template.variables };
        }

        return {
          kind: "Parsed",
          structure,
          mappingRules: this.extractMappingRules(template.mappingRules),
        };
      }
    } catch {
      // If parsing fails, use template as-is
      let fallbackStructure = template.structure || {};

      // Fallback: use variables directly if available
      if (template.variables && Object.keys(fallbackStructure).length === 0) {
        fallbackStructure = { ...template.variables };
      }

      return {
        kind: "ParseFailed",
        fallbackStructure,
        mappingRules: this.extractMappingRules(template.mappingRules),
      };
    }
  }

  /**
   * Extract mapping rules using discriminated union pattern
   */
  private extractMappingRules(
    rules: Record<string, string> | undefined,
  ): MappingRulesResult {
    if (rules && typeof rules === "object") {
      return { kind: "Present", rules };
    }
    return { kind: "NotPresent" };
  }

  /**
   * Extract template structure from parsing result
   */
  private extractTemplateStructure(
    parsingResult: TemplateParsingResult,
  ): Record<string, unknown> {
    switch (parsingResult.kind) {
      case "Parsed":
        return parsingResult.structure;
      case "ParseFailed":
        return parsingResult.fallbackStructure;
    }
  }

  /**
   * Apply mapping rules using discriminated union pattern
   */
  private applyMappingRules(
    mappingRulesResult: MappingRulesResult,
    sourceObj: Record<string, unknown>,
    result: Record<string, unknown>,
  ): void {
    switch (mappingRulesResult.kind) {
      case "Present":
        for (
          const [targetKey, sourceKey] of Object.entries(
            mappingRulesResult.rules,
          )
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
        break;
      case "NotPresent":
        // No mapping rules to apply
        break;
    }
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
    return await analyzer.process(input, context.schema as SchemaDefinition);
  }
}

// Legacy AnalysisStrategies namespace for backward compatibility
export const AnalysisStrategies = {
  FrontMatterExtractionStrategy,
  SchemaMappingStrategy,
};
