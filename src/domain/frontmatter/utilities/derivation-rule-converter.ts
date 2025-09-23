import { DerivationRule } from "../../aggregation/index.ts";
import { DomainError } from "../../shared/types/errors.ts";

/**
 * Utility for converting schema derivation rules to domain rules.
 *
 * Following DDD principles:
 * - Utility class for cross-entity operations
 * - Single responsibility: Rule conversion
 * - Pure functions with no side effects
 */
export class DerivationRuleConverter {
  /**
   * Converts schema derivation rules to domain rules with error handling.
   */
  static convertRules(
    derivationRules: Array<{
      sourcePath: string;
      targetField: string;
      unique: boolean;
    }>,
  ): {
    successfulRules: DerivationRule[];
    failedRuleCount: number;
    errors: Array<DomainError & { message: string }>;
  } {
    const successfulRules: DerivationRule[] = [];
    const errors: Array<DomainError & { message: string }> = [];
    let failedRuleCount = 0;

    for (const rule of derivationRules) {
      const ruleResult = DerivationRule.create(
        rule.sourcePath,
        rule.targetField,
        rule.unique,
      );

      if (ruleResult.ok) {
        successfulRules.push(ruleResult.data);
      } else {
        failedRuleCount++;
        errors.push(ruleResult.error);
      }
    }

    return { successfulRules, failedRuleCount, errors };
  }
}
