/**
 * Domain Layer Barrel Exports
 * Provides centralized access to core domain types and functions
 * Improves architectural consistency by simplifying import paths
 */

// Core Result System
export type {
  AnalysisError,
  DomainError,
  ExternalServiceError,
  FileSystemError,
  PipelineError,
  Result,
  ValidationError,
} from "./core/result.ts";

export {
  combineResults,
  createDomainError,
  createProcessingStageError,
  flatMapResult,
  getDefaultErrorMessage,
  isError,
  isFailure,
  isOk,
  isSuccess,
  mapErrorResult,
  mapResult,
  ResultUtils,
  unwrapOrResult,
  unwrapResult,
} from "./core/result.ts";

// Domain Models
export type {
  AnalysisResult,
  Document,
  ExtractedData,
  Schema,
  Template,
} from "./models/entities.ts";

export {
  DocumentContent,
  DocumentPath,
  ProcessingOptions,
  TemplateFormat,
} from "./models/value-objects.ts";

// Shared Logger
export { StructuredLogger } from "./shared/logger.ts";
