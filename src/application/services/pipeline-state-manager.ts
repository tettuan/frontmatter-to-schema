import { err, ok, Result } from "../../domain/shared/types/result.ts";
import { createError, DomainError } from "../../domain/shared/types/errors.ts";
import { Schema } from "../../domain/schema/entities/schema.ts";
import { FrontmatterData } from "../../domain/frontmatter/value-objects/frontmatter-data.ts";
import { ProcessingStateMachine } from "./processing-state-machine.ts";

/**
 * Pipeline execution state using discriminated union
 * Following Totality principle - exhaustive state representation
 */
export type PipelineExecutionState =
  | { readonly kind: "idle" }
  | { readonly kind: "initializing"; readonly startTime: number }
  | { readonly kind: "schema-loading"; readonly schemaPath: string }
  | { readonly kind: "schema-loaded"; readonly schema: Schema }
  | { readonly kind: "template-resolving"; readonly schema: Schema }
  | { readonly kind: "template-resolved"; readonly paths: TemplatePaths }
  | { readonly kind: "document-processing"; readonly pattern: string }
  | { readonly kind: "document-processed"; readonly data: FrontmatterData }
  | { readonly kind: "rendering"; readonly outputPath: string }
  | { readonly kind: "completed"; readonly duration: number }
  | {
    readonly kind: "failed";
    readonly error: DomainError & { message: string };
  };

/**
 * Template paths resolved during execution
 */
export interface TemplatePaths {
  readonly templatePath: string;
  readonly itemsTemplatePath?: string;
  readonly outputFormat: "json" | "yaml" | "markdown";
}

/**
 * Pipeline execution context
 * Contains all data accumulated during pipeline execution
 */
export interface PipelineExecutionContext {
  readonly executionId: string;
  readonly state: PipelineExecutionState;
  readonly schema?: Schema;
  readonly templatePaths?: TemplatePaths;
  readonly processedData?: FrontmatterData;
  readonly itemsData?: FrontmatterData[];
  readonly startTime: number;
  readonly endTime?: number;
}

/**
 * State transition result
 */
export interface StateTransitionResult {
  readonly previousState: PipelineExecutionState;
  readonly newState: PipelineExecutionState;
  readonly timestamp: number;
}

/**
 * Pipeline State Manager
 * Manages pipeline execution state and transitions
 * Following DDD: Application service for state coordination
 * Following Totality: Exhaustive state handling with Result<T,E>
 */
export class PipelineStateManager {
  private currentContext: PipelineExecutionContext;
  private stateHistory: StateTransitionResult[];
  private readonly stateMachine: ProcessingStateMachine;

  constructor(
    executionId: string,
    stateMachine: ProcessingStateMachine,
  ) {
    this.currentContext = {
      executionId,
      state: { kind: "idle" },
      startTime: performance.now(),
    };
    this.stateHistory = [];
    this.stateMachine = stateMachine;
  }

  /**
   * Smart constructor following Totality principle
   */
  static create(
    executionId: string,
    stateMachine: ProcessingStateMachine,
  ): Result<PipelineStateManager, DomainError & { message: string }> {
    if (!executionId) {
      return err(createError({
        kind: "MissingRequired",
        field: "executionId",
        message: "Execution ID is required",
      }));
    }

    if (!stateMachine) {
      return err(createError({
        kind: "ConfigurationError",
        message: "ProcessingStateMachine is required",
      }));
    }

    return ok(new PipelineStateManager(executionId, stateMachine));
  }

  /**
   * Get current execution context
   */
  getContext(): PipelineExecutionContext {
    return this.currentContext;
  }

  /**
   * Get current state
   */
  getCurrentState(): PipelineExecutionState {
    return this.currentContext.state;
  }

  /**
   * Get state history
   */
  getStateHistory(): readonly StateTransitionResult[] {
    return this.stateHistory;
  }

  /**
   * Get execution ID
   */
  getExecutionId(): string {
    return this.currentContext.executionId;
  }

  /**
   * Generic transition method for simplified orchestrator
   */
  transitionTo(
    newState: PipelineExecutionState,
  ): Result<StateTransitionResult, DomainError & { message: string }> {
    return this.updateState(newState);
  }

