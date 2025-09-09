/**
 * Field Validation Service
 * Validates individual fields against schema definitions
 */

import type { DomainError, Result } from "../core/result.ts";
import { TypeValidationService } from "./type-validation.service.ts";

export class FieldValidationService {
  private typeValidator = new TypeValidationService();

  validateObjectFields(
    data: Record<string, unknown>,
    properties: Record<string, unknown>,
    allowAdditional: boolean,
  ): Result<unknown, DomainError> {
    // Validate each property
    for (const [key, propSchema] of Object.entries(properties)) {
      if (key in data) {
        const value = data[key];
        const validationResult = this.validateProperty(value, propSchema);
        if (!validationResult.ok) {
          return validationResult;
        }
      }
    }

    // Check for additional properties if not allowed
    if (!allowAdditional) {
      for (const key of Object.keys(data)) {
        if (!(key in properties)) {
          return {
            ok: false,
            error: {
              kind: "InvalidFormat",
              input: key,
              expectedFormat: "property defined in schema",
            },
          };
        }
      }
    }

    return { ok: true, data };
  }

  private validateProperty(
    value: unknown,
    propSchema: unknown,
  ): Result<unknown, DomainError> {
    if (typeof propSchema === "object" && propSchema !== null) {
      const schema = propSchema as Record<string, unknown>;
      if (schema.type && typeof schema.type === "string") {
        return this.typeValidator.validateType(value, schema.type);
      }
    }

    // If no type specified, accept any value
    return { ok: true, data: value };
  }
}
