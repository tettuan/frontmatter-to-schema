/**
 * Domain Service Interfaces
 *
 * These interfaces define the contracts for domain services following DDD principles.
 * They are part of the domain layer and represent business capabilities.
 *
 * Key principles:
 * - All methods return Result types (Totality principle)
 * - Interfaces are schema-agnostic where possible
 * - Clear separation between domain logic and infrastructure concerns
 */

import type {
  DomainError,
  Result,
  // createDomainError, // Unused import removed
} from "../core/result.ts";
import type {
  AggregatedResult,
  AnalysisResult,
  Document,
  ExtractedData,
  FrontMatter,
  MappedData,
  Schema,
} from "../models/entities.ts";
import type { Template } from "../models/entities.ts";
import type {
  ConfigPath,
  DocumentPath,
  FrontMatterContent as _FrontMatterContent,
  OutputPath,
  TemplatePath,
} from "../models/value-objects.ts";

/**
 * Discriminated Union Types
 * These types represent different states of processing results following the totality principle
 */

/**
 * Result type for FrontMatter extraction that eliminates null returns
 * - Extracted: Document contains valid frontmatter
 * - NotPresent: Document has no frontmatter (valid state, not an error)
 */
export type FrontMatterExtractionResult =
  | { kind: "Extracted"; frontMatter: FrontMatter }
  | { kind: "NotPresent" };

/**
 * Core Domain Services
 * These services encapsulate domain logic that doesn't naturally fit within entities
 */

/**
 * Extracts frontmatter metadata from markdown documents
 *
 * Responsible for parsing YAML/TOML frontmatter from document content.
 * Returns a discriminated union indicating either extracted frontmatter or no frontmatter present.
 */
export interface FrontMatterExtractor {
  extract(
    document: Document,
  ): Result<FrontMatterExtractionResult, DomainError & { message: string }>;
}

/**
 * Analyzes frontmatter against a schema definition
 *
 * This is a key injection point for schema variability.
 * The schema is provided at runtime, allowing different schemas
 * to be used with the same application instance.
 */
export interface SchemaAnalyzer {
  analyze(
    frontMatter: FrontMatter,
    schema: Schema,
  ): Promise<Result<ExtractedData, DomainError & { message: string }>>;
}

// Discriminated union for schema validation following totality principle
export type SchemaValidationMode =
  | { kind: "WithSchema"; schema: unknown }
  | { kind: "NoSchema" };

/**
 * Maps extracted data to a template structure
 *
 * Transforms schema-validated data into the desired output format.
 * The template is injected at runtime for maximum flexibility.
 * Uses discriminated union for schema validation to follow totality principle.
 */
export interface TemplateMapper {
  map(
    data: ExtractedData,
    template: Template,
    schemaMode: SchemaValidationMode,
  ): Result<MappedData, DomainError & { message: string }>;
}

/**
 * Aggregates multiple analysis results into a final output
 *
 * Combines results from processing multiple documents into
 * a single cohesive output structure.
 */
export interface ResultAggregator {
  aggregate(
    results: AnalysisResult[],
  ): Result<AggregatedResult, DomainError & { message: string }>;
}

/**
 * Infrastructure Service Interfaces
 *
 * These interfaces define contracts for infrastructure services,
 * following the Ports and Adapters pattern to abstract infrastructure
 * concerns from the domain layer.
 */

/**
 * File system reader interface for abstracting file I/O operations
 *
 * This interface allows the domain layer to read files without
 * directly depending on the file system implementation.
 */
export interface FileReader {
  readTextFile(
    path: string,
  ): Promise<Result<string, DomainError & { message: string }>>;
}

/**
 * Repository Interfaces
 *
 * These interfaces define contracts for data access, following the
 * Repository pattern from DDD. They abstract infrastructure concerns
 * from the domain layer.
 */

/**
 * Repository for accessing markdown documents
 */
