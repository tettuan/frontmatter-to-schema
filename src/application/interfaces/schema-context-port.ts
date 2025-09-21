import { Result } from "../../domain/shared/types/result.ts";
import { DomainError as _DomainError } from "../../domain/shared/types/errors.ts";
import { ValidationRules } from "../../domain/schema/value-objects/validation-rules.ts";
import { ResolvedSchema } from "../../domain/schema/entities/schema.ts";

/**
 * Schema Context Port - DDD Boundary Interface
 *
 * Defines the contract for Schema Context interactions following DDD principles.
 * This interface encapsulates all Schema-related operations that other contexts
 * or the application layer can safely use without violating domain boundaries.
 */

export type SchemaContextError = _DomainError & {
  readonly kind:
    | "SchemaNotFound"
    | "SchemaInvalid"
    | "RefResolutionFailed"
    | "ValidationRulesFailed";
  readonly message?: string;
};

/**
 * Schema Context Port Interface
 *
 * Following the DDD architecture design from docs/domain/domain-boundary.md:
 * - Long lifecycle context for schema management
 * - Provides validation rules to Frontmatter Context
 * - Handles $ref resolution and schema loading
 */
export interface SchemaContextPort {
  /**
   * Load and resolve a schema from the given path
   * Implements the core Schema → Validation flow
   */
  loadSchema(
    schemaPath: string,
  ): Promise<Result<ResolvedSchema, SchemaContextError>>;

  /**
   * Extract validation rules from a resolved schema
   * Provides ValidationRules interface to Frontmatter Context
   */
  getValidationRules(
    schema: ResolvedSchema,
  ): Result<ValidationRules, SchemaContextError>;

  /**
   * Get template path from schema if defined
   * Supports x-template schema extension
   */
  getTemplatePath(
    schema: ResolvedSchema,
  ): Result<string | undefined, SchemaContextError>;

  /**
   * Get template format from schema if defined
   * Supports x-template-format schema extension
   */
  getTemplateFormat(
    schema: ResolvedSchema,
  ): Result<"json" | "yaml" | "markdown" | undefined, SchemaContextError>;

  /**
   * Get frontmatter part path if defined
   * Supports x-frontmatter-part schema extension for aggregation
   */
  getFrontmatterPartPath(
    schema: ResolvedSchema,
  ): Result<string | undefined, SchemaContextError>;
}

/**
 * Schema Context Factory
 *
 * Factory interface for creating Schema Context instances.
 * Allows dependency injection while maintaining context boundaries.
 */
export interface SchemaContextFactory {
  create(): SchemaContextPort;
}
