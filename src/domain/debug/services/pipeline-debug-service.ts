import { err, ok, Result } from "../../shared/types/result.ts";
import {
  createError,
  DomainError,
  ValidationError,
} from "../../shared/types/errors.ts";
import { EntropyAnalysisReport } from "../value-objects/entropy-analysis-report.ts";
import {
  TotalityComplianceReport,
  TotalityMetrics,
} from "../value-objects/totality-compliance-report.ts";
import {
  DebugState,
  DebugStateFactory,
  DebugStateGuards,
} from "../types/debug-state.ts";

/**
 * Debug information generation configuration
 */
export interface DebugConfiguration {
  readonly entropyThreshold: number;
  readonly maxReductionSteps: number;
  readonly complianceThreshold: number;
  readonly enableDetailedAnalysis: boolean;
  readonly enablePerformanceTracking: boolean;
}

/**
 * Pipeline Debug Service following DDD and Totality principles
 * Responsible for entropy analysis and totality compliance tracking
 */
export class PipelineDebugService {
  private state: DebugState;

  private constructor(
    private readonly config: DebugConfiguration,
    initialState: DebugState,
  ) {
    this.state = initialState;
  }

  /**
   * Smart constructor for PipelineDebugService
   */
  static create(
    config: DebugConfiguration,
    systemComplexity: number = 0,
  ): Result<PipelineDebugService, ValidationError & { message: string }> {
    // Validate configuration
    const configValidation = PipelineDebugService.validateConfiguration(config);
    if (!configValidation.ok) {
      return configValidation;
    }

    // Validate system complexity
    if (systemComplexity < 0 || systemComplexity > 100) {
      return err(createError({
        kind: "OutOfRange",
        value: systemComplexity,
        min: 0,
        max: 100,
      }, "System complexity must be between 0 and 100"));
    }

    const initialState = DebugStateFactory.createInitializing(systemComplexity);
    return ok(new PipelineDebugService(config, initialState));
  }

  /**
   * Validate debug configuration
   */
  private static validateConfiguration(
    config: DebugConfiguration,
  ): Result<void, ValidationError & { message: string }> {
    if (config.entropyThreshold < 0 || config.entropyThreshold > 100) {
      return err(createError({
        kind: "OutOfRange",
        value: config.entropyThreshold,
        min: 0,
        max: 100,
      }, "Entropy threshold must be between 0 and 100"));
    }

    if (config.maxReductionSteps < 1 || config.maxReductionSteps > 50) {
      return err(createError({
        kind: "OutOfRange",
        value: config.maxReductionSteps,
        min: 1,
        max: 50,
      }, "Max reduction steps must be between 1 and 50"));
    }

    if (config.complianceThreshold < 0 || config.complianceThreshold > 1) {
      return err(createError({
        kind: "OutOfRange",
        value: config.complianceThreshold,
        min: 0,
        max: 1,
      }, "Compliance threshold must be between 0.0 and 1.0"));
    }

    return ok(void 0);
  }

  /**
   * Start entropy measurement phase
   */
  startEntropyMeasurement(
    measurements: Record<string, number>,
  ): Result<void, DomainError & { message: string }> {
    if (!DebugStateGuards.isInitializing(this.state)) {
      return err(createError({
        kind: "ConfigurationError",
        message:
          `Cannot start entropy measurement from ${this.state.kind} state`,
      }));
    }

    this.state = DebugStateFactory.createEntropyMeasuring(
      this.state.systemComplexity,
      measurements,
    );

    return ok(void 0);
  }

  /**
   * Generate entropy analysis report
   */
  generateEntropyAnalysis(
    currentEntropy: number,
    reductionSteps: number,
    expectedReduction: number,
  ): Result<void, DomainError & { message: string }> {
    if (!DebugStateGuards.isEntropyMeasuring(this.state)) {
      return err(createError({
        kind: "ConfigurationError",
        message:
          `Cannot generate entropy analysis from ${this.state.kind} state`,
      }));
    }

    const reductionRequired = currentEntropy > this.config.entropyThreshold;
    const strategy = reductionSteps > this.config.maxReductionSteps / 2
      ? "aggressive-reduction"
      : "gradual-control";

    const reductionPercentage = currentEntropy > 0
      ? ((currentEntropy - expectedReduction) / currentEntropy) * 100
      : 0;

    const entropyReportResult = EntropyAnalysisReport.create(
      currentEntropy,
      this.config.entropyThreshold,
      reductionRequired,
      strategy,
      reductionSteps,
      expectedReduction,
      reductionPercentage,
      "system-entropy-measurement",
    );

    if (!entropyReportResult.ok) {
      this.state = DebugStateFactory.createFailed(entropyReportResult.error);
      return err(entropyReportResult.error);
    }

    this.state = DebugStateFactory.createTotalityAnalyzing(
      entropyReportResult.data,
    );
    return ok(void 0);
  }

