import { ok, Result } from "../../domain/shared/types/result.ts";
import { DomainError } from "../../domain/shared/types/errors.ts";
import { PipelineStrategyConfig } from "../../application/value-objects/pipeline-strategy-config.ts";
import {
  ComplexityMetricsService,
} from "../../domain/monitoring/services/complexity-metrics-service.ts";
import {
  EntropyManagementService,
} from "../../domain/monitoring/services/entropy-management-service.ts";

/**
 * Debug Metrics Service
 * Extracts and manages all debug metrics from PipelineOrchestrator
 * Following DDD and Totality principles
 */

export interface ProcessingStrategyMetrics {
  readonly processingMode: string;
  readonly expectedConcurrency: number;
  readonly memoryBudgetMB: number;
  readonly timeoutMs: number;
  readonly memoryStrategy: string;
  readonly adaptiveScaling: boolean;
  readonly targetMemoryVariancePct: number;
  readonly targetThroughputVariancePct: number;
  readonly expectedVarianceReduction: number;
  readonly memoryVarianceRisk: "high" | "medium" | "low";
  readonly errorRecoveryLatency: string;
}

export interface PipelineProcessingMetrics {
  readonly pipelineArchitecture: string;
  readonly currentMemoryVariance: string;
  readonly currentThroughputVariance: string;
  readonly cpuUtilizationTarget: string;
  readonly errorRecoveryTarget: string;
  readonly varianceImprovements: {
    readonly memoryVarianceReduction: string;
    readonly throughputVarianceReduction: string;
    readonly errorRecoveryImprovement: string;
  };
  readonly pipelineStages: readonly string[];
  readonly currentStage: string;
  readonly strategyOptimizations: Record<string, boolean | number>;
}

export interface EntropyControlMetrics {
  readonly currentSystemEntropy: number;
  readonly entropyThreshold: number;
  readonly entropyAcceptable: boolean;
  readonly reductionRequired: boolean;
  readonly entropyControlStrategy: string;
  readonly reductionStepsCount: number;
  readonly expectedEntropyAfterReduction: number;
  readonly entropyReductionPercentage: number;
  readonly implementationTimeEstimate: {
    readonly lowEstimate: number;
    readonly highEstimate: number;
    readonly unit: string;
  };
  readonly entropyControlStages: readonly string[];
  readonly currentEntropyStage: string;
  readonly entropyVarianceReductions: Record<string, string>;
}

export interface TotalityControlMetrics {
  readonly currentExhaustiveControlLevel: number;
  readonly totalityComplianceRatio: number;
  readonly typeSafetyGuarantee: string;
  readonly exhaustiveControlStrategy: string;
  readonly estimatedTypeSafetyVariance: string;
  readonly estimatedDevelopmentEfficiencyVariance: string;
  readonly compileTimeVerificationVariance: string;
  readonly maintainabilityVariance: string;
  readonly totalityControlStages: readonly string[];
  readonly currentTotalityStage: string;
  readonly totalityVarianceRisks: Record<string, string>;
}

export interface IntegratedControlMetrics {
  readonly integratedIssueControlLevel: number;
  readonly systemHealthScore: number;
  readonly criticalIssueCount: number;
  readonly integrationStrategy: string;
  readonly estimatedEntropyReductionVariance: string;
  readonly estimatedPipelineImprovementVariance: string;
  readonly estimatedTotalityImprovementVariance: string;
  readonly estimatedImplementationTimeVariance: string;
  readonly riskAssessmentVariance: string;
  readonly integrationStages: readonly string[];
  readonly currentIntegrationStage: string;
  readonly integrationVarianceRisks: Record<string, string>;
}

export interface DebugMetrics {
  readonly processingStrategy: ProcessingStrategyMetrics;
  readonly pipelineProcessing: PipelineProcessingMetrics;
  readonly entropyControl: EntropyControlMetrics;
  readonly totalityControl: TotalityControlMetrics;
  readonly integratedControl: IntegratedControlMetrics;
}

/**
 * Debug Metrics Service
 * Centralizes all debug metric calculations
 */
export class DebugMetricsService {
  constructor(
    private readonly complexityMetricsService: ComplexityMetricsService,
    private readonly entropyManagementService: EntropyManagementService,
  ) {}

