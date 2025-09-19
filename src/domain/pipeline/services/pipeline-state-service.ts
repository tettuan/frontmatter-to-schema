import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";
import { Schema } from "../../schema/entities/schema.ts";
import { Template } from "../../template/entities/template.ts";

/**
 * Enhanced Pipeline State Service
 * Manages complex pipeline state transitions with full domain support
 * Following DDD and Totality principles
 */

/**
 * Pipeline execution state using discriminated unions
 * Represents all possible states in the pipeline lifecycle
 */
export type PipelineExecutionState =
  | { readonly kind: "Idle" }
  | {
    readonly kind: "Initializing";
    readonly config: PipelineConfiguration;
  }
  | {
    readonly kind: "LoadingSchema";
    readonly config: PipelineConfiguration;
    readonly schemaPath: string;
  }
  | {
    readonly kind: "SchemaLoaded";
    readonly config: PipelineConfiguration;
    readonly schema: Schema;
  }
  | {
    readonly kind: "ParsingFrontmatter";
    readonly config: PipelineConfiguration;
    readonly schema: Schema;
    readonly content: string;
  }
  | {
    readonly kind: "FrontmatterParsed";
    readonly config: PipelineConfiguration;
    readonly schema: Schema;
    readonly frontmatter: FrontmatterData;
  }
  | {
    readonly kind: "ValidatingData";
    readonly config: PipelineConfiguration;
    readonly schema: Schema;
    readonly frontmatter: FrontmatterData;
  }
  | {
    readonly kind: "DataValidated";
    readonly config: PipelineConfiguration;
    readonly schema: Schema;
    readonly validatedData: FrontmatterData;
  }
  | {
    readonly kind: "LoadingTemplate";
    readonly config: PipelineConfiguration;
    readonly schema: Schema;
    readonly validatedData: FrontmatterData;
    readonly templatePath: string;
  }
  | {
    readonly kind: "TemplateLoaded";
    readonly config: PipelineConfiguration;
    readonly schema: Schema;
    readonly validatedData: FrontmatterData;
    readonly template: Template;
  }
  | {
    readonly kind: "GeneratingOutput";
    readonly config: PipelineConfiguration;
    readonly schema: Schema;
    readonly validatedData: FrontmatterData;
    readonly template: Template;
  }
  | {
    readonly kind: "OutputGenerated";
    readonly config: PipelineConfiguration;
    readonly output: string;
  }
  | {
    readonly kind: "Completed";
    readonly result: PipelineResult;
  }
  | {
    readonly kind: "Failed";
    readonly error: PipelineExecutionError;
    readonly previousState?: PipelineExecutionState;
  };

/**
 * Pipeline configuration
 */
export interface PipelineConfiguration {
  readonly mode: "standard" | "validation-only" | "template-only";
  readonly schemaPath: string;
  readonly templatePath?: string;
  readonly outputPath?: string;
  readonly enableJMESPath: boolean;
  readonly parallelProcessing: boolean;
  readonly maxConcurrency: number;
}

/**
 * Pipeline execution result
 */
export interface PipelineResult {
  readonly output: string;
  readonly metadata: PipelineMetadata;
}

/**
 * Pipeline metadata
 */
export interface PipelineMetadata {
  readonly executionTimeMs: number;
  readonly statesTraversed: number;
  readonly memoryUsedMB: number;
  readonly schemaValidations: number;
  readonly templatesProcessed: number;
}

/**
 * Pipeline execution error
 */
export interface PipelineExecutionError {
  readonly phase: string;
  readonly message: string;
  readonly cause?: DomainError;
  readonly timestamp: Date;
}

/**
 * State transition event
 */
