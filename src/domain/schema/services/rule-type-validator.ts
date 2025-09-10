/**
 * Rule Type Validator - Domain Service
 * Validates rule types and severity levels according to business rules
 * Part of Schema Context - Domain Layer
 * Follows Totality principles with Result<T, E> return types
 */

import type { Result } from "../../core/result.ts";
import { createDomainError, type DomainError } from "../../core/result.ts";
import type {
  RuleSeverity,
  RuleType,
} from "../../value-objects/validation-rules.ts";

/**
 * Domain service for validation rule type and severity validation
 * Encapsulates type system validation logic
 */
export class RuleTypeValidator {
  /**
   * Validate rule type is supported
   */
  static validateRuleType(
    type: RuleType,
  ): Result<void, DomainError & { message: string }> {
    const validTypes: RuleType[] = [
      "required",
      "type",
      "format",
      "pattern",
      "range",
      "length",
      "enum",
      "custom",
    ];

    if (!validTypes.includes(type)) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: type,
            expectedFormat: validTypes.join(", "),
          },
          `Invalid rule type: ${type}`,
        ),
      };
    }

    return { ok: true, data: undefined };
  }

  /**
   * Validate rule severity level
   */
  static validateRuleSeverity(
    severity: RuleSeverity,
  ): Result<void, DomainError & { message: string }> {
    const validSeverities: RuleSeverity[] = ["error", "warning", "info"];

    if (!validSeverities.includes(severity)) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: severity,
            expectedFormat: validSeverities.join(", "),
          },
          `Invalid rule severity: ${severity}`,
        ),
      };
    }

    return { ok: true, data: undefined };
  }
}
