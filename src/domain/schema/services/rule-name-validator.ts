/**
 * Rule Name Validator - Domain Service
 * Validates rule names according to business rules
 * Part of Schema Context - Domain Layer
 * Follows Totality principles with Result<T, E> return types
 */

import type { Result } from "../../core/result.ts";
import { createDomainError, type DomainError } from "../../core/result.ts";

/**
 * Domain service for validation rule name validation
 * Encapsulates naming convention validation logic
 */
export class RuleNameValidator {
  /**
   * Validate rule name is valid and non-empty
   */
  static validateRuleName(
    name: string,
  ): Result<void, DomainError & { message: string }> {
    if (!name || name.trim() === "") {
      return {
        ok: false,
        error: createDomainError(
          { kind: "EmptyInput" },
          "Rule name cannot be empty",
        ),
      };
    }

    const trimmedName = name.trim();

    // Check for valid rule name pattern
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(trimmedName)) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: trimmedName,
            expectedFormat:
              "valid rule name (alphanumeric, underscore, hyphen)",
          },
          "Rule name must start with letter and contain only alphanumeric characters, underscores, and hyphens",
        ),
      };
    }

    // Check for reasonable length
    if (trimmedName.length > 100) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "TooLong",
            value: trimmedName,
            maxLength: 100,
          },
          "Rule name is too long",
        ),
      };
    }

    return { ok: true, data: undefined };
  }
}
