/**
 * RuleValidator Domain Service
 *
 * Validates validation rules, parameters, and types according to business rules
 * Follows Totality principles with Result<T, E> return types
 */

import type { Result } from "../../core/result.ts";
import { createDomainError, type DomainError } from "../../core/result.ts";
import type {
  RuleSeverity,
  RuleType,
  ValidationRule,
} from "../../value-objects/validation-rules.ts";

/**
 * Domain service for validation rule validation
 * Encapsulates all validation logic for rules, parameters, and types
 */
export class RuleValidator {
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
                expectedFormat: "range rule with min and/or max param",
              },
              "Range validation rule must have 'min' and/or 'max' parameter",
            ),
          };
        }

        if (
          rule.params?.min !== undefined && typeof rule.params.min !== "number"
        ) {
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "InvalidFormat",
                input: String(rule.params.min),
                expectedFormat: "numeric min value",
              },
              "Range rule 'min' parameter must be a number",
            ),
          };
        }

        if (
          rule.params?.max !== undefined && typeof rule.params.max !== "number"
        ) {
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "InvalidFormat",
                input: String(rule.params.max),
                expectedFormat: "numeric max value",
              },
              "Range rule 'max' parameter must be a number",
            ),
          };
        }

        if (
          rule.params?.min !== undefined &&
          rule.params?.max !== undefined &&
          rule.params.min > rule.params.max
        ) {
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "InvalidFormat",
                input: `min: ${rule.params.min}, max: ${rule.params.max}`,
                expectedFormat: "min <= max",
              },
              "Range rule 'min' must be less than or equal to 'max'",
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
                expectedFormat:
                  "length rule with minLength and/or maxLength param",
              },
              "Length validation rule must have 'minLength' and/or 'maxLength' parameter",
            ),
          };
        }

        if (
          rule.params?.minLength !== undefined &&
          typeof rule.params.minLength !== "number"
        ) {
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "InvalidFormat",
                input: String(rule.params.minLength),
                expectedFormat: "numeric minLength value",
              },
              "Length rule 'minLength' parameter must be a number",
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
                input: String(rule.params.maxLength),
                expectedFormat: "numeric maxLength value",
              },
              "Length rule 'maxLength' parameter must be a number",
            ),
          };
        }

        if (
          rule.params?.minLength !== undefined &&
          rule.params?.maxLength !== undefined &&
          rule.params.minLength > rule.params.maxLength
        ) {
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "InvalidFormat",
                input:
                  `minLength: ${rule.params.minLength}, maxLength: ${rule.params.maxLength}`,
                expectedFormat: "minLength <= maxLength",
              },
              "Length rule 'minLength' must be less than or equal to 'maxLength'",
            ),
          };
        }

        if (rule.params?.minLength !== undefined && rule.params.minLength < 0) {
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "OutOfRange",
                value: rule.params.minLength,
                min: 0,
              },
              "Length rule 'minLength' must be non-negative",
            ),
          };
        }

        if (rule.params?.maxLength !== undefined && rule.params.maxLength < 0) {
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "OutOfRange",
                value: rule.params.maxLength,
                min: 0,
              },
              "Length rule 'maxLength' must be non-negative",
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
              "Enum validation rule must have 'values' parameter as array",
            ),
          };
        }

        if (rule.params.values.length === 0) {
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "InvalidFormat",
                input: "empty values array",
                expectedFormat: "non-empty values array",
              },
              "Enum rule 'values' array cannot be empty",
            ),
          };
        }
        break;

      case "custom":
        if (!rule.params?.validator) {
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "InvalidFormat",
                input: JSON.stringify(rule.params),
                expectedFormat: "custom rule with validator param",
              },
              "Custom validation rule must have 'validator' parameter",
            ),
          };
        }
        break;

      default:
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidFormat",
              input: String(rule.type),
              expectedFormat: "valid rule type",
            },
            `Unknown rule type: ${String(rule.type)}`,
          ),
        };
    }

    return { ok: true, data: undefined };
  }

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

  /**
   * Validate complete validation rule structure
   */
  static validateRule(
    rule: ValidationRule,
  ): Result<void, DomainError & { message: string }> {
    // Validate rule name
    const nameValidation = RuleValidator.validateRuleName(rule.name);
    if (!nameValidation.ok) {
      return nameValidation;
    }

    // Validate rule type
    const typeValidation = RuleValidator.validateRuleType(rule.type);
    if (!typeValidation.ok) {
      return typeValidation;
    }

    // Validate rule severity
    const severityValidation = RuleValidator.validateRuleSeverity(
      rule.severity,
    );
    if (!severityValidation.ok) {
      return severityValidation;
    }

    // Validate rule parameters
    const paramsValidation = RuleValidator.validateRuleParams(rule);
    if (!paramsValidation.ok) {
      return paramsValidation;
    }

    return { ok: true, data: undefined };
  }
}
