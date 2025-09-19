import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";

/**
 * Quality metrics for comprehensive scoring
 * Following Totality principles with discriminated unions
 */
export type QualityMetrics = {
  readonly totalityScore: number; // 0-100, weight 25%
  readonly robustnessScore: number; // 0-100, weight 20%
  readonly complexityScore: number; // 0-100, weight 20%
  readonly testQualityScore: number; // 0-100, weight 20%
  readonly dddBoundariesScore: number; // 0-100, weight 15%
};

/**
 * Quality scoring configuration
 * Smart Constructor pattern for validation
 */
export interface QualityScoringConfig {
  readonly weights: {
    readonly totality: number; // 0.25
    readonly robustness: number; // 0.20
    readonly complexity: number; // 0.20
    readonly testQuality: number; // 0.20
    readonly dddBoundaries: number; // 0.15
  };
  readonly targetScore: number; // 95.0
  readonly minimumPassingScore: number; // 80.0
}

/**
 * Integrated quality achievement result
 * Using discriminated union for type safety
 */
export type QualityAchievementResult =
  | {
    readonly kind: "excellent";
    readonly score: number;
    readonly metrics: QualityMetrics;
    readonly passedTarget: true;
  }
  | {
    readonly kind: "good";
    readonly score: number;
    readonly metrics: QualityMetrics;
    readonly passedTarget: false;
    readonly improvementAreas: readonly string[];
  }
  | {
    readonly kind: "needs-improvement";
    readonly score: number;
    readonly metrics: QualityMetrics;
    readonly passedTarget: false;
    readonly criticalIssues: readonly string[];
  };

/**
 * Integrated Quality Achievement Service
 * Domain service implementing enterprise-grade quality scoring
 * Following DDD patterns and Totality principles
 */
export class IntegratedQualityAchievementService {
  private constructor(
    private readonly config: QualityScoringConfig,
  ) {}

  /**
   * Smart Constructor for IntegratedQualityAchievementService
   * Ensures all invariants are satisfied
   */
  static create(
    config?: Partial<QualityScoringConfig>,
  ): Result<
    IntegratedQualityAchievementService,
    DomainError & { message: string }
  > {
    const finalConfig: QualityScoringConfig = {
      weights: {
        totality: config?.weights?.totality ?? 0.25,
        robustness: config?.weights?.robustness ?? 0.20,
        complexity: config?.weights?.complexity ?? 0.20,
        testQuality: config?.weights?.testQuality ?? 0.20,
        dddBoundaries: config?.weights?.dddBoundaries ?? 0.15,
      },
      targetScore: config?.targetScore ?? 95.0,
      minimumPassingScore: config?.minimumPassingScore ?? 80.0,
    };

    // Validate weights sum to 1.0
    const weightSum = Object.values(finalConfig.weights).reduce(
      (sum, weight) => sum + weight,
      0,
    );
    if (Math.abs(weightSum - 1.0) > 0.001) {
      return err(createError({
        kind: "ConfigurationError",
        message: `Quality weights must sum to 1.0, got ${weightSum}`,
      }));
    }

    // Validate score ranges
    if (finalConfig.targetScore < 0 || finalConfig.targetScore > 100) {
      return err(createError({
        kind: "ConfigurationError",
        message: "Target score must be between 0 and 100",
      }));
    }

    if (
      finalConfig.minimumPassingScore < 0 ||
      finalConfig.minimumPassingScore > 100
    ) {
      return err(createError({
        kind: "ConfigurationError",
        message: "Minimum passing score must be between 0 and 100",
      }));
    }

    return ok(new IntegratedQualityAchievementService(finalConfig));
  }

