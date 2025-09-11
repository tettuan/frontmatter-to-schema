/**
 * Application Constants with Smart Constructors
 *
 * Following DDD and Totality principles to eliminate hardcoded magic numbers
 * and ensure type-safe configuration values throughout the application.
 *
 * Addresses Issue #639: Magic Number Hardcoding
 */

import type { Result } from "../core/result.ts";

/**
 * Business-meaningful default values for Smart Constructors
 * Centralized constants following DDD domain rules
 */

// Standard debug and error display limits
const STANDARD_DEBUG_OUTPUT_SIZE = 100;
const STANDARD_ERROR_CONTEXT_SIZE = 100;
const TEMPLATE_PREVIEW_SIZE = 100;

// Processing and validation limits
const STANDARD_NAME_LENGTH_SIZE = 100;
const STANDARD_PROCESSING_BATCH_SIZE = 100;
const STANDARD_FORMAT_PRIORITY_VALUE = 100;
const DOCUMENT_FORMAT_PRIORITY_VALUE = 50;
const VARIABLE_DESCRIPTION_MAX_LENGTH = 500;

// Format priority hierarchy for different categories and extensions
const SCHEMA_YAML_PRIMARY_PRIORITY = 90;
const SCHEMA_YML_SECONDARY_PRIORITY = 85;
const TEMPLATE_JSON_PRIORITY = 80;
const TEMPLATE_YAML_PRIORITY = 75;
const TEMPLATE_YML_PRIORITY = 70;
const OUTPUT_JSON_PRIORITY = 70;
const OUTPUT_YAML_PRIORITY = 65;
const OUTPUT_TOML_PRIORITY = 60;

// Schema reference resolution depth
const STANDARD_REF_RESOLUTION_DEPTH = 100;

// Application processing limits for different modes
const STRICT_MODE_MAX_FILES = 1000;
const PERFORMANCE_MODE_MAX_FILES = 10000;
const ABSOLUTE_MAX_FILES_LIMIT = 50000;

// File pattern matching limits
const PATTERN_LENGTH_LIMIT_SIZE = 1000;

/**
 * Common validation error types for constants
 */
export type ConstantValidationError =
  | {
    kind: "OutOfRange";
    value: number;
    min?: number;
    max?: number;
    message: string;
  }
  | { kind: "EmptyInput"; message: string }
  | { kind: "InvalidValue"; value: unknown; message: string };

/**
 * Helper to create validation errors with consistent messaging
 */
const createError = (error: ConstantValidationError): ConstantValidationError =>
  error;

/**
 * Debug output truncation limit for error messages and logging
 * Ensures error messages remain readable while preventing excessive output
 */
export class DebugOutputLimit {
  private constructor(private readonly value: number) {}

  static create(
    limit: number,
  ): Result<DebugOutputLimit, ConstantValidationError> {
    if (limit < 0) {
      return {
        ok: false,
        error: createError({
          kind: "OutOfRange",
          value: limit,
          min: 0,
          message: "Debug output limit must be non-negative",
        }),
      };
    }
    if (limit > 10000) {
      return {
        ok: false,
        error: createError({
          kind: "OutOfRange",
          value: limit,
          max: 10000,
          message: "Debug output limit too large (max 10000 characters)",
        }),
      };
    }
    return { ok: true, data: new DebugOutputLimit(limit) };
  }

  getValue(): number {
    return this.value;
  }

  toString(): string {
    return this.value.toString();
  }
}

/**
 * Format detection priority for file type determination
 * Higher numbers indicate higher priority in format detection
 */
export class FormatPriority {
  private constructor(private readonly value: number) {}

  static create(
    priority: number,
  ): Result<FormatPriority, ConstantValidationError> {
    if (priority < 0 || priority > 1000) {
      return {
        ok: false,
        error: createError({
          kind: "OutOfRange",
          value: priority,
          min: 0,
          max: 1000,
          message: "Format priority must be between 0 and 1000",
        }),
      };
    }
    return { ok: true, data: new FormatPriority(priority) };
  }

  getValue(): number {
    return this.value;
  }

  toString(): string {
    return this.value.toString();
  }

  isHigherThan(other: FormatPriority): boolean {
    return this.value > other.value;
  }
}

/**
 * Maximum recursion depth for various processing operations
 * Prevents infinite loops and stack overflow in recursive operations
 */