export type StateTransitionEvent =
  | { readonly kind: "Initialize"; readonly config: PipelineConfiguration }
  | { readonly kind: "LoadSchema"; readonly path: string }
  | { readonly kind: "SchemaLoadComplete"; readonly schema: Schema }
  | { readonly kind: "ParseFrontmatter"; readonly content: string }
  | {
    readonly kind: "FrontmatterParseComplete";
    readonly data: FrontmatterData;
  }
  | { readonly kind: "ValidateData" }
  | {
    readonly kind: "ValidationComplete";
    readonly validatedData: FrontmatterData;
  }
  | { readonly kind: "LoadTemplate"; readonly path: string }
  | { readonly kind: "TemplateLoadComplete"; readonly template: Template }
  | { readonly kind: "GenerateOutput" }
  | { readonly kind: "OutputGenerationComplete"; readonly output: string }
  | { readonly kind: "Complete" }
  | { readonly kind: "Fail"; readonly error: PipelineExecutionError };

/**
 * Pipeline State Service
 * Manages complex state transitions with validation and consistency
 */
export class PipelineStateService {
  private currentState: PipelineExecutionState;
  private readonly stateHistory: PipelineExecutionState[] = [];
  private readonly transitionLog: Array<{
    from: string;
    to: string;
    event: string;
    timestamp: Date;
  }> = [];

  private constructor(initialState: PipelineExecutionState) {
    this.currentState = initialState;
    this.stateHistory.push(initialState);
  }

  /**
   * Smart Constructor
   */
  static create(): Result<
    PipelineStateService,
    DomainError & { message: string }
  > {
    return ok(new PipelineStateService({ kind: "Idle" }));
  }

  /**
   * Get current state
   */
  getCurrentState(): PipelineExecutionState {
    return this.currentState;
  }

  /**
   * Get state history
   */
  getStateHistory(): readonly PipelineExecutionState[] {
    return this.stateHistory;
  }

  /**
   * Reset state machine to idle
   */
  reset(): void {
    this.currentState = { kind: "Idle" };
    this.stateHistory.length = 0;
    this.stateHistory.push(this.currentState);
    this.transitionLog.length = 0;
  }

  /**
   * Process state transition
   */
  transition(
    event: StateTransitionEvent,
  ): Result<PipelineExecutionState, DomainError & { message: string }> {
    const fromState = this.currentState.kind;

    const transitionResult = this.processTransition(this.currentState, event);

    if (!transitionResult.ok) {
      return transitionResult;
    }

    const toState = transitionResult.data.kind;

    // Log transition
    this.transitionLog.push({
      from: fromState,
      to: toState,
      event: event.kind,
      timestamp: new Date(),
    });

    // Update state
    this.currentState = transitionResult.data;
    this.stateHistory.push(this.currentState);

    return ok(this.currentState);
  }

  /**
   * Process state transition based on current state and event
   */
  private processTransition(
    state: PipelineExecutionState,
    event: StateTransitionEvent,
  ): Result<PipelineExecutionState, DomainError & { message: string }> {
    // Handle failure events from any state
    if (event.kind === "Fail") {
      return ok({
        kind: "Failed",
        error: event.error,
        previousState: state.kind !== "Failed" ? state : undefined,
      });
    }

    // State-specific transitions
    switch (state.kind) {
      case "Idle":
        return this.handleIdleTransition(state, event);

      case "Initializing":
        return this.handleInitializingTransition(state, event);

      case "LoadingSchema":
        return this.handleLoadingSchemaTransition(state, event);

      case "SchemaLoaded":
        return this.handleSchemaLoadedTransition(state, event);

      case "ParsingFrontmatter":
        return this.handleParsingFrontmatterTransition(state, event);

      case "FrontmatterParsed":
        return this.handleFrontmatterParsedTransition(state, event);

      case "ValidatingData":
        return this.handleValidatingDataTransition(state, event);

      case "DataValidated":
        return this.handleDataValidatedTransition(state, event);

      case "LoadingTemplate":
        return this.handleLoadingTemplateTransition(state, event);

      case "TemplateLoaded":
        return this.handleTemplateLoadedTransition(state, event);

      case "GeneratingOutput":
        return this.handleGeneratingOutputTransition(state, event);

      case "OutputGenerated":
        return this.handleOutputGeneratedTransition(state, event);

      case "Completed":
      case "Failed":
        return err(createError({
          kind: "InvalidType",
          expected: "non-terminal state",
          actual: state.kind,
        }));
    }
  }

