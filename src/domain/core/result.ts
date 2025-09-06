/**
 * Foundation Result type system for robust domain implementation
 * Eliminates partial functions and provides comprehensive error handling
 */

// Core Result type - foundation for all domain operations
export type Result<T, E> =
  | { ok: true; data: T }
  | { ok: false; error: E };

// Comprehensive domain error types following the new architecture
export type DomainError =
  | ValidationError
  | AnalysisError
  | PipelineError
  | FileSystemError
  | ExternalServiceError;

// Validation errors - for Smart Constructors and input validation
export type ValidationError =
  | { kind: "EmptyInput"; field?: string }
  | { kind: "InvalidFormat"; input: string; expectedFormat: string }
  | { kind: "OutOfRange"; value: unknown; min?: number; max?: number }
  | { kind: "PatternMismatch"; value: string; pattern: string }
  | { kind: "ParseError"; input: string; details?: string }
  | { kind: "TooLong"; value: string; maxLength: number }
  | { kind: "TooShort"; value: string; minLength: number }
  | { kind: "InvalidRegex"; pattern: string }
  | { kind: "FileExtensionMismatch"; path: string; expected: string[] }
  | { kind: "NotFound"; resource: string; name?: string; key?: string }
  | { kind: "NotConfigured"; component: string }
  | { kind: "AlreadyExecuted"; pipeline: string }
  | { kind: "InvalidState"; expected: string; actual: string }
  | { kind: "NoFrontMatterPresent" }
  | { kind: "MissingRequiredField"; fields: string[] };

// Analysis domain specific errors
export type AnalysisError =
  | { kind: "SchemaValidationFailed"; schema: unknown; data: unknown }
  | { kind: "TemplateMappingFailed"; template: unknown; source: unknown }
  | { kind: "ExtractionStrategyFailed"; strategy: string; input: unknown }
  | { kind: "AIServiceError"; service: string; statusCode?: number }
  | { kind: "InvalidAnalysisContext"; context: unknown }
  | { kind: "AnalysisTimeout"; timeoutMs: number }
  | { kind: "UnsupportedAnalysisType"; type: string }
  | { kind: "SerializationError"; data: string; format: string };

// Pipeline orchestration errors
export type PipelineError =
  | { kind: "FileDiscoveryFailed"; directory: string; pattern?: string }
  | { kind: "ProcessingStageError"; stage: string; error: DomainError }
  | { kind: "ConfigurationError"; config: unknown }
  | { kind: "ResourceExhausted"; resource: string; limit: number }
  | { kind: "PipelineTimeout"; timeoutMs: number }
  | { kind: "StageSequenceError"; expectedStage: string; actualStage: string };

// File system operation errors
export type FileSystemError =
  | { kind: "FileNotFound"; path: string }
  | { kind: "PermissionDenied"; path: string; operation: string }
  | { kind: "DirectoryNotFound"; path: string }
  | { kind: "WriteError"; path: string; details?: string }
  | { kind: "ReadError"; path: string; details?: string }
  | { kind: "InvalidPath"; path: string };

// External service integration errors
export type ExternalServiceError =
  | { kind: "NetworkError"; url?: string; details?: string }
  | { kind: "AuthenticationError"; service: string }
  | { kind: "RateLimitExceeded"; service: string; retryAfter?: number }
  | { kind: "ServiceUnavailable"; service: string }
  | { kind: "InvalidResponse"; service: string; response: unknown }
  | { kind: "ConfigurationMissing"; service: string; requiredConfig: string[] };

// Error creation helper with default messages
export const createDomainError = <E extends DomainError>(
  error: E,
  customMessage?: string,
): E & { message: string } => ({
  ...error,
  message: customMessage || getDefaultErrorMessage(error),
});

