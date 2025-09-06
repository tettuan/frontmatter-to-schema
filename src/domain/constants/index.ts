/**
 * Domain Constants - Centralized constants to avoid hardcoding
 * Following prohibit-hardcoding regulations
 */

// Error Kinds
export const ERROR_KINDS = {
  FILE_NOT_FOUND: "FileNotFound",
  READ_ERROR: "ReadError",
  NOT_PRESENT: "NotPresent",
  INVALID_FORMAT: "InvalidFormat",
  PARSE_ERROR: "ParseError",
  EMPTY_INPUT: "EmptyInput",
  NOT_CONFIGURED: "NotConfigured",
  SCHEMA_VALIDATION_FAILED: "SchemaValidationFailed",
  TEMPLATE_MAPPING_FAILED: "TemplateMappingFailed",
  PROCESSING_STAGE_ERROR: "ProcessingStageError",
  ALREADY_EXECUTED: "AlreadyExecuted",
  INVALID_STATE: "InvalidState",
} as const;

// Schema Types
export const SCHEMA_TYPES = {
  OBJECT: "object",
  STRING: "string",
  NUMBER: "number",
  BOOLEAN: "boolean",
  ARRAY: "array",
} as const;

// Command Fields
export const COMMAND_FIELDS = {
  C1: "c1",
  C2: "c2",
  C3: "c3",
  TITLE: "title",
  DESCRIPTION: "description",
  USAGE: "usage",
  OPTIONS: "options",
} as const;

// Default Values
export const DEFAULT_VALUES = {
  SCHEMA_VERSION: "1.0.0",
  REGISTRY_DESCRIPTION: "Climpt Command Registry",
} as const;

// File Patterns
export const FILE_PATTERNS = {
  MARKDOWN: "\\.md$",
  JSON: "\\.json$",
  YAML: "\\.ya?ml$",
  HANDLEBARS: "\\.hbs$",
} as const;

// Output Formats
export const OUTPUT_FORMATS = {
  JSON: "json",
  YAML: "yaml",
  XML: "xml",
  CSV: "csv",
} as const;

// Schema IDs
export const SCHEMA_IDS = {
  CLI_REGISTRY: "cli-registry-schema",
  MAIN_SCHEMA: "main-schema",
} as const;

// Extraction Result Kinds
export const EXTRACTION_KINDS = {
  EXTRACTED: "Extracted",
  NOT_PRESENT: "NotPresent",
  PRESENT: "Present",
  PARSE_ERROR: "ParseError",
  INVALID_FORMAT: "InvalidFormat",
} as const;

// Type guard for error kinds
export type ErrorKind = typeof ERROR_KINDS[keyof typeof ERROR_KINDS];

// Type guard for schema types
export type SchemaType = typeof SCHEMA_TYPES[keyof typeof SCHEMA_TYPES];

// Type guard for command fields
export type CommandField = typeof COMMAND_FIELDS[keyof typeof COMMAND_FIELDS];

// Type guard for output formats
export type OutputFormat = typeof OUTPUT_FORMATS[keyof typeof OUTPUT_FORMATS];

// Type guard for extraction kinds
export type ExtractionKind =
  typeof EXTRACTION_KINDS[keyof typeof EXTRACTION_KINDS];
