import { Result } from "../../shared/types/result.ts";
import { SchemaError } from "../../shared/types/errors.ts";
import { ErrorHandler } from "../../shared/services/unified-error-handler.ts";
import { ValidationRules } from "../value-objects/validation-rules.ts";
import { Schema } from "../entities/schema.ts";

/**
 * Service for generating validation rules from resolved schemas
 * Following DDD principles - schema domain provides validation rules to other domains
 */
export interface SchemaValidationService {
  /**
   * Generate validation rules for frontmatter part of a schema
   * Uses properly resolved schemas to ensure correct validation rules
   */
  getValidationRulesForFrontmatterPart(
    schema: Schema,
  ): Result<ValidationRules, SchemaError & { message: string }>;
}

/**
 * Implementation of SchemaValidationService
 * Uses resolved schemas to generate proper validation rules
 */
export class DefaultSchemaValidationService implements SchemaValidationService {
  private constructor() {}

  /**
   * Smart constructor following Totality principles
   */
  static create(): Result<
    DefaultSchemaValidationService,
    SchemaError & { message: string }
  > {
    return { ok: true, data: new DefaultSchemaValidationService() };
  }

  getValidationRulesForFrontmatterPart(
    schema: Schema,
  ): Result<ValidationRules, SchemaError & { message: string }> {
    // Find the frontmatter part schema
    const frontmatterPartResult = schema.findFrontmatterPartSchema();
    if (!frontmatterPartResult.ok) {
      // No frontmatter part found, return default validation rules
      return { ok: true, data: ValidationRules.create([]) };
    }

    const arraySchema = frontmatterPartResult.data;

    // Get the items schema from the array
    const itemsResult = arraySchema.getItems();
    if (!itemsResult.ok) {
      return ErrorHandler.schema({
        operation: "getValidationRulesForFrontmatterPart",
        method: "getItems",
      }).invalid(
        `Failed to get items schema: ${itemsResult.error.message}`,
      );
    }

    const itemsSchema = itemsResult.data;

    // Handle both direct schemas and $ref schemas
    if (typeof itemsSchema === "object" && "$ref" in itemsSchema) {
      // This is a $ref, we need to get the resolved schema
      if (!schema.isResolved()) {
        return ErrorHandler.schema({
          operation: "getValidationRulesForFrontmatterPart",
          method: "checkResolved",
        }).invalid("Schema must be resolved to handle $ref");
      }

      const resolvedResult = schema.getResolved();
      if (!resolvedResult.ok) {
        return ErrorHandler.schema({
          operation: "getValidationRulesForFrontmatterPart",
          method: "getResolved",
        }).invalid(
          `Failed to get resolved schema: ${resolvedResult.error.message}`,
        );
      }

      const ref = itemsSchema.$ref;
      const referencedSchema = resolvedResult.data.referencedSchemas.get(ref);
      if (!referencedSchema) {
        return ErrorHandler.schema({
          operation: "getValidationRulesForFrontmatterPart",
          method: "findReference",
        }).invalid(`Referenced schema not found: ${ref}`);
      }

      // Generate validation rules from the resolved referenced schema
      const resolvedSchemaProperty = referencedSchema.getRawSchema();
      return {
        ok: true,
        data: ValidationRules.fromSchema(resolvedSchemaProperty, ""),
      };
    } else {
      // Direct schema property, use it directly
      return { ok: true, data: ValidationRules.fromSchema(itemsSchema, "") };
    }
  }
}
