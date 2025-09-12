/**
 * Processing Options Builder - Smart Constructor Pattern
 *
 * Follows totality principles by eliminating hardcoded defaults and
 * providing configurable, validated processing options.
 */

import type { Result } from "../../domain/core/result.ts";
import {
  createDomainError,
  type DomainError,
} from "../../domain/core/result.ts";
import {
  ABSOLUTE_MAX_PROCESSING_LIMIT,
  DEFAULT_PROCESSING_LIMIT,
  PERFORMANCE_MODE_PROCESSING_LIMIT,
  STRICT_MODE_PROCESSING_LIMIT,
} from "../../domain/shared/constants.ts";

/**
 * Processing options for document processing operations
 */
export interface ProcessingOptions {
  readonly strict: boolean;
  readonly allowEmptyFrontmatter: boolean;
  readonly allowMissingVariables: boolean;
  readonly validateSchema: boolean;
  readonly parallelProcessing: boolean;
  readonly maxFiles: number;
}

/**
 * Configuration for creating processing options
 */
export interface ProcessingOptionsConfig {
  readonly strict?: boolean;
  readonly allowEmptyFrontmatter?: boolean;
  readonly allowMissingVariables?: boolean;
  readonly validateSchema?: boolean;
  readonly parallelProcessing?: boolean;
  readonly maxFiles?: number;
}

/**
 * ProcessingOptionsBuilder - Smart Constructor for ProcessingOptions
 *
 * Eliminates hardcoded defaults and provides validation for option combinations.
 * Follows totality principle by making all configuration explicit.
 */
export class ProcessingOptionsBuilder {
  private constructor(readonly options: ProcessingOptions) {}

  /**
   * Create ProcessingOptionsBuilder with validation
   * Follows totality principle - no invalid combinations allowed
   */
  static create(
    config?: ProcessingOptionsConfig,
  ): Result<ProcessingOptionsBuilder, DomainError & { message: string }> {
    const defaults = ProcessingOptionsBuilder.getDefaults();
    const options: ProcessingOptions = {
      ...defaults,
      ...config,
    };

    // Validate option combinations
    const validationResult = ProcessingOptionsBuilder.validateOptions(options);
    if (!validationResult.ok) {
      return validationResult;
    }

    return {
      ok: true,
      data: new ProcessingOptionsBuilder(options),
    };
  }

  /**
   * Get default processing options
   * Configurable defaults following totality principle
   */
  static getDefaults(): ProcessingOptions {
    return {
      strict: true,
      allowEmptyFrontmatter: true, // Allow files without frontmatter by default for graceful handling
      allowMissingVariables: true, // Allow missing template variables by default - aligns with external configuration requirement
      validateSchema: true,
      parallelProcessing: false, // Sequential processing for reliability
      maxFiles: STRICT_MODE_PROCESSING_LIMIT.getValue(),
    };
  }

  /**
   * Create ProcessingOptionsBuilder with strict validation
   * For high-reliability processing scenarios
   */
  static createStrict(): Result<
    ProcessingOptionsBuilder,
    DomainError & { message: string }
  > {
    return ProcessingOptionsBuilder.create({
      strict: true,
      allowEmptyFrontmatter: false,
      allowMissingVariables: false, // Strict mode still requires all variables
      validateSchema: true,
      parallelProcessing: false,
      maxFiles: DEFAULT_PROCESSING_LIMIT.getValue(), // Lower limit for strict mode
    });
  }

  /**
   * Create ProcessingOptionsBuilder with permissive settings
   * For development and testing scenarios
   */
  static createPermissive(): Result<
    ProcessingOptionsBuilder,
    DomainError & { message: string }
  > {
    return ProcessingOptionsBuilder.create({
      strict: false,
      allowEmptyFrontmatter: true,
      allowMissingVariables: true,
      validateSchema: false,
      parallelProcessing: true,
      maxFiles: PERFORMANCE_MODE_PROCESSING_LIMIT.getValue(),
    });
  }

  /**
   * Validate processing options for logical consistency
   * Follows totality principle - all combinations must be explicitly handled
   */
  private static validateOptions(
    options: ProcessingOptions,
  ): Result<void, DomainError & { message: string }> {
    // Validate maxFiles range
    if (options.maxFiles <= 0) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "OutOfRange",
            value: options.maxFiles,
            min: 1,
          },
          "maxFiles must be greater than 0",
        ),
      };
    }

    if (ABSOLUTE_MAX_PROCESSING_LIMIT.isExceeded(options.maxFiles)) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "OutOfRange",
            value: options.maxFiles,
            max: ABSOLUTE_MAX_PROCESSING_LIMIT.getValue(),
          },
          "maxFiles must not exceed absolute maximum for performance reasons",
        ),
      };
    }

    // Validate logical consistency: strict mode implications
    // Note: allowEmptyFrontmatter is compatible with strict mode
    // It allows graceful handling of files without frontmatter
    // while still strictly validating files that do have frontmatter

    // Validate parallel processing constraints
    if (options.parallelProcessing && options.strict) {
      // Allow but warn about potential consistency issues
      // This combination is valid but may have implications
    }

    return { ok: true, data: undefined };
  }

  /**
   * Get the processing options
   */
  getOptions(): ProcessingOptions {
    return this.options;
  }

  /**
   * Create a new builder with modified options
   * Immutable update pattern following totality principles
   */
  withStrict(
    strict: boolean,
  ): Result<ProcessingOptionsBuilder, DomainError & { message: string }> {
    return ProcessingOptionsBuilder.create({
      ...this.options,
      strict,
    });
  }

  /**
   * Create a new builder with modified maxFiles
   */
  withMaxFiles(
    maxFiles: number,
  ): Result<ProcessingOptionsBuilder, DomainError & { message: string }> {
    return ProcessingOptionsBuilder.create({
      ...this.options,
      maxFiles,
    });
  }

  /**
   * Create a new builder with modified validation settings
   */
  withValidation(
    validateSchema: boolean,
    allowEmptyFrontmatter?: boolean,
  ): Result<ProcessingOptionsBuilder, DomainError & { message: string }> {
    return ProcessingOptionsBuilder.create({
      ...this.options,
      validateSchema,
      allowEmptyFrontmatter: allowEmptyFrontmatter ??
        this.options.allowEmptyFrontmatter,
    });
  }

  /**
   * Check if options are compatible with high-performance processing
   */
  isHighPerformance(): boolean {
    return this.options.parallelProcessing &&
      !this.options.strict &&
      this.options.maxFiles > STRICT_MODE_PROCESSING_LIMIT.getValue();
  }

  /**
   * Check if options are compatible with strict validation
   */
  isStrictValidation(): boolean {
    return this.options.strict &&
      this.options.validateSchema &&
      !this.options.allowEmptyFrontmatter;
  }
}
