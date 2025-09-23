/**
 * @fileoverview Frontmatter Validation Service
 * @description Service for validating frontmatter data against schemas
 * Following DDD and Totality principles
 */

import { err, ok, Result } from "../../shared/types/result.ts";
import { DomainError } from "../../shared/types/errors.ts";
import { FrontmatterData } from "../value-objects/frontmatter-data.ts";
import { Schema } from "../../schema/entities/schema.ts";
import {
  DefaultSchemaValidationService,
  SchemaValidationService,
} from "../../schema/services/schema-validation-service.ts";
import { ValidationRules } from "../../schema/value-objects/validation-rules.ts";

/**
 * Domain service for frontmatter validation operations
 * Encapsulates the logic for validating frontmatter against schemas
 */
export class FrontmatterValidationService {
  private constructor(
    private readonly schemaValidator: SchemaValidationService,
  ) {}

  /**
   * Smart Constructor
   */
  static create(
    schemaValidator?: SchemaValidationService,
  ): Result<FrontmatterValidationService, DomainError & { message: string }> {
    try {
      if (schemaValidator) {
        return ok(new FrontmatterValidationService(schemaValidator));
      } else {
        const validatorResult = DefaultSchemaValidationService.create();
        if (!validatorResult.ok) {
          return err({
            kind: "ConfigurationError",
            message:
              `Failed to create schema validator: ${validatorResult.error.message}`,
          });
        }
        return ok(new FrontmatterValidationService(validatorResult.data));
      }
    } catch (error) {
      return err({
        kind: "ConfigurationError",
        message: `Failed to create FrontmatterValidationService: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  }

  /**
   * Validate frontmatter data against a schema
   */
  validateAgainstSchema(
    data: FrontmatterData,
    schema: Schema,
  ): Result<void, DomainError & { message: string }> {
    try {
      // Get validation rules from schema
      const rulesResult = this.schemaValidator
        .getValidationRulesForFrontmatterPart(schema);
      if (!rulesResult.ok) {
        return err({
          kind: "InvalidFormat",
          format: "schema",
          field: "frontmatter",
          message:
            `Failed to get validation rules: ${rulesResult.error.message}`,
        });
      }

      // Apply the validation rules
      return this.validateAgainstRules(data, rulesResult.data);
    } catch (error) {
      return err({
        kind: "InvalidFormat",
        format: "schema",
        field: "frontmatter",
        message: `Validation error: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  }

  /**
   * Validate frontmatter data against validation rules
   */
  validateAgainstRules(
    data: FrontmatterData,
    rules: ValidationRules,
  ): Result<void, DomainError & { message: string }> {
    try {
      const dataObject = data.getData();

      // Apply validation rules (implementation depends on ValidationRules structure)
      const rulesArray = rules.getRules();
      for (const rule of rulesArray) {
        // Basic rule validation - this would need to be expanded based on rule types
        if (
          rule.required &&
          !Object.prototype.hasOwnProperty.call(dataObject, rule.path)
        ) {
          return err({
            kind: "MissingRequired",
            field: rule.path,
            message: `Required property '${rule.path}' is missing`,
          });
        }
      }

      return ok(undefined);
    } catch (error) {
      return err({
        kind: "InvalidFormat",
        format: "validation-rules",
        field: "frontmatter",
        message: `Rules validation error: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  }

  /**
   * Comprehensive validation combining schema and rules
   */
  validateComprehensive(
    data: FrontmatterData,
    schema: Schema,
    rules: ValidationRules,
  ): Result<void, DomainError & { message: string }> {
    // First validate against schema
    const schemaResult = this.validateAgainstSchema(data, schema);
    if (!schemaResult.ok) {
      return schemaResult;
    }

    // Then validate against rules
    const rulesResult = this.validateAgainstRules(data, rules);
    if (!rulesResult.ok) {
      return rulesResult;
    }

    return ok(undefined);
  }
}
