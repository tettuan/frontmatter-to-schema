/**
 * Rule Parameter Validator - Domain Service
 * Validates validation rule parameters according to business rules
 * Part of Schema Context - Domain Layer
 * Follows Totality principles with Result<T, E> return types
 */

import type { Result } from "../../core/result.ts";
import { createDomainError, type DomainError } from "../../core/result.ts";
import type { ValidationRule } from "../../value-objects/validation-rules.ts";

/**
 * Domain service for validation rule parameter validation
 * Encapsulates parameter validation logic for different rule types
 */
export class RuleParameterValidator {
  /**
   * Validate rule parameters based on rule type
   */
  static validateRuleParams(
    rule: ValidationRule,
  ): Result<void, DomainError & { message: string }> {
    switch (rule.type) {
      case "required":
        // Required rules don't need additional parameters
        break;

      case "type":
        if (!rule.params?.expectedType) {
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "InvalidFormat",
                input: JSON.stringify(rule.params),
                expectedFormat: "type rule with expectedType param",
              },
              "Type validation rule must have 'expectedType' parameter",
            ),
          };
        }
        break;

      case "format":
        if (!rule.params?.format && !rule.params?.pattern) {
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "InvalidFormat",
                input: JSON.stringify(rule.params),
                expectedFormat: "format rule with format or pattern param",
              },
              "Format validation rule must have 'format' or 'pattern' parameter",
            ),
          };
        }
        break;

      case "pattern":
        if (!rule.params?.pattern) {
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "InvalidFormat",
                input: JSON.stringify(rule.params),
                expectedFormat: "pattern rule with pattern param",
              },
              "Pattern validation rule must have 'pattern' parameter",
            ),
          };
        }

        // Validate the regex pattern
        try {
          new RegExp(rule.params.pattern as string);
        } catch (_error) {
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "InvalidRegex",
                pattern: String(rule.params.pattern),
              },
              `Invalid regex pattern in rule '${rule.name}'`,
            ),
          };
        }
        break;

      case "range":
        if (rule.params?.min === undefined && rule.params?.max === undefined) {
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "InvalidFormat",
                input: JSON.stringify(rule.params),
                expectedFormat: "range rule with min or max param",
              },
              "Range validation rule must have 'min' or 'max' parameter",
            ),
          };
        }

        // Validate numeric parameters
        if (
          rule.params?.min !== undefined &&
          typeof rule.params.min !== "number"
        ) {
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "InvalidFormat",
                input: JSON.stringify(rule.params?.min),
                expectedFormat: "number",
              },
              "Range validation rule 'min' parameter must be a number",
            ),
          };
        }

        if (
          rule.params?.max !== undefined &&
          typeof rule.params.max !== "number"
        ) {
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "InvalidFormat",
                input: JSON.stringify(rule.params?.max),
                expectedFormat: "number",
              },
              "Range validation rule 'max' parameter must be a number",
            ),
          };
        }

        // Validate min <= max
        if (
          rule.params?.min !== undefined &&
          rule.params?.max !== undefined &&
          rule.params.min > rule.params.max
        ) {
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "OutOfRange",
                value: `min: ${rule.params.min}, max: ${rule.params.max}`,
                min: rule.params.min,
                max: rule.params.max,
              },
              "Range validation rule 'min' must be less than or equal to 'max'",
            ),
          };
        }
        break;

      case "length":
        if (
          rule.params?.minLength === undefined &&
          rule.params?.maxLength === undefined
        ) {
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "InvalidFormat",
                input: JSON.stringify(rule.params),
                expectedFormat: "length rule with minLength or maxLength param",
              },
              "Length validation rule must have 'minLength' or 'maxLength' parameter",
            ),
          };
        }

        // Validate numeric parameters
        if (
          rule.params?.minLength !== undefined &&
          typeof rule.params.minLength !== "number"
        ) {
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "InvalidFormat",
                input: JSON.stringify(rule.params?.minLength),
                expectedFormat: "number",
              },
              "Length validation rule 'minLength' parameter must be a number",
            ),
          };
        }

        if (
          rule.params?.maxLength !== undefined &&
          typeof rule.params.maxLength !== "number"
        ) {
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "InvalidFormat",
                input: JSON.stringify(rule.params?.maxLength),
                expectedFormat: "number",
              },
              "Length validation rule 'maxLength' parameter must be a number",
            ),
          };
        }

        // Validate minLength >= 0
        if (
          rule.params?.minLength !== undefined &&
          rule.params.minLength < 0
        ) {
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "OutOfRange",
                value: rule.params.minLength,
                min: 0,
              },
              "Length validation rule 'minLength' must be non-negative",
            ),
          };
        }

        // Validate maxLength >= 0
        if (
          rule.params?.maxLength !== undefined &&
          rule.params.maxLength < 0
        ) {
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "OutOfRange",
                value: rule.params.maxLength,
                min: 0,
              },
              "Length validation rule 'maxLength' must be non-negative",
            ),
          };
        }

        // Validate minLength <= maxLength
        if (
          rule.params?.minLength !== undefined &&
          rule.params?.maxLength !== undefined &&
          rule.params.minLength > rule.params.maxLength
        ) {
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "OutOfRange",
                value:
                  `minLength: ${rule.params.minLength}, maxLength: ${rule.params.maxLength}`,
                min: rule.params.minLength,
                max: rule.params.maxLength,
              },
              "Length validation rule 'minLength' must be less than or equal to 'maxLength'",
            ),
          };
        }
        break;

      case "enum":
        if (!rule.params?.values || !Array.isArray(rule.params.values)) {
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "InvalidFormat",
                input: JSON.stringify(rule.params),
                expectedFormat: "enum rule with values array param",
              },
              "Enum validation rule must have 'values' array parameter",
            ),
          };
        }

        if (rule.params.values.length === 0) {
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "InvalidFormat",
                input: JSON.stringify(rule.params.values),
                expectedFormat: "non-empty array",
              },
              "Enum validation rule 'values' array cannot be empty",
            ),
          };
        }
        break;

      case "custom":
        if (!rule.params?.validatorFunction) {
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "InvalidFormat",
                input: JSON.stringify(rule.params),
                expectedFormat: "custom rule with validatorFunction param",
              },
              "Custom validation rule must have 'validatorFunction' parameter",
            ),
          };
        }

        if (typeof rule.params.validatorFunction !== "function") {
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "InvalidFormat",
                input: typeof rule.params.validatorFunction,
                expectedFormat: "function",
              },
              "Custom validation rule 'validatorFunction' must be a function",
            ),
          };
        }
        break;

      default: {
        // Exhaustive check for RuleType
        const _exhaustive: never = rule.type;
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidFormat",
              input: String(rule.type),
              expectedFormat: "valid rule type",
            },
            `Unknown validation rule type: ${String(rule.type)}`,
          ),
        };
      }
    }

    return { ok: true, data: undefined };
  }
}