export class MaxDepthLimit {
  private constructor(private readonly value: number) {}

  static create(depth: number): Result<MaxDepthLimit, ConstantValidationError> {
    if (depth < 1) {
      return {
        ok: false,
        error: createError({
          kind: "OutOfRange",
          value: depth,
          min: 1,
          message: "Maximum depth must be at least 1",
        }),
      };
    }
    if (depth > 1000) {
      return {
        ok: false,
        error: createError({
          kind: "OutOfRange",
          value: depth,
          max: 1000,
          message: "Maximum depth too large (max 1000 levels)",
        }),
      };
    }
    return { ok: true, data: new MaxDepthLimit(depth) };
  }

  getValue(): number {
    return this.value;
  }

  toString(): string {
    return this.value.toString();
  }

  isExceeded(currentDepth: number): boolean {
    return currentDepth > this.value;
  }
}

/**
 * Error context truncation limit for debugging and error messages
 * Used when displaying input content in error messages
 */
export class ErrorContextLimit {
  private constructor(private readonly value: number) {}

  static create(
    limit: number,
  ): Result<ErrorContextLimit, ConstantValidationError> {
    if (limit < 10) {
      return {
        ok: false,
        error: createError({
          kind: "OutOfRange",
          value: limit,
          min: 10,
          message: "Error context limit must be at least 10 characters",
        }),
      };
    }
    if (limit > 1000) {
      return {
        ok: false,
        error: createError({
          kind: "OutOfRange",
          value: limit,
          max: 1000,
          message: "Error context limit too large (max 1000 characters)",
        }),
      };
    }
    return { ok: true, data: new ErrorContextLimit(limit) };
  }

  getValue(): number {
    return this.value;
  }

  toString(): string {
    return this.value.toString();
  }

  truncateContent(content: string): string {
    if (content.length <= this.value) {
      return content;
    }
    return content.substring(0, this.value) + "...";
  }
}

/**
 * Name length validation limit for identifiers and rule names
 * Ensures reasonable naming conventions across the system
 */
export class NameLengthLimit {
  private constructor(private readonly value: number) {}

  static create(
    limit: number,
  ): Result<NameLengthLimit, ConstantValidationError> {
    if (limit < 1) {
      return {
        ok: false,
        error: createError({
          kind: "OutOfRange",
          value: limit,
          min: 1,
          message: "Name length limit must be at least 1",
        }),
      };
    }
    if (limit > 500) {
      return {
        ok: false,
        error: createError({
          kind: "OutOfRange",
          value: limit,
          max: 500,
          message: "Name length limit too large (max 500 characters)",
        }),
      };
    }
    return { ok: true, data: new NameLengthLimit(limit) };
  }

  getValue(): number {
    return this.value;
  }

  toString(): string {
    return this.value.toString();
  }

  isExceeded(name: string): boolean {
    return name.length > this.value;
  }
}

/**
 * Absolute maximum limits for system constraints
 * Higher limits than ProcessingLimit for extreme edge cases
 */
export class AbsoluteMaxLimit {
  private constructor(private readonly value: number) {}

  static create(
    limit: number,
  ): Result<AbsoluteMaxLimit, ConstantValidationError> {
    if (limit < 1) {
      return {
        ok: false,
        error: createError({
          kind: "OutOfRange",
          value: limit,
          min: 1,
          message: "Absolute maximum limit must be at least 1",
        }),
      };
    }
    if (limit > 100000) {
      return {
        ok: false,
        error: createError({
          kind: "OutOfRange",
          value: limit,
          max: 100000,
          message: "Absolute maximum limit too large (max 100000 items)",
        }),
      };
    }
    return { ok: true, data: new AbsoluteMaxLimit(limit) };
  }

  getValue(): number {
    return this.value;
  }

  toString(): string {
    return this.value.toString();
  }

  isExceeded(count: number): boolean {
    return count > this.value;
  }
}

/**
 * Processing concurrency and batch size limits
 * Controls system resource usage during processing operations
 */
export class ProcessingLimit {
  private constructor(private readonly value: number) {}

