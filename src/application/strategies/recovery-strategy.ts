import { err, ok, Result } from "../../domain/shared/types/result.ts";
import { DomainError } from "../../domain/shared/types/errors.ts";

/**
 * Recovery Strategy (Legacy Compatibility)
 *
 * Basic error recovery strategy for maintaining compatibility.
 * In the new 3-domain architecture, error handling is distributed across domains.
 */
export interface RecoveryContext {
  readonly operation?: string;
  readonly operationId?: string;
  readonly error?: DomainError & { message: string };
  readonly attemptCount: number;
  readonly maxAttempts?: number;
  readonly metadata?: Record<string, unknown>;
  readonly verbosityMode?: {
    readonly kind: "verbose" | "normal";
  };
}

export class RecoveryStrategy {
  static createDefault(): Result<
    RecoveryStrategy,
    DomainError & { message: string }
  > {
    return ok(new RecoveryStrategy());
  }

  static create(): Result<RecoveryStrategy, DomainError & { message: string }> {
    return ok(new RecoveryStrategy());
  }

  /**
   * Attempt recovery from error
   */
  recover(
    error?: DomainError & { message: string },
    context?: RecoveryContext,
  ): Result<void, DomainError & { message: string }> {
    // Basic recovery - log and continue
    const operation = context?.operation || "unknown operation";
    const errorMsg = error?.message || context?.error?.message ||
      "unknown error";
    console.warn(`Recovery attempted for ${operation}: ${errorMsg}`);

    // For most errors, we cannot recover, so return void to indicate completion
    return ok(void 0);
  }

  /**
   * Check if error is recoverable
   */
  isRecoverable(_error: DomainError & { message: string }): boolean {
    // Basic check - most errors are not recoverable in our current design
    return false;
  }

  /**
   * Get strategy type information
   */
  getStrategyType(): { kind: string; description: string } {
    return {
      kind: "default",
      description: "Default recovery strategy for basic error handling",
    };
  }

  /**
   * Get maximum number of recovery attempts
   */
  getMaxAttempts(): number {
    return 3; // Default max attempts
  }

  /**
   * Get recovery strategy priority
   */
  getPriority(): number {
    return 1; // Default priority
  }
}

export class RecoveryStrategyFactory {
  static create(): Result<
    RecoveryStrategyFactory,
    DomainError & { message: string }
  > {
    return ok(new RecoveryStrategyFactory());
  }

  createStrategy(): Result<
    RecoveryStrategy,
    DomainError & { message: string }
  > {
    return RecoveryStrategy.create();
  }

  /**
   * Create multiple recovery strategies
   */
  static createStrategies(): Result<
    RecoveryStrategy[],
    DomainError & { message: string }
  > {
    const defaultStrategy = RecoveryStrategy.createDefault();
    if (!defaultStrategy.ok) {
      return err(defaultStrategy.error);
    }
    return ok([defaultStrategy.data]);
  }

  /**
   * Find a suitable recovery strategy for the given context
   */
  static findStrategy(
    _contextOrError: RecoveryContext | DomainError & { message: string },
    _strategies?: unknown,
  ): Result<RecoveryStrategy, DomainError & { message: string }> {
    // For now, always return the default strategy regardless of input
    return RecoveryStrategy.createDefault();
  }
}