// Specialized helper for ProcessingStageError to reduce code duplication
export const createProcessingStageError = (
  stage: string,
  underlyingError: DomainError,
  customMessage?: string,
): PipelineError & { message: string } => {
  const error: PipelineError = {
    kind: "ProcessingStageError",
    stage,
    error: underlyingError,
  };

  return createDomainError(
    error,
    customMessage ||
      `Error in processing stage "${stage}": ${
        getDefaultErrorMessage(underlyingError)
      }`,
  );
};

// Default error messages for comprehensive error reporting
export const getDefaultErrorMessage = (error: DomainError): string => {
  switch (error.kind) {
    // Validation errors
    case "EmptyInput":
      return `Input cannot be empty${
        error.field ? ` (field: ${error.field})` : ""
      }`;
    case "InvalidFormat":
      return `Invalid format: expected ${error.expectedFormat}, got "${error.input}"`;
    case "OutOfRange":
      return `Value ${error.value} is out of range ${error.min ?? "?"}-${
        error.max ?? "?"
      }`;
    case "PatternMismatch":
      return `Value "${error.value}" does not match pattern ${error.pattern}`;
    case "ParseError":
      return `Cannot parse "${error.input}"${
        error.details ? `: ${error.details}` : ""
      }`;
    case "TooLong":
      return `Value "${error.value}" exceeds maximum length of ${error.maxLength}`;
    case "TooShort":
      return `Value "${error.value}" is shorter than minimum length of ${error.minLength}`;
    case "InvalidRegex":
      return `Invalid regex pattern: ${error.pattern}`;
    case "FileExtensionMismatch":
      return `File "${error.path}" must have one of these extensions: ${
        error.expected.join(", ")
      }`;
    case "NotFound":
      return `${error.resource} not found${
        error.name ? `: ${error.name}` : ""
      }${error.key ? ` (key: ${error.key})` : ""}`;
    case "NotConfigured":
      return `Component not configured: ${error.component}`;
    case "AlreadyExecuted":
      return `Pipeline ${error.pipeline} has already been executed`;
    case "InvalidState":
      return `Invalid state: expected ${error.expected}, got ${error.actual}`;
    case "NoFrontMatterPresent":
      return "Document does not contain frontmatter";

    // Analysis errors
    case "SchemaValidationFailed":
      return `Schema validation failed for data: ${JSON.stringify(error.data)}`;
    case "TemplateMappingFailed":
      return `Failed to map source to template: ${
        JSON.stringify(error.source)
      }`;
    case "ExtractionStrategyFailed":
      return `Extraction strategy "${error.strategy}" failed`;
    case "AIServiceError":
      return `AI service "${error.service}" error${
        error.statusCode ? ` (${error.statusCode})` : ""
      }`;
    case "InvalidAnalysisContext":
      return `Invalid analysis context: ${JSON.stringify(error.context)}`;
    case "AnalysisTimeout":
      return `Analysis timed out after ${error.timeoutMs}ms`;
    case "UnsupportedAnalysisType":
      return `Unsupported analysis type: ${error.type}`;
    case "SerializationError":
      return `Failed to serialize data to ${error.format} format`;

    // Pipeline errors
    case "FileDiscoveryFailed":
      return `Failed to discover files in directory: ${error.directory}${
        error.pattern ? ` (pattern: ${error.pattern})` : ""
      }`;
    case "ProcessingStageError":
      return `Error in processing stage "${error.stage}": ${
        typeof error.error === "object" && error.error !== null &&
          "message" in error.error
          ? (error.error as { message: string }).message
          : "Unknown error"
      }`;
    case "ConfigurationError":
      return `Configuration error: ${JSON.stringify(error.config)}`;
    case "ResourceExhausted":
      return `Resource "${error.resource}" exhausted (limit: ${error.limit})`;
    case "PipelineTimeout":
      return `Pipeline timed out after ${error.timeoutMs}ms`;
    case "StageSequenceError":
      return `Invalid stage sequence: expected "${error.expectedStage}", got "${error.actualStage}"`;

    // File system errors
    case "FileNotFound":
      return `File not found: ${error.path}`;
    case "PermissionDenied":
      return `Permission denied for ${error.operation} on: ${error.path}`;
    case "DirectoryNotFound":
      return `Directory not found: ${error.path}`;
    case "WriteError":
      return `Failed to write to ${error.path}${
        error.details ? `: ${error.details}` : ""
      }`;
    case "ReadError":
      return `Failed to read from ${error.path}${
        error.details ? `: ${error.details}` : ""
      }`;
    case "InvalidPath":
      return `Invalid file path: ${error.path}`;

    // External service errors
    case "NetworkError":
      return `Network error${error.url ? ` for ${error.url}` : ""}${
        error.details ? `: ${error.details}` : ""
      }`;
    case "AuthenticationError":
      return `Authentication failed for service: ${error.service}`;
    case "RateLimitExceeded":
      return `Rate limit exceeded for ${error.service}${
        error.retryAfter ? `, retry after ${error.retryAfter}s` : ""
      }`;
    case "ServiceUnavailable":
      return `Service unavailable: ${error.service}`;
    case "InvalidResponse":
      return `Invalid response from ${error.service}: ${
        JSON.stringify(error.response)
      }`;
    case "ConfigurationMissing":
      return `Missing configuration for ${error.service}: ${
        error.requiredConfig.join(", ")
      }`;

    default:
      return "Unknown error occurred";
  }
};