  static create(
    limit: number,
  ): Result<ProcessingLimit, ConstantValidationError> {
    if (limit < 1) {
      return {
        ok: false,
        error: createError({
          kind: "OutOfRange",
          value: limit,
          min: 1,
          message: "Processing limit must be at least 1",
        }),
      };
    }
    if (limit > 10000) {
      return {
        ok: false,
        error: createError({
          kind: "OutOfRange",
          value: limit,
          max: 10000,
          message: "Processing limit too large (max 10000 items)",
        }),
      };
    }
    return { ok: true, data: new ProcessingLimit(limit) };
  }

  getValue(): number {
    return this.value;
  }

  toString(): string {
    return this.value.toString();
  }

  isExceeded(count: number): boolean {
    return count > this.value;
  }
}

// ========================================
// Validated Default Constants
// ========================================

/**
 * Default debug output limit for content truncation in error messages
 * Used in frontmatter extraction and template rendering errors
 */
const DEFAULT_DEBUG_LIMIT_RESULT = DebugOutputLimit.create(
  STANDARD_DEBUG_OUTPUT_SIZE,
);
if (!DEFAULT_DEBUG_LIMIT_RESULT.ok) {
  throw new Error(
    `Failed to create DEFAULT_DEBUG_OUTPUT_LIMIT: ${DEFAULT_DEBUG_LIMIT_RESULT.error.message}`,
  );
}
export const DEFAULT_DEBUG_OUTPUT_LIMIT = DEFAULT_DEBUG_LIMIT_RESULT.data;

/**
 * Default format detection priority for standard file formats
 * Used when no specific priority is configured
 */
const DEFAULT_PRIORITY_RESULT = FormatPriority.create(
  STANDARD_FORMAT_PRIORITY_VALUE,
);
if (!DEFAULT_PRIORITY_RESULT.ok) {
  throw new Error(
    `Failed to create DEFAULT_FORMAT_PRIORITY: ${DEFAULT_PRIORITY_RESULT.error.message}`,
  );
}
export const DEFAULT_FORMAT_PRIORITY = DEFAULT_PRIORITY_RESULT.data;

/**
 * Document format priority for markdown and text-based formats
 * Lower priority than schema/template formats but still valid
 */
const DOCUMENT_PRIORITY_RESULT = FormatPriority.create(
  DOCUMENT_FORMAT_PRIORITY_VALUE,
);
if (!DOCUMENT_PRIORITY_RESULT.ok) {
  throw new Error(
    `Failed to create DOCUMENT_FORMAT_PRIORITY: ${DOCUMENT_PRIORITY_RESULT.error.message}`,
  );
}
export const DOCUMENT_FORMAT_PRIORITY = DOCUMENT_PRIORITY_RESULT.data;

/**
 * Schema format priorities for different extensions
 * Higher priorities for primary schema formats
 */
const SCHEMA_YAML_PRIMARY_RESULT = FormatPriority.create(
  SCHEMA_YAML_PRIMARY_PRIORITY,
);
if (!SCHEMA_YAML_PRIMARY_RESULT.ok) {
  throw new Error(
    `Failed to create SCHEMA_YAML_PRIMARY_FORMAT_PRIORITY: ${SCHEMA_YAML_PRIMARY_RESULT.error.message}`,
  );
}
export const SCHEMA_YAML_PRIMARY_FORMAT_PRIORITY =
  SCHEMA_YAML_PRIMARY_RESULT.data;

const SCHEMA_YML_SECONDARY_RESULT = FormatPriority.create(
  SCHEMA_YML_SECONDARY_PRIORITY,
);
if (!SCHEMA_YML_SECONDARY_RESULT.ok) {
  throw new Error(
    `Failed to create SCHEMA_YML_SECONDARY_FORMAT_PRIORITY: ${SCHEMA_YML_SECONDARY_RESULT.error.message}`,
  );
}
export const SCHEMA_YML_SECONDARY_FORMAT_PRIORITY =
  SCHEMA_YML_SECONDARY_RESULT.data;

/**
 * Template format priorities for different extensions
 * Balanced priorities for template processing formats
 */
const TEMPLATE_JSON_RESULT = FormatPriority.create(TEMPLATE_JSON_PRIORITY);
if (!TEMPLATE_JSON_RESULT.ok) {
  throw new Error(
    `Failed to create TEMPLATE_JSON_FORMAT_PRIORITY: ${TEMPLATE_JSON_RESULT.error.message}`,
  );
}
export const TEMPLATE_JSON_FORMAT_PRIORITY = TEMPLATE_JSON_RESULT.data;

