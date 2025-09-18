import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import { ComplexityFactors } from "./entropy-management-service.ts";

/**
 * Complexity metrics configuration following Totality principle
 * Using Smart Constructor for validation
 */
export class ComplexityMetricsConfig {
  private constructor(
    readonly fileCountWeight: number,
    readonly schemaWeight: number,
    readonly templateWeight: number,
    readonly aggregationWeight: number,
    readonly parallelismWeight: number,
    readonly errorHandlingWeight: number,
    readonly stateSpaceWeight: number,
    readonly integrationWeight: number,
  ) {}

  static create(
    weights?: Partial<{
      fileCountWeight: number;
      schemaWeight: number;
      templateWeight: number;
      aggregationWeight: number;
      parallelismWeight: number;
      errorHandlingWeight: number;
      stateSpaceWeight: number;
      integrationWeight: number;
    }>,
  ): Result<ComplexityMetricsConfig, DomainError & { message: string }> {
    const config = {
      fileCountWeight: weights?.fileCountWeight ?? 0.5,
      schemaWeight: weights?.schemaWeight ?? 2.0,
      templateWeight: weights?.templateWeight ?? 1.5,
      aggregationWeight: weights?.aggregationWeight ?? 3.0,
      parallelismWeight: weights?.parallelismWeight ?? 1.0,
      errorHandlingWeight: weights?.errorHandlingWeight ?? 2.5,
      stateSpaceWeight: weights?.stateSpaceWeight ?? 0.3,
      integrationWeight: weights?.integrationWeight ?? 1.8,
    };

    // Validate all weights are non-negative
    const allWeights = Object.values(config);
    if (allWeights.some((w) => w < 0)) {
      return err(createError({
        kind: "ConfigurationError",
        message: "All weights must be non-negative",
      }));
    }

    // Validate at least one weight is positive
    if (allWeights.every((w) => w === 0)) {
      return err(createError({
        kind: "ConfigurationError",
        message: "At least one weight must be positive",
      }));
    }

    return ok(
      new ComplexityMetricsConfig(
        config.fileCountWeight,
        config.schemaWeight,
        config.templateWeight,
        config.aggregationWeight,
        config.parallelismWeight,
        config.errorHandlingWeight,
        config.stateSpaceWeight,
        config.integrationWeight,
      ),
    );
  }

  getTotalWeight(): number {
    return this.fileCountWeight +
      this.schemaWeight +
      this.templateWeight +
      this.aggregationWeight +
      this.parallelismWeight +
      this.errorHandlingWeight +
      this.stateSpaceWeight +
      this.integrationWeight;
  }
}

/**
 * Exhaustiveness metrics for totality compliance
 */
export interface ExhaustivenessMetrics {
  readonly coveragePercentage: number;
  readonly discriminatedUnionUsage: number;
  readonly smartConstructorUsage: number;
  readonly resultTypeUsage: number;
  readonly exhaustiveSwitchStatements: number;
}

/**
 * Integrated control metrics
 */
export interface IntegratedControlMetrics {
  readonly hardcodingElimination: number;
  readonly configurationExternalization: number;
  readonly errorHandlingCompleteness: number;
  readonly stateTransitionValidation: number;
  readonly domainBoundaryRespect: number;
}

/**
 * Complexity Metrics Service
 * Responsible for calculating and managing system complexity metrics
 * Following DDD principles with clear domain boundaries
 */
export class ComplexityMetricsService {
  private constructor(
    private readonly config: ComplexityMetricsConfig,
  ) {}

  /**
   * Smart Constructor for ComplexityMetricsService
   */
  static create(
    config?: Partial<{
      fileCountWeight: number;
      schemaWeight: number;
      templateWeight: number;
      aggregationWeight: number;
      parallelismWeight: number;
      errorHandlingWeight: number;
      stateSpaceWeight: number;
      integrationWeight: number;
    }>,
  ): Result<ComplexityMetricsService, DomainError & { message: string }> {
    const configResult = ComplexityMetricsConfig.create(config);
    if (!configResult.ok) {
      return err(configResult.error);
    }

    return ok(new ComplexityMetricsService(configResult.data));
  }

  /**
   * Get complexity factors from system state
   * In real implementation, these would be calculated from actual system metrics
   */
  getComplexityFactors(
    systemState?: Partial<ComplexityFactors>,
  ): ComplexityFactors {
    return {
      fileCount: systemState?.fileCount ?? 10,
      schemaComplexity: systemState?.schemaComplexity ?? 5,
      templateComplexity: systemState?.templateComplexity ?? 3,
      aggregationComplexity: systemState?.aggregationComplexity ?? 2,
      parallelismLevel: systemState?.parallelismLevel ?? 1,
      errorHandlingComplexity: systemState?.errorHandlingComplexity ?? 4,
      stateSpaceSize: systemState?.stateSpaceSize ?? 20,
      integrationPoints: systemState?.integrationPoints ?? 3,
    };
  }

