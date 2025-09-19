/**
 * @module IntegratedQualityAchievementService
 * @description Enterprise-grade integrated quality scoring system (Issue #887)
 * Achieves 95% integrated quality score through weighted assessment of multiple domains
 */

import { err, ok, Result } from "../../domain/shared/types/result.ts";
import {
  DomainError,
  PerformanceError,
} from "../../domain/shared/types/errors.ts";

/**
 * Quality domain weights for integrated scoring
 * Total must equal 100%
 */
export const QUALITY_WEIGHTS = {
  TOTALITY: 0.25, // 25% - Result types, Smart Constructors, Exhaustive patterns
  ROBUSTNESS: 0.20, // 20% - Hardcoding elimination, CI/CD enforcement
  COMPLEXITY: 0.20, // 20% - AI entropy reduction
  TEST_QUALITY: 0.20, // 20% - Specification-driven testing ratio
  DDD_BOUNDARIES: 0.15, // 15% - Context separation
} as const;

/**
 * Quality score thresholds
 */
export const QUALITY_THRESHOLDS = {
  ENTERPRISE_GRADE: 0.95, // 95% minimum for enterprise certification
  PRODUCTION_READY: 0.90, // 90% minimum for production deployment
  ACCEPTABLE: 0.80, // 80% minimum acceptable quality
  WARNING: 0.70, // Below 70% requires immediate attention
} as const;

/**
 * Quality assessment result for a single domain
 */
export interface DomainQualityScore {
  readonly domain: QualityDomain;
  readonly score: number; // 0.0 to 1.0
  readonly weight: number; // Domain weight in overall score
  readonly weightedScore: number; // score * weight
  readonly details: QualityDetails;
  readonly recommendations: string[];
}

/**
 * Integrated quality achievement result
 */
export interface IntegratedQualityScore {
  readonly overallScore: number; // 0.0 to 1.0
  readonly percentage: number; // 0 to 100
  readonly grade: QualityGrade;
  readonly domainScores: DomainQualityScore[];
  readonly achievesEnterpriseGrade: boolean;
  readonly timestamp: Date;
  readonly assessmentId: string;
}

/**
 * Quality domains for assessment
 */
export type QualityDomain =
  | "totality"
  | "robustness"
  | "complexity"
  | "test-quality"
  | "ddd-boundaries";

/**
 * Quality grade classification
 */
export type QualityGrade =
  | "enterprise-grade"
  | "production-ready"
  | "acceptable"
  | "warning"
  | "critical";

/**
 * Detailed quality metrics
 */
export interface QualityDetails {
  readonly metricName: string;
  readonly currentValue: number;
  readonly targetValue: number;
  readonly achievementRate: number;
}

/**
 * Quality assessment input data
 */
export interface QualityAssessmentInput {
  readonly totalityMetrics: TotalityMetrics;
  readonly robustnessMetrics: RobustnessMetrics;
  readonly complexityMetrics: ComplexityMetrics;
  readonly testQualityMetrics: TestQualityMetrics;
  readonly dddBoundaryMetrics: DddBoundaryMetrics;
}

/**
 * Totality principle metrics
 */
export interface TotalityMetrics {
  readonly resultTypeUsage: number; // Percentage of functions using Result<T,E>
  readonly smartConstructorUsage: number; // Percentage of value objects with Smart Constructors
  readonly exhaustivePatternUsage: number; // Percentage of switch statements without default
  readonly partialFunctionCount: number; // Number of remaining partial functions
  readonly totalFunctionCount: number; // Total number of functions
}

/**
 * Robustness metrics
 */
export interface RobustnessMetrics {
  readonly hardcodingViolations: number; // Number of hardcoding violations
  readonly externalizedConfigs: number; // Number of externalized configurations
  readonly totalConfigs: number; // Total configuration points
  readonly cicdEnforcement: boolean; // CI/CD validation enabled
}

/**
 * Complexity metrics
 */
export interface ComplexityMetrics {
  readonly currentEntropy: number; // Current AI complexity entropy
  readonly targetEntropy: number; // Target entropy (12.0 bits)
  readonly cyclomaticComplexity: number; // Average cyclomatic complexity
  readonly cognitiveComplexity: number; // Average cognitive complexity
}

/**
 * Test quality metrics
 */
export interface TestQualityMetrics {
  readonly totalTests: number;
  readonly specificationTests: number; // Business requirement tests
  readonly mockBasedTests: number; // Implementation detail tests
  readonly testCoverage: number; // Line coverage percentage
  readonly branchCoverage: number; // Branch coverage percentage
}

/**
 * DDD boundary metrics
 */
export interface DddBoundaryMetrics {
  readonly definedContexts: number; // Number of bounded contexts
  readonly properSeparation: number; // Percentage with proper boundaries
  readonly crossContextViolations: number; // Boundary violation count
  readonly aggregateRootCompliance: number; // Percentage of proper aggregates
}

