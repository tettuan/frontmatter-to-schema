/**
 * Processing State Machine for Document Processing Pipeline
 *
 * This module implements comprehensive state management using discriminated unions
 * following the totality principle. Each state transition is explicit and type-safe.
 */

import type { DomainError, Result } from "../core/result.ts";
import { createDomainError } from "../core/result.ts";
import type {
  AnalysisResult,
  DocumentId,
  ExtractedData,
  FrontMatter,
  MappedData,
  TemplateId,
} from "./entities.ts";

/**
 * Processing stages enumeration for better error context
 */
export type ProcessingStage =
  | "Discovery"
  | "FrontMatterExtraction"
  | "SchemaAnalysis"
  | "TemplateMapping"
  | "ResultAggregation"
  | "OutputGeneration";

/**
 * Comprehensive processing error types with full context
 */
export type ProcessingError =
  | {
    kind: "FileNotFound";
    path: string;
    stage: ProcessingStage;
    details: string;
  }
  | {
    kind: "ParseError";
    content: string;
    format: string;
    stage: ProcessingStage;
    details: string;
  }
  | {
    kind: "ValidationFailed";
    data: unknown;
    schema: unknown;
    stage: ProcessingStage;
    violations: string[];
  }
  | {
    kind: "TemplateError";
    templateId: string;
    data: unknown;
    stage: ProcessingStage;
    reason: string;
  }
  | {
    kind: "SystemError";
    operation: string;
    stage: ProcessingStage;
    cause: string;
  }
  | {
    kind: "TimeoutError";
    operation: string;
    stage: ProcessingStage;
    duration: number;
    maxDuration: number;
  }
  | {
    kind: "ResourceExhausted";
    resource: string;
    stage: ProcessingStage;
    details: string;
  };

/**
 * Processing state discriminated union - exhaustive state representation
 */
export type ProcessingState =
  | { kind: "NotStarted" }
  | { kind: "DocumentsDiscovered"; count: number; paths: string[] }
  | {
    kind: "FrontMatterExtracted";
    documentId: DocumentId;
    frontMatter: FrontMatter;
    timestamp: Date;
  }
  | {
    kind: "AnalysisInProgress";
    documentId: DocumentId;
    startedAt: Date;
    estimatedDuration?: number;
  }
  | {
    kind: "AnalysisCompleted";
    documentId: DocumentId;
    result: ExtractedData;
    duration: number;
    timestamp: Date;
  }
  | {
    kind: "MappingInProgress";
    documentId: DocumentId;
    templateId: TemplateId;
    startedAt: Date;
  }
  | {
    kind: "MappingCompleted";
    documentId: DocumentId;
    result: MappedData;
    templateId: TemplateId;
    duration: number;
    timestamp: Date;
  }
  | {
    kind: "ProcessingFailed";
    documentId: DocumentId;
    error: ProcessingError;
    stage: ProcessingStage;
    retryCount: number;
    timestamp: Date;
  }
  | {
    kind: "BatchCompleted";
    results: AnalysisResult[];
    errors: ProcessingError[];
    totalDuration: number;
    timestamp: Date;
  }
  | {
    kind: "RetryScheduled";
    documentId: DocumentId;
    error: ProcessingError;
    retryCount: number;
    nextRetryAt: Date;
  };

/**
 * State transition result for validation
 */
export type StateTransitionResult = Result<
  ProcessingState,
  DomainError & { message: string }
>;

/**
 * Processing State Machine with validated transitions
 */
export class ProcessingStateMachine {
  private constructor(private readonly currentState: ProcessingState) {}

  /**
   * Create initial state machine
   */
  static create(): ProcessingStateMachine {
    return new ProcessingStateMachine({ kind: "NotStarted" });
  }

  /**
   * Get current state
   */
  getCurrentState(): ProcessingState {
    return this.currentState;
  }

