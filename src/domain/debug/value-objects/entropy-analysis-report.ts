import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, ValidationError } from "../../shared/types/errors.ts";

/**
 * Entropy analysis report value object following Totality principles
 * Encapsulates system entropy measurements and reduction planning
 */
export class EntropyAnalysisReport {
  private constructor(
    readonly currentSystemEntropy: number,
    readonly entropyThreshold: number,
    readonly entropyAcceptable: boolean,
    readonly reductionRequired: boolean,
    readonly entropyControlStrategy: "gradual-control" | "aggressive-reduction",
    readonly reductionStepsCount: number,
    readonly expectedEntropyAfterReduction: number,
    readonly entropyReductionPercentage: number,
    readonly currentEntropyStage:
      | "system-entropy-measurement"
      | "complexity-threshold-evaluation"
      | "reduction-plan-generation"
      | "strategy-selection"
      | "reduction-execution"
      | "entropy-validation",
  ) {}

  /**
   * Smart constructor for EntropyAnalysisReport
   * Validates entropy measurements and returns Result type
   */
  static create(
    currentSystemEntropy: number,
    entropyThreshold: number,
    reductionRequired: boolean,
    entropyControlStrategy: "gradual-control" | "aggressive-reduction",
    reductionStepsCount: number,
    expectedEntropyAfterReduction: number,
    entropyReductionPercentage: number,
    currentEntropyStage:
      | "system-entropy-measurement"
      | "complexity-threshold-evaluation"
      | "reduction-plan-generation"
      | "strategy-selection"
      | "reduction-execution"
      | "entropy-validation",
  ): Result<EntropyAnalysisReport, ValidationError & { message: string }> {
    // Validate entropy measurements
    if (currentSystemEntropy < 0 || currentSystemEntropy > 100) {
      return err(createError({
        kind: "OutOfRange",
        field: "currentSystemEntropy",
        value: currentSystemEntropy,
        min: 0,
        max: 100,
        message: "System entropy must be between 0 and 100",
      }));
    }

    if (entropyThreshold < 0 || entropyThreshold > 100) {
      return err(createError({
        kind: "OutOfRange",
        field: "entropyThreshold",
        value: entropyThreshold,
        min: 0,
        max: 100,
        message: "Entropy threshold must be between 0 and 100",
      }));
    }

    // Validate reduction steps count
    if (reductionStepsCount < 0 || reductionStepsCount > 50) {
      return err(createError({
        kind: "OutOfRange",
        field: "reductionStepsCount",
        value: reductionStepsCount,
        min: 0,
        max: 50,
        message: "Reduction steps count must be between 0 and 50",
      }));
    }

    // Validate reduction percentage
    if (entropyReductionPercentage < 0 || entropyReductionPercentage > 100) {
      return err(createError({
        kind: "OutOfRange",
        field: "entropyReductionPercentage",
        value: entropyReductionPercentage,
        min: 0,
        max: 100,
        message: "Entropy reduction percentage must be between 0% and 100%",
      }));
    }

    const entropyAcceptable = currentSystemEntropy <= entropyThreshold;

    return ok(
      new EntropyAnalysisReport(
        currentSystemEntropy,
        entropyThreshold,
        entropyAcceptable,
        reductionRequired,
        entropyControlStrategy,
        reductionStepsCount,
        expectedEntropyAfterReduction,
        entropyReductionPercentage,
        currentEntropyStage,
      ),
    );
  }

  /**
   * Check if entropy reduction is needed
   */
  requiresReduction(): boolean {
    return this.reductionRequired && !this.entropyAcceptable;
  }

  /**
   * Get entropy improvement ratio
   */
  getImprovementRatio(): number {
    if (this.currentSystemEntropy === 0) return 0;
    return (this.currentSystemEntropy - this.expectedEntropyAfterReduction) /
      this.currentSystemEntropy;
  }

  /**
   * Get stage completion percentage
   */
  getStageCompletion(): number {
    const stages = [
      "system-entropy-measurement",
      "complexity-threshold-evaluation",
      "reduction-plan-generation",
      "strategy-selection",
      "reduction-execution",
      "entropy-validation",
    ];

    const currentIndex = stages.indexOf(this.currentEntropyStage);
    return currentIndex >= 0 ? ((currentIndex + 1) / stages.length) * 100 : 0;
  }

  /**
   * Get entropy summary for logging
   */
  toLogSummary(): Record<string, unknown> {
    return {
      currentSystemEntropy: this.currentSystemEntropy,
      entropyThreshold: this.entropyThreshold,
      entropyAcceptable: this.entropyAcceptable,
      reductionRequired: this.reductionRequired,
      entropyControlStrategy: this.entropyControlStrategy,
      reductionStepsCount: this.reductionStepsCount,
      expectedEntropyAfterReduction: this.expectedEntropyAfterReduction,
      entropyReductionPercentage: this.entropyReductionPercentage,
      currentEntropyStage: this.currentEntropyStage,
      requiresReduction: this.requiresReduction(),
      improvementRatio: this.getImprovementRatio(),
      stageCompletion: this.getStageCompletion(),
    };
  }
}
