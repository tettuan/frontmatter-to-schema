// Centralized error messages following DDD principles

import { DEFAULT_ERROR_CONTEXT_LIMIT } from "./constants.ts";

export const ErrorMessages = {
  // Validation errors
  EMPTY_INPUT: "Input cannot be empty",
  INVALID_FORMAT: (format: string, input: string) =>
    `Invalid format, expected ${format}, got: ${input}`,
  PATTERN_MISMATCH: (pattern: string, input: string) =>
    `Input does not match pattern ${pattern}: ${input}`,
  OUT_OF_RANGE: (value: unknown, min?: number, max?: number) => {
    if (min !== undefined && max !== undefined) {
      return `Value ${value} is out of range [${min}, ${max}]`;
    }
    if (min !== undefined) {
      return `Value ${value} is below minimum ${min}`;
    }
    if (max !== undefined) {
      return `Value ${value} exceeds maximum ${max}`;
    }
    return `Value ${value} is out of range`;
  },
  INVALID_PATH: (path: string, reason: string) =>
    `Invalid path: ${path} - ${reason}`,
  SCHEMA_VALIDATION: (errors: unknown[]) =>
    `Schema validation failed with ${errors.length} error(s)`,
  TEMPLATE_VALIDATION: (errors: unknown[]) =>
    `Template validation failed with ${errors.length} error(s)`,

  // Processing errors
  EXTRACTION_FAILED: (document: string, reason: string) =>
    `Failed to extract frontmatter from ${document}: ${reason}`,
  ANALYSIS_FAILED: (document: string, reason: string) =>
    `Failed to analyze document ${document}: ${reason}`,
  MAPPING_FAILED: (document: string, reason: string) =>
    `Failed to map document ${document}: ${reason}`,
  AGGREGATION_FAILED: (reason: string) =>
    `Failed to aggregate results: ${reason}`,
  CONFIGURATION_INVALID: (errors: unknown[]) =>
    `Configuration is invalid with ${errors.length} error(s)`,

  // IO errors
  FILE_NOT_FOUND: (path: string) => `File not found: ${path}`,
  PERMISSION_DENIED: (path: string) => `Permission denied: ${path}`,
  READ_ERROR: (path: string, reason: string) =>
    `Failed to read ${path}: ${reason}`,
  WRITE_ERROR: (path: string, reason: string) =>
    `Failed to write to ${path}: ${reason}`,

  // AI errors
  PROMPT_TOO_LONG: (length: number, maxLength: number) =>
    `Prompt length ${length} exceeds maximum ${maxLength}`,
  API_ERROR: (message: string, code?: string) =>
    code ? `API error (${code}): ${message}` : `API error: ${message}`,
  RATE_LIMITED: (retryAfter?: number) =>
    retryAfter
      ? `Rate limited, retry after ${retryAfter} seconds`
      : "Rate limited, please try again later",
  INVALID_RESPONSE: (response: string) =>
    `Invalid AI response: ${
      DEFAULT_ERROR_CONTEXT_LIMIT.truncateContent(response)
    }`,

  // Domain-specific errors
  SCHEMA_FILE_NOT_FOUND: (path: string) => `Schema file not found: ${path}`,
  TEMPLATE_FILE_NOT_FOUND: (path: string) => `Template file not found: ${path}`,
  INVALID_JSON_IN_SCHEMA: (path: string, error: string) =>
    `Failed to parse schema JSON from ${path}: ${error}`,
  INVALID_SCHEMA_ID: "Schema contains invalid ID field",
  INVALID_SCHEMA_DEFINITION: "Schema structure is invalid",
  INVALID_SCHEMA_VERSION: "Schema version format is invalid",
  INVALID_TEMPLATE_ID: "Template contains invalid ID field",
  INVALID_TEMPLATE_FORMAT: "Template format is invalid",
  NO_FRONTMATTER_FOUND: (document: string) =>
    `No frontmatter found in ${document}`,
  DOCUMENTS_DIR_NOT_FOUND: (path: string) =>
    `Documents directory not found: ${path}`,
  FAILED_TO_FIND_DOCUMENTS: (path: string, reason: string) =>
    `Failed to find documents in ${path}: ${reason}`,
  FAILED_TO_LOAD_SCHEMA: (path: string, reason: string) =>
    `Failed to load schema from ${path}: ${reason}`,
  FAILED_TO_LOAD_TEMPLATE: (path: string, reason: string) =>
    `Failed to load template from ${path}: ${reason}`,
  UNEXPECTED_ERROR: (context: string, error: string) =>
    `Unexpected error in ${context}: ${error}`,
} as const;

export type ErrorMessageKey = keyof typeof ErrorMessages;

export type ErrorCode =
  // Validation
  | "VAL001" // Empty input
  | "VAL002" // Invalid format
  | "VAL003" // Pattern mismatch
  | "VAL004" // Out of range
  | "VAL005" // Invalid path
  | "VAL006" // Schema validation
  | "VAL007" // Template validation
  // Processing
  | "PRO001" // Extraction failed
  | "PRO002" // Analysis failed
  | "PRO003" // Mapping failed
  | "PRO004" // Aggregation failed
  | "PRO005" // Configuration invalid
  // IO
  | "IO001" // File not found
  | "IO002" // Permission denied
  | "IO003" // Read error
  | "IO004" // Write error
  // AI
  | "AI001" // Prompt too long
  | "AI002" // API error
  | "AI003" // Rate limited
  | "AI004" // Invalid response
  // Domain
  | "DOM001" // Schema file not found
  | "DOM002" // Template file not found
  | "DOM003" // Invalid JSON in schema
  | "DOM004" // Invalid schema ID
  | "DOM005" // Invalid schema definition
  | "DOM006" // Invalid schema version
  | "DOM007" // Invalid template ID
  | "DOM008" // Invalid template format
  | "DOM009" // No frontmatter found
  | "DOM010" // Documents directory not found
  | "DOM011" // Failed to find documents
  | "DOM012" // Failed to load schema
  | "DOM013" // Failed to load template
  | "DOM999"; // Unexpected error