// Result utility functions for common operations

// Map over successful results
export const mapResult = <T, U, E>(
  result: Result<T, E>,
  mapper: (data: T) => U,
): Result<U, E> => {
  if (result.ok) {
    return { ok: true, data: mapper(result.data) };
  }
  return result;
};

// FlatMap for chaining Result-returning operations
export const flatMapResult = <T, U, E>(
  result: Result<T, E>,
  mapper: (data: T) => Result<U, E>,
): Result<U, E> => {
  if (result.ok) {
    return mapper(result.data);
  }
  return result;
};

// Handle errors and provide fallback values
export const mapErrorResult = <
  T,
  E1 extends { message: string },
  E2 extends { message: string },
>(
  result: Result<T, E1>,
  errorMapper: (error: E1) => E2,
): Result<T, E2> => {
  if (result.ok) {
    return result;
  }
  return { ok: false, error: errorMapper(result.error) };
};

// Combine multiple Results into one
export const combineResults = <T, E>(
  results: Result<T, E>[],
): Result<T[], E> => {
  const data: T[] = [];

  for (const result of results) {
    if (!result.ok) {
      return result;
    }
    data.push(result.data);
  }

  return { ok: true, data };
};

// Get data or throw error (for migration from partial functions)
export const unwrapResult = <T, E>(result: Result<T, E>): T => {
  if (result.ok) {
    return result.data;
  }
  const error = result.error;
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : JSON.stringify(error);
  throw new Error(message);
};

// Get data or provide default value
export const unwrapOrResult = <T, E>(
  result: Result<T, E>,
  defaultValue: T,
): T => {
  if (result.ok) {
    return result.data;
  }
  return defaultValue;
};

// Legacy ResultUtils for backward compatibility
export const ResultUtils = {
  unwrap: unwrapResult,
  map: mapResult,
  flatMap: flatMapResult,
  mapError: mapErrorResult,
  combine: combineResults,
  unwrapOr: unwrapOrResult,

  // Additional legacy functions
  chain: <T, U, E>(
    result: Result<T, E>,
    fn: (data: T) => Result<U, E>,
  ): Result<U, E> => flatMapResult(result, fn),

  all: <T, E>(results: Result<T, E>[]): Result<T[], E> =>
    combineResults(results),
};

// Type guard for checking success
export const isSuccess = <T, E>(
  result: Result<T, E>,
): result is { ok: true; data: T } => {
  return result.ok;
};

// Type guard for checking failure
export const isFailure = <T, E extends { message: string }>(
  result: Result<T, E>,
): result is { ok: false; error: E } => {
  return !result.ok;
};

// Aliases for compatibility with shared/result.ts
export const isOk = isSuccess;
export const isError = isFailure;
