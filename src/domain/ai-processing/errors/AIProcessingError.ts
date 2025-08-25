/**
 * AI Processing Errors - Totality-based error handling
 * Complete replacement for claude -p error scenarios
 */

/**
 * Comprehensive AI Processing Error types following Totality principle
 * Each error case is explicitly handled with specific recovery strategies
 */
export type AIProcessingError =
  | NetworkError
  | APIError
  | ValidationError
  | BusinessLogicError;

/**
 * Network-related errors
 */
export type NetworkError = {
  readonly kind: 'NetworkError';
  readonly details: {
    readonly code: string;
    readonly message: string;
    readonly retryable: boolean;
  };
  readonly traceId: string;
  readonly timestamp: string;
};

/**
 * Claude API specific errors
 */
export type APIError = 
  | APIRateLimitError
  | APIAuthError
  | APIServerError
  | APITimeoutError
  | InvalidResponseFormatError;

export type APIRateLimitError = {
  readonly kind: 'APIRateLimitError';
  readonly retryAfter: number;
  readonly requestsRemaining: number;
  readonly resetTime: string;
  readonly traceId: string;
  readonly requestId: string;
};

export type APIAuthError = {
  readonly kind: 'APIAuthError';
  readonly statusCode: 401 | 403;
  readonly message: string;
  readonly traceId: string;
  readonly requestId: string;
};

export type APIServerError = {
  readonly kind: 'APIServerError';
  readonly statusCode: number;
  readonly message: string;
  readonly retryable: boolean;
  readonly traceId: string;
  readonly requestId: string;
};

export type APITimeoutError = {
  readonly kind: 'APITimeoutError';
  readonly timeoutMs: number;
  readonly operation: string;
  readonly traceId: string;
};

/**
 * Validation and format errors
 */
export type ValidationError = 
  | InvalidRequestFormatError
  | InvalidResponseFormatError
  | SchemaValidationError;

export type InvalidRequestFormatError = {
  readonly kind: 'InvalidRequestFormat';
  readonly received: unknown;
  readonly expected: string;
  readonly field: string;
  readonly traceId: string;
};

export type InvalidResponseFormatError = {
  readonly kind: 'InvalidResponseFormat';
  readonly received: unknown;
  readonly expected: string;
  readonly traceId: string;
  readonly requestId: string;
};

export type SchemaValidationError = {
  readonly kind: 'SchemaValidationError';
  readonly schemaName: string;
  readonly data: unknown;
  readonly validationErrors: ValidationErrorDetail[];
  readonly traceId: string;
};

export interface ValidationErrorDetail {
  readonly path: string;
  readonly message: string;
  readonly expectedType: string;
  readonly actualType: string;
}

/**
 * Business logic and processing errors
 */
export type BusinessLogicError = 
  | PromptRenderingError
  | TemplateApplicationError
  | CircuitBreakerOpenError
  | ConfigurationError;

export type PromptRenderingError = {
  readonly kind: 'PromptRenderingError';
  readonly template: string;
  readonly variables: Record<string, unknown>;
  readonly missingVariables: string[];
  readonly traceId: string;
};

export type TemplateApplicationError = {
  readonly kind: 'TemplateApplicationError';
  readonly templateName: string;
  readonly inputData: unknown;
  readonly errorDetails: string;
  readonly traceId: string;
};

export type CircuitBreakerOpenError = {
  readonly kind: 'CircuitBreakerOpen';
  readonly serviceName: string;
  readonly failureCount: number;
  readonly nextRetryTime: string;
  readonly traceId: string;
};

export type ConfigurationError = {
  readonly kind: 'ConfigurationError';
  readonly configKey: string;
  readonly expectedFormat: string;
  readonly actualValue: unknown;
  readonly traceId: string;
};

/**
 * Error utility functions for creating specific error types
 */
export function createNetworkError(
  code: string,
  message: string,
  retryable: boolean,
  traceId: string
): NetworkError {
  return {
    kind: 'NetworkError',
    details: { code, message, retryable },
    traceId,
    timestamp: new Date().toISOString()
  };
}

export function createAPIRateLimitError(
  retryAfter: number,
  requestsRemaining: number,
  resetTime: string,
  traceId: string,
  requestId: string
): APIRateLimitError {
  return {
    kind: 'APIRateLimitError',
    retryAfter,
    requestsRemaining,
    resetTime,
    traceId,
    requestId
  };
}