  /**
   * Calculate exhaustiveness metrics for totality compliance
   */
  calculateExhaustiveness(
    codeMetrics: {
      totalFunctions: number;
      resultTypeFunctions: number;
      totalSwitchStatements: number;
      exhaustiveSwitchStatements: number;
      totalConstructors: number;
      smartConstructors: number;
      totalUnions: number;
      discriminatedUnions: number;
    },
  ): Result<ExhaustivenessMetrics, DomainError & { message: string }> {
    // Validate input metrics
    if (
      codeMetrics.totalFunctions < 0 ||
      codeMetrics.resultTypeFunctions < 0 ||
      codeMetrics.totalSwitchStatements < 0 ||
      codeMetrics.exhaustiveSwitchStatements < 0 ||
      codeMetrics.totalConstructors < 0 ||
      codeMetrics.smartConstructors < 0 ||
      codeMetrics.totalUnions < 0 ||
      codeMetrics.discriminatedUnions < 0
    ) {
      return err(createError({
        kind: "InvalidType",
        expected: "non-negative metrics",
        actual: "negative values",
      }));
    }

    // Validate logical constraints
    if (
      codeMetrics.resultTypeFunctions > codeMetrics.totalFunctions ||
      codeMetrics.exhaustiveSwitchStatements >
        codeMetrics.totalSwitchStatements ||
      codeMetrics.smartConstructors > codeMetrics.totalConstructors ||
      codeMetrics.discriminatedUnions > codeMetrics.totalUnions
    ) {
      return err(createError({
        kind: "InvalidStructure",
        field: "metrics ratios exceed totals",
      }));
    }

    const calculateRatio = (partial: number, total: number): number => {
      return total === 0 ? 100 : (partial / total) * 100;
    };

    const resultTypeUsage = calculateRatio(
      codeMetrics.resultTypeFunctions,
      codeMetrics.totalFunctions,
    );

    const exhaustiveSwitchUsage = calculateRatio(
      codeMetrics.exhaustiveSwitchStatements,
      codeMetrics.totalSwitchStatements,
    );

    const smartConstructorUsage = calculateRatio(
      codeMetrics.smartConstructors,
      codeMetrics.totalConstructors,
    );

    const discriminatedUnionUsage = calculateRatio(
      codeMetrics.discriminatedUnions,
      codeMetrics.totalUnions,
    );

    // Overall coverage is weighted average
    const coveragePercentage = resultTypeUsage * 0.3 +
      exhaustiveSwitchUsage * 0.2 +
      smartConstructorUsage * 0.25 +
      discriminatedUnionUsage * 0.25;

    return ok({
      coveragePercentage,
      discriminatedUnionUsage,
      smartConstructorUsage,
      resultTypeUsage,
      exhaustiveSwitchStatements: codeMetrics.exhaustiveSwitchStatements,
    });
  }

  /**
   * Calculate integrated control metrics
   */
  calculateIntegratedControl(
    systemMetrics: {
      totalHardcodedValues: number;
      externalizedConfigs: number;
      totalErrorPaths: number;
      handledErrorPaths: number;
      totalStateTransitions: number;
      validatedTransitions: number;
      totalDomainCalls: number;
      properDomainCalls: number;
    },
  ): Result<IntegratedControlMetrics, DomainError & { message: string }> {
    // Validate all metrics are non-negative
    const metricsValues = Object.values(systemMetrics);
    if (metricsValues.some((v) => v < 0)) {
      return err(createError({
        kind: "InvalidType",
        expected: "non-negative system metrics",
        actual: "negative values",
      }));
    }

    const calculateCompleteness = (handled: number, total: number): number => {
      if (total === 0) return 100;
      if (handled > total) return 0; // Invalid state
      return (handled / total) * 100;
    };

    // Calculate hardcoding elimination (inverse of hardcoded values)
    const hardcodingElimination = systemMetrics.totalHardcodedValues === 0
      ? 100
      : Math.max(
        0,
        100 - (systemMetrics.totalHardcodedValues * 10), // Each hardcoded value reduces by 10%
      );

    // Calculate configuration externalization
    const configTotal = systemMetrics.totalHardcodedValues +
      systemMetrics.externalizedConfigs;
    const configurationExternalization = calculateCompleteness(
      systemMetrics.externalizedConfigs,
      configTotal,
    );

    // Calculate error handling completeness
    const errorHandlingCompleteness = calculateCompleteness(
      systemMetrics.handledErrorPaths,
      systemMetrics.totalErrorPaths,
    );

    // Calculate state transition validation
    const stateTransitionValidation = calculateCompleteness(
      systemMetrics.validatedTransitions,
      systemMetrics.totalStateTransitions,
    );

    // Calculate domain boundary respect
    const domainBoundaryRespect = calculateCompleteness(
      systemMetrics.properDomainCalls,
      systemMetrics.totalDomainCalls,
    );

    return ok({
      hardcodingElimination,
      configurationExternalization,
      errorHandlingCompleteness,
      stateTransitionValidation,
      domainBoundaryRespect,
    });
  }

  /**
   * Calculate overall system complexity score
   */
  calculateComplexityScore(
    factors: ComplexityFactors,
  ): Result<number, DomainError & { message: string }> {
    // Validate factors
    const factorValues = Object.values(factors);
    if (factorValues.some((v) => v < 0)) {
      return err(createError({
        kind: "InvalidType",
        expected: "non-negative complexity factors",
        actual: "negative values",
      }));
    }

    // Calculate weighted complexity
    const weightedComplexity = factors.fileCount * this.config.fileCountWeight +
      factors.schemaComplexity * this.config.schemaWeight +
      factors.templateComplexity * this.config.templateWeight +
      factors.aggregationComplexity * this.config.aggregationWeight +
      factors.parallelismLevel * this.config.parallelismWeight +
      factors.errorHandlingComplexity * this.config.errorHandlingWeight +
      factors.stateSpaceSize * this.config.stateSpaceWeight +
      factors.integrationPoints * this.config.integrationWeight;

    // Normalize to 0-100 scale
    const totalWeight = this.config.getTotalWeight();
    const maxPossibleComplexity = totalWeight * 100; // Assuming max factor value is 100
    const normalizedScore = (weightedComplexity / maxPossibleComplexity) * 100;

    return ok(Math.min(100, normalizedScore));
  }
}
