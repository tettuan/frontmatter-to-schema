import { EntropyAnalysisReport } from "../value-objects/entropy-analysis-report.ts";
import { TotalityComplianceReport } from "../value-objects/totality-compliance-report.ts";
import { DomainError } from "../../shared/types/errors.ts";

/**
 * Debug state discriminated union following Totality principles
 * Represents the complete lifecycle of debug information generation
 */
export type DebugState =
  | {
    readonly kind: "initializing";
    readonly startTime: number;
    readonly systemComplexity: number;
  }
  | {
    readonly kind: "entropy-measuring";
    readonly systemComplexity: number;
    readonly currentMeasurements: Record<string, number>;
  }
  | {
    readonly kind: "totality-analyzing";
    readonly entropyReport: EntropyAnalysisReport;
    readonly analysisStartTime: number;
  }
  | {
    readonly kind: "compliance-checking";
    readonly entropyReport: EntropyAnalysisReport;
    readonly totalityReport: TotalityComplianceReport;
  }
  | {
    readonly kind: "reporting";
    readonly entropyReport: EntropyAnalysisReport;
    readonly totalityReport: TotalityComplianceReport;
    readonly reportGeneratedAt: number;
  }
  | {
    readonly kind: "completed";
    readonly entropyReport: EntropyAnalysisReport;
    readonly totalityReport: TotalityComplianceReport;
    readonly completedAt: number;
    readonly processingTimeMs: number;
  }
  | {
    readonly kind: "failed";
    readonly error: DomainError;
    readonly failedAt: number;
    readonly partialData?: {
      entropyReport?: EntropyAnalysisReport;
      totalityReport?: TotalityComplianceReport;
    };
  };

/**
 * Debug state factory with type guards
 */
export class DebugStateFactory {
  static createInitializing(
    systemComplexity: number,
  ): DebugState {
    return {
      kind: "initializing",
      startTime: Date.now(),
      systemComplexity,
    };
  }

  static createEntropyMeasuring(
    systemComplexity: number,
    currentMeasurements: Record<string, number>,
  ): DebugState {
    return {
      kind: "entropy-measuring",
      systemComplexity,
      currentMeasurements,
    };
  }

  static createTotalityAnalyzing(
    entropyReport: EntropyAnalysisReport,
  ): DebugState {
    return {
      kind: "totality-analyzing",
      entropyReport,
      analysisStartTime: Date.now(),
    };
  }

  static createComplianceChecking(
    entropyReport: EntropyAnalysisReport,
    totalityReport: TotalityComplianceReport,
  ): DebugState {
    return {
      kind: "compliance-checking",
      entropyReport,
      totalityReport,
    };
  }

  static createReporting(
    entropyReport: EntropyAnalysisReport,
    totalityReport: TotalityComplianceReport,
  ): DebugState {
    return {
      kind: "reporting",
      entropyReport,
      totalityReport,
      reportGeneratedAt: Date.now(),
    };
  }

  static createCompleted(
    entropyReport: EntropyAnalysisReport,
    totalityReport: TotalityComplianceReport,
    processingTimeMs: number,
  ): DebugState {
    return {
      kind: "completed",
      entropyReport,
      totalityReport,
      completedAt: Date.now(),
      processingTimeMs,
    };
  }

  static createFailed(
    error: DomainError,
    partialData?: {
      entropyReport?: EntropyAnalysisReport;
      totalityReport?: TotalityComplianceReport;
    },
  ): DebugState {
    return {
      kind: "failed",
      error,
      failedAt: Date.now(),
      partialData,
    };
  }
}

/**
 * Type guards for debug state discrimination
 */
export const DebugStateGuards = {
  isInitializing: (
    state: DebugState,
  ): state is Extract<DebugState, { kind: "initializing" }> =>
    state.kind === "initializing",

  isEntropyMeasuring: (
    state: DebugState,
  ): state is Extract<DebugState, { kind: "entropy-measuring" }> =>
    state.kind === "entropy-measuring",

  isTotalityAnalyzing: (
    state: DebugState,
  ): state is Extract<DebugState, { kind: "totality-analyzing" }> =>
    state.kind === "totality-analyzing",

  isComplianceChecking: (
    state: DebugState,
  ): state is Extract<DebugState, { kind: "compliance-checking" }> =>
    state.kind === "compliance-checking",

  isReporting: (
    state: DebugState,
  ): state is Extract<DebugState, { kind: "reporting" }> =>
    state.kind === "reporting",

  isCompleted: (
    state: DebugState,
  ): state is Extract<DebugState, { kind: "completed" }> =>
    state.kind === "completed",

  isFailed: (
    state: DebugState,
  ): state is Extract<DebugState, { kind: "failed" }> =>
    state.kind === "failed",

  isTerminal: (state: DebugState): boolean =>
    state.kind === "completed" || state.kind === "failed",

  hasEntropyReport: (state: DebugState): boolean =>
    state.kind === "totality-analyzing" ||
    state.kind === "compliance-checking" ||
    state.kind === "reporting" ||
    state.kind === "completed" ||
    (state.kind === "failed" && state.partialData?.entropyReport !== undefined),

  hasTotalityReport: (state: DebugState): boolean =>
    state.kind === "compliance-checking" ||
    state.kind === "reporting" ||
    state.kind === "completed" ||
    (state.kind === "failed" &&
      state.partialData?.totalityReport !== undefined),
};