export interface DocumentRepository {
  findAll(
    path: DocumentPath,
  ): Promise<Result<Document[], DomainError & { message: string }>>;
  findByPattern(
    pattern: string,
    basePath?: string,
  ): Promise<Result<Document[], DomainError & { message: string }>>;
  read(
    path: DocumentPath,
  ): Promise<Result<Document, DomainError & { message: string }>>;
}

export interface SchemaRepository {
  load(
    path: ConfigPath,
  ): Promise<Result<Schema, DomainError & { message: string }>>;
  validate(schema: Schema): Result<void, DomainError & { message: string }>;
}

export interface TemplateRepository {
  /**
   * Load a template by ID (searches common template locations)
   */
  load(
    templateId: string,
  ): Promise<Result<Template, DomainError & { message: string }>>;

  /**
   * Load a template from a specific path
   */
  loadFromPath(
    path: TemplatePath,
  ): Promise<Result<Template, DomainError & { message: string }>>;

  /**
   * Save a template
   */
  save(
    template: Template,
  ): Promise<Result<void, DomainError & { message: string }>>;

  /**
   * Check if a template exists
   */
  exists(templateId: string): Promise<boolean>;

  /**
   * List all available template IDs
   */
  list(): Promise<Result<string[], DomainError & { message: string }>>;

  /**
   * Validate a template
   */
  validate(
    template: Template,
  ): Result<void, DomainError & { message: string }>;
}

export interface ResultRepository {
  save(
    result: AggregatedResult,
    path: OutputPath,
  ): Promise<Result<void, DomainError & { message: string }>>;
  append(
    result: AnalysisResult,
    path: OutputPath,
  ): Promise<Result<void, DomainError & { message: string }>>;
}

// Configuration repository
export interface ConfigurationRepository {
  loadProcessingConfig(
    path: ConfigPath,
  ): Promise<
    Result<ProcessingConfiguration, DomainError & { message: string }>
  >;
  validate(
    config: ProcessingConfiguration,
  ): Result<void, DomainError & { message: string }>;
}

// Configuration types - kept as interface for backward compatibility
// Note: This represents domain-level configuration which is different from application-layer ProcessingConfiguration
export interface ProcessingConfiguration {
  documentsPath: DocumentPath;
  schemaPath: ConfigPath;
  templatePath: TemplatePath;
  outputPath: OutputPath;
  options: ProcessingOptions;
}

// Totality-compliant options using discriminated union instead of optional properties
export type ProcessingOptions =
  | { kind: "BasicOptions" }
  | { kind: "ParallelOptions"; maxConcurrency: number }
  | { kind: "ResilientOptions"; continueOnError: boolean }
  | { kind: "FullOptions"; maxConcurrency: number; continueOnError: boolean };

// Domain event interfaces (for future event sourcing)
export interface DomainEvent {
  eventId: string;
  eventType: string;
  aggregateId: string;
  timestamp: Date;
  payload: unknown;
}

export interface DocumentProcessedEvent extends DomainEvent {
  eventType: "DocumentProcessed";
  payload: {
    documentId: string;
    path: string;
    success: boolean;
    error?: string;
  };
}

export interface AnalysisCompletedEvent extends DomainEvent {
  eventType: "AnalysisCompleted";
  payload: {
    analysisId: string;
    documentId: string;
    extractedFields: string[];
  };
}

export interface AggregationCompletedEvent extends DomainEvent {
  eventType: "AggregationCompleted";
  payload: {
    resultCount: number;
    outputPath: string;
    format: string;
  };
}

/**
 * Future Totality-Compliant Service Result Types
 *
 * These discriminated union types are prepared for future migration from Result<T, E>
 * patterns to follow Totality principles. They will replace Result types gradually
 * to provide exhaustive result coverage without partial functions.
 */

/**
 * Future FrontMatter extraction operation results (for migration)
 * @deprecated_pattern Replace Result<FrontMatterExtractionResult, DomainError>
 */
