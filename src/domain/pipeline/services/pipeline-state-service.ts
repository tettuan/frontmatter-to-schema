import { ok, Result } from "../../shared/types/result.ts";
import { DomainError } from "../../shared/types/errors.ts";

/**
 * Pipeline State Service (Legacy Compatibility)
 *
 * Service for managing pipeline state.
 * Maintained for compatibility during transition to 3-domain architecture.
 */
export interface PipelineState {
  readonly phase:
    | "initialization"
    | "processing"
    | "aggregation"
    | "rendering"
    | "completed"
    | "error";
  readonly kind:
    | "initialization"
    | "processing"
    | "aggregation"
    | "rendering"
    | "completed"
    | "error"; // Alias for phase for compatibility
  readonly progress: number; // 0-100
  readonly currentOperation?: string;
  readonly startTime: Date;
  readonly endTime?: Date;
  readonly error?: string;
}

// Legacy compatibility aliases
export type PipelineExecutionState = PipelineState;

export interface PipelineConfiguration {
  readonly inputPattern: string;
  readonly schemaPath: string;
  readonly templatePath?: string;
  readonly outputPath?: string;
  readonly parallel?: boolean;
  readonly parallelProcessing?: boolean;
  readonly maxWorkers?: number;
  readonly maxConcurrency?: number;
  readonly enableJMESPath?: boolean;
  readonly mode?: "sequential" | "parallel" | "adaptive";
}

export interface StateTransitionEvent {
  readonly kind?: "state-transition";
  readonly fromPhase: PipelineState["phase"];
  readonly toPhase: PipelineState["phase"];
  readonly timestamp: Date;
  readonly metadata?: Record<string, unknown>;
}

export class PipelineStateService {
  private state: PipelineState;

  constructor() {
    this.state = {
      phase: "initialization",
      kind: "initialization",
      progress: 0,
      startTime: new Date(),
    };
  }

  static create(): Result<
    PipelineStateService,
    DomainError & { message: string }
  > {
    return ok(new PipelineStateService());
  }

  /**
   * Update pipeline state
   */
  updateState(
    updates: Partial<PipelineState>,
  ): Result<void, DomainError & { message: string }> {
    this.state = {
      ...this.state,
      ...updates,
      // Sync kind with phase for compatibility
      kind: updates.phase || this.state.phase,
    };

    return ok(void 0);
  }

  /**
   * Get current pipeline state
   */
  getState(): PipelineState {
    return { ...this.state };
  }

  /**
   * Mark pipeline as completed
   */
  complete(): Result<void, DomainError & { message: string }> {
    return this.updateState({
      phase: "completed",
      progress: 100,
      endTime: new Date(),
    });
  }

  /**
   * Mark pipeline as failed
   */
  fail(error: string): Result<void, DomainError & { message: string }> {
    return this.updateState({
      phase: "error",
      error,
      endTime: new Date(),
    });
  }

  /**
   * Reset pipeline state
   */
  reset(): Result<void, DomainError & { message: string }> {
    this.state = {
      phase: "initialization",
      kind: "initialization",
      progress: 0,
      startTime: new Date(),
    };
    return ok(void 0);
  }

  /**
   * Transition to a new phase
   */
  transition(
    toPhase: PipelineState["phase"],
  ): Result<void, DomainError & { message: string }>;
  transition(
    event: StateTransitionEvent,
  ): Result<void, DomainError & { message: string }>;
  transition(
    toPhaseOrEvent: PipelineState["phase"] | StateTransitionEvent,
  ): Result<void, DomainError & { message: string }> {
    if (typeof toPhaseOrEvent === "string") {
      return this.updateState({
        phase: toPhaseOrEvent,
      });
    } else {
      return this.updateState({
        phase: toPhaseOrEvent.toPhase,
      });
    }
  }

  /**
   * Update progress
   */
  updateProgress(
    progress: number,
    currentOperation?: string,
  ): Result<void, DomainError & { message: string }> {
    return this.updateState({
      progress: Math.min(100, Math.max(0, progress)),
      currentOperation,
    });
  }

  /**
   * Move to next phase
   */
  nextPhase(
    phase: PipelineState["phase"],
  ): Result<void, DomainError & { message: string }> {
    return this.updateState({ phase });
  }

  /**
   * Get current state for compatibility
   */
  getCurrentState(): PipelineState {
    return this.getState();
  }

  /**
   * Check if current state is terminal
   */
  isTerminal(): boolean {
    return this.state.phase === "completed" || this.state.phase === "error";
  }

  /**
   * Check if pipeline can proceed to next phase
   */
  canProceed(): boolean {
    return !this.isTerminal();
  }

  /**
   * Get transition log (stub for compatibility)
   */
  getTransitionLog(): StateTransitionEvent[] {
    // Basic implementation - in a full system, this would track all transitions
    return [];
  }

  /**
   * Get state history (compatibility method)
   */
  getStateHistory(): {
    from: string;
    to: string;
    event: string;
    timestamp: Date;
  }[] {
    // Convert StateTransitionEvent[] to expected format
    return this.getTransitionLog().map((event) => ({
      from: event.fromPhase,
      to: event.toPhase,
      event: event.kind || "state-transition",
      timestamp: event.timestamp,
    }));
  }
}
