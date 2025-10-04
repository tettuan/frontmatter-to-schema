/**
 * Error types for YAML Schema Mapper
 *
 * This module provides error classes for various mapping and validation failures.
 */

/**
 * Base error class for mapper errors
 */
export class MapperError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly path?: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "MapperError";
  }
}

/**
 * Error for property mapping failures
 */
export class PropertyMappingError extends MapperError {
  constructor(
    message: string,
    path: string,
    details?: Record<string, unknown>,
  ) {
    super(message, "PROPERTY_MAPPING_ERROR", path, details);
    this.name = "PropertyMappingError";
  }
}

/**
 * Error for type transformation failures
 */
export class TypeTransformationError extends MapperError {
  constructor(
    message: string,
    path: string,
    details?: Record<string, unknown>,
  ) {
    super(message, "TYPE_TRANSFORMATION_ERROR", path, details);
    this.name = "TypeTransformationError";
  }
}

/**
 * Error for validation failures
 */
export class ValidationError extends MapperError {
  constructor(
    message: string,
    path: string,
    details?: Record<string, unknown>,
  ) {
    super(message, "VALIDATION_ERROR", path, details);
    this.name = "ValidationError";
  }
}

/**
 * Error for circular reference detection
 */
export class CircularReferenceError extends MapperError {
  constructor(path: string, depth: number) {
    super(
      `Circular reference detected at path: ${path} (depth: ${depth})`,
      "CIRCULAR_REFERENCE_ERROR",
      path,
      { depth },
    );
    this.name = "CircularReferenceError";
  }
}

/**
 * Error for schema parsing/structure issues
 */
export class SchemaError extends MapperError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "SCHEMA_ERROR", undefined, details);
    this.name = "SchemaError";
  }
}
