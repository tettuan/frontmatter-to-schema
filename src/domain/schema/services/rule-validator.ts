/**
 * RuleValidator Domain Service (Legacy)
 *
 * This file is being phased out in favor of smaller, specialized validators.
 * Use UnifiedRuleValidator for new code.
 *
 * @deprecated Use UnifiedRuleValidator and specialized validators instead
 */

import type { Result } from "../../core/result.ts";
import type { DomainError } from "../../core/result.ts";
import type { ValidationRule } from "../../value-objects/validation-rules.ts";
import { UnifiedRuleValidator } from "./unified-rule-validator.ts";

/**
 * Legacy domain service for validation rule validation
 * @deprecated Use UnifiedRuleValidator and specialized validators instead
 */
export class RuleValidator {
  /**
   * Validate rule parameters based on rule type
   * @deprecated Use RuleParameterValidator.validateRuleParams instead
   */
  static validateRuleParams(
    rule: ValidationRule,
  ): Result<void, DomainError & { message: string }> {
    return UnifiedRuleValidator.validateRuleParams(rule);
  }

  /**
   * @deprecated Use RuleTypeValidator.validateRuleType instead
   */
  static validateRuleType(
    _type: unknown,
  ): Result<void, DomainError & { message: string }> {
    throw new Error("Use RuleTypeValidator.validateRuleType instead");
  }

  /**
   * @deprecated Use RuleTypeValidator.validateRuleSeverity instead
   */
  static validateRuleSeverity(
    _severity: unknown,
  ): Result<void, DomainError & { message: string }> {
    throw new Error("Use RuleTypeValidator.validateRuleSeverity instead");
  }

  /**
   * @deprecated Use RuleNameValidator.validateRuleName instead
   */
  static validateRuleName(
    _name: string,
  ): Result<void, DomainError & { message: string }> {
    throw new Error("Use RuleNameValidator.validateRuleName instead");
  }

  /**
   * Validate complete validation rule structure
   * @deprecated Use UnifiedRuleValidator.validateRule instead
   */
  static validateRule(
    rule: ValidationRule,
  ): Result<void, DomainError & { message: string }> {
    return UnifiedRuleValidator.validateRule(rule);
  }
}
