/**
 * Type Validation Service
 * Handles type validation for schema properties
 */

import type { DomainError, Result } from "../core/result.ts";

export class TypeValidationService {
  validateType(
    value: unknown,
    expectedType: string,
  ): Result<unknown, DomainError> {
    switch (expectedType) {
      case "string":
        if (typeof value === "string") {
          return { ok: true, data: value };
        }
        break;
      case "number":
        if (typeof value === "number") {
          return { ok: true, data: value };
        }
        break;
      case "boolean":
        if (typeof value === "boolean") {
          return { ok: true, data: value };
        }
        break;
      case "array":
        if (Array.isArray(value)) {
          return { ok: true, data: value };
        }
        break;
      case "object":
        if (
          typeof value === "object" && value !== null && !Array.isArray(value)
        ) {
          return { ok: true, data: value };
        }
        break;
      default:
        return { ok: true, data: value };
    }

    return {
      ok: false,
      error: {
        kind: "InvalidFormat",
        input: String(value),
        expectedFormat: expectedType,
      },
    };
  }
}
