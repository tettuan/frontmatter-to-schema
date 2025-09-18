import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, ValidationError } from "../../shared/types/errors.ts";

/**
 * Totality compliance metrics for tracking type safety and exhaustiveness
 */
export interface TotalityMetrics {
  readonly discriminatedUnionUsage: number; // 0.0 - 1.0
  readonly switchExhaustiveness: number; // 0.0 - 1.0
  readonly resultTypeUsage: number; // 0.0 - 1.0
  readonly smartConstructorUsage: number; // 0.0 - 1.0
  readonly typeSafetyLevel: number; // 0.0 - 1.0
}

/**
 * Totality compliance report value object following Totality principles
 * Encapsulates exhaustiveness analysis and type safety measurements
 */
export class TotalityComplianceReport {
  private constructor(
    readonly currentExhaustiveControlLevel: number,
    readonly totalityComplianceRatio: number,
    readonly typeSafetyGuarantee: "minimal" | "partial" | "complete",
    readonly exhaustiveControlStrategy:
      | "strict-exhaustive"
      | "pragmatic-exhaustive"
      | "pragmatic-mixed",
    readonly estimatedTypeSafetyVariance: number,
    readonly compileTimeVerificationVariance: number,
    readonly currentTotalityStage:
      | "pattern-matching"
      | "switch-exhaustiveness"
      | "default-clause-elimination"
      | "type-system-verification"
      | "compile-time-guarantee"
      | "runtime-safety",
    readonly totalityMetrics: TotalityMetrics,
  ) {}

  /**
   * Smart constructor for TotalityComplianceReport
   * Validates totality measurements and returns Result type
   */
  static create(
    currentExhaustiveControlLevel: number,
    totalityComplianceRatio: number,
    typeSafetyGuarantee: "minimal" | "partial" | "complete",
    exhaustiveControlStrategy:
      | "strict-exhaustive"
      | "pragmatic-exhaustive"
      | "pragmatic-mixed",
    estimatedTypeSafetyVariance: number,
    compileTimeVerificationVariance: number,
    currentTotalityStage:
      | "pattern-matching"
      | "switch-exhaustiveness"
      | "default-clause-elimination"
      | "type-system-verification"
      | "compile-time-guarantee"
      | "runtime-safety",
    totalityMetrics: TotalityMetrics,
  ): Result<TotalityComplianceReport, ValidationError & { message: string }> {
    // Validate exhaustive control level
    if (
      currentExhaustiveControlLevel < 0 || currentExhaustiveControlLevel > 1
    ) {
      return err(createError({
        kind: "OutOfRange",
        field: "currentExhaustiveControlLevel",
        value: currentExhaustiveControlLevel,
        min: 0,
        max: 1,
        message: "Exhaustive control level must be between 0.0 and 1.0",
      }));
    }

    // Validate compliance ratio
    if (totalityComplianceRatio < 0 || totalityComplianceRatio > 1) {
      return err(createError({
        kind: "OutOfRange",
        field: "totalityComplianceRatio",
        value: totalityComplianceRatio,
        min: 0,
        max: 1,
        message: "Totality compliance ratio must be between 0.0 and 1.0",
      }));
    }

    // Validate variance percentages
    if (estimatedTypeSafetyVariance < 0 || estimatedTypeSafetyVariance > 100) {
      return err(createError({
        kind: "OutOfRange",
        field: "estimatedTypeSafetyVariance",
        value: estimatedTypeSafetyVariance,
        min: 0,
        max: 100,
        message: "Type safety variance must be between 0% and 100%",
      }));
    }

    if (
      compileTimeVerificationVariance < 0 ||
      compileTimeVerificationVariance > 100
    ) {
      return err(createError({
        kind: "OutOfRange",
        field: "compileTimeVerificationVariance",
        value: compileTimeVerificationVariance,
        min: 0,
        max: 100,
        message:
          "Compile time verification variance must be between 0% and 100%",
      }));
    }

    // Validate totality metrics
    const metricsValidation = TotalityComplianceReport.validateTotalityMetrics(
      totalityMetrics,
    );
    if (!metricsValidation.ok) {
      return metricsValidation;
    }

    return ok(
      new TotalityComplianceReport(
        currentExhaustiveControlLevel,
        totalityComplianceRatio,
        typeSafetyGuarantee,
        exhaustiveControlStrategy,
        estimatedTypeSafetyVariance,
        compileTimeVerificationVariance,
        currentTotalityStage,
        totalityMetrics,
      ),
    );
  }

  /**
   * Validate totality metrics structure
   */
  private static validateTotalityMetrics(
    metrics: TotalityMetrics,
  ): Result<void, ValidationError & { message: string }> {
    const fields = [
      "discriminatedUnionUsage",
      "switchExhaustiveness",
      "resultTypeUsage",
      "smartConstructorUsage",
      "typeSafetyLevel",
    ] as const;

    for (const field of fields) {
      const value = metrics[field];
      if (value < 0 || value > 1) {
        return err(createError({
          kind: "OutOfRange",
          field: field,
          value: value,
          min: 0,
          max: 1,
          message: `${field} must be between 0.0 and 1.0`,
        }));
      }
    }

    return ok(void 0);
  }

  /**
   * Calculate overall totality score
   */
  calculateOverallScore(): number {
    const weights = {
      discriminatedUnionUsage: 0.25,
      switchExhaustiveness: 0.25,
      resultTypeUsage: 0.25,
      smartConstructorUsage: 0.15,
      typeSafetyLevel: 0.10,
    };

    return (
      this.totalityMetrics.discriminatedUnionUsage *
        weights.discriminatedUnionUsage +
      this.totalityMetrics.switchExhaustiveness *
        weights.switchExhaustiveness +
      this.totalityMetrics.resultTypeUsage * weights.resultTypeUsage +
      this.totalityMetrics.smartConstructorUsage *
        weights.smartConstructorUsage +
      this.totalityMetrics.typeSafetyLevel * weights.typeSafetyLevel
    );
  }

  /**
   * Check if totality compliance is acceptable
   */
  isComplianceAcceptable(threshold: number = 0.8): boolean {
    return this.totalityComplianceRatio >= threshold;
  }

  /**
   * Get stage completion percentage
   */
  getStageCompletion(): number {
    const stages = [
      "pattern-matching",
      "switch-exhaustiveness",
      "default-clause-elimination",
      "type-system-verification",
      "compile-time-guarantee",
      "runtime-safety",
    ];

    const currentIndex = stages.indexOf(this.currentTotalityStage);
    return currentIndex >= 0 ? ((currentIndex + 1) / stages.length) * 100 : 0;
  }

  /**
   * Get totality summary for logging
   */
  toLogSummary(): Record<string, unknown> {
    return {
      currentExhaustiveControlLevel: this.currentExhaustiveControlLevel,
      totalityComplianceRatio: this.totalityComplianceRatio,
      typeSafetyGuarantee: this.typeSafetyGuarantee,
      exhaustiveControlStrategy: this.exhaustiveControlStrategy,
      estimatedTypeSafetyVariance: this.estimatedTypeSafetyVariance,
      compileTimeVerificationVariance: this.compileTimeVerificationVariance,
      currentTotalityStage: this.currentTotalityStage,
      totalityMetrics: this.totalityMetrics,
      overallScore: this.calculateOverallScore(),
      complianceAcceptable: this.isComplianceAcceptable(),
      stageCompletion: this.getStageCompletion(),
    };
  }
}
