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

// Format detection priorities and limits
const DEFAULT_FORMAT_DETECTOR_PRIORITY = 10;
const SECONDARY_FORMAT_DETECTOR_PRIORITY = 9;
const FORMAT_EXTENSION_MAX_LENGTH = 10;

// Error reporting and aggregation limits
const ERROR_REPORTING_LIMIT = 10;
const COMMAND_PROCESSING_MAX_ERRORS = 10;

// Pluralization rule priorities for linguistic pattern matching
const IRREGULAR_PLURALIZATION_PRIORITY = 100;
const HIGH_PRIORITY_PLURALIZATION_RULE = 90;
const MEDIUM_PRIORITY_PLURALIZATION_RULE = 85;
const STANDARD_PLURALIZATION_RULE_PRIORITY = 80;
const LOW_PRIORITY_PLURALIZATION_RULE = 10;

// Process Documents Options validation limits
const DEFAULT_MAX_WORKERS = 4;
const MIN_WORKERS_LIMIT = 1;
const MAX_WORKERS_LIMIT = 16;

// Web format detection priorities for format-detector web configurations
const WEB_XML_FORMAT_PRIORITY = 8;
const WEB_HTML_FORMAT_PRIORITY = 5;
const WEB_HTM_FORMAT_PRIORITY = 4;
const DEFAULT_RULE_PRIORITY = 5;

// Exit handler graceful shutdown timeout for log flushing
const GRACEFUL_EXIT_TIMEOUT_MS = 10;

// Analysis engine processing timeout for complex operations
const ANALYSIS_ENGINE_TIMEOUT_MS = 30000;

// Dry-run content preview length for output display
const DRY_RUN_PREVIEW_LENGTH = 500;

