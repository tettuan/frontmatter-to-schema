/**
 * Validate Frontmatter Use Case
 *
 * Responsible for validating frontmatter data against schema
 * Part of the Schema Management Context (validation aspect) in DDD
 * Follows Totality principles with Result types
 */

import type { UseCase } from "../base.usecase.ts";
import type { DomainError, Result } from "../../../domain/core/result.ts";
import { createDomainError } from "../../../domain/core/result.ts";

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
      // Ensure data is an object
      if (
        !input.data || typeof input.data !== "object" ||
        Array.isArray(input.data)
      ) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidFormat",
              input: String(input.data),
              expectedFormat: "object",
            },
            "Data to validate must be an object",
          ),
        };
      }

      const data = input.data as Record<string, unknown>;
      const validationErrors: string[] = [];

      // Basic schema validation if schema is provided
      if (
        input.schema && typeof input.schema === "object" &&
        !Array.isArray(input.schema)
      ) {
        const schema = input.schema as Record<string, unknown>;

        // Check for required fields if defined
        if (schema.required && Array.isArray(schema.required)) {
          for (const field of schema.required) {
            if (typeof field === "string" && !(field in data)) {
              validationErrors.push(`Missing required field: ${field}`);
            }
          }
        }

        // Check for property types if defined
        if (schema.properties && typeof schema.properties === "object") {
          const properties = schema.properties as Record<string, unknown>;

          for (const [key, propSchema] of Object.entries(properties)) {
            if (key in data && propSchema && typeof propSchema === "object") {
              const prop = propSchema as Record<string, unknown>;
              const value = data[key];

              // Basic type checking
              if (prop.type) {
                const expectedType = prop.type as string;
                const actualType = Array.isArray(value)
                  ? "array"
                  : typeof value;

                if (expectedType !== actualType) {
                  validationErrors.push(
                    `Field '${key}' has wrong type: expected ${expectedType}, got ${actualType}`,
                  );
                }
              }
            }
          }
        }
      }

      // Return validation result
      if (validationErrors.length > 0) {
        return {
          ok: true,
          data: {
            valid: false,
            data,
            validationErrors,
          },
        };
      }

      return {
        ok: true,
        data: {
          valid: true,
          data,
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