  /**
   * Generate totality compliance report
   */
  generateTotalityCompliance(
    totalityMetrics: TotalityMetrics,
    currentLevel: number,
    complianceRatio: number,
  ): Result<void, DomainError & { message: string }> {
    if (!DebugStateGuards.isTotalityAnalyzing(this.state)) {
      return err(createError({
        kind: "ConfigurationError",
        message:
          `Cannot generate totality compliance from ${this.state.kind} state`,
      }));
    }

    const typeSafetyGuarantee = complianceRatio >= 0.9
      ? "complete"
      : complianceRatio >= 0.7
      ? "partial"
      : "minimal";

    const strategy = complianceRatio < this.config.complianceThreshold
      ? "strict-exhaustive"
      : "pragmatic-exhaustive";

    const totalityReportResult = TotalityComplianceReport.create(
      currentLevel,
      complianceRatio,
      typeSafetyGuarantee,
      strategy,
      15, // estimatedTypeSafetyVariance
      10, // compileTimeVerificationVariance
      "pattern-matching",
      totalityMetrics,
    );

    if (!totalityReportResult.ok) {
      this.state = DebugStateFactory.createFailed(
        totalityReportResult.error,
        { entropyReport: this.state.entropyReport },
      );
      return err(totalityReportResult.error);
    }

    this.state = DebugStateFactory.createComplianceChecking(
      this.state.entropyReport,
      totalityReportResult.data,
    );

    return ok(void 0);
  }

  /**
   * Generate final debug report
   */
  generateDebugReport(): Result<
    {
      entropyReport: EntropyAnalysisReport;
      totalityReport: TotalityComplianceReport;
      processingTime: number;
    },
    DomainError & { message: string }
  > {
    if (!DebugStateGuards.isComplianceChecking(this.state)) {
      return err(createError({
        kind: "ConfigurationError",
        message: `Cannot generate debug report from ${this.state.kind} state`,
      }));
    }

    // State is compliance-checking, so we can safely access reports
    const complianceState = this.state;

    const reportingState = DebugStateFactory.createReporting(
      complianceState.entropyReport,
      complianceState.totalityReport,
    );

    this.state = reportingState;

    const processingTime = Date.now() - Date.now(); // Simplified for now

    const completedState = DebugStateFactory.createCompleted(
      complianceState.entropyReport,
      complianceState.totalityReport,
      processingTime,
    );

    this.state = completedState;

    return ok({
      entropyReport: complianceState.entropyReport,
      totalityReport: complianceState.totalityReport,
      processingTime,
    });
  }

  /**
   * Get current debug state
   */
  getCurrentState(): DebugState {
    return this.state;
  }

  /**
   * Check if debug service is in terminal state
   */
  isTerminal(): boolean {
    return DebugStateGuards.isTerminal(this.state);
  }

  /**
   * Check if debug service has completed successfully
   */
  isCompleted(): boolean {
    return DebugStateGuards.isCompleted(this.state);
  }

  /**
   * Check if debug service has failed
   */
  hasFailed(): boolean {
    return DebugStateGuards.isFailed(this.state);
  }

  /**
   * Get error if service has failed
   */
  getError(): DomainError | undefined {
    return DebugStateGuards.isFailed(this.state) ? this.state.error : undefined;
  }

  /**
   * Get debug information for logging
   */
  getDebugInfo(): Record<string, unknown> {
    const baseInfo = {
      state: this.state.kind,
      config: this.config,
      isTerminal: this.isTerminal(),
      isCompleted: this.isCompleted(),
      hasFailed: this.hasFailed(),
    };

    if (
      DebugStateGuards.hasEntropyReport(this.state) &&
      this.state.kind !== "failed"
    ) {
      if (
        this.state.kind === "totality-analyzing" ||
        this.state.kind === "compliance-checking" ||
        this.state.kind === "reporting" ||
        this.state.kind === "completed"
      ) {
        return {
          ...baseInfo,
          entropyReport: this.state.entropyReport.toLogSummary(),
        };
      }
    }

    if (
      DebugStateGuards.hasTotalityReport(this.state) &&
      this.state.kind !== "failed"
    ) {
      if (
        this.state.kind === "compliance-checking" ||
        this.state.kind === "reporting" ||
        this.state.kind === "completed"
      ) {
        return {
          ...baseInfo,
          totalityReport: this.state.totalityReport.toLogSummary(),
        };
      }
    }

    if (DebugStateGuards.isFailed(this.state)) {
      return {
        ...baseInfo,
        error: this.state.error,
        partialData: this.state.partialData,
      };
    }

    return baseInfo;
  }
}
