/**
 * Schema Validator Orchestrator (Refactored)
 *
 * Coordinates validation services for complete schema validation
 * Part of the Schema Management Context (Domain Layer)
 * Follows DDD and Totality principles with Result types
 */

import type { DomainError, Result } from "../core/result.ts";
import type { Schema } from "../models/entities.ts";
import { isObject } from "../shared/type-guards.ts";

// Service imports
import { SchemaPropertyExtractorService } from "../schema/schema-property-extractor.service.ts";
import { TypeValidationService } from "../schema/type-validation.service.ts";
import { FieldValidationService } from "../schema/field-validation.service.ts";

// Totality-compliant validation result using discriminated unions
export type ValidationResult = {
  kind: "Valid";
  data: unknown;
} | {
  kind: "Invalid";
  error: DomainError;
};

/**
 * Refactored Schema Validator that orchestrates specialized services
 * Each service handles a specific aspect of validation
 */
export class SchemaValidator {
  private readonly propertyExtractor: SchemaPropertyExtractorService;
  private readonly typeValidator: TypeValidationService;
  private readonly fieldValidator: FieldValidationService;

  constructor() {
    this.propertyExtractor = new SchemaPropertyExtractorService();
    this.typeValidator = new TypeValidationService();
    this.fieldValidator = new FieldValidationService();
  }

  /**
   * Type guard for Record<string, unknown>
   */
  private isRecordObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  /**
   * Main validation entry point
   * Validates data against a schema using orchestrated services
   */
  validate(
    data: unknown,
    schema: Schema,
  ): Result<unknown, DomainError> {
    // This is a simplified validator
    // In production, this would use a proper JSON Schema validator
    const schemaDefinition = schema.getDefinition().getRawDefinition();

    if (!this.isRecordObject(schemaDefinition)) {
      return {
        ok: false,
        error: {
          kind: "InvalidFormat",
          input: String(schemaDefinition),
          expectedFormat: "object",
        },
      };
    }

    // For now, we'll do basic type checking
    return this.validateObject(data, schemaDefinition);
  }

  /**
   * Validate object against schema
   * Orchestrates property extraction, required field checking, and field validation
   */
  private validateObject(
    data: unknown,
    schema: Record<string, unknown>,
  ): Result<unknown, DomainError> {
    if (typeof data !== "object" || data === null) {
      return {
        ok: false,
        error: {
          kind: "InvalidFormat",
          input: String(data),
          expectedFormat: "object",
        },
      };
    }

    // Use type guard to safely access object properties
    if (!isObject(data)) {
      return {
        ok: false,
        error: {
          kind: "InvalidFormat",
          input: typeof data,
          expectedFormat: "object",
        },
      };
    }
    const dataObj = data;

    // Extract properties and required fields using specialized service
    const properties = this.propertyExtractor.extractProperties(schema);
    const required = this.propertyExtractor.extractRequiredFields(schema);

    // Check required fields using discriminated union pattern
    const requiredFieldsResult = this.validateRequiredFields(dataObj, required);
    if (!requiredFieldsResult.ok) {
      return requiredFieldsResult;
    }

    // Validate properties using discriminated union pattern
    switch (properties.kind) {
      case "Present": {
        const allowAdditional = this.propertyExtractor
          .allowsAdditionalProperties(schema);

        return this.fieldValidator.validateObjectFields(
          dataObj,
          properties.value,
          allowAdditional,
        );
      }
      case "NotPresent":
        // No properties schema to validate against
        return { ok: true, data };
      default: {
        // Exhaustive check for discriminated union
        const _exhaustiveCheck: never = properties;
        return {
          ok: false,
          error: {
            kind: "InvalidState",
            expected: "Present or NotPresent",
            actual: String(_exhaustiveCheck),
          },
        };
      }
    }
  }

  /**
   * Validate required fields are present
   */
  private validateRequiredFields(
    dataObj: Record<string, unknown>,
    required: ReturnType<
      SchemaPropertyExtractorService["extractRequiredFields"]
    >,
  ): Result<void, DomainError> {
    switch (required.kind) {
      case "Present":
        for (const field of required.fields) {
          if (!(field in dataObj)) {
            return {
              ok: false,
              error: { kind: "NotFound", resource: "field", name: field },
            };
          }
        }
        break;
      case "NotPresent":
        // No required fields to validate
        break;
    }

    return { ok: true, data: undefined };
  }
}