// File path maximum length for filesystem compatibility
const MAX_FILE_PATH_LENGTH = 1024;

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

  /**
   * Totality-compliant creation with fallback value
   * Prevents module load failures by providing safe defaults
   */
  static createOrDefault(
    limit: number,
    defaultValue: number = 100,
  ): DebugOutputLimit {
    const result = this.create(limit);
    if (result.ok) {
      return result.data;
    }

    // Fallback to default value if primary creation fails
    const fallbackResult = this.create(defaultValue);
    if (fallbackResult.ok) {
      return fallbackResult.data;
    }

    // Ultimate fallback with hardcoded safe value
    return new DebugOutputLimit(100);
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

  /**
   * Totality-compliant creation with fallback value
   * Prevents module load failures by providing safe defaults
   */
  static createOrDefault(
    priority: number,
    defaultValue: number = 100,
  ): FormatPriority {
    const result = this.create(priority);
    if (result.ok) {
      return result.data;
    }

    // Fallback to default value if primary creation fails
    const fallbackResult = this.create(defaultValue);
    if (fallbackResult.ok) {
      return fallbackResult.data;
    }

    // Ultimate fallback with hardcoded safe value
    return new FormatPriority(100);
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

  /**
   * Totality-compliant creation with fallback value
   */
  static createOrDefault(
    depth: number,
    defaultValue: number = 100,
  ): MaxDepthLimit {
    const result = this.create(depth);
    if (result.ok) {
      return result.data;
    }

    const fallbackResult = this.create(defaultValue);
    if (fallbackResult.ok) {
      return fallbackResult.data;
    }

    return new MaxDepthLimit(100);
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

  /**
   * Totality-compliant creation with fallback value
   */
  static createOrDefault(
    limit: number,
    defaultValue: number = 100,
  ): ErrorContextLimit {
    const result = this.create(limit);
    if (result.ok) {
      return result.data;
    }

    const fallbackResult = this.create(defaultValue);
    if (fallbackResult.ok) {
      return fallbackResult.data;
    }

    return new ErrorContextLimit(100);
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

  static createOrDefault(
    limit: number,
    defaultValue: number = 100,
  ): NameLengthLimit {
    const result = this.create(limit);
    if (result.ok) return result.data;

    const fallbackResult = this.create(defaultValue);
    if (fallbackResult.ok) return fallbackResult.data;

    return new NameLengthLimit(100);
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

  static createOrDefault(
    limit: number,
    defaultValue: number = 1000,
  ): AbsoluteMaxLimit {
    const result = this.create(limit);
    if (result.ok) return result.data;

    const fallbackResult = this.create(defaultValue);
    if (fallbackResult.ok) return fallbackResult.data;

    return new AbsoluteMaxLimit(1000);
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

  static createOrDefault(
    limit: number,
    defaultValue: number = 100,
  ): ProcessingLimit {
    const result = this.create(limit);
    if (result.ok) return result.data;

    const fallbackResult = this.create(defaultValue);
    if (fallbackResult.ok) return fallbackResult.data;

    return new ProcessingLimit(100);
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
 * Timeout values for asynchronous operations
 * Controls timing for graceful shutdowns and process delays
 */
export class TimeoutLimit {
  private constructor(private readonly value: number) {}

  static create(
    timeout: number,
  ): Result<TimeoutLimit, ConstantValidationError> {
    if (timeout < 0) {
      return {
        ok: false,
        error: createError({
          kind: "OutOfRange",
          value: timeout,
          min: 0,
          message: "Timeout must be non-negative",
        }),
      };
    }
    if (timeout > 60000) {
      return {
        ok: false,
        error: createError({
          kind: "OutOfRange",
          value: timeout,
          max: 60000,
          message: "Timeout too large (max 60000ms/1 minute)",
        }),
      };
    }
    return { ok: true, data: new TimeoutLimit(timeout) };
  }

  static createOrDefault(
    timeout: number,
    defaultValue: number = 5000,
  ): TimeoutLimit {
    const result = this.create(timeout);
    if (result.ok) return result.data;

    const fallbackResult = this.create(defaultValue);
    if (fallbackResult.ok) return fallbackResult.data;

    return new TimeoutLimit(5000);
  }

  getValue(): number {
    return this.value;
  }

  toString(): string {
    return `${this.value}ms`;
  }
}

// ========================================
// Validated Default Constants
// ========================================

/**
 * Default debug output limit for content truncation in error messages
 * Used in frontmatter extraction and template rendering errors
 */
export const DEFAULT_DEBUG_OUTPUT_LIMIT = DebugOutputLimit.createOrDefault(
  STANDARD_DEBUG_OUTPUT_SIZE,
);

/**
 * Default format detection priority for standard file formats
 * Used when no specific priority is configured
 */
export const DEFAULT_FORMAT_PRIORITY = FormatPriority.createOrDefault(
  STANDARD_FORMAT_PRIORITY_VALUE,
);

/**
 * Document format priority for markdown and text-based formats
 * Lower priority than schema/template formats but still valid
 */
export const DOCUMENT_FORMAT_PRIORITY = FormatPriority.createOrDefault(
  DOCUMENT_FORMAT_PRIORITY_VALUE,
);

/**
 * Schema format priorities for different extensions
 * Higher priorities for primary schema formats
 */
export const SCHEMA_YAML_PRIMARY_FORMAT_PRIORITY = FormatPriority
  .createOrDefault(
    SCHEMA_YAML_PRIMARY_PRIORITY,
  );

export const SCHEMA_YML_SECONDARY_FORMAT_PRIORITY = FormatPriority
  .createOrDefault(
    SCHEMA_YML_SECONDARY_PRIORITY,
  );

/**
 * Template format priorities for different extensions
 * Balanced priorities for template processing formats
 */
export const TEMPLATE_JSON_FORMAT_PRIORITY = FormatPriority.createOrDefault(
  TEMPLATE_JSON_PRIORITY,
);

export const TEMPLATE_YAML_FORMAT_PRIORITY = FormatPriority.createOrDefault(
  TEMPLATE_YAML_PRIORITY,
);

export const TEMPLATE_YML_FORMAT_PRIORITY = FormatPriority.createOrDefault(
  TEMPLATE_YML_PRIORITY,
);

/**
 * Output format priorities for different extensions
 * Lower priorities for output-specific formats
 */
export const OUTPUT_JSON_FORMAT_PRIORITY = FormatPriority.createOrDefault(
  OUTPUT_JSON_PRIORITY,
);

export const OUTPUT_YAML_FORMAT_PRIORITY = FormatPriority.createOrDefault(
  OUTPUT_YAML_PRIORITY,
);

export const OUTPUT_TOML_FORMAT_PRIORITY = FormatPriority.createOrDefault(
  OUTPUT_TOML_PRIORITY,
);

/**
 * Template preview length for error reporting
 * Used when template processing fails to show context
 */
export const ERROR_TEMPLATE_PREVIEW_LIMIT = DebugOutputLimit.createOrDefault(
  TEMPLATE_PREVIEW_SIZE,
);

/**
 * Maximum depth for schema reference resolution
 * Prevents infinite recursion in $ref resolution
 */
export const MAX_REFERENCE_DEPTH = MaxDepthLimit.createOrDefault(
  STANDARD_REF_RESOLUTION_DEPTH,
);

/**
 * Default error context truncation limit for debug messages
 * Used when displaying input content in error messages
 */
export const DEFAULT_ERROR_CONTEXT_LIMIT = ErrorContextLimit.createOrDefault(
  STANDARD_ERROR_CONTEXT_SIZE,
);

/**
 * Default name length limit for identifiers and rule names
 * Used in validation of rule names, variable names, etc.
 */
export const DEFAULT_NAME_LENGTH_LIMIT = NameLengthLimit.createOrDefault(
  STANDARD_NAME_LENGTH_SIZE,
);

/**
 * Default processing limits for batch operations and concurrency
 * Used in file processing, template concurrency, etc.
 */
export const DEFAULT_PROCESSING_LIMIT = ProcessingLimit.createOrDefault(
  STANDARD_PROCESSING_BATCH_SIZE,
);

/**
 * Strict mode processing limit for high-reliability scenarios
 * Used in application services with strict validation requirements
 */
export const STRICT_MODE_PROCESSING_LIMIT = ProcessingLimit.createOrDefault(
  STRICT_MODE_MAX_FILES,
);

/**
 * Performance mode processing limit for high-throughput scenarios
 * Used in application services with performance optimization requirements
 */
export const PERFORMANCE_MODE_PROCESSING_LIMIT = ProcessingLimit
  .createOrDefault(
    PERFORMANCE_MODE_MAX_FILES,
  );

/**
 * Absolute maximum file processing limit for system constraints
 * Hard upper limit to prevent resource exhaustion
 */
export const ABSOLUTE_MAX_PROCESSING_LIMIT = AbsoluteMaxLimit.createOrDefault(
  ABSOLUTE_MAX_FILES_LIMIT,
);

/**
 * Pattern length limit for file matching operations
 * Used in domain services to prevent performance issues with overly long patterns
 */
export const PATTERN_LENGTH_LIMIT = ProcessingLimit.createOrDefault(
  PATTERN_LENGTH_LIMIT_SIZE,
);

/**
 * Variable description length limit for template validation
 * Used in domain services to validate template variable descriptions
 */
export const VARIABLE_DESCRIPTION_LENGTH_LIMIT = NameLengthLimit
  .createOrDefault(
    VARIABLE_DESCRIPTION_MAX_LENGTH,
  );

/**
 * Format detector priorities for different format detection scenarios
 * Used in domain services for format detection rules
 */
export const DEFAULT_FORMAT_DETECTOR_PRIORITY_VALUE = FormatPriority
  .createOrDefault(
    DEFAULT_FORMAT_DETECTOR_PRIORITY,
  );

export const SECONDARY_FORMAT_DETECTOR_PRIORITY_VALUE = FormatPriority
  .createOrDefault(
    SECONDARY_FORMAT_DETECTOR_PRIORITY,
  );

/**
 * Format extension maximum length for validation
 * Used in format detection rule validation
 */
export const FORMAT_EXTENSION_LENGTH_LIMIT = NameLengthLimit.createOrDefault(
  FORMAT_EXTENSION_MAX_LENGTH,
);

/**
 * Error reporting limits for result aggregation and processing
 * Used in application services for error display and processing
 */
export const ERROR_REPORTING_PROCESSING_LIMIT = ProcessingLimit.createOrDefault(
  ERROR_REPORTING_LIMIT,
);

export const COMMAND_PROCESSING_ERROR_LIMIT = ProcessingLimit.createOrDefault(
  COMMAND_PROCESSING_MAX_ERRORS,
);

/**
 * Pluralization rule priorities for linguistic pattern matching
 * Used in domain services for pluralization rule ordering and precedence
 */
export const IRREGULAR_PLURALIZATION_PRIORITY_VALUE = FormatPriority
  .createOrDefault(
    IRREGULAR_PLURALIZATION_PRIORITY,
  );

export const HIGH_PRIORITY_PLURALIZATION_RULE_VALUE = FormatPriority
  .createOrDefault(
    HIGH_PRIORITY_PLURALIZATION_RULE,
  );

export const MEDIUM_PRIORITY_PLURALIZATION_RULE_VALUE = FormatPriority
  .createOrDefault(
    MEDIUM_PRIORITY_PLURALIZATION_RULE,
  );

export const STANDARD_PLURALIZATION_RULE_PRIORITY_VALUE = FormatPriority
  .createOrDefault(
    STANDARD_PLURALIZATION_RULE_PRIORITY,
  );

export const LOW_PRIORITY_PLURALIZATION_RULE_VALUE = FormatPriority
  .createOrDefault(
    LOW_PRIORITY_PLURALIZATION_RULE,
  );

/**
 * Process Documents Options validation limits
 * Used in application services for worker and processing validation
 */
export const DEFAULT_MAX_WORKERS_VALUE = ProcessingLimit.createOrDefault(
  DEFAULT_MAX_WORKERS,
);

export const MIN_WORKERS_LIMIT_VALUE = ProcessingLimit.createOrDefault(
  MIN_WORKERS_LIMIT,
);

export const MAX_WORKERS_LIMIT_VALUE = ProcessingLimit.createOrDefault(
  MAX_WORKERS_LIMIT,
);

/**
 * Web format detection priorities for browser-compatible formats
 * Used in FormatDetector web configuration methods
 */
export const WEB_XML_FORMAT_PRIORITY_VALUE = FormatPriority.createOrDefault(
  WEB_XML_FORMAT_PRIORITY,
);

export const WEB_HTML_FORMAT_PRIORITY_VALUE = FormatPriority.createOrDefault(
  WEB_HTML_FORMAT_PRIORITY,
);

export const WEB_HTM_FORMAT_PRIORITY_VALUE = FormatPriority.createOrDefault(
  WEB_HTM_FORMAT_PRIORITY,
);

export const DEFAULT_RULE_PRIORITY_VALUE = FormatPriority.createOrDefault(
  DEFAULT_RULE_PRIORITY,
);

/**
 * Graceful exit timeout for log flushing and cleanup operations
 * Used in infrastructure services for clean application shutdown
 */
export const GRACEFUL_EXIT_TIMEOUT_VALUE = TimeoutLimit.createOrDefault(
  GRACEFUL_EXIT_TIMEOUT_MS,
);

/**
 * Analysis engine processing timeout for complex operations
 * Used in domain core services for analysis operation timeouts
 */
export const ANALYSIS_ENGINE_TIMEOUT_VALUE = TimeoutLimit.createOrDefault(
  ANALYSIS_ENGINE_TIMEOUT_MS,
);

/**
 * Dry-run content preview length for output display
 * Used in application services for content preview in dry-run mode
 */
export const DRY_RUN_PREVIEW_LENGTH_VALUE = DebugOutputLimit.createOrDefault(
  DRY_RUN_PREVIEW_LENGTH,
);

/**
 * Maximum file path length for filesystem compatibility
 * Used in domain value objects for path validation
 */
export const MAX_FILE_PATH_LENGTH_VALUE = AbsoluteMaxLimit.createOrDefault(
  MAX_FILE_PATH_LENGTH,
);

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
   * Totality-compliant with fallback values
   */
  static getDefaults(): ApplicationConstants {
    const result = ApplicationConstants.create();
    if (!result.ok) {
      // Fallback using createOrDefault methods if creation fails
      return new ApplicationConstants(
        DebugOutputLimit.createOrDefault(100),
        FormatPriority.createOrDefault(100),
        DebugOutputLimit.createOrDefault(100),
        MaxDepthLimit.createOrDefault(100),
        ErrorContextLimit.createOrDefault(100),
        NameLengthLimit.createOrDefault(100),
        ProcessingLimit.createOrDefault(100),
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