export function createSchemaValidationError(
  schemaName: string,
  data: unknown,
  validationErrors: ValidationErrorDetail[],
  traceId: string
): SchemaValidationError {
  return {
    kind: 'SchemaValidationError',
    schemaName,
    data,
    validationErrors,
    traceId
  };
}

export function createPromptRenderingError(
  template: string,
  variables: Record<string, unknown>,
  missingVariables: string[],
  traceId: string
): PromptRenderingError {
  return {
    kind: 'PromptRenderingError',
    template,
    variables,
    missingVariables,
    traceId
  };
}

/**
 * Error message formatter for logging and debugging
 */
export function formatErrorMessage(error: AIProcessingError): string {
  switch (error.kind) {
    case 'NetworkError':
      return `Network error: ${error.details.message} (code: ${error.details.code}, retryable: ${error.details.retryable})`;
    
    case 'APIRateLimitError':
      return `API rate limit exceeded. Retry after ${error.retryAfter}s. Requests remaining: ${error.requestsRemaining}`;
    
    case 'APIAuthError':
      return `API authentication failed (${error.statusCode}): ${error.message}`;
    
    case 'APIServerError':
      return `API server error (${error.statusCode}): ${error.message}. Retryable: ${error.retryable}`;
    
    case 'APITimeoutError':
      return `API timeout after ${error.timeoutMs}ms for operation: ${error.operation}`;
    
    case 'InvalidRequestFormat':
      return `Invalid request format for field '${error.field}'. Expected: ${error.expected}`;
    
    case 'InvalidResponseFormat':
      return `Invalid response format. Expected: ${error.expected}`;
    
    case 'SchemaValidationError':
      const errorDetails = error.validationErrors.map(e => `${e.path}: ${e.message}`).join(', ');
      return `Schema validation failed for '${error.schemaName}': ${errorDetails}`;
    
    case 'PromptRenderingError':
      return `Prompt rendering failed. Missing variables: ${error.missingVariables.join(', ')}`;
    
    case 'TemplateApplicationError':
      return `Template application failed for '${error.templateName}': ${error.errorDetails}`;
    
    case 'CircuitBreakerOpen':
      return `Circuit breaker open for '${error.serviceName}'. Failures: ${error.failureCount}. Next retry: ${error.nextRetryTime}`;
    
    case 'ConfigurationError':
      return `Configuration error for '${error.configKey}'. Expected: ${error.expectedFormat}`;
    
    default:
      // Totality check - ensures all error types are handled
      const _exhaustive: never = error;
      return `Unknown error type: ${_exhaustive}`;
  }
}

/**
 * Determines if an error is retryable based on its type and properties
 */
export function isRetryableError(error: AIProcessingError): boolean {
  switch (error.kind) {
    case 'NetworkError':
      return error.details.retryable;
    
    case 'APIRateLimitError':
      return true; // Can retry after rate limit period
    
    case 'APIAuthError':
      return false; // Authentication issues require manual intervention
    
    case 'APIServerError':
      return error.retryable;
    
    case 'APITimeoutError':
      return true; // Timeouts are generally retryable
    
    case 'InvalidRequestFormat':
    case 'InvalidResponseFormat':
    case 'SchemaValidationError':
    case 'PromptRenderingError':
    case 'TemplateApplicationError':
    case 'ConfigurationError':
      return false; // Logic errors require code fixes
    
    case 'CircuitBreakerOpen':
      return false; // Must wait for circuit breaker to close
    
    default:
      const _exhaustive: never = error;
      return false;
  }
}

/**
 * Calculates retry delay in milliseconds based on error type
 */
export function getRetryDelayMs(error: AIProcessingError, attemptNumber: number): number {
  switch (error.kind) {
    case 'APIRateLimitError':
      return error.retryAfter * 1000; // Convert seconds to milliseconds
    
    case 'NetworkError':
    case 'APIServerError':
    case 'APITimeoutError':
      // Exponential backoff: 1s, 2s, 4s, 8s, 16s (max)
      return Math.min(1000 * Math.pow(2, attemptNumber), 16000);
    
    default:
      return 0; // No retry for non-retryable errors
  }
}