  private handleIdleTransition(
    _state: Extract<PipelineExecutionState, { kind: "Idle" }>,
    event: StateTransitionEvent,
  ): Result<PipelineExecutionState, DomainError & { message: string }> {
    if (event.kind === "Initialize") {
      return ok({
        kind: "Initializing",
        config: event.config,
      });
    }

    return err(createError({
      kind: "InvalidType",
      expected: "Initialize",
      actual: event.kind,
    }));
  }

  private handleInitializingTransition(
    state: Extract<PipelineExecutionState, { kind: "Initializing" }>,
    event: StateTransitionEvent,
  ): Result<PipelineExecutionState, DomainError & { message: string }> {
    if (event.kind === "LoadSchema") {
      return ok({
        kind: "LoadingSchema",
        config: state.config,
        schemaPath: event.path,
      });
    }

    return err(createError({
      kind: "InvalidType",
      expected: "LoadSchema",
      actual: event.kind,
    }));
  }

  private handleLoadingSchemaTransition(
    state: Extract<PipelineExecutionState, { kind: "LoadingSchema" }>,
    event: StateTransitionEvent,
  ): Result<PipelineExecutionState, DomainError & { message: string }> {
    if (event.kind === "SchemaLoadComplete") {
      return ok({
        kind: "SchemaLoaded",
        config: state.config,
        schema: event.schema,
      });
    }

    return err(createError({
      kind: "InvalidType",
      expected: "SchemaLoadComplete",
      actual: event.kind,
    }));
  }

  private handleSchemaLoadedTransition(
    state: Extract<PipelineExecutionState, { kind: "SchemaLoaded" }>,
    event: StateTransitionEvent,
  ): Result<PipelineExecutionState, DomainError & { message: string }> {
    if (event.kind === "ParseFrontmatter") {
      return ok({
        kind: "ParsingFrontmatter",
        config: state.config,
        schema: state.schema,
        content: event.content,
      });
    }

    return err(createError({
      kind: "InvalidType",
      expected: "ParseFrontmatter",
      actual: event.kind,
    }));
  }

  private handleParsingFrontmatterTransition(
    state: Extract<PipelineExecutionState, { kind: "ParsingFrontmatter" }>,
    event: StateTransitionEvent,
  ): Result<PipelineExecutionState, DomainError & { message: string }> {
    if (event.kind === "FrontmatterParseComplete") {
      return ok({
        kind: "FrontmatterParsed",
        config: state.config,
        schema: state.schema,
        frontmatter: event.data,
      });
    }

    return err(createError({
      kind: "InvalidType",
      expected: "FrontmatterParseComplete",
      actual: event.kind,
    }));
  }

  private handleFrontmatterParsedTransition(
    state: Extract<PipelineExecutionState, { kind: "FrontmatterParsed" }>,
    event: StateTransitionEvent,
  ): Result<PipelineExecutionState, DomainError & { message: string }> {
    if (event.kind === "ValidateData") {
      if (state.config.mode === "template-only") {
        // Skip validation for template-only mode
        return ok({
          kind: "DataValidated",
          config: state.config,
          schema: state.schema,
          validatedData: state.frontmatter,
        });
      }

      return ok({
        kind: "ValidatingData",
        config: state.config,
        schema: state.schema,
        frontmatter: state.frontmatter,
      });
    }

    return err(createError({
      kind: "InvalidType",
      expected: "ValidateData",
      actual: event.kind,
    }));
  }

  private handleValidatingDataTransition(
    state: Extract<PipelineExecutionState, { kind: "ValidatingData" }>,
    event: StateTransitionEvent,
  ): Result<PipelineExecutionState, DomainError & { message: string }> {
    if (event.kind === "ValidationComplete") {
      return ok({
        kind: "DataValidated",
        config: state.config,
        schema: state.schema,
        validatedData: event.validatedData,
      });
    }

    return err(createError({
      kind: "InvalidType",
      expected: "ValidationComplete",
      actual: event.kind,
    }));
  }