  /**
   * Smart Constructor
   */
  static create(
    complexityMetricsService: ComplexityMetricsService,
    entropyManagementService: EntropyManagementService,
  ): Result<DebugMetricsService, DomainError & { message: string }> {
    return ok(
      new DebugMetricsService(
        complexityMetricsService,
        entropyManagementService,
      ),
    );
  }

  /**
   * Generate all debug metrics
   */
  generateMetrics(
    strategyConfig: PipelineStrategyConfig,
    initialMemory: Deno.MemoryUsage,
  ): DebugMetrics {
    const processingStrategy = this.generateProcessingStrategyMetrics(
      strategyConfig,
      initialMemory,
    );

    const pipelineProcessing = this.generatePipelineProcessingMetrics(
      strategyConfig,
      processingStrategy,
    );

    const entropyControl = this.generateEntropyControlMetrics();

    const totalityControl = this.generateTotalityControlMetrics();

    const integratedControl = this.generateIntegratedControlMetrics();

    return {
      processingStrategy,
      pipelineProcessing,
      entropyControl,
      totalityControl,
      integratedControl,
    };
  }

  private generateProcessingStrategyMetrics(
    strategyConfig: PipelineStrategyConfig,
    initialMemory: Deno.MemoryUsage,
  ): ProcessingStrategyMetrics {
    const thresholds = strategyConfig.getPerformanceThresholds();

    return {
      processingMode: strategyConfig.getProcessingStrategy(),
      expectedConcurrency: strategyConfig.getConcurrencyLevel(),
      memoryBudgetMB: Math.floor(initialMemory.heapTotal / 1024 / 1024 * 0.8),
      timeoutMs: 60000,
      memoryStrategy: strategyConfig.getMemoryStrategy(),
      adaptiveScaling: strategyConfig.isAdaptiveScalingEnabled(),
      targetMemoryVariancePct: thresholds.maxMemoryVariancePct,
      targetThroughputVariancePct: thresholds.maxThroughputVariancePct,
      expectedVarianceReduction: strategyConfig
        .calculateExpectedVarianceReduction(),
      memoryVarianceRisk: thresholds.maxMemoryVariancePct > 300
        ? "high"
        : "medium",
      errorRecoveryLatency: `${thresholds.maxErrorRecoveryTimeMs}ms`,
    };
  }

  private generatePipelineProcessingMetrics(
    strategyConfig: PipelineStrategyConfig,
    processingStrategyMetrics: ProcessingStrategyMetrics,
  ): PipelineProcessingMetrics {
    const thresholds = strategyConfig.getPerformanceThresholds();

    return {
      pipelineArchitecture: strategyConfig.getProcessingStrategy(),
      currentMemoryVariance: `${thresholds.maxMemoryVariancePct}%`,
      currentThroughputVariance: `${thresholds.maxThroughputVariancePct}%`,
      cpuUtilizationTarget: `${thresholds.maxCpuUtilizationPct}%`,
      errorRecoveryTarget: `${thresholds.maxErrorRecoveryTimeMs}ms`,
      varianceImprovements: {
        memoryVarianceReduction: `${600 - thresholds.maxMemoryVariancePct}%`,
        throughputVarianceReduction: `${
          650 - thresholds.maxThroughputVariancePct
        }%`,
        errorRecoveryImprovement:
          `finite: ${thresholds.maxErrorRecoveryTimeMs}ms`,
      },
      pipelineStages: [
        "strategy-selection",
        "input-stream-creation",
        "parallel-frontmatter-extraction",
        "concurrent-schema-validation",
        "batched-data-transformation",
        "optimized-template-processing",
        "streaming-output-generation",
      ],
      currentStage: "strategy-selection",
      strategyOptimizations: {
        "parallel-frontmatter-extraction": strategyConfig
          .shouldUseParallelProcessing(100, 5),
        "concurrent-schema-validation":
          strategyConfig.getConcurrencyLevel() > 1,
        "batched-data-transformation": strategyConfig.calculateOptimalBatchSize(
          100,
          processingStrategyMetrics.memoryBudgetMB,
        ),
        "adaptive-scaling": strategyConfig.isAdaptiveScalingEnabled(),
      },
    };
  }