  /**
   * Transition to documents discovered state
   */
  transitionToDocumentsDiscovered(
    count: number,
    paths: string[],
  ): StateTransitionResult {
    if (this.currentState.kind !== "NotStarted") {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidStateTransition",
            from: this.currentState.kind,
            to: "DocumentsDiscovered",
          },
          `Cannot transition from ${this.currentState.kind} to DocumentsDiscovered`,
        ),
      };
    }

    if (count <= 0) {
      return {
        ok: false,
        error: createDomainError(
          { kind: "InvalidInput", field: "count" },
          "Document count must be greater than 0",
        ),
      };
    }

    if (paths.length !== count) {
      return {
        ok: false,
        error: createDomainError(
          { kind: "InvalidInput", field: "paths" },
          `Path count (${paths.length}) must match document count (${count})`,
        ),
      };
    }

    return {
      ok: true,
      data: { kind: "DocumentsDiscovered", count, paths },
    };
  }

  /**
   * Transition to front matter extracted state
   */
  transitionToFrontMatterExtracted(
    documentId: DocumentId,
    frontMatter: FrontMatter,
  ): StateTransitionResult {
    const validFromStates = [
      "DocumentsDiscovered",
      "FrontMatterExtracted",
      "ProcessingFailed",
    ];

    if (!validFromStates.includes(this.currentState.kind)) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidStateTransition",
            from: this.currentState.kind,
            to: "FrontMatterExtracted",
          },
          `Cannot transition from ${this.currentState.kind} to FrontMatterExtracted`,
        ),
      };
    }

    return {
      ok: true,
      data: {
        kind: "FrontMatterExtracted",
        documentId,
        frontMatter,
        timestamp: new Date(),
      },
    };
  }

  /**
   * Transition to analysis in progress state
   */
  transitionToAnalysisInProgress(
    documentId: DocumentId,
    estimatedDuration?: number,
  ): StateTransitionResult {
    const validFromStates = ["FrontMatterExtracted", "RetryScheduled"];

    if (!validFromStates.includes(this.currentState.kind)) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidStateTransition",
            from: this.currentState.kind,
            to: "AnalysisInProgress",
          },
          `Cannot transition from ${this.currentState.kind} to AnalysisInProgress`,
        ),
      };
    }

    return {
      ok: true,
      data: {
        kind: "AnalysisInProgress",
        documentId,
        startedAt: new Date(),
        estimatedDuration,
      },
    };
  }

  /**
   * Transition to analysis completed state
   */
  transitionToAnalysisCompleted(
    documentId: DocumentId,
    result: ExtractedData,
    duration: number,
  ): StateTransitionResult {
    if (this.currentState.kind !== "AnalysisInProgress") {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidStateTransition",
            from: this.currentState.kind,
            to: "AnalysisCompleted",
          },
          `Cannot transition from ${this.currentState.kind} to AnalysisCompleted`,
        ),
      };
    }

    // Validate that we're completing analysis for the same document
    if (!documentId.equals(this.currentState.documentId)) {
      return {
        ok: false,
        error: createDomainError(
          { kind: "DocumentMismatch" },
          "Analysis completion for different document than in progress",
        ),
      };
    }

    return {
      ok: true,
      data: {
        kind: "AnalysisCompleted",
        documentId,
        result,
        duration,
        timestamp: new Date(),
      },
    };
  }

  /**
   * Transition to processing failed state
   */
  transitionToProcessingFailed(
    documentId: DocumentId,
    error: ProcessingError,
    stage: ProcessingStage,
    retryCount: number = 0,
  ): StateTransitionResult {
    return {
      ok: true,
      data: {
        kind: "ProcessingFailed",
        documentId,
        error,
        stage,
        retryCount,
        timestamp: new Date(),
      },
    };
  }

  /**
   * Transition to batch completed state
   */
  transitionToBatchCompleted(
    results: AnalysisResult[],
    errors: ProcessingError[],
    totalDuration: number,
  ): StateTransitionResult {
    const validFromStates = [
      "MappingCompleted",
      "ProcessingFailed",
      "BatchCompleted", // Allow multiple batch completions
    ];

    if (!validFromStates.includes(this.currentState.kind)) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidStateTransition",
            from: this.currentState.kind,
            to: "BatchCompleted",
          },
          `Cannot transition from ${this.currentState.kind} to BatchCompleted`,
        ),
      };
    }

    return {
      ok: true,
      data: {
        kind: "BatchCompleted",
        results,
        errors,
        totalDuration,
        timestamp: new Date(),
      },
    };
  }

  /**
   * Check if state machine can transition to a specific state
   */
  canTransitionTo(targetState: ProcessingState["kind"]): boolean {
    const validTransitions: Record<
      ProcessingState["kind"],
      ProcessingState["kind"][]
    > = {
      "NotStarted": ["DocumentsDiscovered"],
      "DocumentsDiscovered": ["FrontMatterExtracted", "ProcessingFailed"],
      "FrontMatterExtracted": ["AnalysisInProgress", "ProcessingFailed"],
      "AnalysisInProgress": ["AnalysisCompleted", "ProcessingFailed"],
      "AnalysisCompleted": ["MappingInProgress", "ProcessingFailed"],
      "MappingInProgress": ["MappingCompleted", "ProcessingFailed"],
      "MappingCompleted": [
        "BatchCompleted",
        "FrontMatterExtracted",
        "ProcessingFailed",
      ],
      "ProcessingFailed": [
        "RetryScheduled",
        "FrontMatterExtracted",
        "BatchCompleted",
      ],
      "RetryScheduled": ["AnalysisInProgress", "ProcessingFailed"],
      "BatchCompleted": ["NotStarted", "DocumentsDiscovered"], // Allow restart
    };

    return validTransitions[this.currentState.kind]?.includes(targetState) ??
      false;
  }

  /**
   * Get human-readable description of current state
   */
  getStateDescription(): string {
    switch (this.currentState.kind) {
      case "NotStarted":
        return "Processing not started";
      case "DocumentsDiscovered":
        return `Discovered ${this.currentState.count} documents`;
      case "FrontMatterExtracted":
        return `Front matter extracted from document ${this.currentState.documentId.getValue()}`;
      case "AnalysisInProgress":
        return `Analyzing document ${this.currentState.documentId.getValue()}`;
      case "AnalysisCompleted":
        return `Analysis completed for document ${this.currentState.documentId.getValue()}`;
      case "MappingInProgress":
        return `Mapping document ${this.currentState.documentId.getValue()} with template ${this.currentState.templateId.getValue()}`;
      case "MappingCompleted":
        return `Mapping completed for document ${this.currentState.documentId.getValue()}`;
      case "ProcessingFailed":
        return `Processing failed for document ${this.currentState.documentId.getValue()}: ${this.currentState.error.kind}`;
      case "RetryScheduled":
        return `Retry scheduled for document ${this.currentState.documentId.getValue()}`;
      case "BatchCompleted":
        return `Batch completed: ${this.currentState.results.length} successful, ${this.currentState.errors.length} failed`;
      default: {
        // Exhaustive check - TypeScript will error if we miss a case
        const _exhaustiveCheck: never = this.currentState;
        throw new Error(`Unhandled state: ${String(_exhaustiveCheck)}`);
      }
    }
  }

  /**
   * Determine if processing is in a terminal state
   */
  isTerminal(): boolean {
    return this.currentState.kind === "BatchCompleted" ||
      (this.currentState.kind === "ProcessingFailed" &&
        this.currentState.retryCount >= 3); // Max retries reached
  }

  /**
   * Determine if processing can be retried
   */
  canRetry(): boolean {
    return this.currentState.kind === "ProcessingFailed" &&
      this.currentState.retryCount < 3;
  }
}