  /**
   * Transition to initializing state
   */
  transitionToInitializing(): Result<
    StateTransitionResult,
    DomainError & { message: string }
  > {
    const currentState = this.currentContext.state;
    if (currentState.kind !== "idle") {
      return err(createError({
        kind: "ConfigurationError",
        from: currentState.kind,
        to: "initializing",
        message: `Cannot transition from ${currentState.kind} to initializing`,
      }));
    }

    const newState: PipelineExecutionState = {
      kind: "initializing",
      startTime: performance.now(),
    };

    return this.updateState(newState);
  }

  /**
   * Transition to schema loading state
   */
  transitionToSchemaLoading(
    schemaPath: string,
  ): Result<StateTransitionResult, DomainError & { message: string }> {
    const currentState = this.currentContext.state;
    if (currentState.kind !== "initializing") {
      return err(createError({
        kind: "ConfigurationError",
        from: currentState.kind,
        to: "schema-loading",
        message:
          `Cannot transition from ${currentState.kind} to schema-loading`,
      }));
    }

    const newState: PipelineExecutionState = {
      kind: "schema-loading",
      schemaPath,
    };

    return this.updateState(newState);
  }

  /**
   * Transition to schema loaded state
   */
  transitionToSchemaLoaded(
    schema: Schema,
  ): Result<StateTransitionResult, DomainError & { message: string }> {
    const currentState = this.currentContext.state;
    if (currentState.kind !== "schema-loading") {
      return err(createError({
        kind: "ConfigurationError",
        from: currentState.kind,
        to: "schema-loaded",
        message: `Cannot transition from ${currentState.kind} to schema-loaded`,
      }));
    }

    const newState: PipelineExecutionState = {
      kind: "schema-loaded",
      schema,
    };

    this.currentContext = {
      ...this.currentContext,
      schema,
    };

    return this.updateState(newState);
  }

  /**
   * Transition to template resolving state
   */
  transitionToTemplateResolving(
    schema: Schema,
  ): Result<StateTransitionResult, DomainError & { message: string }> {
    const currentState = this.currentContext.state;
    if (currentState.kind !== "schema-loaded") {
      return err(createError({
        kind: "ConfigurationError",
        from: currentState.kind,
        to: "template-resolving",
        message:
          `Cannot transition from ${currentState.kind} to template-resolving`,
      }));
    }

    const newState: PipelineExecutionState = {
      kind: "template-resolving",
      schema,
    };

    return this.updateState(newState);
  }

  /**
   * Transition to template resolved state
   */
  transitionToTemplateResolved(
    paths: TemplatePaths,
  ): Result<StateTransitionResult, DomainError & { message: string }> {
    const currentState = this.currentContext.state;
    if (currentState.kind !== "template-resolving") {
      return err(createError({
        kind: "ConfigurationError",
        from: currentState.kind,
        to: "template-resolved",
        message:
          `Cannot transition from ${currentState.kind} to template-resolved`,
      }));
    }

    const newState: PipelineExecutionState = {
      kind: "template-resolved",
      paths,
    };

    this.currentContext = {
      ...this.currentContext,
      templatePaths: paths,
    };

    return this.updateState(newState);
  }

  /**
   * Transition to document processing state
   */
  transitionToDocumentProcessing(
    pattern: string,
  ): Result<StateTransitionResult, DomainError & { message: string }> {
    const currentState = this.currentContext.state;
    if (currentState.kind !== "template-resolved") {
      return err(createError({
        kind: "ConfigurationError",
        from: currentState.kind,
        to: "document-processing",
        message:
          `Cannot transition from ${currentState.kind} to document-processing`,
      }));
    }

    const newState: PipelineExecutionState = {
      kind: "document-processing",
      pattern,
    };

    return this.updateState(newState);
  }

  /**
   * Transition to document processed state
   */
  transitionToDocumentProcessed(
    data: FrontmatterData,
    itemsData?: FrontmatterData[],
  ): Result<StateTransitionResult, DomainError & { message: string }> {
    const currentState = this.currentContext.state;
    if (currentState.kind !== "document-processing") {
      return err(createError({
        kind: "ConfigurationError",
        from: currentState.kind,
        to: "document-processed",
        message:
          `Cannot transition from ${currentState.kind} to document-processed`,
      }));
    }

    const newState: PipelineExecutionState = {
      kind: "document-processed",
      data,
    };

    this.currentContext = {
      ...this.currentContext,
      processedData: data,
      itemsData,
    };

    return this.updateState(newState);
  }

