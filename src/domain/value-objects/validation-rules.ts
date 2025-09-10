/**
 * ValidationRules Value Object
 *
 * Represents a set of validation rules for schema validation
 * Follows Totality principles with Smart Constructor pattern
 */

import type { Result } from "../core/result.ts";
import { createDomainError, type DomainError } from "../core/result.ts";

/**
 * Rule severity levels as discriminated union
 */
export type RuleSeverity = "error" | "warning" | "info";

/**
 * Validation rule types as discriminated union
 */
export type RuleType =
  | "required"
  | "type"
  | "format"
  | "pattern"
  | "range"
  | "length"
  | "enum"
  | "custom";

/**
 * Individual validation rule
 */
export interface ValidationRule {
  readonly name: string;
  readonly type: RuleType;
  readonly severity: RuleSeverity;
  readonly message?: string;
  readonly params?: Record<string, unknown>;
}

/**
 * ValidationRules value object with validation
 * Ensures rules are valid and well-formed
 */
export class ValidationRules {
  private constructor(
    private readonly rules: ReadonlyArray<ValidationRule>,
    private readonly strictMode: boolean = false,
  ) {}

  /**
   * Smart Constructor for ValidationRules
   * Validates rule structure and consistency
   */
  static create(
    rules: ValidationRule[],
    strictMode = false,
  ): Result<ValidationRules, DomainError & { message: string }> {
    // Check for empty rules when strict mode is enabled
    if (strictMode && (!rules || rules.length === 0)) {
      return {
        ok: false,
        error: createDomainError(
          { kind: "EmptyInput" },
          "Validation rules cannot be empty in strict mode",
        ),
      };
    }

    // Allow empty rules in non-strict mode
    if (!rules || rules.length === 0) {
      return {
        ok: true,
        data: new ValidationRules([], strictMode),
      };
    }

    // Validate each rule
    const validatedRules: ValidationRule[] = [];
    const ruleNames = new Set<string>();

    for (const rule of rules) {
      // Check for required fields
      if (!rule.name || rule.name.trim() === "") {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidFormat",
              input: JSON.stringify(rule),
              expectedFormat: "rule with non-empty name",
            },
            "Validation rule must have a non-empty name",
          ),
        };
      }

      // Check for duplicate rule names
      if (ruleNames.has(rule.name)) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidFormat",
              input: rule.name,
              expectedFormat: "unique rule name",
            },
            `Duplicate validation rule name: ${rule.name}`,
          ),
        };
      }

      // Validate rule type
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
      if (!validTypes.includes(rule.type)) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidFormat",
              input: rule.type,
              expectedFormat: validTypes.join(", "),
            },
            `Invalid rule type: ${rule.type}`,
          ),
        };
      }

      // Validate severity
      const validSeverities: RuleSeverity[] = ["error", "warning", "info"];
      if (!validSeverities.includes(rule.severity)) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidFormat",
              input: rule.severity,
              expectedFormat: validSeverities.join(", "),
            },
            `Invalid rule severity: ${rule.severity}`,
          ),
        };
      }

      // Validate rule-specific parameters
      const paramValidation = ValidationRules.validateRuleParams(rule);
      if (!paramValidation.ok) {
        return paramValidation;
      }

      ruleNames.add(rule.name);
      validatedRules.push({
        name: rule.name.trim(),
        type: rule.type,
        severity: rule.severity,
        message: rule.message?.trim(),
        params: rule.params,
      });
    }

    return {
      ok: true,
      data: new ValidationRules(Object.freeze(validatedRules), strictMode),
    };
  }

  /**
   * Validate rule-specific parameters
   */
  private static validateRuleParams(
    rule: ValidationRule,
  ): Result<void, DomainError & { message: string }> {
    switch (rule.type) {
      case "required":
        // No specific params needed
        break;

      case "type":
        if (!rule.params?.expectedType) {
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "InvalidFormat",
                input: rule.name,
                expectedFormat: "type rule with expectedType param",
              },
              `Type rule '${rule.name}' must have expectedType parameter`,
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
                input: rule.name,
                expectedFormat: "pattern rule with pattern param",
              },
              `Pattern rule '${rule.name}' must have pattern parameter`,
            ),
          };
        }
        // Validate regex pattern
        try {
          new RegExp(rule.params.pattern as string);
        } catch (error) {
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "InvalidFormat",
                input: rule.params.pattern as string,
                expectedFormat: "valid regex pattern",
              },
              `Invalid regex pattern in rule '${rule.name}': ${
                error instanceof Error ? error.message : String(error)
              }`,
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
                input: rule.name,
                expectedFormat: "range rule with min or max param",
              },
              `Range rule '${rule.name}' must have at least min or max parameter`,
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
                input: rule.name,
                expectedFormat: "length rule with minLength or maxLength param",
              },
              `Length rule '${rule.name}' must have at least minLength or maxLength parameter`,
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
                input: rule.name,
                expectedFormat: "enum rule with values array param",
              },
              `Enum rule '${rule.name}' must have values array parameter`,
            ),
          };
        }
        break;

      case "format":
      case "custom":
        // These can have flexible params
        break;

      default: {
        // Exhaustive check
        const _exhaustiveCheck: never = rule.type;
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidFormat",
              input: String(_exhaustiveCheck),
              expectedFormat: "valid rule type",
            },
            `Unknown rule type: ${String(_exhaustiveCheck)}`,
          ),
        };
      }
    }

    return { ok: true, data: undefined };
  }

  /**
   * Create empty validation rules
   */
  static createEmpty(): ValidationRules {
    return new ValidationRules([], false);
  }

  /**
   * Get all rules
   */
  getRules(): ReadonlyArray<ValidationRule> {
    return this.rules;
  }

  /**
   * Get rules by type
   */
  getRulesByType(type: RuleType): ReadonlyArray<ValidationRule> {
    return this.rules.filter((rule) => rule.type === type);
  }

  /**
   * Get rules by severity
   */
  getRulesBySeverity(severity: RuleSeverity): ReadonlyArray<ValidationRule> {
    return this.rules.filter((rule) => rule.severity === severity);
  }

  /**
   * Get a specific rule by name
   */
  getRule(
    name: string,
  ): Result<ValidationRule, DomainError & { message: string }> {
    const rule = this.rules.find((r) => r.name === name);
    if (!rule) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "NotFound",
            resource: "rule",
            name,
          },
          `Validation rule not found: ${name}`,
        ),
      };
    }
    return { ok: true, data: rule };
  }

  /**
   * Check if a rule exists
   */
  hasRule(name: string): boolean {
    return this.rules.some((r) => r.name === name);
  }

  /**
   * Check if rules contain errors
   */
  hasErrors(): boolean {
    return this.rules.some((r) => r.severity === "error");
  }

  /**
   * Check if rules contain warnings
   */
  hasWarnings(): boolean {
    return this.rules.some((r) => r.severity === "warning");
  }

  /**
   * Get rule count
   */
  count(): number {
    return this.rules.length;
  }

  /**
   * Check if rules are empty
   */
  isEmpty(): boolean {
    return this.rules.length === 0;
  }

  /**
   * Check if in strict mode
   */
  isStrictMode(): boolean {
    return this.strictMode;
  }

  /**
   * Merge with another set of rules
   */
  merge(
    other: ValidationRules,
  ): Result<ValidationRules, DomainError & { message: string }> {
    const mergedRules = [...this.rules];
    const existingNames = new Set(this.rules.map((r) => r.name));

    for (const rule of other.rules) {
      if (existingNames.has(rule.name)) {
        // In strict mode, duplicates are errors
        if (this.strictMode || other.strictMode) {
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "InvalidFormat",
                input: rule.name,
                expectedFormat: "unique rule name after merge",
              },
              `Cannot merge: duplicate rule name '${rule.name}'`,
            ),
          };
        }
        // In non-strict mode, skip duplicates
        continue;
      }
      mergedRules.push(rule);
    }

    return ValidationRules.create(
      mergedRules,
      this.strictMode || other.strictMode,
    );
  }

  /**
   * Filter rules by predicate
   */
  filter(
    predicate: (rule: ValidationRule) => boolean,
  ): Result<ValidationRules, DomainError & { message: string }> {
    const filteredRules = this.rules.filter(predicate);
    return ValidationRules.create([...filteredRules], this.strictMode);
  }

  /**
   * String representation for debugging
   */
  toString(): string {
    const modeStr = this.strictMode ? "strict" : "normal";
    return `ValidationRules(${this.rules.length} rules, ${modeStr} mode)`;
  }
}
