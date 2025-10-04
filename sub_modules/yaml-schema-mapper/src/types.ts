/**
 * Core types for YAML Schema Mapper
 *
 * This module provides type definitions for the mapper configuration,
 * results, and warnings system.
 */

/**
 * JSON Schema property definition
 */
export interface SchemaProperty {
  type?: string | string[];
  items?: SchemaProperty | SchemaProperty[];
  properties?: Record<string, SchemaProperty>;
  required?: string[];
  enum?: unknown[];
  pattern?: string;
  "x-map-from"?: string | string[];
  additionalProperties?: boolean | SchemaProperty;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  [key: string]: unknown;
}

/**
 * JSON Schema definition (JSON Schema Draft 7 compatible)
 */
export interface JsonSchema {
  type?: string | string[];
  properties?: Record<string, SchemaProperty>;
  required?: string[];
  additionalProperties?: boolean | SchemaProperty;
  [key: string]: unknown;
}

/**
 * Warning severity levels
 */
export type WarningSeverity = "info" | "warning" | "error";

/**
 * Warning codes for different types of issues
 */
export enum WarningCode {
  // Property mapping
  PROPERTY_AMBIGUOUS = "PROPERTY_AMBIGUOUS",
  PROPERTY_NOT_IN_SCHEMA = "PROPERTY_NOT_IN_SCHEMA",
  EMOJI_PROPERTY = "EMOJI_PROPERTY",
  UNICODE_NORMALIZATION = "UNICODE_NORMALIZATION",
  EMPTY_PROPERTY_NAME = "EMPTY_PROPERTY_NAME",

  // Type transformation
  TYPE_COERCION = "TYPE_COERCION",
  DATA_LOSS = "DATA_LOSS",
  PRECISION_LOSS = "PRECISION_LOSS",
  NAN_CONVERSION = "NAN_CONVERSION",

  // Structure
  DEPTH_LIMIT = "DEPTH_LIMIT",
  CIRCULAR_REFERENCE = "CIRCULAR_REFERENCE",

  // Validation
  ADDITIONAL_PROPERTY = "ADDITIONAL_PROPERTY",
}

/**
 * Warning details for transformations
 */
export interface WarningDetails {
  originalValue?: unknown;
  transformedValue?: unknown;
  suggestion?: string;
  candidates?: string[];
  currentDepth?: number;
  maxDepth?: number;
}

/**
 * Mapping warning information
 */
export interface MappingWarning {
  code: WarningCode;
  message: string;
  path: string;
  severity: WarningSeverity;
  details?: WarningDetails;
}

/**
 * Mapper configuration options
 */
export interface MapperOptions {
  /**
   * Strict mode: Reject additional properties not in schema
   * Default: false
   */
  strict?: boolean;

  /**
   * Validate types against schema
   * Default: true
   */
  validateTypes?: boolean;

  /**
   * Apply type coercion (e.g., array to single value)
   * Default: true
   */
  coerceTypes?: boolean;

  /**
   * Maximum nesting depth (warn if exceeded)
   * Default: 20
   */
  maxDepth?: number;

  /**
   * Warn on data loss transformations (object → string, etc.)
   * Default: true
   */
  warnOnDataLoss?: boolean;

  /**
   * Unicode normalization (for property name matching)
   * Default: "none"
   */
  unicodeNormalization?: "NFC" | "NFD" | "none";
}

/**
 * Mapper configuration
 */
export interface MapperConfig {
  /**
   * JSON Schema object (JSON Schema Draft 7)
   */
  schema: JsonSchema;

  /**
   * Raw data to transform (e.g., parsed YAML frontmatter)
   */
  data: Record<string, unknown>;

  /**
   * Options for transformation behavior
   */
  options?: MapperOptions;
}

/**
 * Transformation metadata
 */
export interface TransformationMetadata {
  propertiesMapped: number;
  typesCoerced: number;
  propertiesDropped: number;
}

/**
 * Mapper result
 */
export interface MapperResult {
  /**
   * Transformed data conforming to schema
   */
  data: Record<string, unknown>;

  /**
   * Validation/transformation warnings (non-fatal)
   */
  warnings: MappingWarning[];

  /**
   * Metadata about transformations applied
   */
  metadata: TransformationMetadata;
}