  /**
   * Transition to rendering state
   */
  transitionToRendering(
    outputPath: string,
  ): Result<StateTransitionResult, DomainError & { message: string }> {
    const currentState = this.currentContext.state;
    if (currentState.kind !== "document-processed") {
      return err(createError({
        kind: "ConfigurationError",
        from: currentState.kind,
        to: "rendering",
        message: `Cannot transition from ${currentState.kind} to rendering`,
      }));
    }

    const newState: PipelineExecutionState = {
      kind: "rendering",
      outputPath,
    };

    return this.updateState(newState);
  }

  /**
   * Transition to completed state
   */
  transitionToCompleted(): Result<
    StateTransitionResult,
    DomainError & { message: string }
  > {
    const currentState = this.currentContext.state;
    if (currentState.kind !== "rendering") {
      return err(createError({
        kind: "ConfigurationError",
        from: currentState.kind,
        to: "completed",
        message: `Cannot transition from ${currentState.kind} to completed`,
      }));
    }

    const endTime = performance.now();
    const duration = endTime - this.currentContext.startTime;

    const newState: PipelineExecutionState = {
      kind: "completed",
      duration,
    };

    this.currentContext = {
      ...this.currentContext,
      endTime,
    };

    return this.updateState(newState);
  }

  /**
   * Transition to failed state
   */
  transitionToFailed(
    error: DomainError & { message: string },
  ): Result<StateTransitionResult, DomainError & { message: string }> {
    const newState: PipelineExecutionState = {
      kind: "failed",
      error,
    };

    const endTime = performance.now();
    this.currentContext = {
      ...this.currentContext,
      endTime,
    };

    return this.updateState(newState);
  }

  /**
   * Check if pipeline is in terminal state
   */
  isTerminalState(): boolean {
    const state = this.currentContext.state;
    return state.kind === "completed" || state.kind === "failed";
  }

  /**
   * Check if pipeline can proceed
   */
  canProceed(): boolean {
    const state = this.currentContext.state;
    return state.kind !== "failed" && state.kind !== "completed";
  }

  /**
   * Reset state to idle
   */
  reset(): Result<void, DomainError & { message: string }> {
    this.currentContext = {
      executionId: this.currentContext.executionId,
      state: { kind: "idle" },
      startTime: performance.now(),
    };
    this.stateHistory = [];
    return ok(undefined);
  }

  /**
   * Update state and record transition
   */
  private updateState(
    newState: PipelineExecutionState,
  ): Result<StateTransitionResult, DomainError & { message: string }> {
    const previousState = this.currentContext.state;
    const timestamp = performance.now();

    const transition: StateTransitionResult = {
      previousState,
      newState,
      timestamp,
    };

    this.currentContext = {
      ...this.currentContext,
      state: newState,
    };

    this.stateHistory.push(transition);

    // Update ProcessingStateMachine
    const stateMachineResult = this.updateStateMachine(newState);
    if (!stateMachineResult.ok) {
      // Log warning but don't fail the state transition
      console.warn(
        `State machine update failed: ${stateMachineResult.error.message}`,
      );
    }

    return ok(transition);
  }

  /**
   * Update ProcessingStateMachine based on pipeline state
   */
  private updateStateMachine(
    _state: PipelineExecutionState,
  ): Result<void, DomainError & { message: string }> {
    // The ProcessingStateMachine tracks its own states
    // We don't need to manually transition it from here
    // Just log that state was updated successfully
    return ok(undefined);
  }

  /**
   * Get execution summary
   */
  getExecutionSummary(): {
    readonly executionId: string;
    readonly currentState: string;
    readonly duration?: number;
    readonly hasSchema: boolean;
    readonly hasTemplatePaths: boolean;
    readonly hasProcessedData: boolean;
    readonly stateTransitionCount: number;
  } {
    const state = this.currentContext.state;
    const duration = this.currentContext.endTime
      ? this.currentContext.endTime - this.currentContext.startTime
      : undefined;

    return {
      executionId: this.currentContext.executionId,
      currentState: state.kind,
      duration,
      hasSchema: !!this.currentContext.schema,
      hasTemplatePaths: !!this.currentContext.templatePaths,
      hasProcessedData: !!this.currentContext.processedData,
      stateTransitionCount: this.stateHistory.length,
    };
  }
}