/**
 * Integrated Quality Achievement Service
 * Calculates enterprise-grade quality scores across multiple domains
 */
export class IntegratedQualityAchievementService {
  /**
   * Calculate integrated quality score
   */
  static calculateIntegratedScore(
    input: QualityAssessmentInput,
  ): Result<IntegratedQualityScore, DomainError & { message: string }> {
    try {
      // Calculate individual domain scores
      const totalityScore = this.calculateTotalityScore(input.totalityMetrics);
      const robustnessScore = this.calculateRobustnessScore(
        input.robustnessMetrics,
      );
      const complexityScore = this.calculateComplexityScore(
        input.complexityMetrics,
      );
      const testQualityScore = this.calculateTestQualityScore(
        input.testQualityMetrics,
      );
      const dddBoundaryScore = this.calculateDddBoundaryScore(
        input.dddBoundaryMetrics,
      );

      // Create domain score results
      const domainScores: DomainQualityScore[] = [
        this.createDomainScore(
          "totality",
          totalityScore,
          QUALITY_WEIGHTS.TOTALITY,
        ),
        this.createDomainScore(
          "robustness",
          robustnessScore,
          QUALITY_WEIGHTS.ROBUSTNESS,
        ),
        this.createDomainScore(
          "complexity",
          complexityScore,
          QUALITY_WEIGHTS.COMPLEXITY,
        ),
        this.createDomainScore(
          "test-quality",
          testQualityScore,
          QUALITY_WEIGHTS.TEST_QUALITY,
        ),
        this.createDomainScore(
          "ddd-boundaries",
          dddBoundaryScore,
          QUALITY_WEIGHTS.DDD_BOUNDARIES,
        ),
      ];

      // Calculate overall weighted score
      const overallScore = domainScores.reduce(
        (sum, domain) => sum + domain.weightedScore,
        0,
      );

      // Determine quality grade
      const grade = this.determineQualityGrade(overallScore);

      // Create integrated score result
      const integratedScore: IntegratedQualityScore = {
        overallScore,
        percentage: Math.round(overallScore * 100),
        grade,
        domainScores,
        achievesEnterpriseGrade:
          overallScore >= QUALITY_THRESHOLDS.ENTERPRISE_GRADE,
        timestamp: new Date(),
        assessmentId: this.generateAssessmentId(),
      };

      return ok(integratedScore);
    } catch (error) {
      return err(
        {
          kind: "PipelineExecutionError",
          content: `Failed to calculate integrated quality score: ${error}`,
          message: `Failed to calculate integrated quality score: ${error}`,
        } as PerformanceError & { message: string },
      );
    }
  }

  /**
   * Calculate Totality domain score
   */
  private static calculateTotalityScore(metrics: TotalityMetrics): number {
    const resultTypeScore = metrics.resultTypeUsage;
    const smartConstructorScore = metrics.smartConstructorUsage;
    const exhaustiveScore = metrics.exhaustivePatternUsage;
    const partialFunctionScore = 1 -
      (metrics.partialFunctionCount / Math.max(metrics.totalFunctionCount, 1));

    // Weighted average of totality metrics
    return (
      resultTypeScore * 0.3 +
      smartConstructorScore * 0.3 +
      exhaustiveScore * 0.2 +
      partialFunctionScore * 0.2
    );
  }

  /**
   * Calculate Robustness domain score
   */
  private static calculateRobustnessScore(metrics: RobustnessMetrics): number {
    const hardcodingScore = 1 -
      (metrics.hardcodingViolations / Math.max(metrics.totalConfigs, 1));
    const externalizationScore = metrics.externalizedConfigs /
      Math.max(metrics.totalConfigs, 1);
    const cicdScore = metrics.cicdEnforcement ? 1.0 : 0.5;

    // Weighted average of robustness metrics
    return (
      hardcodingScore * 0.4 +
      externalizationScore * 0.4 +
      cicdScore * 0.2
    );
  }

  /**
   * Calculate Complexity domain score
   */
  private static calculateComplexityScore(metrics: ComplexityMetrics): number {
    // Entropy score (lower is better, target is 12.0)
    const entropyScore = Math.max(
      0,
      1 -
        (metrics.currentEntropy - metrics.targetEntropy) /
          metrics.targetEntropy,
    );

    // Cyclomatic complexity score (lower is better, ideal < 10)
    const cyclomaticScore = Math.max(
      0,
      1 - (metrics.cyclomaticComplexity - 10) / 20,
    );

    // Cognitive complexity score (lower is better, ideal < 15)
    const cognitiveScore = Math.max(
      0,
      1 - (metrics.cognitiveComplexity - 15) / 30,
    );

    // Weighted average of complexity metrics
    return (
      entropyScore * 0.4 +
      cyclomaticScore * 0.3 +
      cognitiveScore * 0.3
    );
  }

