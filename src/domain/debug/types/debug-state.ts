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
    readonly kind: "failed-without-data";
    readonly error: DomainError;
    readonly failedAt: number;
  }
  | {
    readonly kind: "failed-with-entropy";
    readonly error: DomainError;
    readonly failedAt: number;
    readonly entropyReport: EntropyAnalysisReport;
  }
  | {
    readonly kind: "failed-with-both";
    readonly error: DomainError;
    readonly failedAt: number;
    readonly entropyReport: EntropyAnalysisReport;
    readonly totalityReport: TotalityComplianceReport;
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

  static createFailedWithoutData(error: DomainError): DebugState {
    return {
      kind: "failed-without-data",
      error,
      failedAt: Date.now(),
    };
  }

  static createFailedWithEntropy(
    error: DomainError,
    entropyReport: EntropyAnalysisReport,
  ): DebugState {
    return {
      kind: "failed-with-entropy",
      error,
      failedAt: Date.now(),
      entropyReport,
    };
  }

  static createFailedWithBoth(
    error: DomainError,
    entropyReport: EntropyAnalysisReport,
    totalityReport: TotalityComplianceReport,
  ): DebugState {
    return {
      kind: "failed-with-both",
      error,
      failedAt: Date.now(),
      entropyReport,
      totalityReport,
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

  isFailedWithoutData: (
    state: DebugState,
  ): state is Extract<DebugState, { kind: "failed-without-data" }> =>
    state.kind === "failed-without-data",

  isFailedWithEntropy: (
    state: DebugState,
  ): state is Extract<DebugState, { kind: "failed-with-entropy" }> =>
    state.kind === "failed-with-entropy",

  isFailedWithBoth: (
    state: DebugState,
  ): state is Extract<DebugState, { kind: "failed-with-both" }> =>
    state.kind === "failed-with-both",

  isFailed: (state: DebugState): boolean =>
    state.kind === "failed-without-data" ||
    state.kind === "failed-with-entropy" ||
    state.kind === "failed-with-both",

  isTerminal: (state: DebugState): boolean =>
    state.kind === "completed" ||
    state.kind === "failed-without-data" ||
    state.kind === "failed-with-entropy" ||
    state.kind === "failed-with-both",

  hasEntropyReport: (state: DebugState): boolean =>
    state.kind === "totality-analyzing" ||
    state.kind === "compliance-checking" ||
    state.kind === "reporting" ||
    state.kind === "completed" ||
    state.kind === "failed-with-entropy" ||
    state.kind === "failed-with-both",

  hasTotalityReport: (state: DebugState): boolean =>
    state.kind === "compliance-checking" ||
    state.kind === "reporting" ||
    state.kind === "completed" ||
    state.kind === "failed-with-both",
};