const TEMPLATE_YAML_RESULT = FormatPriority.create(TEMPLATE_YAML_PRIORITY);
if (!TEMPLATE_YAML_RESULT.ok) {
  throw new Error(
    `Failed to create TEMPLATE_YAML_FORMAT_PRIORITY: ${TEMPLATE_YAML_RESULT.error.message}`,
  );
}
export const TEMPLATE_YAML_FORMAT_PRIORITY = TEMPLATE_YAML_RESULT.data;

const TEMPLATE_YML_RESULT = FormatPriority.create(TEMPLATE_YML_PRIORITY);
if (!TEMPLATE_YML_RESULT.ok) {
  throw new Error(
    `Failed to create TEMPLATE_YML_FORMAT_PRIORITY: ${TEMPLATE_YML_RESULT.error.message}`,
  );
}
export const TEMPLATE_YML_FORMAT_PRIORITY = TEMPLATE_YML_RESULT.data;

/**
 * Output format priorities for different extensions
 * Lower priorities for output-specific formats
 */
const OUTPUT_JSON_RESULT = FormatPriority.create(OUTPUT_JSON_PRIORITY);
if (!OUTPUT_JSON_RESULT.ok) {
  throw new Error(
    `Failed to create OUTPUT_JSON_FORMAT_PRIORITY: ${OUTPUT_JSON_RESULT.error.message}`,
  );
}
export const OUTPUT_JSON_FORMAT_PRIORITY = OUTPUT_JSON_RESULT.data;

const OUTPUT_YAML_RESULT = FormatPriority.create(OUTPUT_YAML_PRIORITY);
if (!OUTPUT_YAML_RESULT.ok) {
  throw new Error(
    `Failed to create OUTPUT_YAML_FORMAT_PRIORITY: ${OUTPUT_YAML_RESULT.error.message}`,
  );
}
export const OUTPUT_YAML_FORMAT_PRIORITY = OUTPUT_YAML_RESULT.data;

const OUTPUT_TOML_RESULT = FormatPriority.create(OUTPUT_TOML_PRIORITY);
if (!OUTPUT_TOML_RESULT.ok) {
  throw new Error(
    `Failed to create OUTPUT_TOML_FORMAT_PRIORITY: ${OUTPUT_TOML_RESULT.error.message}`,
  );
}
export const OUTPUT_TOML_FORMAT_PRIORITY = OUTPUT_TOML_RESULT.data;

/**
 * Template preview length for error reporting
 * Used when template processing fails to show context
 */
const TEMPLATE_PREVIEW_RESULT = DebugOutputLimit.create(TEMPLATE_PREVIEW_SIZE);
if (!TEMPLATE_PREVIEW_RESULT.ok) {
  throw new Error(
    `Failed to create ERROR_TEMPLATE_PREVIEW_LIMIT: ${TEMPLATE_PREVIEW_RESULT.error.message}`,
  );
}
export const ERROR_TEMPLATE_PREVIEW_LIMIT = TEMPLATE_PREVIEW_RESULT.data;

/**
 * Maximum depth for schema reference resolution
 * Prevents infinite recursion in $ref resolution
 */
const MAX_REF_DEPTH_RESULT = MaxDepthLimit.create(
  STANDARD_REF_RESOLUTION_DEPTH,
);
if (!MAX_REF_DEPTH_RESULT.ok) {
  throw new Error(
    `Failed to create MAX_REFERENCE_DEPTH: ${MAX_REF_DEPTH_RESULT.error.message}`,
  );
}
export const MAX_REFERENCE_DEPTH = MAX_REF_DEPTH_RESULT.data;

/**
 * Default error context truncation limit for debug messages
 * Used when displaying input content in error messages
 */
const ERROR_CONTEXT_LIMIT_RESULT = ErrorContextLimit.create(
  STANDARD_ERROR_CONTEXT_SIZE,
);
if (!ERROR_CONTEXT_LIMIT_RESULT.ok) {
  throw new Error(
    `Failed to create DEFAULT_ERROR_CONTEXT_LIMIT: ${ERROR_CONTEXT_LIMIT_RESULT.error.message}`,
  );
}
export const DEFAULT_ERROR_CONTEXT_LIMIT = ERROR_CONTEXT_LIMIT_RESULT.data;

/**
 * Default name length limit for identifiers and rule names
 * Used in validation of rule names, variable names, etc.
 */
