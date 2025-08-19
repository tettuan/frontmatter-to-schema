export interface ValidationError {
  kind: "ValidationError";
  message: string;
  field?: string;
  value?: unknown;
}

export interface ProcessingError {
  kind: "ProcessingError";
  message: string;
  cause?: Error;
}

export interface IOError {
  kind: "IOError";
  message: string;
  path?: string;
  operation?: "read" | "write" | "delete";
}

export interface APIError {
  kind: "APIError";
  message: string;
  statusCode?: number;
  response?: unknown;
}

export interface ConfigurationError {
  kind: "ConfigurationError";
  message: string;
  field?: string;
}

export type DomainError =
  | ValidationError
  | ProcessingError
  | IOError
  | APIError
  | ConfigurationError;

export function createValidationError(
  message: string,
  field?: string,
  value?: unknown,
): ValidationError {
  return {
    kind: "ValidationError",
    message,
    field,
    value,
  };
}

export function createProcessingError(
  message: string,
  cause?: Error,
): ProcessingError {
  return {
    kind: "ProcessingError",
    message,
    cause,
  };
}

export function createIOError(
  message: string,
  path?: string,
  operation?: "read" | "write" | "delete",
): IOError {
  return {
    kind: "IOError",
    message,
    path,
    operation,
  };
}

export function createAPIError(
  message: string,
  statusCode?: number,
  response?: unknown,
): APIError {
  return {
    kind: "APIError",
    message,
    statusCode,
    response,
  };
}

export function createConfigurationError(
  message: string,
  field?: string,
): ConfigurationError {
  return {
    kind: "ConfigurationError",
    message,
    field,
  };
}

export function errorToString(error: DomainError): string {
  switch (error.kind) {
    case "ValidationError":
      return error.field
        ? `Validation error in field '${error.field}': ${error.message}`
        : `Validation error: ${error.message}`;
    case "ProcessingError":
      return error.cause
        ? `Processing error: ${error.message} (${error.cause.message})`
        : `Processing error: ${error.message}`;
    case "IOError":
      return error.path
        ? `IO error (${error.operation || "unknown"}) at '${error.path}': ${error.message}`
        : `IO error: ${error.message}`;
    case "APIError":
      return error.statusCode
        ? `API error (${error.statusCode}): ${error.message}`
        : `API error: ${error.message}`;
    case "ConfigurationError":
      return error.field
        ? `Configuration error in field '${error.field}': ${error.message}`
        : `Configuration error: ${error.message}`;
  }
}