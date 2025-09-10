/**
 * ValidationRules Value Object
 *
 * Represents a set of validation rules for schema validation
 * Follows Totality principles with Smart Constructor pattern
 */

import type { Result } from "../core/result.ts";
import type { DomainError } from "../core/result.ts";
import { RuleExtractor } from "../schema/services/rule-extractor.ts";

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
   * Validates rule structure and consistency using domain services
   */
  static create(
    rules: ValidationRule[],
    strictMode = false,
  ): Result<ValidationRules, DomainError & { message: string }> {
    // Extract and validate rules using domain service
    const extractionResult = RuleExtractor.extractRules(rules, strictMode);
    if (!extractionResult.ok) {
      return extractionResult;
    }

    return {
      ok: true,
      data: new ValidationRules(extractionResult.data, strictMode),
    };
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
   * Get rules by type using domain service
   */
  getRulesByType(type: RuleType): ReadonlyArray<ValidationRule> {
    return RuleExtractor.filterRules(this.rules, (rule) => rule.type === type);
  }

  /**
   * Get rules by severity using domain service
   */
  getRulesBySeverity(severity: RuleSeverity): ReadonlyArray<ValidationRule> {
    return RuleExtractor.filterRules(
      this.rules,
      (rule) => rule.severity === severity,
    );
  }

  /**
   * Get a specific rule by name using domain service
   */
  getRule(
    name: string,
  ): Result<ValidationRule, DomainError & { message: string }> {
    return RuleExtractor.findRule(this.rules, name);
  }

  /**
   * Check if a rule exists
   */
  hasRule(name: string): boolean {
    return this.rules.some((r) => r.name === name);
  }

  /**
   * Check if rules contain errors using domain service
   */
  hasErrors(): boolean {
    return RuleExtractor.hasErrors(this.rules);
  }

  /**
   * Check if rules contain warnings using domain service
   */
  hasWarnings(): boolean {
    return RuleExtractor.hasWarnings(this.rules);
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
   * Merge with another set of rules using domain service
   */
  merge(
    other: ValidationRules,
  ): Result<ValidationRules, DomainError & { message: string }> {
    const isStrictMode = this.strictMode || other.strictMode;
    const mergeResult = RuleExtractor.mergeRules(
      this.rules,
      other.rules,
      isStrictMode,
    );

    if (!mergeResult.ok) {
      return mergeResult;
    }

    return ValidationRules.create(mergeResult.data, isStrictMode);
  }

  /**
   * Filter rules by predicate using domain service
   */
  filter(
    predicate: (rule: ValidationRule) => boolean,
  ): Result<ValidationRules, DomainError & { message: string }> {
    const filteredRules = RuleExtractor.filterRules(this.rules, predicate);
    return ValidationRules.create(filteredRules, this.strictMode);
  }

  /**
   * String representation for debugging
   */
  toString(): string {
    const modeStr = this.strictMode ? "strict" : "normal";
    return `ValidationRules(${this.rules.length} rules, ${modeStr} mode)`;
  }
}