const NAME_LENGTH_LIMIT_RESULT = NameLengthLimit.create(
  STANDARD_NAME_LENGTH_SIZE,
);
if (!NAME_LENGTH_LIMIT_RESULT.ok) {
  throw new Error(
    `Failed to create DEFAULT_NAME_LENGTH_LIMIT: ${NAME_LENGTH_LIMIT_RESULT.error.message}`,
  );
}
export const DEFAULT_NAME_LENGTH_LIMIT = NAME_LENGTH_LIMIT_RESULT.data;

/**
 * Default processing limits for batch operations and concurrency
 * Used in file processing, template concurrency, etc.
 */
const PROCESSING_LIMIT_RESULT = ProcessingLimit.create(
  STANDARD_PROCESSING_BATCH_SIZE,
);
if (!PROCESSING_LIMIT_RESULT.ok) {
  throw new Error(
    `Failed to create DEFAULT_PROCESSING_LIMIT: ${PROCESSING_LIMIT_RESULT.error.message}`,
  );
}
export const DEFAULT_PROCESSING_LIMIT = PROCESSING_LIMIT_RESULT.data;

/**
 * Strict mode processing limit for high-reliability scenarios
 * Used in application services with strict validation requirements
 */
const STRICT_PROCESSING_LIMIT_RESULT = ProcessingLimit.create(
  STRICT_MODE_MAX_FILES,
);
if (!STRICT_PROCESSING_LIMIT_RESULT.ok) {
  throw new Error(
    `Failed to create STRICT_MODE_PROCESSING_LIMIT: ${STRICT_PROCESSING_LIMIT_RESULT.error.message}`,
  );
}
export const STRICT_MODE_PROCESSING_LIMIT = STRICT_PROCESSING_LIMIT_RESULT.data;

/**
 * Performance mode processing limit for high-throughput scenarios
 * Used in application services with performance optimization requirements
 */
const PERFORMANCE_PROCESSING_LIMIT_RESULT = ProcessingLimit.create(
  PERFORMANCE_MODE_MAX_FILES,
);
if (!PERFORMANCE_PROCESSING_LIMIT_RESULT.ok) {
  throw new Error(
    `Failed to create PERFORMANCE_MODE_PROCESSING_LIMIT: ${PERFORMANCE_PROCESSING_LIMIT_RESULT.error.message}`,
  );
}
export const PERFORMANCE_MODE_PROCESSING_LIMIT =
  PERFORMANCE_PROCESSING_LIMIT_RESULT.data;

/**
 * Absolute maximum file processing limit for system constraints
 * Hard upper limit to prevent resource exhaustion
 */
const ABSOLUTE_MAX_PROCESSING_LIMIT_RESULT = AbsoluteMaxLimit.create(
  ABSOLUTE_MAX_FILES_LIMIT,
);
if (!ABSOLUTE_MAX_PROCESSING_LIMIT_RESULT.ok) {
  throw new Error(
    `Failed to create ABSOLUTE_MAX_PROCESSING_LIMIT: ${ABSOLUTE_MAX_PROCESSING_LIMIT_RESULT.error.message}`,
  );
}
export const ABSOLUTE_MAX_PROCESSING_LIMIT =
  ABSOLUTE_MAX_PROCESSING_LIMIT_RESULT.data;

/**
 * Pattern length limit for file matching operations
 * Used in domain services to prevent performance issues with overly long patterns
 */
const PATTERN_LENGTH_LIMIT_RESULT = ProcessingLimit.create(
  PATTERN_LENGTH_LIMIT_SIZE,
);
if (!PATTERN_LENGTH_LIMIT_RESULT.ok) {
  throw new Error(
    `Failed to create PATTERN_LENGTH_LIMIT: ${PATTERN_LENGTH_LIMIT_RESULT.error.message}`,
  );
}
export const PATTERN_LENGTH_LIMIT = PATTERN_LENGTH_LIMIT_RESULT.data;

/**
 * Variable description length limit for template validation
 * Used in domain services to validate template variable descriptions
 */
const VARIABLE_DESCRIPTION_LIMIT_RESULT = NameLengthLimit.create(
  VARIABLE_DESCRIPTION_MAX_LENGTH,
);
if (!VARIABLE_DESCRIPTION_LIMIT_RESULT.ok) {
  throw new Error(
    `Failed to create VARIABLE_DESCRIPTION_LENGTH_LIMIT: ${VARIABLE_DESCRIPTION_LIMIT_RESULT.error.message}`,
  );
}
export const VARIABLE_DESCRIPTION_LENGTH_LIMIT =
  VARIABLE_DESCRIPTION_LIMIT_RESULT.data;

