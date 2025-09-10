/**
 * RuleExtractor Domain Service
 *
 * Handles rule extraction, creation, and collection operations
 * Encapsulates complex rule manipulation and validation logic
 */

import type { Result } from "../../core/result.ts";
import { createDomainError, type DomainError } from "../../core/result.ts";
import type {
  RuleSeverity,
  RuleType,
  ValidationRule,
} from "../../value-objects/validation-rules.ts";
import { UnifiedRuleValidator } from "./unified-rule-validator.ts";

/**
 * Domain service for rule extraction and collection operations
 * Handles rule creation, duplication checking, and collection validation
 */
export class RuleExtractor {
  /**
   * Extract and validate rules from raw input
   */
  static extractRules(
    rules: ValidationRule[],
    strictMode = false,
  ): Result<ReadonlyArray<ValidationRule>, DomainError & { message: string }> {
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
        data: Object.freeze([]),
      };
    }

    // Validate each rule and check for duplicates
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

      // Validate complete rule structure using RuleValidator
      const ruleValidation = UnifiedRuleValidator.validateRule(rule);
      if (!ruleValidation.ok) {
        return ruleValidation;
      }

      ruleNames.add(rule.name);
      validatedRules.push(RuleExtractor.normalizeRule(rule));
    }

    return {
      ok: true,
      data: Object.freeze(validatedRules),
    };
  }

  /**
   * Normalize rule by trimming strings and ensuring consistency
   */
  static normalizeRule(rule: ValidationRule): ValidationRule {
    return {
      name: rule.name.trim(),
      type: rule.type,
      severity: rule.severity,
      message: rule.message?.trim(),
      params: rule.params,
    };
  }

  /**
   * Check for duplicate rule names in collection
   */
  static checkDuplicateNames(
    rules: ValidationRule[],
  ): Result<void, DomainError & { message: string }> {
    const ruleNames = new Set<string>();

    for (const rule of rules) {
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
      ruleNames.add(rule.name);
    }

    return { ok: true, data: undefined };
  }

  /**
   * Filter rules by predicate function
   */
  static filterRules(
    rules: ReadonlyArray<ValidationRule>,
    predicate: (rule: ValidationRule) => boolean,
  ): ValidationRule[] {
    return rules.filter(predicate);
  }

  /**
   * Group rules by type
   */
  static groupRulesByType(
    rules: ReadonlyArray<ValidationRule>,
  ): Map<RuleType, ValidationRule[]> {
    const grouped = new Map<RuleType, ValidationRule[]>();

    for (const rule of rules) {
      const existing = grouped.get(rule.type) || [];
      existing.push(rule);
      grouped.set(rule.type, existing);
    }

    return grouped;
  }

  /**
   * Group rules by severity
   */
  static groupRulesBySeverity(
    rules: ReadonlyArray<ValidationRule>,
  ): Map<RuleSeverity, ValidationRule[]> {
    const grouped = new Map<RuleSeverity, ValidationRule[]>();

    for (const rule of rules) {
      const existing = grouped.get(rule.severity) || [];
      existing.push(rule);
      grouped.set(rule.severity, existing);
    }

    return grouped;
  }

  /**
   * Merge rule collections with conflict resolution
   */
  static mergeRules(
    primary: ReadonlyArray<ValidationRule>,
    secondary: ReadonlyArray<ValidationRule>,
    strictMode = false,
  ): Result<ValidationRule[], DomainError & { message: string }> {
    const mergedRules = [...primary];
    const existingNames = new Set(primary.map((r) => r.name));

    for (const rule of secondary) {
      if (existingNames.has(rule.name)) {
        // In strict mode, duplicates are errors
        if (strictMode) {
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

    return { ok: true, data: mergedRules };
  }

  /**
   * Find rule by name
   */
  static findRule(
    rules: ReadonlyArray<ValidationRule>,
    name: string,
  ): Result<ValidationRule, DomainError & { message: string }> {
    const rule = rules.find((r) => r.name === name);
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
   * Check if rules contain errors
   */
  static hasErrors(rules: ReadonlyArray<ValidationRule>): boolean {
    return rules.some((r) => r.severity === "error");
  }

  /**
   * Check if rules contain warnings
   */
  static hasWarnings(rules: ReadonlyArray<ValidationRule>): boolean {
    return rules.some((r) => r.severity === "warning");
  }

  /**
   * Get rule statistics
   */
  static getRuleStats(rules: ReadonlyArray<ValidationRule>): {
    total: number;
    byType: Record<RuleType, number>;
    bySeverity: Record<RuleSeverity, number>;
  } {
    const stats = {
      total: rules.length,
      byType: {} as Record<RuleType, number>,
      bySeverity: {} as Record<RuleSeverity, number>,
    };

    for (const rule of rules) {
      stats.byType[rule.type] = (stats.byType[rule.type] || 0) + 1;
      stats.bySeverity[rule.severity] = (stats.bySeverity[rule.severity] || 0) +
        1;
    }

    return stats;
  }
}
