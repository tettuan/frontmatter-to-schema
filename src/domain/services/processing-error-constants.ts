/**
 * Processing Error Constants
 *
 * Type-safe constants for processing resource service error handling.
 * Eliminates hardcoded strings in error type checks.
 * Follows Totality principles with discriminated unions.
 */

/**
 * Domain Error Kinds as const
 */
export const DOMAIN_ERROR_KINDS = {
  FILE_NOT_FOUND: "FileNotFound",
  READ_ERROR: "ReadError",
  WRITE_ERROR: "WriteError",
  VALIDATION_ERROR: "ValidationError",
  INVALID_STATE: "InvalidState",
  TEMPLATE_ERROR: "TemplateError",
  SCHEMA_ERROR: "SchemaError",
} as const;

/**
 * Type for domain error kind values
 */
export type DomainErrorKind =
  typeof DOMAIN_ERROR_KINDS[keyof typeof DOMAIN_ERROR_KINDS];

/**
 * Processing Result Kinds as const
 */
export const PROCESSING_RESULT_KINDS = {
  SUCCESS: "Success",
  FAILED: "Failed",
  PARTIAL: "Partial",
} as const;

/**
 * Type for processing result kind values
 */
export type ProcessingResultKind =
  typeof PROCESSING_RESULT_KINDS[keyof typeof PROCESSING_RESULT_KINDS];

/**
 * Type guard for checking if an error is of a specific kind
 */
export function isErrorKind(
  error: { kind: string },
  kind: DomainErrorKind,
): boolean {
  return error.kind === kind;
}
