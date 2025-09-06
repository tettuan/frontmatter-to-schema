/**
 * Error Handler Service
 *
 * Centralized error message generation and Result type handling
 * following DDD principles. Eliminates code duplication patterns
 * across the codebase while maintaining consistency.
 */

import type { DomainError, Result } from "../core/result.ts";

/**
 * Error context for generating contextual error messages
 */
export interface ErrorContext {
  operation: string;
  resource?: string;
  details?: Record<string, unknown>;
}

/**
 * Standard error message patterns for domain errors
 */
const ERROR_PATTERNS = {
  fileNotFound: (resource: string) => `${resource} file not found`,
  readError: (resource: string, details?: string) =>
    details
      ? `${resource} read error: ${details}`
      : `Failed to read ${resource}`,
  writeError: (resource: string, details?: string) =>
    details
      ? `${resource} write error: ${details}`
      : `Failed to write ${resource}`,
  permissionDenied: (resource: string, operation: string) =>
    `Permission denied for ${operation} on ${resource}`,
  schemaValidationFailed: (resource: string) =>
    `Schema validation failed for ${resource}`,
  templateMappingFailed: (resource: string) =>
    `Template mapping failed for ${resource}`,
  extractionStrategyFailed: (strategy: string) =>
    `Extraction strategy '${strategy}' failed`,
  aiServiceError: (service: string) => `AI service '${service}' error`,
  configurationError: (resource: string) =>
    `Configuration error for ${resource}`,
  processingStageError: (stage: string, details?: string) =>
    details
      ? `Processing stage '${stage}' failed: ${details}`
      : `Processing stage '${stage}' failed`,
} as const;

/**
 * Centralized Error Handler Service
 */
export class ErrorHandlerService {
  /**
   * Generate standardized error message based on error kind and context
   */
  static generateMessage(
    error: DomainError,
    context: ErrorContext,
  ): string {
    const { operation, resource = operation, details } = context;
    const detailsString = details ? JSON.stringify(details) : undefined;

    switch (error.kind) {
      case "FileNotFound":
        return ERROR_PATTERNS.fileNotFound(resource);

      case "ReadError":
        return ERROR_PATTERNS.readError(resource, detailsString);

      case "WriteError":
        return ERROR_PATTERNS.writeError(resource, detailsString);

      case "PermissionDenied":
        return ERROR_PATTERNS.permissionDenied(resource, error.operation);

      case "SchemaValidationFailed":
        return ERROR_PATTERNS.schemaValidationFailed(resource);

      case "TemplateMappingFailed":
        return ERROR_PATTERNS.templateMappingFailed(resource);

      case "ExtractionStrategyFailed":
        return ERROR_PATTERNS.extractionStrategyFailed(error.strategy);

      case "AIServiceError":
        return ERROR_PATTERNS.aiServiceError(error.service);

      case "ConfigurationError":
        return ERROR_PATTERNS.configurationError(resource);

      case "ProcessingStageError":
        return ERROR_PATTERNS.processingStageError(error.stage, detailsString);

      default:
        return `${operation} failed: ${error.kind}`;
    }
  }

  /**
   * Create a Result error with a standardized message
   * Use this when you have a specific DomainError instance
   */
  static createResultWithMessage<T>(
    error: DomainError,
    context: ErrorContext,
  ): Result<T, DomainError & { message: string }> {
    const message = this.generateMessage(error, context);

    return {
      ok: false,
      error: {
        ...error,
        message,
      } as DomainError & { message: string },
    };
  }

  /**
   * Transform a Result error with standardized messaging
   */
  static transformError<T>(
    result: Result<T, DomainError>,
    context: ErrorContext,
  ): Result<T, DomainError & { message: string }> {
    if (result.ok) {
      return result;
    }

    const message = this.generateMessage(result.error, context);

    return {
      ok: false,
      error: {
        ...result.error,
        message,
      },
    };
  }

  /**
   * Chain multiple Result operations with consistent error handling
   */
  static chainResults<T, U>(
    result: Result<T, DomainError>,
    transform: (value: T) => Result<U, DomainError>,
    context: ErrorContext,
  ): Result<U, DomainError & { message: string }> {
    if (!result.ok) {
      return this.transformError(result, context);
    }

    const transformedResult = transform(result.data);
    return this.transformError(transformedResult, context);
  }

  /**
   * Handle multiple Results with aggregated error reporting
   */
  static aggregateResults<T>(
    results: Result<T, DomainError>[],
    context: ErrorContext,
  ): Result<T[], DomainError & { message: string }> {
    const successful: T[] = [];
    const errors: string[] = [];

    for (const result of results) {
      if (result.ok) {
        successful.push(result.data);
      } else {
        errors.push(this.generateMessage(result.error, context));
      }
    }

    if (errors.length > 0) {
      const pipelineError: DomainError = {
        kind: "ProcessingStageError",
        stage: context.operation,
        error: { kind: "NotFound", resource: "aggregation" },
      };

      const message = `Multiple errors in ${context.operation}: ${
        errors.join("; ")
      } (${successful.length} successful)`;

      return {
        ok: false,
        error: {
          ...pipelineError,
          message,
        } as DomainError & { message: string },
      };
    }

    return { ok: true, data: successful };
  }
}
