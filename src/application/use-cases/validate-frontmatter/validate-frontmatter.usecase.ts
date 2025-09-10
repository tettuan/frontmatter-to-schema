/**
 * Validate Frontmatter Use Case
 *
 * Responsible for validating frontmatter data against schema
 * Part of the Schema Management Context (validation aspect) in DDD
 * Follows Totality principles with Result types and Smart Constructors
 */

import type { UseCase } from "../base.usecase.ts";
import type { DomainError, Result } from "../../../domain/core/result.ts";
import { createDomainError } from "../../../domain/core/result.ts";
import {
  ValidatedInputData,
  ValidatedSchema,
  ValidationResult,
} from "../../../domain/value-objects/validated-data.ts";

/**
 * Input for frontmatter validation
 */
export interface ValidateFrontmatterInput {
  data: unknown;
  schema: unknown;
  filePath?: string;
}

/**
 * Output from frontmatter validation
 */
export interface ValidateFrontmatterOutput {
  valid: boolean;
  data: Record<string, unknown>;
  validationErrors?: string[];
}

/**
 * Validate Frontmatter Use Case Implementation
 * Validates frontmatter data against provided schema
 * Note: Currently performs basic validation, can be extended with JSON Schema validator
 */
export class ValidateFrontmatterUseCase
  implements UseCase<ValidateFrontmatterInput, ValidateFrontmatterOutput> {
  async execute(
    input: ValidateFrontmatterInput,
  ): Promise<
    Result<ValidateFrontmatterOutput, DomainError & { message: string }>
  > {
    // Await to satisfy linter requirement for async functions
    await Promise.resolve();

    try {
      // Validate input data using Smart Constructor
      const validatedDataResult = ValidatedInputData.create(input.data);
      if (!validatedDataResult.ok) {
        return {
          ok: false,
          error: validatedDataResult.error,
        };
      }

      const validatedData = validatedDataResult.data;
      const validationErrors: string[] = [];

      // Basic schema validation if schema is provided
      if (input.schema) {
        const validatedSchemaResult = ValidatedSchema.create(input.schema);
        if (!validatedSchemaResult.ok) {
          return {
            ok: false,
            error: validatedSchemaResult.error,
          };
        }

        const validatedSchema = validatedSchemaResult.data;

        // Note: Level filtering is already done by SchemaConstraints in ProcessDocumentsOrchestrator
        // We don't need to check level compatibility here again

        // Check for required fields
        const requiredFields = validatedSchema.getRequiredFields();
        for (const field of requiredFields) {
          if (!validatedData.hasField(field)) {
            validationErrors.push(`Missing required field: ${field}`);
          }
        }

        // Check for property types if defined
        const properties = validatedSchema.getProperties();
        if (properties) {
          for (const propertyName of properties.getPropertyNames()) {
            if (validatedData.hasField(propertyName)) {
              const propertySchema = properties.getPropertySchema(propertyName);
              if (propertySchema) {
                const expectedType = propertySchema.getType();
                if (expectedType) {
                  const value = validatedData.getField(propertyName);
                  const actualType = Array.isArray(value)
                    ? "array"
                    : typeof value;

                  if (expectedType !== actualType) {
                    validationErrors.push(
                      `Field '${propertyName}' has wrong type: expected ${expectedType}, got ${actualType}`,
                    );
                  }
                }

                // Check const constraints
                if (propertySchema.hasConstConstraint()) {
                  const expectedValue = propertySchema.getConstValue();
                  const value = validatedData.getField(propertyName);
                  if (value !== expectedValue) {
                    validationErrors.push(
                      `Field '${propertyName}' has wrong value: expected ${
                        String(expectedValue)
                      }, got ${String(value)}`,
                    );
                  }
                }
              }
            }
          }
        }
      }

      // Create validation result using domain object
      const validationResult = validationErrors.length > 0
        ? ValidationResult.createInvalid(validatedData, validationErrors)
        : ValidationResult.createValid(validatedData);

      // Return result in expected format
      return {
        ok: true,
        data: {
          valid: validationResult.isValid(),
          data: validationResult.getData(),
          validationErrors: validationResult.hasErrors()
            ? validationResult.getErrors()
            : undefined,
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "SchemaValidationFailed",
            schema: input.schema,
            data: input.data,
          },
          `Validation failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      };
    }
  }
}