export const ErrorCodeMap: Record<string, ErrorCode> = {
  ValidationError: "VAL001",
  EmptyInput: "VAL001",
  InvalidFormat: "VAL002",
  PatternMismatch: "VAL003",
  OutOfRange: "VAL004",
  InvalidPath: "VAL005",
  SchemaValidation: "VAL006",
  TemplateValidation: "VAL007",
  ExtractionFailed: "PRO001",
  AnalysisFailed: "PRO002",
  MappingFailed: "PRO003",
  AggregationFailed: "PRO004",
  ConfigurationInvalid: "PRO005",
  FileNotFound: "IO001",
  PermissionDenied: "IO002",
  ReadError: "IO003",
  WriteError: "IO004",
  PromptTooLong: "AI001",
  APIError: "AI002",
  RateLimited: "AI003",
  InvalidResponse: "AI004",
} as const;

export function getErrorCode(errorKind: string): ErrorCode {
  return ErrorCodeMap[errorKind] || "DOM999";
}

export function formatErrorMessage(
  code: ErrorCode,
  ...args: unknown[]
): string {
  const baseMessage = getBaseMessage(code, args);
  return `[${code}] ${baseMessage}`;
}

function getBaseMessage(code: ErrorCode, args: unknown[]): string {
  switch (code) {
    case "VAL001":
      return ErrorMessages.EMPTY_INPUT;
    case "VAL002":
      return ErrorMessages.INVALID_FORMAT(
        String(args[0]),
        String(args[1]),
      );
    case "VAL003":
      return ErrorMessages.PATTERN_MISMATCH(
        String(args[0]),
        String(args[1]),
      );
    case "VAL004":
      return ErrorMessages.OUT_OF_RANGE(
        args[0],
        args[1] as number | undefined,
        args[2] as number | undefined,
      );
    case "VAL005":
      return ErrorMessages.INVALID_PATH(
        String(args[0]),
        String(args[1]),
      );
    case "VAL006":
      return ErrorMessages.SCHEMA_VALIDATION(args[0] as unknown[]);
    case "VAL007":
      return ErrorMessages.TEMPLATE_VALIDATION(args[0] as unknown[]);
    case "PRO001":
      return ErrorMessages.EXTRACTION_FAILED(
        String(args[0]),
        String(args[1]),
      );
    case "PRO002":
      return ErrorMessages.ANALYSIS_FAILED(
        String(args[0]),
        String(args[1]),
      );
    case "PRO003":
      return ErrorMessages.MAPPING_FAILED(
        String(args[0]),
        String(args[1]),
      );
    case "PRO004":
      return ErrorMessages.AGGREGATION_FAILED(String(args[0]));
    case "PRO005":
      return ErrorMessages.CONFIGURATION_INVALID(args[0] as unknown[]);
    case "IO001":
      return ErrorMessages.FILE_NOT_FOUND(String(args[0]));
    case "IO002":
      return ErrorMessages.PERMISSION_DENIED(String(args[0]));
    case "IO003":
      return ErrorMessages.READ_ERROR(
        String(args[0]),
        String(args[1]),
      );
    case "IO004":
      return ErrorMessages.WRITE_ERROR(
        String(args[0]),
        String(args[1]),
      );
    case "AI001":
      return ErrorMessages.PROMPT_TOO_LONG(
        Number(args[0]),
        Number(args[1]),
      );
    case "AI002":
      return ErrorMessages.API_ERROR(
        String(args[0]),
        args[1] as string | undefined,
      );
    case "AI003":
      return ErrorMessages.RATE_LIMITED(args[0] as number | undefined);
    case "AI004":
      return ErrorMessages.INVALID_RESPONSE(String(args[0]));
    case "DOM001":
      return ErrorMessages.SCHEMA_FILE_NOT_FOUND(String(args[0]));
    case "DOM002":
      return ErrorMessages.TEMPLATE_FILE_NOT_FOUND(String(args[0]));
    case "DOM003":
      return ErrorMessages.INVALID_JSON_IN_SCHEMA(
        String(args[0]),
        String(args[1]),
      );
    case "DOM004":
      return ErrorMessages.INVALID_SCHEMA_ID;
    case "DOM005":
      return ErrorMessages.INVALID_SCHEMA_DEFINITION;
    case "DOM006":
      return ErrorMessages.INVALID_SCHEMA_VERSION;
    case "DOM007":
      return ErrorMessages.INVALID_TEMPLATE_ID;
    case "DOM008":
      return ErrorMessages.INVALID_TEMPLATE_FORMAT;
    case "DOM009":
      return ErrorMessages.NO_FRONTMATTER_FOUND(String(args[0]));
    case "DOM010":
      return ErrorMessages.DOCUMENTS_DIR_NOT_FOUND(String(args[0]));
    case "DOM011":
      return ErrorMessages.FAILED_TO_FIND_DOCUMENTS(
        String(args[0]),
        String(args[1]),
      );
    case "DOM012":
      return ErrorMessages.FAILED_TO_LOAD_SCHEMA(
        String(args[0]),
        String(args[1]),
      );
    case "DOM013":
      return ErrorMessages.FAILED_TO_LOAD_TEMPLATE(
        String(args[0]),
        String(args[1]),
      );
    case "DOM999":
      return ErrorMessages.UNEXPECTED_ERROR(
        String(args[0]),
        String(args[1]),
      );
    default:
      return `Unknown error code: ${code}`;
  }
}
