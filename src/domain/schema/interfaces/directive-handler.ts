/**
 * @fileoverview Directive Handler Interface
 * @description Core interface for processing schema directives following DDD and Totality principles
 */

import { Result } from "../../shared/types/result.ts";
import { DomainError } from "../../shared/types/errors.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";
import { Schema } from "../entities/schema.ts";

/**
 * Directive Processing Error Types
 * Following Totality principles with discriminated unions
 */
export type DirectiveHandlerError =
  | {
    kind: "ConfigurationError";
    directiveName: string;
    message: string;
    details?: unknown;
  }
  | {
    kind: "ProcessingError";
    directiveName: string;
    message: string;
    cause?: DomainError;
  }
  | {
    kind: "ValidationError";
    directiveName: string;
    message: string;
    invalidValue?: unknown;
  };

/**
 * Extension Extraction Result
 * Following Totality principles - replaces Result<T | null, E> pattern
 */
export type ExtensionExtractionResult =
  | {
    readonly kind: "ExtensionFound";
    readonly key: string;
    readonly value: unknown;
  }
  | {
    readonly kind: "ExtensionNotApplicable";
    readonly reason: string;
  };

/**
 * Directive Configuration extracted from schema
 * Generic type parameter allows each directive to define its own config structure
 */
export interface DirectiveConfig<T = unknown> {
  readonly kind: "DirectiveConfig";
  readonly directiveName: string;
  readonly configuration: T;
  readonly isPresent: boolean;
}

/**
 * Directive Processing Result
 * Contains both processed data and any metadata
 */
export interface DirectiveProcessingResult<T = unknown> {
  readonly kind: "DirectiveProcessingResult";
  readonly directiveName: string;
  readonly processedData: FrontmatterData;
  readonly metadata?: T;
}

/**
 * Legacy Schema Property Interface (for extraction only)
 * Represents the partial function approach we're migrating from
 */
export interface LegacySchemaProperty {
  readonly [key: string]: unknown;
  readonly extensions?: { readonly [key: string]: unknown };
  readonly "x-template"?: string;
  readonly "x-frontmatter-part"?: boolean;
  readonly "x-derived-from"?: string;
  readonly "x-derived-unique"?: boolean;
  readonly "x-template-items"?: string;
  readonly "x-template-format"?: "json" | "yaml" | "markdown";
  readonly "x-jmespath-filter"?: string;
  readonly "x-flatten-arrays"?: string;
  readonly description?: string;
}

/**
 * Core DirectiveHandler Interface
 *
 * Following Totality principles:
 * - All methods return Result<T,E> (total functions)
 * - Uses discriminated union for identification
 * - No exceptions or undefined behavior
 * - Smart Constructor pattern for implementations
 */
export interface DirectiveHandler<TConfig = unknown, TMetadata = unknown> {
  readonly kind: "DirectiveHandler";
  readonly directiveName: string;
  readonly priority: number;
  readonly dependencies: readonly string[];

  /**
   * Check if this handler can process the given directive
   * Total function - always returns boolean, never throws
   */
  canHandle(directiveName: string): boolean;

  /**
   * Extract configuration from legacy schema property
   * Converts partial function (optional properties) to total function (Result<T,E>)
   */
  extractConfig(
    schema: LegacySchemaProperty,
  ): Result<DirectiveConfig<TConfig>, DirectiveHandlerError>;

  /**
   * Process data according to directive configuration
   * Total function - handles all inputs, returns Result<T,E>
   */
  processData(
    data: FrontmatterData,
    config: DirectiveConfig<TConfig>,
    schema: Schema,
  ): Result<DirectiveProcessingResult<TMetadata>, DirectiveHandlerError>;

  /**
   * Extract extension key-value pair for schema building
   * Used during schema property migration
   * Following Totality principles with discriminated union result
   */
  extractExtension(
    schema: LegacySchemaProperty,
  ): Result<ExtensionExtractionResult, DirectiveHandlerError>;

  /**
   * Get processing dependencies
   * Returns other directive names that must be processed before this one
   */
  getDependencies(): readonly string[];

  /**
   * Get processing priority
   * Lower numbers = higher priority (processed first)
   */
  getPriority(): number;
}

/**
 * Base Directive Handler Abstract Implementation
 * Provides common functionality following DDD patterns
 */
export abstract class BaseDirectiveHandler<
  TConfig = unknown,
  TMetadata = unknown,
> implements DirectiveHandler<TConfig, TMetadata> {
  readonly kind = "DirectiveHandler" as const;

  protected constructor(
    public readonly directiveName: string,
    public readonly priority: number,
    public readonly dependencies: readonly string[] = [],
  ) {}

  /**
   * Default implementation checks exact name match
   * Subclasses can override for more complex matching
   */
  canHandle(directiveName: string): boolean {
    return directiveName === this.directiveName;
  }

  /**
   * Default dependency getter
   */
  getDependencies(): readonly string[] {
    return this.dependencies;
  }

  /**
   * Default priority getter
   */
  getPriority(): number {
    return this.priority;
  }

  // Abstract methods that must be implemented by concrete handlers
  abstract extractConfig(
    schema: LegacySchemaProperty,
  ): Result<DirectiveConfig<TConfig>, DirectiveHandlerError>;

  abstract processData(
    data: FrontmatterData,
    config: DirectiveConfig<TConfig>,
    schema: Schema,
  ): Result<DirectiveProcessingResult<TMetadata>, DirectiveHandlerError>;

  abstract extractExtension(
    schema: LegacySchemaProperty,
  ): Result<ExtensionExtractionResult, DirectiveHandlerError>;
}

/**
 * Directive Handler Factory
 * Following Smart Constructor pattern for creating handlers
 */
export class DirectiveHandlerFactory {
  private constructor() {
    // Private constructor for Smart Constructor pattern
  }

  /**
   * Create a directive handler configuration
   * Returns Result<T,E> following Totality principles
   */
  static createConfig<T>(
    directiveName: string,
    configuration: T,
    isPresent: boolean = true,
  ): Result<DirectiveConfig<T>, DirectiveHandlerError> {
    if (!directiveName || directiveName.trim() === "") {
      return {
        ok: false,
        error: {
          kind: "ValidationError",
          directiveName,
          message: "Directive name cannot be empty",
          invalidValue: directiveName,
        },
      };
    }

    return {
      ok: true,
      data: {
        kind: "DirectiveConfig",
        directiveName,
        configuration,
        isPresent,
      },
    };
  }

  /**
   * Create a processing result
   * Returns Result<T,E> following Totality principles
   */
  static createResult<T>(
    directiveName: string,
    processedData: FrontmatterData,
    metadata?: T,
  ): Result<DirectiveProcessingResult<T>, DirectiveHandlerError> {
    if (!directiveName || directiveName.trim() === "") {
      return {
        ok: false,
        error: {
          kind: "ValidationError",
          directiveName,
          message: "Directive name cannot be empty",
          invalidValue: directiveName,
        },
      };
    }

    return {
      ok: true,
      data: {
        kind: "DirectiveProcessingResult",
        directiveName,
        processedData,
        metadata,
      },
    };
  }
}
