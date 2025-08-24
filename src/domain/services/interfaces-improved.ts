/**
 * Domain Service Interfaces - Improved with Totality
 *
 * These interfaces define the contracts for domain services following DDD principles
 * and the Totality principle - all functions are total (no null/undefined returns).
 *
 * Key improvements:
 * - No nullable returns - use discriminated unions instead
 * - All optional parameters made explicit
 * - Exhaustive pattern matching enabled
 */

import type {
  IOError,
  ProcessingError,
  Result,
  ValidationError,
} from "../shared/types.ts";
import type {
  AggregatedResult,
  AnalysisResult,
  Document,
  ExtractedData,
  FrontMatter,
  MappedData,
  Schema,
  Template,
} from "../models/entities.ts";
import type {
  ConfigPath,
  DocumentPath,
  OutputPath,
} from "../models/value-objects.ts";

/**
 * Result of frontmatter extraction - explicit states using discriminated union
 * This replaces the partial function that returned FrontMatter | null
 */
export type FrontMatterExtractionResult =
  | { kind: "Found"; frontMatter: FrontMatter }
  | { kind: "NotFound"; documentPath: string }
  | { kind: "Invalid"; documentPath: string; reason: string };

/**
 * Extracts frontmatter metadata from markdown documents
 *
 * Now returns an explicit result type instead of nullable FrontMatter.
 * All possible states are explicitly modeled.
 */
export interface FrontMatterExtractor {
  extract(
    document: Document,
  ): Result<FrontMatterExtractionResult, ProcessingError & { message: string }>;
}

/**
 * Analysis configuration - makes optional parameters explicit
 */
export type AnalysisConfig = 
  | { kind: "Default" }
  | { kind: "Custom"; timeout: number; retries: number }
  | { kind: "Strict"; requiredFields: string[] };

/**
 * Analyzes frontmatter against a schema definition
 *
 * Configuration is now explicit rather than optional.
 */
export interface SchemaAnalyzer {
  analyze(
    frontMatter: FrontMatter,
    schema: Schema,
    config: AnalysisConfig,
  ): Promise<Result<ExtractedData, ProcessingError & { message: string }>>;
}

/**
 * Template mapping mode - explicit strategy selection
 */
export type MappingMode =
  | { kind: "Direct" }
  | { kind: "Transform"; transformRules: MappingRule[] }
  | { kind: "Conditional"; conditions: MappingCondition[] };

export interface MappingRule {
  source: string;
  target: string;
  transform: (value: unknown) => unknown;
}

export interface MappingCondition {
  when: (data: ExtractedData) => boolean;
  apply: (data: ExtractedData) => MappedData;
}

/**
 * Maps extracted data to a template structure
 *
 * Mapping mode is now explicit, not optional.
 */
export interface TemplateMapper {
  map(
    data: ExtractedData,
    template: Template,
    mode: MappingMode,
  ): Result<MappedData, ProcessingError & { message: string }>;
}

/**
 * Aggregation strategy - explicit selection of how to combine results
 */
export type AggregationStrategy =
  | { kind: "Concat" }
  | { kind: "Merge"; conflictResolution: "First" | "Last" | "Error" }
  | { kind: "Group"; groupBy: string };

/**
 * Aggregates multiple analysis results into a final output
 *
 * Strategy is now required and explicit.
 */
export interface ResultAggregator {
  aggregate(
    results: AnalysisResult[],
    strategy: AggregationStrategy,
  ): Result<AggregatedResult, ProcessingError & { message: string }>;
}

/**
 * Repository Interfaces with Totality
 */

/**
 * Document query - explicit filtering
 */
export type DocumentQuery =
  | { kind: "All" }
  | { kind: "ByPath"; path: DocumentPath }
  | { kind: "ByPattern"; pattern: string }
  | { kind: "ByPaths"; paths: DocumentPath[] };

/**
 * Repository for accessing markdown documents
 */
export interface DocumentRepository {
  find(
    query: DocumentQuery,
  ): Promise<Result<Document[], IOError & { message: string }>>;

  findOne(
    path: DocumentPath,
  ): Promise<Result<Document, IOError & { message: string }>>;
}

/**
 * Schema loading options - explicit configuration
 */
export type SchemaLoadOptions =
  | { kind: "Latest" }
  | { kind: "Version"; version: string }
  | { kind: "Path"; path: ConfigPath };

/**
 * Repository for managing schemas
 */
export interface SchemaRepository {
  load(
    options: SchemaLoadOptions,
  ): Promise<Result<Schema, ValidationError & { message: string }>>;

  validate(
    schema: Schema,
  ): Result<void, ValidationError & { message: string }>;
}

/**
 * Template loading options - explicit source selection
 */
export type TemplateLoadOptions =
  | { kind: "Default"; format: "json" | "yaml" }
  | { kind: "Custom"; path: ConfigPath }
  | { kind: "Inline"; content: string; format: string };

/**
 * Repository for managing templates
 */
export interface TemplateRepository {
  load(
    options: TemplateLoadOptions,
  ): Promise<Result<Template, ValidationError & { message: string }>>;
}

/**
 * Configuration types with explicit presence
 */
export type ProcessingConfiguration = {
  documentsPath: DocumentPath;
  schemaPath: ConfigPath;
  templatePath: ConfigPath;
  outputPath: OutputPath;
  options: ProcessingOptions;
};

export type ProcessingOptions = {
  parallel: boolean;
  continueOnError: boolean;
  maxConcurrency: number;
  timeout: number;
};

export type AnalysisConfiguration = {
  aiProvider: "claude" | "openai" | "none";
  aiConfig: AIProviderConfig;
};

export type AIProviderConfig =
  | { kind: "Claude"; apiKey: string; model: string }
  | { kind: "OpenAI"; apiKey: string; model: string }
  | { kind: "None" };

/**
 * Configuration loader with explicit modes
 */
export interface ConfigurationLoader {
  loadProcessingConfig(
    path: ConfigPath,
  ): Promise<Result<ProcessingConfiguration, ValidationError & { message: string }>>;

  loadAnalysisConfig(
    path: ConfigPath,
  ): Promise<Result<AnalysisConfiguration, ValidationError & { message: string }>>;
}