// ========================================
// Configuration Loading
// ========================================

/**
 * Application constants configuration
 * Allows runtime configuration of constant values while maintaining type safety
 */
export interface ApplicationConstantsConfig {
  debugOutputLimit?: number;
  defaultFormatPriority?: number;
  errorTemplatePreviewLimit?: number;
  maxReferenceDepth?: number;
  errorContextLimit?: number;
  nameLengthLimit?: number;
  processingLimit?: number;
}

/**
 * Configuration-driven constants factory
 * Allows overriding default values with validated configuration
 */
export class ApplicationConstants {
  private constructor(
    public readonly debugOutputLimit: DebugOutputLimit,
    public readonly defaultFormatPriority: FormatPriority,
    public readonly errorTemplatePreviewLimit: DebugOutputLimit,
    public readonly maxReferenceDepth: MaxDepthLimit,
    public readonly errorContextLimit: ErrorContextLimit,
    public readonly nameLengthLimit: NameLengthLimit,
    public readonly processingLimit: ProcessingLimit,
  ) {}

  static create(
    config: ApplicationConstantsConfig = {},
  ): Result<ApplicationConstants, ConstantValidationError> {
    // Debug output limit
    const debugLimitResult = config.debugOutputLimit
      ? DebugOutputLimit.create(config.debugOutputLimit)
      : { ok: true as const, data: DEFAULT_DEBUG_OUTPUT_LIMIT };
    if (!debugLimitResult.ok) return debugLimitResult;

    // Format priority
    const priorityResult = config.defaultFormatPriority
      ? FormatPriority.create(config.defaultFormatPriority)
      : { ok: true as const, data: DEFAULT_FORMAT_PRIORITY };
    if (!priorityResult.ok) return priorityResult;

    // Template preview limit
    const previewLimitResult = config.errorTemplatePreviewLimit
      ? DebugOutputLimit.create(config.errorTemplatePreviewLimit)
      : { ok: true as const, data: ERROR_TEMPLATE_PREVIEW_LIMIT };
    if (!previewLimitResult.ok) return previewLimitResult;

    // Max reference depth
    const maxDepthResult = config.maxReferenceDepth
      ? MaxDepthLimit.create(config.maxReferenceDepth)
      : { ok: true as const, data: MAX_REFERENCE_DEPTH };
    if (!maxDepthResult.ok) return maxDepthResult;

    // Error context limit
    const errorContextResult = config.errorContextLimit
      ? ErrorContextLimit.create(config.errorContextLimit)
      : { ok: true as const, data: DEFAULT_ERROR_CONTEXT_LIMIT };
    if (!errorContextResult.ok) return errorContextResult;

    // Name length limit
    const nameLengthResult = config.nameLengthLimit
      ? NameLengthLimit.create(config.nameLengthLimit)
      : { ok: true as const, data: DEFAULT_NAME_LENGTH_LIMIT };
    if (!nameLengthResult.ok) return nameLengthResult;

    // Processing limit
    const processingLimitResult = config.processingLimit
      ? ProcessingLimit.create(config.processingLimit)
      : { ok: true as const, data: DEFAULT_PROCESSING_LIMIT };
    if (!processingLimitResult.ok) return processingLimitResult;

    return {
      ok: true,
      data: new ApplicationConstants(
        debugLimitResult.data,
        priorityResult.data,
        previewLimitResult.data,
        maxDepthResult.data,
        errorContextResult.data,
        nameLengthResult.data,
        processingLimitResult.data,
      ),
    };
  }

  /**
   * Get default constants instance
   * Pre-validated with standard application defaults
   */
  static getDefaults(): ApplicationConstants {
    const result = ApplicationConstants.create();
    if (!result.ok) {
      throw new Error(
        `Failed to create default constants: ${result.error.message}`,
      );
    }
    return result.data;
  }
}

// ========================================
// Default Application Constants Instance
// ========================================

/**
 * Default application constants with validated values
 * Available for immediate use throughout the application
 */
export const APP_CONSTANTS = ApplicationConstants.getDefaults();