  /**
   * Calculate integrated quality score
   * Returns comprehensive quality assessment following enterprise standards
   */
  calculateQualityScore(
    metrics: QualityMetrics,
  ): Result<QualityAchievementResult, DomainError & { message: string }> {
    // Validate input metrics
    const validationResult = this.validateMetrics(metrics);
    if (!validationResult.ok) {
      return validationResult;
    }

    // Calculate weighted score
    const score = metrics.totalityScore * this.config.weights.totality +
      metrics.robustnessScore * this.config.weights.robustness +
      metrics.complexityScore * this.config.weights.complexity +
      metrics.testQualityScore * this.config.weights.testQuality +
      metrics.dddBoundariesScore * this.config.weights.dddBoundaries;

    // Determine result category based on score and target
    if (score >= this.config.targetScore) {
      return ok({
        kind: "excellent",
        score,
        metrics,
        passedTarget: true,
      });
    }

    if (score >= this.config.minimumPassingScore) {
      const improvementAreas = this.identifyImprovementAreas(metrics);
      return ok({
        kind: "good",
        score,
        metrics,
        passedTarget: false,
        improvementAreas,
      });
    }

    const criticalIssues = this.identifyCriticalIssues(metrics);
    return ok({
      kind: "needs-improvement",
      score,
      metrics,
      passedTarget: false,
      criticalIssues,
    });
  }

  /**
   * Validate quality metrics input
   * Ensures all metric values are within valid ranges
   */
  private validateMetrics(
    metrics: QualityMetrics,
  ): Result<void, DomainError & { message: string }> {
    const metricsEntries = Object.entries(metrics) as Array<
      [keyof QualityMetrics, number]
    >;

    for (const [_key, value] of metricsEntries) {
      if (
        typeof value !== "number" || Number.isNaN(value) ||
        !Number.isFinite(value) || value < 0 || value > 100
      ) {
        return err(createError({
          kind: "InvalidType",
          expected: "number between 0 and 100",
          actual: `${typeof value} with value ${value}`,
        }));
      }
    }

    return ok(undefined);
  }

  /**
   * Identify areas for improvement based on metric analysis
   */
  private identifyImprovementAreas(metrics: QualityMetrics): readonly string[] {
    const areas: string[] = [];
    const threshold = 85; // Below this threshold suggests improvement needed

    if (metrics.totalityScore < threshold) {
      areas.push(
        "Enhance Result<T,E> pattern usage and Smart Constructor implementation",
      );
    }
    if (metrics.robustnessScore < threshold) {
      areas.push("Improve hardcoding elimination and CI/CD enforcement");
    }
    if (metrics.complexityScore < threshold) {
      areas.push("Reduce AI entropy and implement complexity control measures");
    }
    if (metrics.testQualityScore < threshold) {
      areas.push(
        "Increase specification-driven testing and reduce mock dependency",
      );
    }
    if (metrics.dddBoundariesScore < threshold) {
      areas.push("Strengthen domain boundary separation and context isolation");
    }

    return areas;
  }

  /**
   * Identify critical issues requiring immediate attention
   */
  private identifyCriticalIssues(metrics: QualityMetrics): readonly string[] {
    const issues: string[] = [];
    const criticalThreshold = 60; // Below this threshold indicates critical issues

    if (metrics.totalityScore < criticalThreshold) {
      issues.push(
        "CRITICAL: Totality principle violations - incomplete Result type coverage",
      );
    }
    if (metrics.robustnessScore < criticalThreshold) {
      issues.push(
        "CRITICAL: Robustness failures - hardcoding detected or CI/CD issues",
      );
    }
    if (metrics.complexityScore < criticalThreshold) {
      issues.push(
        "CRITICAL: Complexity management failure - entropy exceeds acceptable levels",
      );
    }
    if (metrics.testQualityScore < criticalThreshold) {
      issues.push(
        "CRITICAL: Test quality insufficient - inadequate specification coverage",
      );
    }
    if (metrics.dddBoundariesScore < criticalThreshold) {
      issues.push(
        "CRITICAL: DDD boundary violations - context bleeding detected",
      );
    }

    return issues;
  }

  /**
   * Get current quality configuration
   */
  getConfiguration(): QualityScoringConfig {
    return {
      weights: {
        totality: this.config.weights.totality,
        robustness: this.config.weights.robustness,
        complexity: this.config.weights.complexity,
        testQuality: this.config.weights.testQuality,
        dddBoundaries: this.config.weights.dddBoundaries,
      },
      targetScore: this.config.targetScore,
      minimumPassingScore: this.config.minimumPassingScore,
    };
  }

  /**
   * Get target score for quality achievement
   */
  getTargetScore(): number {
    return this.config.targetScore;
  }
}
