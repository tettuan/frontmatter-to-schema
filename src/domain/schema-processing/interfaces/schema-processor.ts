import { Result } from "../../shared/types/result.ts";
import { DomainError as _DomainError } from "../../shared/types/errors.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";
import { Schema } from "../../schema/entities/schema.ts";

/**
 * Result of schema validation and transformation following DDD principles
 */
export interface ValidatedData {
  readonly processedFrontmatter: FrontmatterData[];
  readonly schemaMetadata: SchemaMetadata;
}

/**
 * Schema metadata extracted during processing
 */
export interface SchemaMetadata {
  readonly hasFrontmatterPart: boolean;
  readonly frontmatterPartPath?: string;
  readonly processedCount: number;
  readonly extractedCount: number;
}

/**
 * Discriminated union for schema processing errors following Totality principles
 */
export type SchemaError =
  | { kind: "SchemaValidationFailure"; schema: string; cause: string }
  | { kind: "FrontmatterPartProcessingFailure"; path: string; cause: string }
  | {
    kind: "SchemaDataTransformationFailure";
    operation: string;
    cause: string;
  }
  | { kind: "SchemaProcessorCreationFailure"; cause: string };

/**
 * Domain service interface for schema processing following DDD principles.
 * Handles the core responsibility of validating and transforming data according to schema rules.
 *
 * Core Domain: Schema Processing
 * Responsibility: Schema validation, transformation, frontmatter-part processing
 * Dependencies: SchemaValidator, TypeChecker, FrontmatterDataCreationService
 */
export interface SchemaProcessor {
  /**
   * Validate and transform frontmatter data according to schema rules.
   * Includes processing of x-frontmatter-part directives when present.
   * Follows Totality principle - all error cases are handled and represented in the type system.
   *
   * @param data Array of frontmatter data to validate and transform
   * @param schema Schema containing validation rules and transformation directives
   * @returns Result containing validated and transformed data or error information
   */
  validateAndTransform(
    data: FrontmatterData[],
    schema: Schema,
  ): Result<ValidatedData, SchemaError & { message: string }>;

  /**
   * Process frontmatter parts according to x-frontmatter-part schema directives.
   * Extracts and transforms data when the schema specifies frontmatter-part processing.
   *
   * @param data Array of frontmatter data to process
   * @param schema Schema containing frontmatter-part directives
   * @returns Result containing processed frontmatter parts or original data
   */
  processFrontmatterParts(
    data: FrontmatterData[],
    schema: Schema,
  ): Result<FrontmatterData[], SchemaError & { message: string }>;
}
