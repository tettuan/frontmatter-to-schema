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
const DEFAULT_DEBUG_LIMIT_RESULT = DebugOutputLimit.create(100);
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
const DEFAULT_PRIORITY_RESULT = FormatPriority.create(100);
if (!DEFAULT_PRIORITY_RESULT.ok) {
  throw new Error(
    `Failed to create DEFAULT_FORMAT_PRIORITY: ${DEFAULT_PRIORITY_RESULT.error.message}`,
  );
}
export const DEFAULT_FORMAT_PRIORITY = DEFAULT_PRIORITY_RESULT.data;

/**
 * Template preview length for error reporting
 * Used when template processing fails to show context
 */
const TEMPLATE_PREVIEW_RESULT = DebugOutputLimit.create(100);
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
const MAX_REF_DEPTH_RESULT = MaxDepthLimit.create(100);
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
const ERROR_CONTEXT_LIMIT_RESULT = ErrorContextLimit.create(100);
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
const NAME_LENGTH_LIMIT_RESULT = NameLengthLimit.create(100);
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
const PROCESSING_LIMIT_RESULT = ProcessingLimit.create(100);
if (!PROCESSING_LIMIT_RESULT.ok) {
  throw new Error(
    `Failed to create DEFAULT_PROCESSING_LIMIT: ${PROCESSING_LIMIT_RESULT.error.message}`,
  );
}
export const DEFAULT_PROCESSING_LIMIT = PROCESSING_LIMIT_RESULT.data;

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
