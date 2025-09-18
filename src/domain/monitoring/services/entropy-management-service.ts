import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";

/**
 * Complexity factors for entropy calculation
 * Following Totality principle with constrained values
 */
export interface ComplexityFactors {
  readonly fileCount: number;
  readonly schemaComplexity: number;
  readonly templateComplexity: number;
  readonly aggregationComplexity: number;
  readonly parallelismLevel: number;
  readonly errorHandlingComplexity: number;
  readonly stateSpaceSize: number;
  readonly integrationPoints: number;
}

/**
 * Entropy reduction plan with specific actions
 */
export interface EntropyReductionPlan {
  readonly currentEntropy: number;
  readonly targetEntropy: number;
  readonly reductionStrategies: ReadonlyArray<ReductionStrategy>;
  readonly estimatedReduction: number;
  readonly priority: Priority;
}

/**
 * Individual reduction strategy
 */
interface ReductionStrategy {
  readonly kind:
    | "simplification"
    | "modularization"
    | "standardization"
    | "elimination";
  readonly target: string;
  readonly impact: number;
  readonly effort: EffortLevel;
}

type Priority = "critical" | "high" | "medium" | "low";
type EffortLevel = "minimal" | "moderate" | "significant";

/**
 * Entropy thresholds configuration
 * Using Smart Constructor pattern for validation
 */
class EntropyThresholds {
  private constructor(
    readonly acceptable: number,
    readonly warning: number,
    readonly critical: number,
  ) {}

  static create(
    acceptable: number,
    warning: number,
    critical: number,
  ): Result<EntropyThresholds, DomainError & { message: string }> {
    if (acceptable <= 0 || warning <= 0 || critical <= 0) {
      return err(createError({
        kind: "ConfigurationError",
        message: "All thresholds must be positive",
      }));
    }

    if (!(acceptable < warning && warning < critical)) {
      return err(createError({
        kind: "ConfigurationError",
        message: "Thresholds must be in order: acceptable < warning < critical",
      }));
    }

    return ok(new EntropyThresholds(acceptable, warning, critical));
  }

  getLevel(entropy: number): "acceptable" | "warning" | "critical" {
    if (entropy <= this.acceptable) return "acceptable";
    if (entropy <= this.warning) return "warning";
    return "critical";
  }
}

/**
 * Entropy Management Service
 * Responsible for calculating and managing system entropy
 * Following DDD principles with clear domain boundaries
 */
export class EntropyManagementService {
  private constructor(
    private readonly thresholds: EntropyThresholds,
    private readonly baseComplexity: number,
  ) {}

  /**
   * Smart Constructor for EntropyManagementService
   * Ensures all invariants are satisfied
   */
  static create(
    config?: {
      acceptableThreshold?: number;
      warningThreshold?: number;
      criticalThreshold?: number;
      baseComplexity?: number;
    },
  ): Result<EntropyManagementService, DomainError & { message: string }> {
    const thresholdsResult = EntropyThresholds.create(
      config?.acceptableThreshold ?? 12.0,
      config?.warningThreshold ?? 18.0,
      config?.criticalThreshold ?? 24.0,
    );

    if (!thresholdsResult.ok) {
      return err(thresholdsResult.error);
    }

    const baseComplexity = config?.baseComplexity ?? 1.0;
    if (baseComplexity <= 0) {
      return err(createError({
        kind: "ConfigurationError",
        message: "Base complexity must be positive",
      }));
    }

    return ok(
      new EntropyManagementService(
        thresholdsResult.data,
        baseComplexity,
      ),
    );
  }

  /**
   * Calculate system entropy based on complexity factors
   * Pure function following Totality principle
   */
  calculateSystemEntropy(
    factors: ComplexityFactors,
  ): Result<number, DomainError & { message: string }> {
    try {
      // Validate all factors are non-negative
      const factorValues = Object.values(factors);
      if (factorValues.some((v) => v < 0)) {
        return err(createError({
          kind: "InvalidType",
          expected: "non-negative number",
          actual: "negative number",
        }));
      }

      // Shannon entropy calculation
      const totalComplexity = this.baseComplexity +
        factors.fileCount * 0.5 +
        factors.schemaComplexity * 2.0 +
        factors.templateComplexity * 1.5 +
        factors.aggregationComplexity * 3.0 +
        factors.parallelismLevel * 1.0 +
        factors.errorHandlingComplexity * 2.5 +
        factors.stateSpaceSize * 0.3 +
        factors.integrationPoints * 1.8;

      // Logarithmic entropy (bits)
      const entropy = Math.log2(Math.max(1, totalComplexity));

      return ok(entropy);
    } catch (error) {
      return err(createError({
        kind: "UnknownError",
        field: `Entropy calculation failed: ${error}`,
      }));
    }
  }