export type FrontMatterExtractionOperation =
  | { kind: "Extracted"; frontMatter: FrontMatter }
  | { kind: "NotPresent" }
  | { kind: "ParseError"; input: string; details: string }
  | { kind: "InvalidFormat"; input: string; expectedFormat: string };

/**
 * Future Schema analysis operation results (for migration)
 * @deprecated_pattern Replace Result<ExtractedData, DomainError>
 */
export type SchemaAnalysisOperation =
  | { kind: "Success"; extractedData: ExtractedData }
  | {
    kind: "ValidationFailed";
    schema: unknown;
    data: unknown;
    violations: string[];
  }
  | { kind: "SchemaError"; schemaIssue: string }
  | { kind: "DataError"; dataIssue: string };

/**
 * Future Template mapping operation results (for migration)
 * @deprecated_pattern Replace Result<MappedData, DomainError>
 */
export type TemplateMappingOperation =
  | { kind: "Success"; mappedData: MappedData }
  | { kind: "MappingFailed"; template: unknown; source: unknown; issue: string }
  | { kind: "TemplateError"; templateIssue: string }
  | { kind: "DataIncompatible"; reason: string };

/**
 * Future Result aggregation operation results (for migration)
 * @deprecated_pattern Replace Result<AggregatedResult, DomainError>
 */
export type ResultAggregationOperation =
  | { kind: "Success"; aggregatedResult: AggregatedResult }
  | { kind: "NoResults" }
  | { kind: "AggregationFailed"; resultCount: number; issue: string }
  | { kind: "IncompatibleResults"; reason: string };

/**
 * Future Document repository operation results (for migration)
 * @deprecated_pattern Replace Result<Document[], DomainError> and similar
 */
export type DocumentRepositoryOperation =
  | { kind: "Success"; documents: Document[] }
  | { kind: "SingleSuccess"; document: Document }
  | { kind: "NotFound"; path: string }
  | { kind: "AccessDenied"; path: string; operation: string }
  | { kind: "ReadError"; path: string; details: string }
  | { kind: "PatternNoMatch"; pattern: string; searchPath: string };

/**
 * Future Schema repository operation results (for migration)
 * @deprecated_pattern Replace Result<Schema, DomainError> and similar
 */
export type SchemaRepositoryOperation =
  | { kind: "Success"; schema: Schema }
  | { kind: "ValidationSuccess" }
  | { kind: "NotFound"; path: string }
  | { kind: "InvalidSchema"; path: string; errors: string[] }
  | { kind: "LoadError"; path: string; details: string };

/**
 * Future Template repository operation results (for migration)
 * @deprecated_pattern Replace Result<Template, DomainError> and similar
 */
export type TemplateRepositoryOperation =
  | { kind: "Success"; template: Template }
  | { kind: "ListSuccess"; templateIds: string[] }
  | { kind: "SaveSuccess" }
  | { kind: "ValidationSuccess" }
  | { kind: "Exists"; templateId: string }
  | { kind: "NotExists"; templateId: string }
  | { kind: "NotFound"; identifier: string }
  | { kind: "LoadError"; path: string; details: string }
  | { kind: "SaveError"; details: string }
  | { kind: "ValidationError"; errors: string[] };

/**
 * Future Result repository operation results (for migration)
 * @deprecated_pattern Replace Result<void, DomainError>
 */
export type ResultRepositoryOperation =
  | { kind: "SaveSuccess" }
  | { kind: "AppendSuccess" }
  | { kind: "WriteError"; path: string; details: string }
  | { kind: "AccessDenied"; path: string; operation: string }
  | { kind: "InvalidData"; reason: string };

/**
 * Future Configuration repository operation results (for migration)
 * @deprecated_pattern Replace Result<ProcessingConfiguration, DomainError> and similar
 */
export type ConfigurationRepositoryOperation =
  | { kind: "Success"; config: ProcessingConfiguration }
  | { kind: "ValidationSuccess" }
  | { kind: "NotFound"; path: string }
  | { kind: "ConfigError"; path: string; errors: string[] }
  | { kind: "LoadError"; path: string; details: string };