  private generateEntropyControlMetrics(): EntropyControlMetrics {
    const complexityFactors = this.complexityMetricsService
      .getComplexityFactors();
    const entropyResult = this.entropyManagementService.calculateSystemEntropy(
      complexityFactors,
    );
    const entropyPlanResult = this.entropyManagementService
      .generateReductionPlan(complexityFactors);

    const entropyAnalysis = entropyPlanResult.ok
      ? {
        currentEntropy: entropyPlanResult.data.currentEntropy,
        targetEntropy: entropyPlanResult.data.targetEntropy,
        reductionPlan: entropyPlanResult.data,
        isAcceptable: this.entropyManagementService.isAcceptable(
          entropyResult.ok ? entropyResult.data : 100,
        ),
      }
      : {
        currentEntropy: entropyResult.ok ? entropyResult.data : 100,
        targetEntropy: 12.0,
        reductionPlan: null,
        isAcceptable: false,
      };

    return {
      currentSystemEntropy: entropyAnalysis.currentEntropy,
      entropyThreshold: entropyAnalysis.targetEntropy,
      entropyAcceptable: entropyAnalysis.isAcceptable,
      reductionRequired:
        entropyAnalysis.currentEntropy > entropyAnalysis.targetEntropy,
      entropyControlStrategy: entropyAnalysis.reductionPlan?.priority === "low"
        ? "gradual-control"
        : "aggressive-reduction",
      reductionStepsCount:
        entropyAnalysis.reductionPlan?.reductionStrategies?.length || 0,
      expectedEntropyAfterReduction: entropyAnalysis.targetEntropy,
      entropyReductionPercentage: entropyAnalysis.currentEntropy > 0
        ? ((entropyAnalysis.currentEntropy - entropyAnalysis.targetEntropy) /
          entropyAnalysis.currentEntropy) * 100
        : 0,
      implementationTimeEstimate: {
        lowEstimate: 7,
        highEstimate: 14,
        unit: "days",
      },
      entropyControlStages: [
        "system-entropy-measurement",
        "complexity-threshold-evaluation",
        "reduction-plan-generation",
        "strategy-selection",
        "reduction-execution",
        "entropy-validation",
      ],
      currentEntropyStage: "reduction-execution",
      entropyVarianceReductions: {
        "complexity-threshold-evaluation": "resolved",
        "impact-prediction-execution": "calculated",
        "pre-control-gate": "implemented",
        "entropy-reduction-execution": "planned",
      },
    };
  }

  private generateTotalityControlMetrics(): TotalityControlMetrics {
    return {
      currentExhaustiveControlLevel: 0.75,
      totalityComplianceRatio: 0.75,
      typeSafetyGuarantee: "partial",
      exhaustiveControlStrategy: "pragmatic-mixed",
      estimatedTypeSafetyVariance: "11%",
      estimatedDevelopmentEfficiencyVariance: "qualitative-medium",
      compileTimeVerificationVariance: "20%",
      maintainabilityVariance: "qualitative-medium",
      totalityControlStages: [
        "pattern-matching",
        "switch-exhaustiveness",
        "default-clause-elimination",
        "type-system-verification",
        "compile-time-guarantee",
        "runtime-safety",
      ],
      currentTotalityStage: "initialization",
      totalityVarianceRisks: {
        "switch-exhaustiveness": "medium",
        "pattern-matching": "medium",
        "type-system-verification": "high",
        "default-clause-elimination": "low",
      },
    };
  }

  private generateIntegratedControlMetrics(): IntegratedControlMetrics {
    return {
      integratedIssueControlLevel: 0.62,
      systemHealthScore: 0.62,
      criticalIssueCount: 3,
      integrationStrategy: "gradual-recommended",
      estimatedEntropyReductionVariance: "104%",
      estimatedPipelineImprovementVariance: "84%",
      estimatedTotalityImprovementVariance: "109%",
      estimatedImplementationTimeVariance: "100%",
      riskAssessmentVariance: "qualitative-high",
      integrationStages: [
        "entropy-excess-response",
        "pipeline-variance-control",
        "totality-principle-application",
        "ddd-boundary-strengthening",
        "hardcode-elimination",
        "integrated-validation-execution",
      ],
      currentIntegrationStage: "initialization",
      integrationVarianceRisks: {
        "entropy-excess-response": "critical",
        "pipeline-variance-control": "high",
        "totality-principle-application": "medium",
        "ddd-boundary-strengthening": "medium",
        "hardcode-elimination": "low",
        "integrated-validation-execution": "high",
      },
    };
  }
}