  /**
   * Generate entropy reduction plan based on current factors
   * Returns actionable strategies for entropy reduction
   */
  generateReductionPlan(
    factors: ComplexityFactors,
  ): Result<EntropyReductionPlan, DomainError & { message: string }> {
    const entropyResult = this.calculateSystemEntropy(factors);
    if (!entropyResult.ok) {
      return err(entropyResult.error);
    }

    const currentEntropy = entropyResult.data;
    const level = this.thresholds.getLevel(currentEntropy);

    // Determine target entropy based on current level
    const targetEntropy = level === "acceptable"
      ? currentEntropy
      : this.thresholds.acceptable;

    // Generate strategies based on complexity factors
    const strategies: ReductionStrategy[] = [];

    if (factors.schemaComplexity > 10) {
      strategies.push({
        kind: "simplification",
        target: "Schema structure",
        impact: 2.0,
        effort: "moderate",
      });
    }

    if (factors.aggregationComplexity > 5) {
      strategies.push({
        kind: "modularization",
        target: "Aggregation logic",
        impact: 3.0,
        effort: "significant",
      });
    }

    if (factors.errorHandlingComplexity > 8) {
      strategies.push({
        kind: "standardization",
        target: "Error handling patterns",
        impact: 2.5,
        effort: "moderate",
      });
    }

    if (factors.stateSpaceSize > 50) {
      strategies.push({
        kind: "elimination",
        target: "Unnecessary states",
        impact: 1.5,
        effort: "minimal",
      });
    }

    const estimatedReduction = strategies.reduce((sum, s) => sum + s.impact, 0);

    const priority: Priority = level === "critical"
      ? "critical"
      : level === "warning"
      ? "high"
      : strategies.length > 0
      ? "medium"
      : "low";

    return ok({
      currentEntropy,
      targetEntropy,
      reductionStrategies: strategies,
      estimatedReduction,
      priority,
    });
  }

  /**
   * Apply reduction strategies to current factors
   * Returns updated factors after applying strategies
   */
  applyReduction(
    factors: ComplexityFactors,
    strategies: ReadonlyArray<ReductionStrategy>,
  ): Result<ComplexityFactors, DomainError & { message: string }> {
    if (strategies.length === 0) {
      return ok(factors);
    }

    // Create mutable copy for modifications
    const updatedFactors = { ...factors };

    for (const strategy of strategies) {
      switch (strategy.kind) {
        case "simplification":
          if (strategy.target.includes("Schema")) {
            updatedFactors.schemaComplexity = Math.max(
              1,
              factors.schemaComplexity * 0.7,
            );
          }
          if (strategy.target.includes("Template")) {
            updatedFactors.templateComplexity = Math.max(
              1,
              factors.templateComplexity * 0.7,
            );
          }
          break;

        case "modularization":
          if (strategy.target.includes("Aggregation")) {
            updatedFactors.aggregationComplexity = Math.max(
              1,
              factors.aggregationComplexity * 0.6,
            );
          }
          break;

        case "standardization":
          if (strategy.target.includes("Error")) {
            updatedFactors.errorHandlingComplexity = Math.max(
              1,
              factors.errorHandlingComplexity * 0.5,
            );
          }
          break;

        case "elimination":
          if (strategy.target.includes("states")) {
            updatedFactors.stateSpaceSize = Math.max(
              1,
              factors.stateSpaceSize * 0.5,
            );
          }
          break;
      }
    }

    return ok(updatedFactors);
  }

  /**
   * Check if current entropy is acceptable
   */
  isAcceptable(entropy: number): boolean {
    return this.thresholds.getLevel(entropy) === "acceptable";
  }

  /**
   * Get current thresholds for reporting
   */
  getThresholds(): {
    acceptable: number;
    warning: number;
    critical: number;
  } {
    return {
      acceptable: this.thresholds.acceptable,
      warning: this.thresholds.warning,
      critical: this.thresholds.critical,
    };
  }
}