  /**
   * Calculate Test Quality domain score
   */
  private static calculateTestQualityScore(
    metrics: TestQualityMetrics,
  ): number {
    const specificationRatio = metrics.specificationTests /
      Math.max(metrics.totalTests, 1);
    const coverageScore = metrics.testCoverage / 100;
    const branchScore = metrics.branchCoverage / 100;

    // Weighted average of test quality metrics
    return (
      specificationRatio * 0.5 + // Specification-driven tests weighted heavily
      coverageScore * 0.3 +
      branchScore * 0.2
    );
  }

  /**
   * Calculate DDD Boundary domain score
   */
  private static calculateDddBoundaryScore(
    metrics: DddBoundaryMetrics,
  ): number {
    const separationScore = metrics.properSeparation / 100;
    const violationScore = Math.max(
      0,
      1 - metrics.crossContextViolations / Math.max(metrics.definedContexts, 1),
    );
    const aggregateScore = metrics.aggregateRootCompliance / 100;

    // Weighted average of DDD boundary metrics
    return (
      separationScore * 0.4 +
      violationScore * 0.3 +
      aggregateScore * 0.3
    );
  }

  /**
   * Create domain score result
   */
  private static createDomainScore(
    domain: QualityDomain,
    score: number,
    weight: number,
  ): DomainQualityScore {
    return {
      domain,
      score: Math.min(1, Math.max(0, score)), // Clamp between 0 and 1
      weight,
      weightedScore: Math.min(1, Math.max(0, score)) * weight,
      details: this.getQualityDetails(domain, score),
      recommendations: this.getRecommendations(domain, score),
    };
  }

  /**
   * Get quality details for a domain
   */
  private static getQualityDetails(
    domain: QualityDomain,
    score: number,
  ): QualityDetails {
    const targetValue = 0.95; // Enterprise target
    return {
      metricName: `${domain}-quality`,
      currentValue: score,
      targetValue,
      achievementRate: score / targetValue,
    };
  }

  /**
   * Get improvement recommendations
   */
  private static getRecommendations(
    domain: QualityDomain,
    score: number,
  ): string[] {
    if (score >= 0.95) return [];

    const recommendations: Record<QualityDomain, string[]> = {
      "totality": [
        "Increase Result<T,E> type usage in all functions",
        "Implement Smart Constructors for value objects",
        "Eliminate partial functions with exhaustive pattern matching",
      ],
      "robustness": [
        "Eliminate remaining hardcoded values",
        "Externalize all configuration to registries",
        "Enable CI/CD enforcement for quality gates",
      ],
      "complexity": [
        "Reduce AI complexity entropy to target 12.0 bits",
        "Refactor high cyclomatic complexity functions",
        "Simplify cognitive complexity in core services",
      ],
      "test-quality": [
        "Migrate mock-based tests to specification-driven tests",
        "Increase test coverage to 95%",
        "Improve branch coverage for critical paths",
      ],
      "ddd-boundaries": [
        "Strengthen bounded context separation",
        "Eliminate cross-context violations",
        "Ensure aggregate root compliance",
      ],
    };

    return recommendations[domain] || [];
  }

  /**
   * Determine quality grade based on score
   */
  private static determineQualityGrade(score: number): QualityGrade {
    if (score >= QUALITY_THRESHOLDS.ENTERPRISE_GRADE) return "enterprise-grade";
    if (score >= QUALITY_THRESHOLDS.PRODUCTION_READY) return "production-ready";
    if (score >= QUALITY_THRESHOLDS.ACCEPTABLE) return "acceptable";
    if (score >= QUALITY_THRESHOLDS.WARNING) return "warning";
    return "critical";
  }

  /**
   * Generate unique assessment ID
   */
  private static generateAssessmentId(): string {
    return `qa-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Validate quality achievement against requirements
   */
  static validateQualityRequirements(
    score: IntegratedQualityScore,
    requirements: QualityRequirements,
  ): QualityValidationResult {
    const meetsOverallScore = score.overallScore >= requirements.minimumScore;
    const failedDomains = score.domainScores.filter(
      (domain) => domain.score < requirements.minimumDomainScore,
    );

    return {
      isValid: meetsOverallScore && failedDomains.length === 0,
      overallScoreMet: meetsOverallScore,
      failedDomains: failedDomains.map((d) => d.domain),
      recommendations: failedDomains.flatMap((d) => d.recommendations),
      certificationEligible: score.achievesEnterpriseGrade,
    };
  }
}

/**
 * Quality requirements for validation
 */
export interface QualityRequirements {
  readonly minimumScore: number; // Overall minimum score
  readonly minimumDomainScore: number; // Minimum per domain
  readonly mandatoryDomains?: QualityDomain[]; // Required domains
}

/**
 * Quality validation result
 */
export interface QualityValidationResult {
  readonly isValid: boolean;
  readonly overallScoreMet: boolean;
  readonly failedDomains: QualityDomain[];
  readonly recommendations: string[];
  readonly certificationEligible: boolean;
}
