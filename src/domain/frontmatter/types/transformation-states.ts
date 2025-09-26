/**
 * @fileoverview Frontmatter Transformation State Types
 * @description Discriminated union types for frontmatter transformation states
 * Following Totality principles to eliminate partial functions
 */

import { DomainError } from "../../shared/types/errors.ts";
import { FrontmatterData } from "../value-objects/frontmatter-data.ts";
import { ValidationRules } from "../../schema/value-objects/validation-rules.ts";

/**
 * Processing Strategy State
 * Replaces boolean flags and optional properties with discriminated unions
 */
export type ProcessingStrategyState =
  | { kind: "sequential" }
  | { kind: "parallel"; workers: number }
  | { kind: "adaptive"; baseWorkers: number; threshold: number };

/**
 * Validation State
 * Represents the validation lifecycle of frontmatter data
 */
export type ValidationState =
  | { kind: "unvalidated"; data: unknown }
  | { kind: "validating"; data: unknown; rules: ValidationRules }
  | { kind: "validated"; data: FrontmatterData }
  | {
    kind: "validation_failed";
    data: unknown;
    errors: Array<DomainError & { message: string }>;
  };

/**
 * Transformation Progress State
 * Tracks the progress of document transformation
 */
export type TransformationProgressState =
  | { kind: "pending"; totalFiles: number }
  | {
    kind: "processing";
    processedCount: number;
    totalFiles: number;
    currentFile: string;
  }
  | { kind: "aggregating"; processedData: FrontmatterData[] }
  | { kind: "completed"; result: FrontmatterData; processedCount: number }
  | {
    kind: "failed";
    error: DomainError & { message: string };
    processedCount: number;
  };

/**
 * Memory Monitoring State
 * Tracks memory usage during processing
 */
export type MemoryMonitoringState =
  | { kind: "within_bounds"; heapUsed: number; limit: number }
  | {
    kind: "approaching_limit";
    heapUsed: number;
    warningThreshold: number;
    limit: number;
  }
  | { kind: "exceeded_limit"; heapUsed: number; limit: number };

/**
 * Document Processing Result
 * Represents the result of processing a single document
 */
export type DocumentProcessingResult =
  | {
    kind: "success";
    data: FrontmatterData;
    document: import("../entities/markdown-document.ts").MarkdownDocument;
  }
  | { kind: "skipped"; reason: string; filePath: string }
  | {
    kind: "failed";
    error: DomainError & { message: string };
    filePath: string;
  };

/**
 * Aggregation State
 * Represents the state of data aggregation
 */
export type AggregationState =
  | { kind: "not_started"; dataCount: number }
  | { kind: "in_progress"; processedRules: number; totalRules: number }
  | { kind: "completed"; result: FrontmatterData }
  | { kind: "failed"; error: DomainError & { message: string } };

/**
 * Schema Resolution State
 * Represents the state of schema resolution for frontmatter parts
 */
export type SchemaResolutionState =
  | { kind: "unresolved"; hasRefs: boolean }
  | { kind: "resolving"; currentRef: string }
  | {
    kind: "resolved";
    schema: import("../../schema/entities/schema.ts").Schema;
  }
  | { kind: "resolution_failed"; error: DomainError & { message: string } };

/**
 * Transition from unvalidated to validating state
 */
export function startValidation(
  data: unknown,
  rules: ValidationRules,
): ValidationState {
  return { kind: "validating", data, rules };
}

/**
 * Transition to validated state
 */
export function completeValidation(data: FrontmatterData): ValidationState {
  return { kind: "validated", data };
}

/**
 * Transition to validation failed state
 */
export function failValidation(
  data: unknown,
  errors: Array<DomainError & { message: string }>,
): ValidationState {
  return { kind: "validation_failed", data, errors };
}

/**
 * Check if processing should use parallel strategy
 */
export function determineProcessingStrategy(
  fileCount: number,
  requestedStrategy?: ProcessingStrategyState,
): ProcessingStrategyState {
  if (requestedStrategy) {
    return requestedStrategy;
  }

  // Default heuristics
  if (fileCount <= 5) {
    return { kind: "sequential" };
  } else if (fileCount <= 20) {
    return { kind: "parallel", workers: 4 };
  } else {
    return { kind: "adaptive", baseWorkers: 8, threshold: 100 };
  }
}

/**
 * Update transformation progress
 */
export function updateProgress(
  current: TransformationProgressState,
  event:
    | { type: "file_processed"; file: string }
    | {
      type: "file_failed";
      file: string;
      error: DomainError & { message: string };
    }
    | { type: "aggregation_started"; data: FrontmatterData[] }
    | { type: "completed"; result: FrontmatterData },
): TransformationProgressState {
  switch (current.kind) {
    case "pending":
      if (event.type === "file_processed" || event.type === "file_failed") {
        return {
          kind: "processing",
          processedCount: 1,
          totalFiles: current.totalFiles,
          currentFile: event.file,
        };
      }
      return current;

    case "processing":
      if (event.type === "file_processed") {
        return {
          kind: "processing",
          processedCount: current.processedCount + 1,
          totalFiles: current.totalFiles,
          currentFile: event.file,
        };
      }
      if (event.type === "file_failed") {
        return {
          kind: "failed",
          error: event.error,
          processedCount: current.processedCount,
        };
      }
      if (event.type === "aggregation_started") {
        return {
          kind: "aggregating",
          processedData: event.data,
        };
      }
      return current;

    case "aggregating":
      if (event.type === "completed") {
        return {
          kind: "completed",
          result: event.result,
          processedCount: current.processedData.length,
        };
      }
      return current;

    case "completed":
    case "failed":
      // Terminal states
      return current;
  }
}

/**
 * Helper object for state transitions (grouping for backward compatibility)
 */
export const StateTransitions = {
  startValidation,
  completeValidation,
  failValidation,
  determineProcessingStrategy,
  updateProgress,
};
