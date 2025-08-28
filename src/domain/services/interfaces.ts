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
  Template,
} from "../models/entities.ts";
import type {
  ConfigPath,
  DocumentPath,
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
  readTextFile(path: string): Promise<string>;
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

/**
 * Repository interface for Template aggregate following DDD pattern
 * Provides abstraction for template persistence and validation
 */
export interface TemplateRepository {
  /**
   * Load a template by ID
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
   * Validate a template structure and format
   */
  validate(
    template: Template,
  ): Result<void, DomainError & { message: string }>;

  /**
   * Check if a template exists
   */
  exists(templateId: string): Promise<boolean>;

  /**
   * List all available template IDs
   */
  list(): Promise<Result<string[], DomainError & { message: string }>>;
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
  loadAnalysisConfig(
    path: ConfigPath,
  ): Promise<Result<AnalysisConfiguration, DomainError & { message: string }>>;
  validate(
    config: ProcessingConfiguration | AnalysisConfiguration,
  ): Result<void, DomainError & { message: string }>;
}

// Configuration types
export interface ProcessingConfiguration {
  documentsPath: DocumentPath;
  schemaPath: ConfigPath;
  templatePath: TemplatePath;
  outputPath: OutputPath;
  options: {
    parallel?: boolean;
    maxConcurrency?: number;
    continueOnError?: boolean;
  };
}

export interface AnalysisConfiguration {
  promptsPath?: ConfigPath;
  extractionPrompt?: string;
  mappingPrompt?: string;
  aiProvider: "claude" | "openai" | "local" | "mock";
  aiConfig: {
    apiKey?: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
  };
}

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