  private handleDataValidatedTransition(
    state: Extract<PipelineExecutionState, { kind: "DataValidated" }>,
    event: StateTransitionEvent,
  ): Result<PipelineExecutionState, DomainError & { message: string }> {
    if (event.kind === "LoadTemplate") {
      if (state.config.mode === "validation-only") {
        // Skip template for validation-only mode
        return ok({
          kind: "OutputGenerated",
          config: state.config,
          output: "Validation completed successfully",
        });
      }

      return ok({
        kind: "LoadingTemplate",
        config: state.config,
        schema: state.schema,
        validatedData: state.validatedData,
        templatePath: event.path,
      });
    }

    return err(createError({
      kind: "InvalidType",
      expected: "LoadTemplate",
      actual: event.kind,
    }));
  }

  private handleLoadingTemplateTransition(
    state: Extract<PipelineExecutionState, { kind: "LoadingTemplate" }>,
    event: StateTransitionEvent,
  ): Result<PipelineExecutionState, DomainError & { message: string }> {
    if (event.kind === "TemplateLoadComplete") {
      return ok({
        kind: "TemplateLoaded",
        config: state.config,
        schema: state.schema,
        validatedData: state.validatedData,
        template: event.template,
      });
    }

    return err(createError({
      kind: "InvalidType",
      expected: "TemplateLoadComplete",
      actual: event.kind,
    }));
  }

  private handleTemplateLoadedTransition(
    state: Extract<PipelineExecutionState, { kind: "TemplateLoaded" }>,
    event: StateTransitionEvent,
  ): Result<PipelineExecutionState, DomainError & { message: string }> {
    if (event.kind === "GenerateOutput") {
      return ok({
        kind: "GeneratingOutput",
        config: state.config,
        schema: state.schema,
        validatedData: state.validatedData,
        template: state.template,
      });
    }

    return err(createError({
      kind: "InvalidType",
      expected: "GenerateOutput",
      actual: event.kind,
    }));
  }

  private handleGeneratingOutputTransition(
    state: Extract<PipelineExecutionState, { kind: "GeneratingOutput" }>,
    event: StateTransitionEvent,
  ): Result<PipelineExecutionState, DomainError & { message: string }> {
    if (event.kind === "OutputGenerationComplete") {
      return ok({
        kind: "OutputGenerated",
        config: state.config,
        output: event.output,
      });
    }

    return err(createError({
      kind: "InvalidType",
      expected: "OutputGenerationComplete",
      actual: event.kind,
    }));
  }

  private handleOutputGeneratedTransition(
    state: Extract<PipelineExecutionState, { kind: "OutputGenerated" }>,
    event: StateTransitionEvent,
  ): Result<PipelineExecutionState, DomainError & { message: string }> {
    if (event.kind === "Complete") {
      const metadata: PipelineMetadata = {
        executionTimeMs: 0, // Would be calculated from actual timing
        statesTraversed: this.stateHistory.length,
        memoryUsedMB: 0, // Would be calculated from actual usage
        schemaValidations: state.config.mode === "template-only" ? 0 : 1,
        templatesProcessed: state.config.mode === "validation-only" ? 0 : 1,
      };

      return ok({
        kind: "Completed",
        result: {
          output: state.output,
          metadata,
        },
      });
    }

    return err(createError({
      kind: "InvalidType",
      expected: "Complete",
      actual: event.kind,
    }));
  }

  /**
   * Check if pipeline is in terminal state
   */
  isTerminal(): boolean {
    return this.currentState.kind === "Completed" ||
      this.currentState.kind === "Failed";
  }

  /**
   * Check if pipeline can proceed
   */
  canProceed(): boolean {
    return !this.isTerminal();
  }

  /**
   * Get transition log
   */
  getTransitionLog(): Array<{
    from: string;
    to: string;
    event: string;
    timestamp: Date;
  }> {
    return this.transitionLog;
  }
}
