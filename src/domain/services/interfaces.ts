// Domain service interfaces

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

// Core domain services
export interface FrontMatterExtractor {
  extract(
    document: Document,
  ): Result<FrontMatter | null, ProcessingError & { message: string }>;
}

export interface SchemaAnalyzer {
  analyze(
    frontMatter: FrontMatter,
    schema: Schema,
  ): Promise<Result<ExtractedData, ProcessingError & { message: string }>>;
}

export interface TemplateMapper {
  map(
    data: ExtractedData,
    template: Template,
  ): Result<MappedData, ProcessingError & { message: string }>;
}

export interface ResultAggregator {
  aggregate(
    results: AnalysisResult[],
  ): Result<AggregatedResult, ProcessingError & { message: string }>;
}

// Repository interfaces
export interface DocumentRepository {
  findAll(
    path: DocumentPath,
  ): Promise<Result<Document[], IOError & { message: string }>>;
  findByPattern(
    pattern: string,
    basePath?: string,
  ): Promise<Result<Document[], IOError & { message: string }>>;
  read(
    path: DocumentPath,
  ): Promise<Result<Document, IOError & { message: string }>>;
}

export interface SchemaRepository {
  load(
    path: ConfigPath,
  ): Promise<Result<Schema, IOError & { message: string }>>;
  validate(schema: Schema): Result<void, ValidationError & { message: string }>;
}

export interface TemplateRepository {
  load(
    path: ConfigPath,
  ): Promise<Result<Template, IOError & { message: string }>>;
  validate(
    template: Template,
  ): Result<void, ValidationError & { message: string }>;
}

export interface ResultRepository {
  save(
    result: AggregatedResult,
    path: OutputPath,
  ): Promise<Result<void, IOError & { message: string }>>;
  append(
    result: AnalysisResult,
    path: OutputPath,
  ): Promise<Result<void, IOError & { message: string }>>;
}

// Configuration repository
export interface ConfigurationRepository {
  loadProcessingConfig(
    path: ConfigPath,
  ): Promise<Result<ProcessingConfiguration, IOError & { message: string }>>;
  loadAnalysisConfig(
    path: ConfigPath,
  ): Promise<Result<AnalysisConfiguration, IOError & { message: string }>>;
  validate(
    config: ProcessingConfiguration | AnalysisConfiguration,
  ): Result<void, ValidationError & { message: string }>;
}

// Configuration types
export interface ProcessingConfiguration {
  documentsPath: DocumentPath;
  schemaPath: ConfigPath;
  templatePath: ConfigPath;
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
  aiProvider: "claude" | "openai" | "local";
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
