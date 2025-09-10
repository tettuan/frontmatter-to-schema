/**
 * Unified Rule Validator - Domain Service
 * Coordinates all rule validation services following DDD boundaries
 * Part of Schema Context - Domain Layer
 * Follows Totality principles with Result<T, E> return types
 */

import type { Result } from "../../core/result.ts";
import type { DomainError } from "../../core/result.ts";
import type { ValidationRule } from "../../value-objects/validation-rules.ts";
import { RuleParameterValidator } from "./rule-parameter-validator.ts";
import { RuleTypeValidator } from "./rule-type-validator.ts";
import { RuleNameValidator } from "./rule-name-validator.ts";

/**
 * Unified domain service for complete validation rule validation
 * Orchestrates specialized validators following DDD principles
 */
export class UnifiedRuleValidator {
  /**
   * Validate complete validation rule structure
   * Coordinates all specialized validation services
   */
  static validateRule(
    rule: ValidationRule,
  ): Result<void, DomainError & { message: string }> {
    // Validate rule name using RuleNameValidator
    const nameValidation = RuleNameValidator.validateRuleName(rule.name);
    if (!nameValidation.ok) {
      return nameValidation;
    }

    // Validate rule type using RuleTypeValidator
    const typeValidation = RuleTypeValidator.validateRuleType(rule.type);
    if (!typeValidation.ok) {
      return typeValidation;
    }

    // Validate rule severity using RuleTypeValidator
    const severityValidation = RuleTypeValidator.validateRuleSeverity(
      rule.severity,
    );
    if (!severityValidation.ok) {
      return severityValidation;
    }

    // Validate rule parameters using RuleParameterValidator
    const paramsValidation = RuleParameterValidator.validateRuleParams(rule);
    if (!paramsValidation.ok) {
      return paramsValidation;
    }

    return { ok: true, data: undefined };
  }

  /**
   * Convenience method for parameter validation
   * Delegates to RuleParameterValidator
   */
  static validateRuleParams(
    rule: ValidationRule,
  ): Result<void, DomainError & { message: string }> {
    return RuleParameterValidator.validateRuleParams(rule);
  }
}
